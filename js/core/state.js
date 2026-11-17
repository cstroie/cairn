/*
 * state.js: the save. One JSON document: the rocks, the generator, the
 * last tide simulated, the journal, what has been found, the settings.
 * Nothing here touches the browser: `store` is anything with getItem and
 * setItem.
 */
import { simTide, catchUp, trample } from './sim.js';
import { tideOf } from './tide.js';
import { hash } from './rng.js';

export const KEY = 'cairn.save';
const OLD_KEY = 'lowwater.save';                  // the save of the game when it was called Low Water
export const VERSION = 3;
export const NICKS = 30, LEDGE_NICKS = 6;   // how many shore names a language has to offer
export const ROCKS = 13;             // ten, and three on the Deep Ledge
export const ORDER = [4, 5, 3, 6, 2, 7, 1, 8, 0, 9];     // the order the sand uncovers them
export const START_ROCKS = 4, START_STONES = 3;
export const VISIT_GAP = 10;        // minutes hidden after which you have left
const PRE_AGE = 36;                 // tides a new pool has already seen

/** Give every rock a shore name of its own (a number in the language's list), from the seed. */
export function christen(st) {
    const draw = (n, salt) => Array.from({ length: n }, (_, k) => k).sort((a, b) => hash(st.seed, salt + a) - hash(st.seed, salt + b));
    const main = draw(NICKS, 500), ledge = draw(LEDGE_NICKS, 700);
    st.rocks.forEach((r, i) => { if (r.nick == null) r.nick = i < 10 ? main[i] : ledge[i - 10]; });
}

export function newPool(seed, M, settings) {
    const st = {
        v: VERSION, seed: seed >>> 0, rng: seed >>> 0,
        born: Math.floor(M), last: tideOf(M) - PRE_AGE - 1, seen: Math.floor(M), away: null,
        stones: START_STONES, lastStorm: -1, ledge: false,
        rocks: Array.from({ length: ROCKS }, (_, i) => ({ sp: 0, g: 0, calm: 0, cairn: false, name: '', on: ORDER.indexOf(i) >= 0 && ORDER.indexOf(i) < START_ROCKS })),
        journal: [], jseq: 0, album: {}, beach: null, bottles: 0, bottleDay: -1,
        settings: Object.assign({ lang: '', sound: true, bell: true, alert: false }, settings)
    };
    christen(st);
    for (let n = st.last + 1; n <= tideOf(M); n++) simTide(st, n);
    st.journal = [];
    st.lastStorm = -1;
    for (const r of st.rocks) r.calm = Math.min(r.calm, 6);
    return st;
}

/** Bring an older save up to this version; null when it is not a save. */
export function migrate(st) {
    if (!st || typeof st !== 'object' || !Array.isArray(st.rocks) || typeof st.last !== 'number') return null;
    if (st.v > VERSION) return null;
    if (st.v < 2) {                                         // version 1: ten rocks, all bare of sand, five stones
        st.rocks.forEach(r => { r.on = true; });
        while (st.rocks.length < ROCKS) st.rocks.push({ sp: 0, g: 0, calm: 0, cairn: false, name: '', on: false });
        Object.assign(st, { ledge: false, beach: null, bottles: 0, bottleDay: -1 });
        delete st.open;
    }
    if (st.v < 3) christen(st);                             // version 2: the rocks had no names of their own
    st.v = VERSION;
    st.journal = st.journal || [];
    st.album = st.album || {};
    st.settings = Object.assign({ lang: '', sound: true, bell: true, alert: false }, st.settings);
    return st;
}

export function load(store) {
    try { return migrate(JSON.parse(store.getItem(KEY) ?? store.getItem(OLD_KEY))); } catch (e) { return null; }
}

export function save(store, st) {
    try { store.setItem(KEY, JSON.stringify(st)); return true; } catch (e) { return false; }
}

/**
 * Coming back. If the page was away for more than VISIT_GAP minutes you
 * had left: the open rocks are walked (at the time of leaving), then the
 * tides in between are simulated. Returns what the welcome needs.
 */
export function arrive(st, nowMs, M) {
    const res = { walked: false, stepped: [], tides: 0, awayMin: 0, since: st.jseq || 0,
        before: st.rocks.map(r => ({ sp: r.sp, g: r.g })) };
    if (st.away != null) {
        res.awayMin = Math.max(0, (nowMs - st.away) / 60000);
        if (res.awayMin > VISIT_GAP) { res.stepped = trample(st); res.walked = true; }
    }
    res.tides = catchUp(st, tideOf(M));
    st.seen = Math.floor(M);
    st.away = nowMs;
    return res;
}

/** The journal entries written after sequence number `since`. */
export const entriesSince = (st, since) => st.journal.filter(e => e.n > since);
