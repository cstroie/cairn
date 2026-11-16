import test from 'node:test';
import assert from 'node:assert/strict';
import { SP, EV, CAP, simTide, catchUp, trample, toggleCairn, stonesLeft, stage } from '../js/core/sim.js';
import { newPool, arrive, migrate, save, load, entriesSince, VISIT_GAP } from '../js/core/state.js';
import { TIDE, tideOf, seasonOfTide } from '../js/core/tide.js';

const M0 = 25_000_000;              // a minute in 2025
const bare = (seed = 1) => {
    const st = newPool(seed, M0);
    for (const r of st.rocks) Object.assign(r, { sp: 0, g: 0, calm: 0, cairn: false });
    return st;
};
const tideIn = season => { let n = tideOf(M0); while (seasonOfTide(n) !== season) n++; return n; };

test('the same seed gives the same pool', () => {
    const a = newPool(42, M0), b = newPool(42, M0), c = newPool(43, M0);
    assert.deepEqual(a, b);
    assert.notDeepEqual(a.rocks, c.rocks);
    catchUp(a, a.last + 500); catchUp(b, b.last + 500);
    assert.deepEqual(a, b);
});

test('a new pool is alive, with an empty journal', () => {
    const st = newPool(7, M0);
    assert.equal(st.rocks.length, 10);
    assert.ok(st.rocks.some(r => r.sp !== SP.BARE));
    assert.equal(st.journal.length, 0);
    assert.equal(st.last, tideOf(M0));
});

test('growth stays in 0-255 and species are valid over many tides', () => {
    const st = newPool(3, M0);
    for (let i = 0; i < 5000; i++) {
        simTide(st, st.last + 1);
        for (const r of st.rocks) {
            assert.ok(r.g >= 0 && r.g <= 255 && r.sp >= 0 && r.sp <= 8 && r.calm <= 255);
            assert.ok(stage(r.g) <= 3);
        }
    }
    assert.ok(st.journal.length <= 200);
});

test('storms are as common as the season says', () => {
    const want = [14, 7, 4, 12];
    for (let season = 0; season < 4; season++) {
        const st = bare(season + 11);
        const n = tideIn(season);
        let storms = 0;
        const N = 40000;
        for (let i = 0; i < N; i++) { st.lastStorm = -1; st.journal.length = 0; simTide(st, n); if (st.lastStorm === n) storms++; }
        const p = storms / N, q = want[season] / 256;
        assert.ok(Math.abs(p - q) < 0.006, `season ${season}: ${p} vs ${q}`);
    }
});

test('an anemone needs twelve days of quiet, a sea star eight', () => {
    const run = (sp, g, calm) => {
        let seen = 0;
        for (let seed = 1; seed <= 300; seed++) {
            const st = bare(seed);
            const n = tideIn(2);
            Object.assign(st.rocks[0], { sp, g, calm });
            simTide(st, n);
            if (st.rocks[0].sp === SP.ANEM || st.rocks[0].sp === SP.STAR) seen++;
        }
        return seen;
    };
    assert.equal(run(SP.BARN, 200, 22), 0);          // calm becomes 23: not yet
    assert.ok(run(SP.BARN, 200, 23) > 0);
    assert.equal(run(SP.MUSS, 200, 14), 0);
    assert.ok(run(SP.MUSS, 200, 15) > 0);
    assert.equal(run(SP.BARN, 100, 200), 0);         // not grown enough
});

test('winter halves growth, summer adds a quarter', () => {
    const g = season => { const st = bare(5); st.open = 1; Object.assign(st.rocks[0], { sp: SP.MUSS, g: 20 }); simTide(st, tideIn(season)); return st.rocks[0].g; };
    const noStorm = season => { for (let s = 1; s < 50; s++) { const st = bare(s); st.open = 1; Object.assign(st.rocks[0], { sp: SP.MUSS, g: 20 }); simTide(st, tideIn(season)); if (st.lastStorm < 0) return st.rocks[0].g; } };
    assert.equal(noStorm(0), 24);
    assert.equal(noStorm(1), 28);
    assert.equal(noStorm(2), 30);
    assert.ok(g(3) <= 28);
});

test('walking out: a quarter and ten, visitors go, cairns are spared', () => {
    const st = bare();
    Object.assign(st.rocks[0], { sp: SP.BARN, g: 200, calm: 30 });
    Object.assign(st.rocks[1], { sp: SP.BARN, g: 200, calm: 30, cairn: true });
    Object.assign(st.rocks[2], { sp: SP.CRAB, g: 100, calm: 9 });
    Object.assign(st.rocks[3], { sp: SP.KELP, g: 25, calm: 9 });
    Object.assign(st.rocks[4], { sp: SP.FILM, g: 20, calm: 9 });
    const stepped = trample(st);
    assert.deepEqual(stepped, [0, 2, 3, 4]);
    assert.deepEqual([st.rocks[0].g, st.rocks[0].calm], [140, 0]);
    assert.deepEqual([st.rocks[1].g, st.rocks[1].calm], [200, 30]);
    assert.equal(st.rocks[2].sp, SP.BARE);
    assert.equal(st.rocks[3].sp, SP.BARE);
    assert.deepEqual([st.rocks[4].sp, st.rocks[4].g], [SP.FILM, 0]);
    assert.deepEqual(st.journal.map(e => [e.ev, e.rock, e.sp]), [[EV.STEP, 3, SP.KELP]]);
});

test('five stones, no more', () => {
    const st = bare();
    for (let i = 0; i < 5; i++) assert.equal(toggleCairn(st, i), true);
    assert.equal(stonesLeft(st), 0);
    assert.equal(toggleCairn(st, 5), false);
    assert.equal(toggleCairn(st, 0), true);
    assert.equal(stonesLeft(st), 1);
});

test('catching up is capped', () => {
    const st = newPool(9, M0);
    assert.equal(catchUp(st, st.last), 0);
    assert.equal(catchUp(st, st.last + 14), 14);
    const far = st.last + 5000;
    assert.equal(catchUp(st, far), CAP);
    assert.equal(st.last, far);
});

test('arriving: a short absence is free, a long one walks the rocks', () => {
    const st = newPool(21, M0);
    Object.assign(st.rocks[0], { sp: SP.BARN, g: 200, calm: 5, cairn: false });
    const t0 = 1_000_000_000_000;
    let res = arrive(st, t0, M0);
    assert.equal(res.walked, false);
    res = arrive(st, t0 + 5 * 60000, M0 + 5);
    assert.equal(res.walked, false);
    assert.equal(st.rocks[0].g, 200);
    const since = st.jseq;
    res = arrive(st, t0 + (VISIT_GAP + 6) * 60000 + 7 * 1440 * 60000, M0 + 7 * 1440);
    assert.equal(res.walked, true);
    assert.ok(res.stepped.includes(0));
    assert.ok(res.tides === 13 || res.tides === 14);
    assert.equal(res.since, since);
    assert.equal(entriesSince(st, since).length, st.journal.length);
    assert.equal(res.before[0].g, 200);
});

test('the journal keeps the name the rock had then', () => {
    const st = bare();
    st.rocks[2].name = 'Old Tom';
    Object.assign(st.rocks[2], { sp: SP.KELP, g: 20 });
    trample(st);
    st.rocks[2].name = 'New';
    assert.equal(st.journal[0].name, 'Old Tom');
});

test('the save goes round, and rubbish is refused', () => {
    const mem = new Map();
    const store = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    assert.equal(load(store), null);
    const st = newPool(77, M0);
    assert.equal(save(store, st), true);
    assert.deepEqual(load(store), st);
    assert.equal(migrate({ v: 99, rocks: [], last: 1 }), null);
    assert.equal(migrate('x'), null);
    mem.set('lowwater.save', '{oops');
    assert.equal(load(store), null);
});
