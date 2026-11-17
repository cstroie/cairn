import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../js/core/tide.js';

const at = (y, mo, d, h = 0, mi = 0) => T.minuteOf(new Date(y, mo - 1, d, h, mi));

test('the count starts on 31 December 1977', () => {
    assert.equal(at(1977, 12, 31), 0);
    assert.equal(at(1978, 1, 1, 0, 1), 1441);
    const f = T.fieldsOf(at(2026, 11, 16, 9, 30));
    assert.deepEqual([f.year, f.month, f.day, f.hour, f.minute], [2026, 10, 16, 9, 30]);
});

test('a tide is 745 minutes, high at 0 and low at 372', () => {
    const M = 1000 * T.TIDE;
    assert.equal(T.tideOf(M), 1000);
    assert.equal(T.phaseOf(M + 372), 372);
    assert.ok(T.level(M) > T.level(M + 100));
    assert.ok(T.level(M + 372) < T.level(M + 300));
    assert.ok(T.level(M + 372) < 0.2 && T.level(M) > 0.8);
    assert.equal(T.flooding(M + 100), false);
    assert.equal(T.flooding(M + 500), true);
    for (let m = 0; m < 3 * T.TIDE; m += 7) assert.ok(T.level(M + m) >= 0 && T.level(M + m) <= 1);
});

test('the next waters alternate and come in order', () => {
    const M = 1000 * T.TIDE + 10;
    const w = T.nextWaters(M, 4);
    assert.deepEqual(w.map(x => x.high), [false, true, false, true]);
    assert.equal(w[0].M, 1000 * T.TIDE + 372);
    assert.equal(w[1].M, 1001 * T.TIDE);
    assert.equal(T.nextWaters(1000 * T.TIDE + 400, 1)[0].high, true);
});

test('the moon: full on 5 November 2025, new on 20 November 2025', () => {
    const full = T.moonPhase(at(2025, 11, 5, 13));
    const dark = T.moonPhase(at(2025, 11, 20, 7));
    assert.ok(Math.abs(full - 0.5) < 0.03, `full ${full}`);
    assert.ok(dark < 0.03 || dark > 0.97, `new ${dark}`);
    assert.ok(T.springness(at(2025, 11, 5, 13)) > 0.9);
    assert.ok(T.springness(at(2025, 11, 12, 13)) < 0.2);
});

test('seasons start on 1 March, June, September, December', () => {
    assert.equal(T.seasonOf(at(2026, 2, 28)), 0);
    assert.equal(T.seasonOf(at(2026, 3, 1)), 1);
    assert.equal(T.seasonOf(at(2026, 6, 1)), 2);
    assert.equal(T.seasonOf(at(2026, 9, 1)), 3);
    assert.equal(T.seasonOf(at(2026, 12, 1)), 0);
});

test('the sun is up at noon and down at midnight, longer in June', () => {
    assert.ok(T.sun(at(2026, 6, 21, 12, 30)).alt > 0.95);
    assert.ok(T.sun(at(2026, 6, 21, 0, 30)).alt < -0.9);
    assert.equal(T.sun(at(2026, 6, 21, 20)).up, true);
    assert.equal(T.sun(at(2026, 12, 21, 20)).up, false);
});

test('the weather is the same for the same moment, and in range', () => {
    const M = at(2026, 11, 16, 9);
    assert.deepEqual(T.weather(M), T.weather(M));
    for (let i = 0; i < 2000; i++) {
        const w = T.weather(M + i * 97);
        for (const k of ['wind', 'cloud', 'rain', 'fog']) assert.ok(w[k] >= 0 && w[k] <= 1, k);
    }
    assert.equal(T.env(M, T.tideOf(M)).storm, true);
    assert.equal(T.env(M, 5).storm, false);
});

test('the next great low water is a spring tide in daylight', () => {
    const M = T.minuteOf(new Date(2026, 5, 1, 9, 0));
    const b = T.bestLow(M);
    assert.ok(b > M && b < M + 16 * T.DAY);
    assert.equal(T.phaseOf(b), T.LOW);
    assert.ok(T.springness(b) >= 0.8 && T.sun(b).alt > 0.05);
});
