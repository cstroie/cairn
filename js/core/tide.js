/*
 * tide.js: the clock of the pool. Everything here is a pure function of
 * the time.
 *
 * M is minutes since 31 December 1977, 00:00, on the wall clock (the same
 * count as the CP/M TIDEPOOL, so both show the same tide). A tide is 745
 * minutes, high water to high water: tide number M / 745, minute within
 * the tide M mod 745 (0 high water, 372 low).
 *
 * The moon's phase sets the range: springs at new and full moon, neaps at
 * the quarters. The sun, the season and the weather come from the date.
 */
import { hash } from './rng.js';

export const TIDE = 745;
export const LOW = 372;
export const DAY = 1440;
const EPOCH = Date.UTC(1977, 11, 31);
const SYNODIC = 29.530588853 * 86400000;
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

/** A Date -> M (fractional), from the wall clock. */
export function minuteOf(d) {
    return (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(),
        d.getSeconds(), d.getMilliseconds()) - EPOCH) / 60000;
}

/** M -> the calendar fields of that wall-clock minute. */
export function fieldsOf(M) {
    const u = new Date(EPOCH + Math.floor(M) * 60000);
    const start = Date.UTC(u.getUTCFullYear(), 0, 1);
    return {
        year: u.getUTCFullYear(), month: u.getUTCMonth(), day: u.getUTCDate(),
        hour: u.getUTCHours(), minute: u.getUTCMinutes(), weekday: u.getUTCDay(),
        doy: Math.floor((u.getTime() - start) / 86400000),
        hours: u.getUTCHours() + u.getUTCMinutes() / 60 + (M - Math.floor(M)) / 60
    };
}

export const tideOf = M => Math.floor(M / TIDE);
export const phaseOf = M => M - Math.floor(M / TIDE) * TIDE;
export const dayOf = M => Math.floor(M / DAY);

/** The moon: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
export function moonPhase(M) {
    const x = (EPOCH + M * 60000 - NEW_MOON) / SYNODIC;
    return x - Math.floor(x);
}

/** 1 at spring tides (new and full moon), 0 at neaps. */
export function springness(M) {
    return 0.5 + 0.5 * Math.cos(4 * Math.PI * moonPhase(M));
}

/** The water, 0 (the lowest spring low water) to 1 (the highest spring high water). */
export function level(M) {
    const amp = 0.7 + 0.3 * springness(M);
    return 0.5 + 0.5 * amp * Math.cos(2 * Math.PI * phaseOf(M) / TIDE);
}

/** true while the water rises. */
export const flooding = M => phaseOf(M) >= LOW;

/** The next high and low waters after M: [{ M, high }], `count` of them. */
export function nextWaters(M, count = 4) {
    const out = [];
    let c = tideOf(M);
    while (out.length < count) {
        const low = c * TIDE + LOW, high = (c + 1) * TIDE;
        if (low > M) out.push({ M: low, high: false });
        if (out.length < count) out.push({ M: high, high: true });
        c++;
    }
    return out;
}

/**
 * The next low water worth getting up for: a spring tide (the lowest), in
 * daylight, within `days`. M of that low water, or null.
 */
export function bestLow(M, days = 16) {
    for (let c = tideOf(M); c * TIDE < M + days * DAY; c++) {
        const low = c * TIDE + LOW;
        if (low > M && springness(low) >= 0.8 && sun(low).alt > 0.05) return low;
    }
    return null;
}

/** 0 winter (December to February), 1 spring, 2 summer, 3 autumn. */
export function seasonOf(M) {
    return [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 0][fieldsOf(M).month];
}

/** The season of a tide, for the simulation. */
export const seasonOfTide = n => seasonOf(n * TIDE + LOW);

/**
 * The sun: alt from -1 (deep night) to 1 (high noon); arc 0..1 across the
 * sky while it is up; night 0..1 through the night while it is down.
 */
export function sun(M) {
    const f = fieldsOf(M);
    const len = 12 + 3.5 * Math.cos(2 * Math.PI * (f.doy - 172) / 365);
    const rise = 12.5 - len / 2, set = rise + len;
    if (f.hours >= rise && f.hours <= set) {
        const arc = (f.hours - rise) / len;
        return { alt: Math.sin(Math.PI * arc), arc, night: 0, up: true };
    }
    const night = ((f.hours - set + 24) % 24) / (24 - len);
    return { alt: -Math.sin(Math.PI * night), arc: 0, night, up: false };
}

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);

/** The weather of a moment: the same for everyone, made from the date. */
export function weather(M) {
    const block = M / 360;                       // a block of six hours
    const b = Math.floor(block), t = smooth(block - b);
    const season = seasonOf(M);
    const rough = [0.25, 0.05, -0.1, 0.15][season];
    const at = n => {
        const wind = Math.min(1, Math.max(0, hash(n, 1) * 0.9 + rough));
        const cloud = Math.min(1, Math.max(0, hash(n, 2) * 1.1 - 0.15 + rough));
        const rain = cloud > 0.7 && hash(n, 3) < 0.55 ? Math.min(1, (cloud - 0.7) / 0.3) : 0;
        const fog = wind < 0.18 && hash(n, 4) < 0.3 ? 1 : 0;
        return { wind, cloud, rain, fog };
    };
    const a = at(b), c = at(b + 1);
    return {
        wind: lerp(a.wind, c.wind, t), cloud: lerp(a.cloud, c.cloud, t),
        rain: lerp(a.rain, c.rain, t), fog: lerp(a.fog, c.fog, t)
    };
}

/** Everything the scene needs to know about a moment. */
export function env(M, stormTide = -1) {
    const w = weather(M);
    const storm = stormTide === tideOf(M);
    if (storm) { w.wind = 1; w.cloud = Math.max(w.cloud, 0.95); w.rain = Math.max(w.rain, 0.9); w.fog = 0; }
    return {
        M, tide: tideOf(M), phase: phaseOf(M), level: level(M), flooding: flooding(M),
        moon: moonPhase(M), spring: springness(M), season: seasonOf(M), sun: sun(M),
        weather: w, storm, fields: fieldsOf(M)
    };
}
