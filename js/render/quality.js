/*
 * quality.js: how much the picture may cost. Three tiers: high draws
 * everything, medium a little less often and less finely, low the pool
 * and its life with the costly light left out. On 'auto' the tier starts
 * from what the device says of itself and then follows how long frames
 * actually take: down when they are slow, back up, slowly, when cheap.
 */
export const TIERS = {
    high:   { name: 'high',   dpr: 2,    fps: 12, fx: 2 },
    medium: { name: 'medium', dpr: 1.25, fps: 10, fx: 1 },
    low:    { name: 'low',    dpr: 1,    fps: 6, fx: 0 }
};
const ORDER = ['low', 'medium', 'high'];

/** The tier in use: read by the drawing code (Q.fx: 0 none, 1 some, 2 all of the costly light). */
export const Q = Object.assign({}, TIERS.medium);

let mode = 'auto', onChange = () => {}, samples = [], goodSince = 0, ceiling = 2;    // ceiling: no climbing back above a tier that was too slow

function guess() {
    const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
    const px = screen.width * screen.height * Math.min(2, devicePixelRatio || 1) ** 2;
    if (cores <= 4 || mem <= 2) return 'low';
    if (cores >= 8 && mem >= 8 && px < 4.5e6) return 'high';
    return 'medium';
}

function apply(name) {
    if (Q.name === name) return;
    Object.assign(Q, TIERS[name]);
    samples = []; goodSince = 0;
    onChange(name);
}

/** 'auto', 'high', 'medium' or 'low'; changed() is called when the tier changes. */
export function setQuality(m, changed) {
    if (changed) onChange = changed;
    mode = TIERS[m] ? m : 'auto';
    ceiling = 2;
    apply(mode === 'auto' ? guess() : mode);
}

/**
 * The motion is small and slow, so a still pool is drawn only a few
 * times a second; main.js asks for more while something moves fast.
 *
 * A frame took this long from one to the next (ms, including what the
 * browser did between). On 'auto', step down if frames come too late
 * for the tier's rate, up after half a minute of ease.
 */
export function measure(gap, now, want = 1000 / Q.fps) {
    if (mode !== 'auto' || gap > 1000) return;
    samples.push(gap);
    if (samples.length < 40) return;
    const sorted = samples.slice().sort((a, b) => a - b), mid = sorted[sorted.length >> 1];
    samples = [];
    const at = ORDER.indexOf(Q.name);
    if (mid > want * 1.45 && at > 0) { ceiling = at - 1; return apply(ORDER[at - 1]); }
    if (mid < want * 1.08 && at < ceiling) {
        if (!goodSince) goodSince = now;
        else if (now - goodSince > 30000) apply(ORDER[at + 1]);
    } else goodSince = 0;
}
