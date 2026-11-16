/*
 * rocks.js: what does not move: the ridge behind the pool, the sand, the
 * ten rocks. Their shapes come from the pool's seed, so a pool always
 * looks the same. Drawn once into a layer as wide as the whole scene.
 */
import { clamp, lerp, mix, rgb, rgba, layer, smoothPath, TAU } from './util.js';
import { seeded } from '../core/rng.js';

const SAND = [226, 204, 160], SAND_DEEP = [196, 170, 122];

/** The shape of rock i: outline points and a function along its top. */
export function makeRock(i, n, L, seed) {
    const r = seeded(seed * 7919 + i * 104729 + 13);
    const slot = L.SW * 0.9 / n;
    const cx = L.SW * 0.05 + slot * (i + 0.5) + (r() - 0.5) * slot * 0.1;
    const w = slot * (0.8 + r() * 0.26);
    const h = L.H * (0.1 + r() * 0.1);
    const base = L.floor + L.H * 0.014;
    const skew = (r() - 0.5) * 0.9, round = 0.72 + r() * 0.5;
    const ctl = Array.from({ length: 7 }, () => 0.8 + r() * 0.32);     // lumps along the top
    const lump = u => { const f = u * 6, k = Math.min(5, Math.floor(f)), x = f - k, s = x * x * (3 - 2 * x); return lerp(ctl[k], ctl[k + 1], s); };
    const N = 26, pts = [];
    for (let k = 0; k <= N; k++) {
        const u = k / N, a = Math.PI * (1 - u);
        pts.push([cx + Math.cos(a) * w / 2 * (1 + (r() - 0.5) * 0.03),
            base - Math.pow(Math.sin(a), round) * h * lump(u) * (1 + skew * (u - 0.5)) - (r() - 0.5) * h * 0.02]);
    }
    /** A point on the top: u 0 (left) to 1 (right) -> { x, y, a } with a the angle of the surface. */
    const at = u => {
        const f = clamp(0.1 + 0.8 * u, 0, 1) * N, k = Math.min(N - 1, Math.floor(f)), t = f - k;
        const p = pts[k], q = pts[k + 1];
        return { x: lerp(p[0], q[0], t), y: lerp(p[1], q[1], t), a: Math.atan2(q[1] - p[1], q[0] - p[0]) };
    };
    const top = Math.min(...pts.map(p => p[1]));
    return { i, cx, w, h, base, top, pts, at, seed: seed * 31 + i * 977, tone: r(), slot };
}

function drawRock(ctx, R, H) {
    const r = seeded(R.seed + 5);
    ctx.fillStyle = 'rgba(40,30,20,0.22)';                  // its shadow on the sand
    ctx.beginPath(); ctx.ellipse(R.cx + R.w * 0.04, R.base + H * 0.004, R.w * 0.56, H * 0.014, 0, 0, TAU); ctx.fill();

    const light = mix([158, 146, 132], [124, 132, 142], R.tone);
    const dark = mix([62, 54, 52], [44, 48, 60], R.tone);
    const path = () => {
        ctx.beginPath();
        const p = R.pts;
        ctx.moveTo(p[0][0], p[0][1] + 2);
        smoothPath(ctx, p, false, true);
        ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1] + 2);
        ctx.quadraticCurveTo(R.cx, R.base + H * 0.012, p[0][0], p[0][1] + 2);
        ctx.closePath();
    };
    const g = ctx.createLinearGradient(R.cx - R.w * 0.2, R.top, R.cx + R.w * 0.2, R.base);
    g.addColorStop(0, rgb(light));
    g.addColorStop(0.55, rgb(mix(light, dark, 0.55)));
    g.addColorStop(1, rgb(dark));
    path(); ctx.fillStyle = g; ctx.fill();

    ctx.save();
    path(); ctx.clip();
    for (let k = 0; k < 5; k++) {                           // strata
        const y = lerp(R.top, R.base, 0.2 + 0.16 * k + r() * 0.06);
        ctx.strokeStyle = `rgba(20,16,24,${0.1 + r() * 0.12})`;
        ctx.lineWidth = 1 + r() * 2.5;
        ctx.beginPath();
        ctx.moveTo(R.cx - R.w * 0.6, y + (r() - 0.5) * 14);
        ctx.bezierCurveTo(R.cx - R.w * 0.2, y + (r() - 0.5) * 22, R.cx + R.w * 0.2, y + (r() - 0.5) * 22, R.cx + R.w * 0.6, y + (r() - 0.5) * 14);
        ctx.stroke();
    }
    for (let k = 0; k < 90; k++) {                          // grain
        const x = R.cx + (r() - 0.5) * R.w, y = lerp(R.top, R.base, r());
        ctx.fillStyle = r() < 0.5 ? `rgba(255,250,240,${r() * 0.14})` : `rgba(10,10,20,${r() * 0.16})`;
        ctx.beginPath(); ctx.ellipse(x, y, 1 + r() * 3.5, 1 + r() * 2, r() * 3, 0, TAU); ctx.fill();
    }
    const sh = ctx.createLinearGradient(R.cx + R.w * 0.1, 0, R.cx + R.w * 0.5, 0);    // the side away from the light
    sh.addColorStop(0, 'rgba(12,12,28,0)');
    sh.addColorStop(1, 'rgba(12,12,28,0.34)');
    ctx.fillStyle = sh; ctx.fillRect(R.cx - R.w, R.top - 10, R.w * 2, R.h * 1.5);
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,248,232,0.26)';             // light along the top
    ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    smoothPath(ctx, R.pts.slice(3, Math.floor(R.pts.length * 0.6)).map(p => [p[0] + 1, p[1] + 2.5]));
    ctx.stroke();
}

/** Draw the ridge, the sand and the rocks into a layer of the scene's size. */
export function buildStatic(L, rocks, seed, scale) {
    const { SW, H } = L;
    const { canvas, ctx } = layer(SW, H, scale);
    const r = seeded(seed * 13 + 3);

    const ridge = (y0, amp, tones, alpha) => {              // the ridge behind
        const pts = [];
        let y = y0;
        for (let x = -40; x <= SW + 40; x += 22 + r() * 30) {
            y = clamp(y + (r() - 0.5) * amp * 1.1, y0 - amp, y0 + amp);
            pts.push([x, y + (r() < 0.2 ? -amp * 0.5 * r() : 0)]);
        }
        const g = ctx.createLinearGradient(0, y0 - amp, 0, L.floor);
        g.addColorStop(0, rgba(tones[0], alpha));
        g.addColorStop(1, rgba(tones[1], alpha));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-40, L.floor + 4);
        smoothPath(ctx, pts, false, true);
        ctx.lineTo(SW + 40, L.floor + 4);
        ctx.closePath(); ctx.fill();
        return pts;
    };
    ridge(L.ridge, H * 0.022, [[122, 112, 104], [70, 66, 70]], 1);
    const near = ridge(L.ridge + H * 0.07, H * 0.03, [[96, 88, 82], [40, 42, 54]], 1);
    const zone = (y0, y1, c, a) => {                        // the bands the tide leaves on the wall
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, rgba(c, 0)); g.addColorStop(0.5, rgba(c, a)); g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g; ctx.fillRect(0, y0, SW, y1 - y0);
    };
    zone(L.ridge + H * 0.07, L.ridge + H * 0.15, [196, 180, 120], 0.16);      // lichen
    zone(L.ridge + H * 0.13, L.ridge + H * 0.24, [20, 22, 30], 0.3);          // the black zone
    zone(L.ridge + H * 0.2, L.floor, [70, 104, 60], 0.2);                     // weed
    for (let k = 0; k < SW / 9; k++) {                      // barnacle dust at the high water mark
        ctx.fillStyle = `rgba(236,230,214,${r() * 0.3})`;
        ctx.fillRect(r() * SW, L.ridge + H * (0.085 + r() * r() * 0.12), 1.5 + r() * 2, 1.2 + r() * 1.6);
    }
    for (let k = 0; k < SW / 26; k++) {                     // cracks and pale patches
        const x = r() * SW, y = lerp(L.ridge + H * 0.02, L.floor, r());
        ctx.strokeStyle = `rgba(14,14,26,${0.1 + r() * 0.16})`;
        ctx.lineWidth = 1 + r() * 2;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + (r() - 0.5) * 40, y + 14 + r() * 26, x + (r() - 0.5) * 50, y + 30 + r() * 44);
        ctx.stroke();
        ctx.fillStyle = `rgba(190,196,180,${r() * 0.06})`;
        ctx.beginPath(); ctx.ellipse(r() * SW, lerp(L.ridge + H * 0.04, L.floor, r()), 8 + r() * 26, 4 + r() * 10, r() * 3, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,246,230,0.1)'; ctx.lineWidth = 2;
    ctx.beginPath(); smoothPath(ctx, near.map(p => [p[0], p[1] + 2])); ctx.stroke();

    const edge = [];                                        // the sand
    for (let x = -40; x <= SW + 40; x += 36) edge.push([x, L.floor + Math.sin(x * 0.011 + seed) * H * 0.006 + (r() - 0.5) * H * 0.006]);
    const sg = ctx.createLinearGradient(0, L.floor, 0, H);
    sg.addColorStop(0, rgb(mix(SAND_DEEP, [120, 104, 84], 0.45)));
    sg.addColorStop(0.1, rgb(SAND_DEEP));
    sg.addColorStop(0.32, rgb(SAND));
    sg.addColorStop(1, rgb(mix(SAND, [240, 226, 190], 0.5)));
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(-40, H + 4);
    smoothPath(ctx, edge, false, true);
    ctx.lineTo(SW + 40, H + 4); ctx.closePath(); ctx.fill();
    for (let k = 0; k < SW / 5; k++) {                      // grains, ripples, pebbles, shells
        const x = r() * SW, y = lerp(L.floor + H * 0.012, H, r());
        ctx.fillStyle = r() < 0.5 ? `rgba(255,248,225,${r() * 0.3})` : `rgba(110,84,50,${r() * 0.2})`;
        ctx.fillRect(x, y, 1 + r() * 1.6, 1 + r() * 1.2);
    }
    ctx.lineWidth = 1.5;
    for (let k = 0; k < SW / 70; k++) {
        const x = r() * SW, y = lerp(L.floor + H * 0.05, H * 0.99, r()), w = 30 + r() * 80;
        ctx.strokeStyle = `rgba(140,112,70,${0.08 + r() * 0.1})`;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w / 2, y - 4 - r() * 5, x + w, y + (r() - 0.5) * 4); ctx.stroke();
    }
    for (let k = 0; k < SW / 40; k++) {
        const x = r() * SW, y = lerp(L.floor + H * 0.03, H * 0.99, r()), s = 2 + r() * 5;
        const tone = mix([120, 116, 112], [196, 180, 160], r());
        ctx.fillStyle = 'rgba(60,44,24,0.2)';
        ctx.beginPath(); ctx.ellipse(x + 1, y + s * 0.5, s * 1.1, s * 0.4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = rgb(tone);
        ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.66, r() * 3, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.ellipse(x - s * 0.25, y - s * 0.2, s * 0.4, s * 0.2, 0, 0, TAU); ctx.fill();
    }

    for (const R of rocks) drawRock(ctx, R, H);
    return canvas;
}

/** A cairn: stones balanced on the sand in front of a rock. */
export function drawCairn(ctx, x, y, s, seed) {
    const r = seeded(seed + 77);
    ctx.fillStyle = 'rgba(70,50,26,0.26)';
    ctx.beginPath(); ctx.ellipse(x + s * 0.2, y + s * 0.12, s * 1.3, s * 0.26, 0, 0, TAU); ctx.fill();
    let yy = y, w = s;
    for (let k = 0; k < 4; k++) {
        const hh = w * (0.42 + r() * 0.1), tone = mix([118, 122, 130], [206, 196, 182], r());
        const dx = (r() - 0.5) * w * 0.22;
        const g = ctx.createLinearGradient(0, yy - hh * 2, 0, yy);
        g.addColorStop(0, rgb(mix(tone, [255, 255, 255], 0.3)));
        g.addColorStop(1, rgb(mix(tone, [30, 30, 44], 0.45)));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x + dx, yy - hh, w, hh, (r() - 0.5) * 0.16, 0, TAU); ctx.fill();
        yy -= hh * 1.72; w *= 0.72;
    }
}
