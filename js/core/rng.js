/*
 * rng.js: random numbers. The pool's own generator keeps its state in the
 * save (st.rng), so a pool is reproducible from its seed; hash() is for
 * things that are the same for everyone (the weather of a day).
 */

/** The next byte, 0-255, from the pool's generator (mulberry32). */
export function rnd(st) {
    const a = (st.rng = (st.rng + 0x6D2B79F5) >>> 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) >>> 24;
}

/** A number in [0, 1) from one or two integers; no state. */
export function hash(n, m = 0) {
    let h = (Math.imul(n | 0, 0x9E3779B1) ^ Math.imul((m | 0) + 0x7F4A7C15, 0x85EBCA6B)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x21F0AAAD);
    h = Math.imul(h ^ (h >>> 15), 0x735A2D97);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** A small generator for drawing: the same shapes from the same seed. */
export function seeded(seed) {
    const st = { rng: seed >>> 0 };
    return () => {
        const a = (st.rng = (st.rng + 0x6D2B79F5) >>> 0);
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
