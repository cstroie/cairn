import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, setLang, t, duration, sentence } from '../js/i18n.js';
import { EVENTS, SP } from '../js/core/sim.js';

test('every language has the same keys, of the same kind', () => {
    const keys = Object.keys(LANGS.en).sort();
    for (const [code, lang] of Object.entries(LANGS)) {
        assert.deepEqual(Object.keys(lang).sort(), keys, code);
        for (const k of keys) {
            assert.equal(typeof lang[k], typeof LANGS.en[k], `${code}.${k}`);
            if (Array.isArray(LANGS.en[k])) assert.equal(lang[k].length, LANGS.en[k].length, `${code}.${k}`);
        }
        assert.deepEqual(Object.keys(lang.ev).sort(), [...EVENTS].sort(), code);
    }
});

test('every journal sentence can be said in every language', () => {
    const cases = { storm: [0], torn: [2, 3, 4], settle: [2, 3, 4], bloom: [5], graze: [8], ate: [6], died: [2, 3, 4, 5], left: [6, 7, 8], visit: [7], step: [2, 3, 4, 5] };
    for (const code of Object.keys(LANGS)) {
        setLang(code);
        for (const [evName, list] of Object.entries(cases)) for (const sp of list) {
            const s = sentence({ evName, sp }, 'X');
            assert.ok(s.length > 8 && !s.includes('undefined'), `${code} ${evName} ${sp}: ${s}`);
        }
    }
    assert.equal(SP.URCH, 8);
});

test('durations and plurals', () => {
    setLang('en');
    assert.equal(duration(5), '5 min');
    assert.equal(duration(135), '2 h 15 min');
    assert.equal(duration(1440), '1 day');
    assert.equal(duration(7 * 1440), '7 days');
    assert.equal(t('rockN', { n: 3 }), 'Rock 3');
    setLang('ro');
    assert.equal(duration(1440), 'o zi');
    assert.equal(duration(7 * 1440), '7 zile');
    assert.equal(duration(21 * 1440), '21 de zile');
    assert.equal(LANGS.ro.tideCount(14), '14 maree');
    setLang('xx');
    assert.equal(t('title'), 'Low Water');
});
