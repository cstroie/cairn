/*
 * sim.js: the pool. One call of simTide is one tide: every rock grows,
 * settles, is grazed, is torn by a storm, or is visited. The rules and
 * their numbers are those of the CP/M TIDEPOOL (sim.asm), where a random
 * byte is compared with a threshold.
 *
 * A rock: sp (species), g (growth 0-255, a size every 64), calm (tides
 * since it was last stepped on), cairn (a cairn guards it), name, on (it
 * lies bare: rocks still under the sand are not simulated).
 *
 * Beyond the CP/M game: the rocks from LEDGE on are the Deep Ledge, with
 * their own settlers (sponge) and visitors (sea slug, brittle star), and
 * the journal also keeps what the player does (uncover, rescue, clean, look).
 */
import { rnd } from './rng.js';
import { seasonOfTide } from './tide.js';

export const SP = { BARE: 0, FILM: 1, BARN: 2, KELP: 3, MUSS: 4, ANEM: 5, STAR: 6, CRAB: 7, URCH: 8, SPONGE: 9, NUDI: 10, BRIT: 11 };
export const SPECIES = ['bare', 'film', 'barn', 'kelp', 'muss', 'anem', 'star', 'crab', 'urch', 'sponge', 'nudi', 'brit'];
export const EV = { STORM: 0, TORN: 1, SETTLE: 2, BLOOM: 3, GRAZE: 4, ATE: 5, DIED: 6, LEFT: 7, VISIT: 8, STEP: 9, UNCOVER: 10, RESCUE: 11, CLEAN: 12, LOOK: 13 };
export const EVENTS = ['storm', 'torn', 'settle', 'bloom', 'graze', 'ate', 'died', 'left', 'visit', 'step', 'uncover', 'rescue', 'clean', 'look'];
export const LEDGE = 10;            // the first rock of the Deep Ledge

export const CAP = 2000;            // tides caught up at most (nearly three years)
export const JOURNAL = 200;
export const CALM_ANEM = 24;        // twelve days of quiet
export const CALM_STAR = 16;        // eight days

const TB_STORM = [14, 7, 4, 12];    // of 256, winter first
const TB_SETTLE = [30, 80, 56, 56];
const TB_CRAB = [4, 6, 10, 6];

export const stage = g => g >> 6;   // 0 tiny, 1 young, 2 grown, 3 full grown
export const isVisitor = sp => (sp >= SP.STAR && sp <= SP.URCH) || sp >= SP.NUDI;
export const grows = sp => sp >= SP.FILM && !isVisitor(sp);

/** Write a happening in the journal. rock -1 is the whole pool. */
export function log(st, tide, ev, rock, sp) {
    st.jseq = (st.jseq || 0) + 1;
    st.journal.push({ n: st.jseq, t: tide, ev, rock, sp, name: rock >= 0 ? st.rocks[rock].name || null : null });
    if (st.journal.length > JOURNAL) st.journal.splice(0, st.journal.length - JOURNAL);
}

function becomes(r, sp, g) { r.sp = sp; r.g = g; }

function grow(r, b, season) {
    if (season === 0) b = Math.max(1, b >> 1);
    else if (season === 2) b += b >> 2;
    r.g = Math.min(255, r.g + b);
    return r.g;
}

/** One tide for the whole pool. */
export function simTide(st, n) {
    const season = seasonOfTide(n);
    const storm = rnd(st) < TB_STORM[season];
    if (storm) { st.lastStorm = n; log(st, n, EV.STORM, -1, 0); }
    for (let i = 0; i < st.rocks.length; i++) if (st.rocks[i].on) rock(st, n, i, season, storm);
    st.last = n;
}

function rock(st, n, i, season, storm) {
    const r = st.rocks[i];
    if (r.calm < 255) r.calm++;

    if (storm && r.sp >= SP.BARN && r.sp <= SP.MUSS) {     // a storm tears barnacles, kelp and mussels
        const left = r.g - ((rnd(st) & 63) + 50);
        if (left < 24) {
            const was = r.sp;
            becomes(r, SP.BARE, 0);
            return log(st, n, EV.TORN, i, was);
        }
        r.g = left;
    }

    const senesce = () => {                                // a full grown thing may let go, and leave a film
        if (r.g !== 255 || rnd(st) >= 4) return;
        const was = r.sp;
        becomes(r, SP.FILM, 96);
        log(st, n, EV.DIED, i, was);
    };
    const crab = () => {                                   // a hermit crab may cross the rock
        if (rnd(st) >= TB_CRAB[season]) return;
        becomes(r, SP.CRAB, 100);
        log(st, n, EV.VISIT, i, SP.CRAB);
    };
    const leave = chance => {                              // a visitor moves on
        if (rnd(st) >= chance) return;
        const was = r.sp;
        becomes(r, SP.BARE, 0);
        log(st, n, EV.LEFT, i, was);
    };

    if (i >= LEDGE) {                                      // the Deep Ledge has its own ways
        switch (r.sp) {
        case SP.BARE:
            if (rnd(st) < 44) becomes(r, SP.FILM, 8);
            else if (r.calm >= 30 && rnd(st) < 6) { becomes(r, SP.BRIT, 100); log(st, n, EV.VISIT, i, SP.BRIT); }
            return;
        case SP.FILM:
            if (grow(r, (rnd(st) & 15) + 18, season) >= 96 && rnd(st) < TB_SETTLE[season]) {
                becomes(r, rnd(st) < 170 ? SP.SPONGE : SP.KELP, 20);
                log(st, n, EV.SETTLE, i, r.sp);
            }
            return;
        case SP.SPONGE:
            if (grow(r, 4, season) >= 128 && r.calm >= 20 && rnd(st) < 8) {
                becomes(r, SP.NUDI, 120);
                log(st, n, EV.ATE, i, SP.NUDI);
            } else senesce();
            return;
        case SP.NUDI: return leave(16);
        case SP.BRIT: return leave(12);
        }
    }

    switch (r.sp) {
    case SP.BARE:
        if (rnd(st) < 44) becomes(r, SP.FILM, 8);
        else crab();
        break;
    case SP.FILM:
        if (grow(r, (rnd(st) & 15) + 18, season) < 96) { crab(); break; }
        if (rnd(st) < TB_SETTLE[season]) {
            const x = rnd(st);
            becomes(r, x < 100 ? SP.BARN : x < 180 ? SP.KELP : SP.MUSS, 20);
            log(st, n, EV.SETTLE, i, r.sp);
        }
        break;
    case SP.BARN:
        if (grow(r, 6, season) < 192) break;
        if (r.calm >= CALM_ANEM && rnd(st) < 7) {
            becomes(r, SP.ANEM, 40);
            log(st, n, EV.BLOOM, i, SP.ANEM);
        } else senesce();
        break;
    case SP.KELP:
        if (grow(r, 14, season) >= 128 && rnd(st) < 5) {
            becomes(r, SP.URCH, 120);
            log(st, n, EV.GRAZE, i, SP.URCH);
        } else senesce();
        break;
    case SP.MUSS:
        if (grow(r, 8, season) >= 128 && r.calm >= CALM_STAR && rnd(st) < 9) {
            becomes(r, SP.STAR, 150);
            log(st, n, EV.ATE, i, SP.STAR);
        } else senesce();
        break;
    case SP.ANEM:
        if (grow(r, 5, season) === 255 && rnd(st) < 2) {
            becomes(r, SP.FILM, 96);
            log(st, n, EV.DIED, i, SP.ANEM);
        }
        break;
    case SP.STAR: leave(8); break;
    case SP.CRAB: leave(60); break;
    case SP.URCH: leave(24); break;
    }
}

/** Bring the pool up to tide `now`. Returns the number of tides simulated. */
export function catchUp(st, now) {
    if (now <= st.last) return 0;
    let from = st.last + 1;
    if (now - from >= CAP) from = now - CAP + 1;
    for (let n = from; n <= now; n++) simTide(st, n);
    return now - from + 1;
}

/**
 * You leave across the rocks nobody fenced: what grows there is set back
 * a quarter and a little more, the visitors are scared off, and the quiet
 * starts again. Returns the rocks that were stepped on.
 */
export function trample(st) {
    const stepped = [];
    for (let i = 0; i < st.rocks.length; i++) {
        const r = st.rocks[i];
        if (!r.on || r.cairn) continue;
        r.calm = 0;
        if (r.sp === SP.BARE) continue;
        stepped.push(i);
        if (isVisitor(r.sp)) { becomes(r, SP.BARE, 0); continue; }
        const left = r.g - ((r.g >> 2) + 10);
        if (left >= 12) { r.g = left; continue; }
        if (r.sp === SP.FILM) { r.g = 0; continue; }
        const was = r.sp;
        becomes(r, SP.BARE, 0);
        log(st, st.last, EV.STEP, i, was);
    }
    return stepped;
}

/** Put a cairn on a rock, or lift it. Returns false when no stone is left. */
export function toggleCairn(st, i) {
    const r = st.rocks[i];
    if (r.cairn) { r.cairn = false; return true; }
    if (stonesLeft(st) <= 0) return false;
    r.cairn = true;
    return true;
}

export const stonesLeft = st => st.stones - st.rocks.filter(r => r.cairn).length;
export const openRocks = st => st.rocks.filter(r => r.on).length;
