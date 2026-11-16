/*
 * state.js: the save. One JSON document: the rocks, the generator, the
 * last tide simulated, the journal, what has been found, the settings.
 * Nothing here touches the browser: `store` is anything with getItem and
 * setItem.
 */
import { simTide, catchUp, trample } from './sim.js';
import { tideOf } from './tide.js';

export const KEY = 'lowwater.save';
export const VERSION = 1;
export const ROCKS = 10;
export const VISIT_GAP = 10;        // minutes hidden after which you have left
const PRE_AGE = 36;                 // tides a new pool has already seen

export function newPool(seed, M, settings) {
    const st = {
        v: VERSION, seed: seed >>> 0, rng: seed >>> 0,
        born: Math.floor(M), last: tideOf(M) - PRE_AGE - 1, seen: Math.floor(M), away: null,
        open: ROCKS, stones: 5, lastStorm: -1,
        rocks: Array.from({ length: ROCKS }, () => ({ sp: 0, g: 0, calm: 0, cairn: false, name: '' })),
        journal: [], jseq: 0, album: {},
        settings: Object.assign({ lang: '', sound: true, bell: true, alert: false }, settings)
    };
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
    st.v = VERSION;
    st.journal = st.journal || [];
    st.album = st.album || {};
    st.settings = Object.assign({ lang: '', sound: true, bell: true, alert: false }, st.settings);
    return st;
}

export function load(store) {
    try { return migrate(JSON.parse(store.getItem(KEY))); } catch (e) { return null; }
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
