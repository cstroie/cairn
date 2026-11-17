import test from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../js/core/world.js';
import { SP, EV, catchUp } from '../js/core/sim.js';
import { newPool } from '../js/core/state.js';
import { env, minuteOf, tideOf, TIDE, LOW, springness } from '../js/core/tide.js';

const M0 = 25_000_000;
const at = (y, mo, d, h = 0, mi = 0) => minuteOf(new Date(y, mo - 1, d, h, mi));

test('the guide has fifty-two pages, each named once', () => {
    assert.equal(W.ALBUM.length, 52);
    assert.equal(new Set(W.ALBUM.map(a => a.id)).size, 52);
    assert.equal(W.UNDER.length, 6);
});

test('looking at the pool writes the pages of what lives there, once', () => {
    const st = newPool(5, M0);
    Object.assign(st.rocks[4], { sp: SP.KELP, g: 130 });
    Object.assign(st.rocks[5], { sp: SP.CRAB, g: 100 });
    Object.assign(st.rocks[0], { sp: SP.ANEM, g: 255 });     // still under the sand: not seen
    const e = env(M0, -1);
    const news = W.observe(st, e, new Set());
    assert.ok(news.includes('sp3.2') && news.includes('sp7'));
    assert.ok(!news.includes('sp5.3'));
    assert.deepEqual(W.observe(st, e, new Set()), []);
    assert.equal(W.found(st), news.length);
    assert.equal(W.discover(st, 'nonsense'), false);
});

test('pages uncover rocks in order, then stones, then the ledge', () => {
    const st = newPool(5, M0);
    st.album = {};
    const ids = W.ALBUM.map(a => a.id);
    let on = 4;
    for (let n = 1; n <= 50; n++) {
        W.discover(st, ids[n - 1]);
        const res = W.unlock(st);
        on += res.rocks.length;
        assert.equal(st.rocks.slice(0, 10).filter(r => r.on).length, 4 + W.ROCK_AT.filter(k => n >= k).length);
        assert.equal(st.stones, 3 + W.STONE_AT.filter(k => n >= k).length);
        assert.equal(st.ledge, n >= W.LEDGE_AT);
        assert.equal(st.rocks.slice(10).every(r => r.on), n >= W.LEDGE_AT);
    }
    assert.equal(on, 10);
    assert.equal(st.stones, 6);
    assert.equal(W.nextUnlock(st), null);
    assert.equal(st.journal.filter(e => e.ev === EV.UNCOVER).length, 7);
    const fresh = newPool(5, M0); fresh.album = {};
    assert.deepEqual(W.nextUnlock(fresh), { at: 2, kind: 'rock', left: 2 });
});

test('surprises are the same for the same moment, and keep to their hours', () => {
    const seen = new Set();
    for (let i = 0; i < 20000; i++) {
        const M = at(2026, 1, 1) + i * 53;
        const e = env(M, -1), s = W.surprises(e);
        assert.deepEqual([...s], [...W.surprises(e)]);
        for (const id of s) seen.add(id);
        if (s.has('wader')) assert.ok(e.level < 0.3 && e.sun.alt > 0.1);
        if (s.has('octopus') || s.has('glow') || s.has('shooting')) assert.ok(e.sun.alt < -0.25);
        if (s.has('seal') || s.has('gull') || s.has('dolphin')) assert.ok(e.sun.alt > 0.1);
        if (s.has('rainbow')) assert.ok(e.sun.up && e.weather.rain > 0);
    }
    for (const id of ['fish', 'shrimp', 'gull', 'wader', 'seal', 'dolphin', 'octopus', 'jelly', 'glow', 'rainbow', 'shooting', 'lighthouse'])
        assert.ok(seen.has(id), `${id} never comes`);
    assert.equal(W.surprises(env(M0, tideOf(M0))).has('gull'), false);       // not in a storm
});

test('a spring low water and a full moon can be seen in a year', () => {
    const st = newPool(5, M0);
    let spring = false, moon = false;
    for (let M = at(2026, 1, 1); M < at(2027, 1, 1); M += 11) {
        const news = W.observe(st, env(M, -1), new Set());
        spring = spring || news.includes('springtide');
        moon = moon || news.includes('fullmoon');
    }
    assert.ok(spring && moon);
    const low = (tideOf(M0) + 3) * TIDE + LOW;
    assert.ok(springness(low) >= 0);
});

test('a storm leaves things on the sand; picking them up is remembered', () => {
    const st = newPool(5, M0);
    const e = env(M0, -1);
    st.lastStorm = e.tide - 1;
    assert.equal(W.tideLine(st, e), true);
    const n = st.beach.items.filter(i => i.k !== 'bottle').length;
    assert.ok(n >= 2 && n <= 4);
    W.tideLine(st, e);
    assert.equal(st.beach.items.filter(i => i.k !== 'bottle').length, n);
    const kinds = new Set();
    st.beach.items.forEach((it, k) => { const r = W.pickUp(st, k); kinds.add(r.kind); assert.equal(W.pickUp(st, k), null); });
    assert.ok(kinds.has('rescue') || kinds.has('clean'));
    assert.ok(W.has(st, 'rescue') || W.has(st, 'cleanup'));
    const later = env(M0 + 8 * TIDE, -1);
    st.bottleDay = Math.floor(later.M / 1440);
    W.tideLine(st, later);
    assert.equal(st.beach, null);
});

test('a bottle comes some days, and each holds the next message', () => {
    const st = newPool(5, M0);
    let bottles = 0;
    for (let d = 0; d < 400; d++) {
        const e = env(M0 + d * 1440, -1);
        W.tideLine(st, e);
        const k = st.beach ? st.beach.items.findIndex(i => i.k === 'bottle' && !i.done) : -1;
        if (k >= 0) { assert.equal(W.pickUp(st, k).message, bottles); bottles++; }
    }
    assert.ok(bottles > 20 && bottles < 90, `${bottles} bottles in 400 days`);
    assert.ok(W.has(st, 'bottle'));
});

test('looking under a stone costs the quiet, and a cairn forbids it', () => {
    const st = newPool(5, M0);
    const i = 4;
    st.rocks[i].calm = 30;
    const r = W.lookUnder(st, i);
    assert.ok(W.UNDER.includes(r.id) && r.fresh);
    assert.equal(st.rocks[i].calm, 0);
    assert.deepEqual(W.lookUnder(st, i), { id: null });
    st.rocks[5].cairn = true; st.rocks[5].calm = 30;
    assert.equal(W.lookUnder(st, 5), null);
    assert.equal(st.rocks[5].calm, 30);
    assert.equal(W.lookUnder(st, 0), null);                  // under the sand
    const found = new Set();
    for (let k = 0; k < 60; k++) { catchUp(st, st.last + 1); const x = W.lookUnder(st, i); if (x.id) found.add(x.id); }
    assert.equal(found.size, 6);
});
