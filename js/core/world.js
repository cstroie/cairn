/*
 * world.js: the game around the pool. What can be found (the field
 * guide), what finding it uncovers (more rocks, more cairn stones, the
 * Deep Ledge), the surprises of a day, what a storm leaves on the sand,
 * and what the hand may do: look under a stone, carry a stranded thing
 * back, clear the wrack. Pure: nothing here touches the browser.
 */
import { rnd, hash } from './rng.js';
import { SP, EV, LEDGE, log, stage, grows } from './sim.js';
import { ORDER, START_STONES } from './state.js';
import { dayOf } from './tide.js';

/* ---------- the field guide ---------- */

const GROWERS = [SP.FILM, SP.BARN, SP.KELP, SP.MUSS, SP.ANEM];
export const ALBUM = [
    ...GROWERS.flatMap(sp => [0, 1, 2, 3].map(k => ({ id: `sp${sp}.${k}`, kind: 'life', sp, stage: k }))),
    ...[SP.STAR, SP.CRAB, SP.URCH].map(sp => ({ id: `sp${sp}`, kind: 'life', sp })),
    ...[SP.SPONGE, SP.NUDI, SP.BRIT].map(sp => ({ id: `sp${sp}`, kind: 'ledge', sp })),
    ...['fish', 'shrimp', 'gull', 'wader', 'heron', 'seal', 'dolphin', 'octopus', 'jelly'].map(id => ({ id, kind: 'shore' })),
    ...['shorecrab', 'blenny', 'limpet', 'winkle', 'seaslug', 'eggs'].map(id => ({ id, kind: 'under' })),
    ...['storm', 'springtide', 'fullmoon', 'lighthouse', 'glow', 'rainbow', 'shooting', 'greenflash', 'bottle', 'rescue', 'cleanup'].map(id => ({ id, kind: 'wonder' }))
];
export const UNDER = ALBUM.filter(a => a.kind === 'under').map(a => a.id);
const IDS = new Set(ALBUM.map(a => a.id));

export const found = st => Object.keys(st.album).filter(id => IDS.has(id)).length;
export const has = (st, id) => !!st.album[id];

/** The page of the guide for what lives on a rock. */
export const pageOf = r => (r.sp === SP.BARE ? null : GROWERS.includes(r.sp) ? `sp${r.sp}.${stage(r.g)}` : `sp${r.sp}`);

/** Write a page in the guide. Returns true when it is new. */
export function discover(st, id, tide = st.last) {
    if (!IDS.has(id) || st.album[id]) return false;
    st.album[id] = tide;
    return true;
}

/* ---------- what finding uncovers ---------- */

export const ROCK_AT = [2, 4, 6, 9, 12, 16];      // pages found: the sand uncovers another rock
export const STONE_AT = [3, 8, 14];               // another cairn stone washes up
export const LEDGE_AT = 24;                       // the Deep Ledge shows at a spring low water

/** Give what the pages found have earned. Returns { rocks: [i], stones, ledge }. */
export function unlock(st) {
    const n = found(st), res = { rocks: [], stones: 0, ledge: false };
    const due = 4 + ROCK_AT.filter(k => n >= k).length;
    for (const i of ORDER.slice(0, due)) {
        if (st.rocks[i].on) continue;
        st.rocks[i].on = true;
        res.rocks.push(i);
        log(st, st.last, EV.UNCOVER, i, 0);
    }
    const stones = START_STONES + STONE_AT.filter(k => n >= k).length;
    if (stones > st.stones) { res.stones = stones - st.stones; st.stones = stones; }
    if (n >= LEDGE_AT && !st.ledge) {
        st.ledge = true; res.ledge = true;
        for (let i = LEDGE; i < st.rocks.length; i++) st.rocks[i].on = true;
        log(st, st.last, EV.UNCOVER, -1, 0);
    }
    return res;
}

/** How far to the next thing: { next, kind } or null when all is given. */
export function nextUnlock(st) {
    const n = found(st);
    const all = [...ROCK_AT.map(k => [k, 'rock']), ...STONE_AT.map(k => [k, 'stone']), [LEDGE_AT, 'ledge']].sort((a, b) => a[0] - b[0]);
    const nx = all.find(([k]) => k > n);
    return nx ? { at: nx[0], kind: nx[1], left: nx[0] - n } : null;
}

/* ---------- the surprises of a moment ---------- */

/** What is about just now, beyond the pool's own life: a set of ids. */
export function surprises(env) {
    const out = new Set(), d = dayOf(env.M), h = env.fields.hours, w = env.weather;
    const night = env.sun.alt < -0.25, day = env.sun.alt > 0.1;
    const window = (salt, chance, hours) => {
        if (hash(d, salt) >= chance) return false;
        const start = 7 + hash(d, salt + 1) * 10;
        return h >= start && h < start + hours;
    };
    if (!env.storm) {
        if (day && env.level > 0.25) out.add('fish');
        if (env.level > 0.12) out.add('shrimp');
        if (day && w.rain < 0.5) out.add('gull');
        if (day && env.level < 0.3) out.add('wader');
        if (day && window(101, 0.35, 2.5)) out.add('seal');
        if (day && window(103, 0.15, 1.5)) out.add('dolphin');
        if (night && env.level > 0.55 && hash(env.tide, 104) < 0.35) out.add('octopus');
        if ((env.season === 2 || env.season === 3) && env.level > 0.5 && hash(env.tide, 105) < 0.35) out.add('jelly');
        if (night && env.season >= 2 && Math.abs(env.moon - 0.5) > 0.28 && w.cloud < 0.55 && hash(d, 106) < 0.6) out.add('glow');
        if (night && w.cloud < 0.5) out.add('shooting');
        if (h >= 5 && h < 9 && env.sun.up && env.level < 0.45 && hash(d, 108) < 0.5) out.add('heron');          // a heron, fishing at dawn
        if (!env.sun.up && env.sun.night < 0.012 && w.cloud < 0.3 && w.fog < 0.2 && hash(d, 107) < 0.4) out.add('greenflash');
    }
    if (env.sun.up && env.sun.alt < 0.75 && w.rain > 0.04 && w.rain < 0.7) out.add('rainbow');
    if (env.sun.alt < -0.1) out.add('lighthouse');
    return out;
}

/**
 * What is seen just by looking: the life on the rocks, a storm, a spring
 * low water, a full moon, and the sights of the sky. Returns the new pages.
 */
export function observe(st, env, about = surprises(env)) {
    const news = [];
    const see = id => { if (discover(st, id, env.tide)) news.push(id); };
    for (const r of st.rocks) if (r.on) { const id = pageOf(r); if (id) see(id); }
    if (env.storm) see('storm');
    if (env.spring > 0.85 && env.level < 0.06) see('springtide');
    if (env.sun.alt < -0.2 && Math.abs(env.moon - 0.5) < 0.035 && env.weather.cloud < 0.6) see('fullmoon');
    for (const id of ['lighthouse', 'glow', 'rainbow', 'shooting', 'greenflash']) if (about.has(id)) see(id);
    return news;
}

/* ---------- the sand after a storm, and the bottle ---------- */

const WRACK = ['strandedStar', 'strandedFish', 'driftwood', 'net'];

/** Keep the things on the sand up to date; returns true when something came. */
export function tideLine(st, env) {
    let came = false;
    if (st.beach && env.tide - st.beach.tide > 6) st.beach = null;          // the sea takes it back
    if (st.lastStorm >= 0 && env.tide - st.lastStorm <= 6 && (!st.beach || st.beach.tide < st.lastStorm)) {
        const n = 2 + Math.floor(hash(st.lastStorm, st.seed) * 3);
        st.beach = { tide: st.lastStorm, items: Array.from({ length: n }, (_, k) => ({
            k: WRACK[Math.floor(hash(st.lastStorm, k + 7) * WRACK.length)], x: 0.08 + 0.84 * hash(st.lastStorm, k + 40), done: false })) };
        came = true;
    }
    const d = dayOf(env.M);
    if (st.bottleDay !== d && hash(d, 107 + (st.seed & 255)) < 0.12) {       // a bottle, some days
        st.bottleDay = d;
        if (!st.beach) st.beach = { tide: env.tide, items: [] };
        if (!st.beach.items.some(i => i.k === 'bottle' && !i.done)) { st.beach.items.push({ k: 'bottle', x: 0.1 + 0.8 * hash(d, 108), done: false }); came = true; }
    }
    return came;
}

/**
 * Pick up thing k of the sand. Returns { kind, page, message } : a stranded
 * creature is carried back (rescue), wrack is cleared (clean), a bottle is
 * opened (message is its number).
 */
export function pickUp(st, k) {
    const it = st.beach && st.beach.items[k];
    if (!it || it.done) return null;
    it.done = true;
    if (it.k === 'bottle') { st.bottles = (st.bottles || 0) + 1; discover(st, 'bottle'); return { kind: 'bottle', message: st.bottles - 1 }; }
    if (it.k.startsWith('stranded')) {
        discover(st, 'rescue');
        log(st, st.last, EV.RESCUE, -1, it.k === 'strandedStar' ? SP.STAR : 0);
        return { kind: 'rescue', what: it.k };
    }
    discover(st, 'cleanup');
    log(st, st.last, EV.CLEAN, -1, 0);
    return { kind: 'clean', what: it.k };
}

/* ---------- under the stones ---------- */

/**
 * Lift the weed and look under rock i. It costs the rock its quiet. A
 * rock with a cairn is left alone (null); a rock already looked under
 * this tide shows nothing new ({ id: null }).
 */
export function lookUnder(st, i) {
    const r = st.rocks[i];
    if (!r || !r.on || r.cairn) return null;
    r.calm = 0;
    if (r.looked === st.last) return { id: null };
    r.looked = st.last;
    const missing = UNDER.filter(id => !st.album[id]);
    const x = rnd(st);
    const id = missing.length && x < 150 ? missing[x % missing.length] : UNDER[x % UNDER.length];
    const fresh = discover(st, id);
    log(st, st.last, EV.LOOK, i, 0);
    return { id, fresh };
}

export { grows };
