/*
 * land.js: the shore around the pool, chosen by the seed. Four kinds:
 * a northern headland with its lighthouse, an Aegean cape of limestone
 * with white houses and stone pines, low tropical islets with palms, and
 * a cove shut in by tall cliffs. They differ in the land on the horizon,
 * the trees, the colour of the sea, the beach (sand, pebbles, shingle)
 * and what hangs into the picture from above (a branch, palm fronds).
 * Every kind keeps a lighthouse: the field guide has a page for it.
 */
import { clamp, lerp, mix, rgb, rgba, TAU } from './util.js';
import { seeded } from '../core/rng.js';

const KINDS = ['north', 'aegean', 'tropic', 'cove'];

/** The shore of a pool. */
export function makeLand(seed) {
    const r = seeded(seed * 211 + 5);
    const kind = KINDS[Math.floor(r() * KINDS.length)];
    const side = r() < 0.5 ? -1 : 1;
    const mass = (x, w, h, cliff, peak) => ({ x, w, h, cliff, peak });
    const L = { kind, side, masses: [], trees: null, houses: false, overhang: null, oside: r() < 0.5 ? -1 : 1, seed };
    switch (kind) {
    case 'north':
        L.masses.push(mass(side < 0 ? 0.08 + r() * 0.14 : 0.92 - r() * 0.14, 0.24 + r() * 0.2, 0.6 + r() * 0.8, -side, r()));
        if (r() < 0.65) L.masses.push(mass(0.35 + r() * 0.3, 0.04 + r() * 0.07, 0.15 + r() * 0.3, side, r()));
        L.trees = r() < 0.4 ? 'fir' : null;
        L.overhang = r() < 0.35 ? 'branch' : null;
        L.sand = [[226, 204, 160], [196, 170, 122]]; L.beach = 'sand'; L.sea = null;
        L.rim = [[122, 112, 104], [70, 66, 70], [100, 92, 86], [44, 46, 58]];
        break;
    case 'aegean':
        L.masses.push(mass(side < 0 ? 0.1 + r() * 0.12 : 0.9 - r() * 0.12, 0.26 + r() * 0.16, 1.3 + r() * 0.7, -side, r()));
        for (let k = 0, n = 1 + Math.floor(r() * 2); k < n; k++) L.masses.push(mass(0.3 + r() * 0.5, 0.05 + r() * 0.08, 0.3 + r() * 0.6, r() < 0.5 ? -1 : 1, r()));
        L.trees = 'umbrella'; L.houses = true;
        L.overhang = r() < 0.7 ? 'pine' : null;
        L.sand = [[214, 208, 196], [178, 170, 156]]; L.beach = 'pebble'; L.sea = [[14, 60, 120], [30, 120, 190]];
        L.rim = [[196, 184, 164], [120, 108, 94], [170, 158, 138], [84, 78, 74]];
        break;
    case 'tropic':
        for (let k = 0, n = 2 + Math.floor(r() * 2); k < n; k++) L.masses.push(mass(0.1 + (k + r() * 0.7) / n * 0.8, 0.05 + r() * 0.07, 0.08 + r() * 0.1, r() < 0.5 ? -1 : 1, r()));
        L.trees = 'palm';
        L.overhang = r() < 0.85 ? 'palm' : null;
        L.sand = [[246, 238, 220], [222, 208, 180]]; L.beach = 'sand'; L.sea = [[20, 120, 150], [60, 200, 200]];
        L.rim = [[200, 190, 170], [130, 122, 108], [176, 166, 148], [96, 92, 88]];
        break;
    case 'cove':
        L.masses.push(mass(0.04 + r() * 0.08, 0.2 + r() * 0.12, 2 + r() * 1.2, 1, r()));
        L.masses.push(mass(0.96 - r() * 0.08, 0.2 + r() * 0.12, 2 + r() * 1.2, -1, r()));
        L.trees = 'fir';
        L.overhang = r() < 0.55 ? 'pine' : null;
        L.sand = [[150, 142, 132], [110, 104, 98]]; L.beach = 'shingle'; L.sea = [[12, 44, 70], [40, 110, 130]];
        L.rim = [[110, 104, 98], [60, 58, 62], [92, 86, 82], [40, 40, 50]];
        break;
    }
    L.rimRough = 0.7 + r() * 0.9 + (kind === 'cove' ? 0.8 : 0);
    L.light = Math.floor(r() * L.masses.length);           // the mass the lighthouse stands on
    if (kind === 'cove') L.light = 0;
    return L;
}

/** The colour of open water, deep and shallow, for this shore (or null for the default). */
export const seaTint = (land, col, which) => (land && land.sea ? mix(mix([6, 16, 40], land.sea[0], col.light), mix([20, 40, 60], land.sea[1], col.light), which) : null);

/** The land on the horizon: headlands, islands, their trees and houses, the lighthouse. */
export function drawLand(ctx, L, env, t, col) {
    const ld = L.land, { W, H, horizon } = L;
    const r = seeded(ld.seed * 17 + 3);
    const land = mix([10, 14, 30], ld.kind === 'aegean' ? [150, 140, 120] : ld.kind === 'tropic' ? [70, 110, 80] : [70, 92, 104], col.light);
    let lamp = null;
    ld.masses.forEach((m, mi) => {
        const near = m.h > 1 ? 1 : 0.5;                     // the big ones stand nearer: less haze
        const fill = mix(land, col.bot, near === 1 ? 0.3 : 0.55);
        const cx = W * m.x - L.pan * 0.05, hw = Math.max(W * m.w, H * 0.12), hh = H * 0.05 * m.h;
        const c = -0.15 + 0.3 * m.peak, flat = ld.kind === 'tropic';
        const prof = v => {                                 // v across the land, positive towards the open sea
            if (flat) { const d = v / 0.8; return Math.max(0, 1 - Math.pow(Math.abs(d), 4)); }
            const d = (v - c) / (v < c ? 0.75 : 0.22);
            return Math.max(0, 1 - d * d) * (1 + 0.06 * Math.sin(v * 23 + m.peak * 9) + 0.04 * Math.sin(v * 51));
        };
        const X = v => cx - m.cliff * v * hw, Y = v => horizon + 1 - hh * prof(v);
        ctx.fillStyle = rgb(fill);
        ctx.beginPath(); ctx.moveTo(X(-1.2), horizon + 1);
        for (let k = 0; k <= 60; k++) { const v = -1.2 + k / 60 * 2.1; ctx.lineTo(X(v), Y(v)); }
        ctx.lineTo(X(0.9), horizon + 1); ctx.closePath(); ctx.fill();
        if (ld.kind === 'aegean' || ld.kind === 'cove') {   // the bare rock of the cliff face, paler
            ctx.fillStyle = rgba(mix(fill, [255, 250, 240], ld.kind === 'aegean' ? 0.35 : 0.12), 0.7);
            ctx.beginPath(); ctx.moveTo(X(c + 0.05), Y(c + 0.05));
            for (let k = 0; k <= 12; k++) { const v = c + 0.05 + k / 12 * 0.2; ctx.lineTo(X(v), Y(v)); }
            ctx.lineTo(X(c + 0.12), horizon + 1); ctx.closePath(); ctx.fill();
        }
        if (flat) {                                         // a white beach around a low islet
            ctx.fillStyle = rgb(mix([120, 120, 120], [250, 244, 226], col.light));
            ctx.fillRect(X(-0.95) < X(0.9) ? X(-0.95) : X(0.9), horizon - 1, Math.abs(X(0.9) - X(-0.95)), 2);
        }
        const ts = H * 0.012 * (near === 1 ? 1 : 0.7);      // trees along the top
        const treeCol = rgb(mix(mix([6, 10, 20], [40, 70, 44], col.light), col.bot, near === 1 ? 0.15 : 0.4));
        if (ld.trees) for (let k = 0, n = flat ? 2 + Math.floor(r() * 4) : 4 + Math.floor(r() * 10); k < n; k++) {
            const v = flat ? (r() - 0.5) * 1.3 : -0.9 + r() * (c + 0.9), x = X(v), y = Y(v) + 1;
            if (prof(v) < 0.15) continue;
            tree(ctx, ld.trees, x, y, ts * (0.7 + r() * 0.6), treeCol, t, r());
        }
        if (ld.houses && mi === 0) {                        // a white village down the slope
            const wall = mix([60, 64, 80], [250, 248, 240], col.light);
            for (let k = 0; k < 14; k++) {
                const v = -0.6 + r() * (c + 0.5), x = X(v), y = Y(v) + (horizon - Y(v)) * (0.15 + r() * 0.45), s = H * (0.003 + r() * 0.003);
                if (prof(v) < 0.3) continue;
                ctx.fillStyle = rgb(wall); ctx.fillRect(x - s, y - s * 1.2, s * 2, s * 1.4);
                if (r() < 0.15) { ctx.fillStyle = rgb(mix([20, 30, 60], [40, 90, 170], col.light)); ctx.beginPath(); ctx.arc(x, y - s * 1.2, s * 0.9, Math.PI, 0); ctx.fill(); }
            }
        }
        if (mi === ld.light) { const v = flat ? 0.2 : c - 0.08; lamp = [X(v), Y(v) + 2]; }
    });
    if (lamp) lighthouse(ctx, L, lamp[0], lamp[1], t, col);
}

function tree(ctx, kind, x, y, s, fill, t, k) {
    ctx.fillStyle = fill; ctx.strokeStyle = fill;
    if (kind === 'fir') {
        ctx.beginPath(); ctx.moveTo(x, y - s * 2.6); ctx.lineTo(x + s * 0.7, y); ctx.lineTo(x - s * 0.7, y); ctx.closePath(); ctx.fill();
    } else if (kind === 'umbrella') {                       // a stone pine: a bare trunk, a flat crown
        ctx.lineWidth = Math.max(1, s * 0.18);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.2, y - s * 1.6); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x + s * 0.2, y - s * 1.9, s * 1.3, s * 0.5, 0, 0, TAU); ctx.fill();
    } else {                                                // a palm, leaning
        const lean = (k - 0.5) * 0.8, tx = x + s * 2.4 * Math.sin(lean), ty = y - s * 2.6;
        ctx.lineWidth = Math.max(1, s * 0.16);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * lean * 0.4, y - s * 1.4, tx, ty); ctx.stroke();
        ctx.lineWidth = Math.max(1, s * 0.14);
        for (let f = 0; f < 6; f++) {
            const a = -Math.PI / 2 + (f - 2.5) * 0.55 + Math.sin(t * 0.8 + f) * 0.05;
            ctx.beginPath(); ctx.moveTo(tx, ty);
            ctx.quadraticCurveTo(tx + Math.cos(a) * s * 1.2, ty + Math.sin(a) * s * 0.9, tx + Math.cos(a) * s * 1.8, ty + Math.sin(a) * s * 0.5 + s * 0.6);
            ctx.stroke();
        }
    }
}

function lighthouse(ctx, L, lx, ly, t, col) {
    const lh = L.H * 0.05;
    ctx.fillStyle = rgb(mix([40, 44, 60], [238, 236, 228], col.light));
    ctx.beginPath();
    ctx.moveTo(lx - lh * 0.11, ly); ctx.lineTo(lx - lh * 0.07, ly - lh); ctx.lineTo(lx + lh * 0.07, ly - lh); ctx.lineTo(lx + lh * 0.11, ly);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgb(mix([30, 20, 26], [180, 60, 50], col.light));
    ctx.fillRect(lx - lh * 0.085, ly - lh * 0.62, lh * 0.17, lh * 0.18);
    ctx.fillRect(lx - lh * 0.1, ly - lh * 1.16, lh * 0.2, lh * 0.16);
    if (col.light < 0.6) {                                  // its light, turning
        const turn = (t % 6) / 6;
        const flash = Math.pow(Math.max(0, Math.cos(turn * TAU)), 24);
        const a = (0.25 + 0.75 * flash) * (1 - col.light / 0.6);
        const r = lh * (0.5 + 3.5 * flash);
        const gl = ctx.createRadialGradient(lx, ly - lh * 1.08, 0, lx, ly - lh * 1.08, r);
        gl.addColorStop(0, `rgba(255,244,190,${a})`);
        gl.addColorStop(1, 'rgba(255,244,190,0)');
        ctx.fillStyle = gl;
        ctx.fillRect(lx - r, ly - lh * 1.08 - r, r * 2, r * 2);
    }
}

/**
 * What hangs into the picture from a tree behind you: a pine bough, palm
 * fronds, or a bare branch. It sways with the wind, and is dark against
 * the sky, as a near thing is.
 */
export function drawOverhang(ctx, L, env, t, col) {
    const ld = L.land;
    if (!ld || !ld.overhang) return;
    const { W, H } = L, s = Math.min(W, H), sd = ld.oside, r = seeded(ld.seed * 29 + 1);
    const wind = 0.3 + env.weather.wind;
    const sway = (k, f = 1) => Math.sin(t * (0.7 + k * 0.13) + k) * 0.03 * wind * f + Math.sin(t * 2.3 + k * 2) * 0.008 * wind * f;
    const x0 = sd < 0 ? -s * 0.02 : W + s * 0.02, y0 = H * (0.06 + r() * 0.12);
    const dark = ld.overhang === 'palm' ? mix([6, 12, 8], [52, 86, 44], col.light) : mix([4, 8, 10], [36, 52, 34], col.light * 0.8), bark = mix([6, 6, 8], [58, 44, 34], col.light * 0.8);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (ld.overhang === 'palm') {
        for (let f = 0; f < 4; f++) {                       // fronds: a rib, leaflets hanging from it
            const len = s * (0.32 + r() * 0.16), a0 = (sd < 0 ? 0 : Math.PI) + sd * (0.25 + f * 0.28) * -1 + sway(f, 2) * 4;
            const bend = 0.9 + r() * 0.5, pts = [];
            for (let k = 0; k <= 16; k++) {
                const u = k / 16, a = a0 + sd * -1 * 0 + (sd < 0 ? 1 : -1) * u * bend * 0.9;
                const px = x0 + Math.cos(a0) * len * u, py = y0 + Math.sin(a0) * len * u * 0.4 + u * u * len * 0.5 * bend;
                pts.push([px, py, a]);
            }
            ctx.strokeStyle = rgb(mix(dark, [20, 30, 10], 0.3)); ctx.lineWidth = s * 0.006;
            ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
            ctx.strokeStyle = rgb(dark); ctx.lineWidth = s * 0.007;
            ctx.beginPath();                                // the leaflets of a frond in one stroke
            for (let k = 2; k < pts.length; k++) {
                const [px, py] = pts[k], l = len * 0.26 * Math.sin(Math.PI * k / 16) + len * 0.04;
                for (const side of [-1, 1]) {
                    const da = Math.PI / 2 + side * 0.55 + sway(k + f, 3) * 6;
                    ctx.moveTo(px, py);
                    ctx.quadraticCurveTo(px + side * l * 0.3, py + l * 0.3, px + side * Math.cos(da) * l * 0.6, py + Math.sin(da) * l);
                }
            }
            ctx.stroke();
        }
    } else {                                                // a bough: bark, twigs, and needles or nothing
        const len = s * (0.3 + r() * 0.15), sag = 0.25 + r() * 0.2, pts = [];
        for (let k = 0; k <= 20; k++) {
            const u = k / 20, sw = sway(1, 1 + u * 3) * len * u;
            pts.push([x0 - sd * len * u, y0 + Math.sin(u * Math.PI * 0.8) * len * sag * 0.5 + u * u * len * 0.18 + sw]);
        }
        ctx.strokeStyle = rgb(bark);
        for (let k = 1; k < pts.length; k++) {
            ctx.lineWidth = s * 0.022 * (1 - k / pts.length * 0.8);
            ctx.beginPath(); ctx.moveTo(pts[k - 1][0], pts[k - 1][1]); ctx.lineTo(pts[k][0], pts[k][1]); ctx.stroke();
        }
        const twigs = [];
        for (let k = 3; k < pts.length; k += 2 + Math.floor(r() * 2)) {
            const [px, py] = pts[k], a = (sd < 0 ? 0 : Math.PI) + (r() - 0.5) * 1.6 + (r() < 0.5 ? -0.6 : 0.6), l = len * (0.12 + r() * 0.16);
            const ex = px + Math.cos(a) * l, ey = py + Math.sin(a) * l * 0.8 + l * 0.15 + sway(k, 2) * l;
            ctx.lineWidth = s * 0.005;
            ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo((px + ex) / 2, (py + ey) / 2 - l * 0.1, ex, ey); ctx.stroke();
            twigs.push([px, py, ex, ey]);
        }
        if (ld.overhang === 'pine') {
            ctx.strokeStyle = rgb(dark); ctx.lineWidth = Math.max(1, s * 0.0028);
            ctx.beginPath();                                // all the needles in one stroke
            for (const [px, py, ex, ey] of twigs.concat(pts.filter((_, k) => k > 6 && k % 2).map(p => [p[0], p[1], p[0], p[1]]))) {
                for (let n = 0; n < 34; n++) {               // tufts of needles along the twig and at its tip
                    const u = n < 22 ? n / 22 : 1, cx = lerp(px, ex, u), cy = lerp(py, ey, u);
                    const a = r() * TAU, l = s * (0.012 + r() * 0.016) * (n < 22 ? 0.8 : 1.2);
                    ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l * 0.7 + l * 0.3);
                }
            }
            ctx.stroke();
        }
    }
    ctx.restore();
}

/** Pebbles or shingle on the near beach, drawn once into the still layer. */
export function drawStones(ctx, L, r) {
    const ld = L.land;
    if (!ld || ld.beach === 'sand') return;
    const { W, H } = L, many = ld.beach === 'pebble' ? W * 1.6 : W * 2.2;
    for (let k = 0; k < many; k++) {
        const y = lerp(L.yNear + H * 0.01, H + 4, Math.sqrt(r())), depth = clamp((y - L.yNear) / (H - L.yNear));
        const x = r() * W, sz = (1.2 + r() * r() * (ld.beach === 'pebble' ? 6 : 8)) * (0.6 + depth * 0.8);
        const tone = ld.beach === 'pebble' ? mix([150, 146, 140], [240, 236, 228], r()) : mix([60, 58, 56], [150, 140, 128], r());
        ctx.fillStyle = 'rgba(20,18,16,0.25)';
        ctx.beginPath(); ctx.ellipse(x + sz * 0.2, y + sz * 0.25, sz, sz * 0.5, 0, 0, TAU); ctx.fill();
        const g = ctx.createLinearGradient(x - sz, y - sz * 0.5, x + sz * 0.4, y + sz * 0.5);
        g.addColorStop(0, rgb(mix(tone, [255, 255, 255], 0.3))); g.addColorStop(1, rgb(mix(tone, [20, 20, 24], 0.35)));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y, sz, sz * (0.45 + r() * 0.2), (r() - 0.5) * 0.6, 0, TAU); ctx.fill();
    }
}
