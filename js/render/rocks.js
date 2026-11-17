/*
 * rocks.js: what does not move: the rim behind the pool, its floor, the
 * near sand, and the rocks. The pool is seen from above and behind: a
 * rock stands at a place on the floor (u across, d from far 0 to near 1)
 * and is drawn larger the nearer it is. Shapes come from the pool's seed,
 * so a pool always looks the same.
 *
 * The floor is drawn once into a layer; each rock is drawn once into a
 * sprite of its own, because the water and the creatures go between them.
 */
import { clamp, lerp, mix, rgb, rgba, layer, smoothPath, TAU } from './util.js';
import { seeded } from '../core/rng.js';

const SAND = [226, 204, 160], SAND_DEEP = [196, 170, 122];

/**
 * Where the thirteen rocks stand: [{ u, d }]. Ten in staggered rows that
 * suit the shape of the window, shuffled by the seed; the three of the
 * Deep Ledge in a far row of their own.
 */
export function places(aspect, seed) {
    const rows = aspect < 0.8 ? [3, 2, 3, 2] : aspect < 1.5 ? [3, 4, 3] : [5, 5];
    const r = seeded(seed * 53 + 7), out = [];
    rows.forEach((n, k) => {
        const d = rows.length === 2 ? [0.36, 0.9][k] : lerp(0.2, 0.93, k / (rows.length - 1));
        const shift = rows.length === 2 && k === 1 ? 0.04 : 0;
        for (let j = 0; j < n; j++) out.push({ u: clamp((j + 0.5) / n + shift + (r() - 0.5) * 0.24 / n, 0.08, 0.92), d: d + (r() - 0.5) * 0.07 });
    });
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    for (let j = 0; j < 3; j++) out.push({ u: 0.26 + j * 0.24 + (r() - 0.5) * 0.05, d: 0.03 + r() * 0.03 });
    return { list: out, cols: Math.max(...rows), rows: rows.length };
}

/** The shape of rock i at its place: outline points, and a function along its top. */
export function makeRock(i, L, seed, place) {
    const r = seeded(seed * 7919 + i * 104729 + 13);
    const ledge = i >= 10, s = L.sc(place.d);
    const cx = L.px(place.u, place.d), base = L.floorY(place.d);
    const w = L.unit * (0.84 + r() * 0.26) * s;
    const h = ledge ? L.unit * 0.085 * s * (0.9 + r() * 0.2) : L.unit * (0.5 + r() * 0.38) * s;
    const skew = (r() - 0.5) * 0.9, round = 0.72 + r() * 0.5;
    const ctl = Array.from({ length: 7 }, () => 0.8 + r() * 0.32);     // lumps along the top
    const lump = u => { const f = u * 6, k = Math.min(5, Math.floor(f)), x = f - k, e = x * x * (3 - 2 * x); return lerp(ctl[k], ctl[k + 1], e); };
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
    const body = new Path2D();                              // its outline, to shade what is under water
    body.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) body.lineTo(p[0], p[1]);
    body.bezierCurveTo(pts[N][0], base + w * 0.13, pts[0][0], base + w * 0.13, pts[0][0], pts[0][1]);
    return { body, i, cx, w, h, base, top, pts, at, seed: seed * 31 + i * 977, tone: ledge ? 1.6 : r(), slot: w * 1.25, ledge,
        d: place.d, s, unit: L.unit * s };
}

function drawRock(ctx, R) {
    const r = seeded(R.seed + 5);
    const light = mix([166, 154, 138], [130, 138, 148], Math.min(1, R.tone));
    const dark = mix([62, 54, 52], [44, 48, 60], Math.min(1, R.tone));
    if (R.tone > 1) { light[0] -= 44; light[1] -= 34; light[2] -= 22; }   // the ledge is darker stone
    const foot = R.w * 0.13;                                // the base is round: we look down on it
    const path = () => {
        ctx.beginPath();
        const p = R.pts;
        ctx.moveTo(p[0][0], p[0][1]);
        smoothPath(ctx, p, false, true);
        ctx.bezierCurveTo(p[p.length - 1][0], R.base + foot, p[0][0], R.base + foot, p[0][0], p[0][1]);
        ctx.closePath();
    };
    const g = ctx.createLinearGradient(R.cx - R.w * 0.2, R.top, R.cx + R.w * 0.2, R.base + foot);
    g.addColorStop(0, rgb(light));
    g.addColorStop(0.55, rgb(mix(light, dark, 0.55)));
    g.addColorStop(1, rgb(dark));
    path(); ctx.fillStyle = g; ctx.fill();

    ctx.save();
    path(); ctx.clip();
    for (let k = 0; k < 5; k++) {                           // strata
        const y = lerp(R.top, R.base, 0.2 + 0.16 * k + r() * 0.06);
        ctx.strokeStyle = `rgba(20,16,24,${0.1 + r() * 0.12})`;
        ctx.lineWidth = (1 + r() * 2.5) * R.s;
        ctx.beginPath();
        ctx.moveTo(R.cx - R.w * 0.6, y + (r() - 0.5) * R.h * 0.14);
        ctx.bezierCurveTo(R.cx - R.w * 0.2, y + (r() - 0.5) * R.h * 0.22, R.cx + R.w * 0.2, y + (r() - 0.5) * R.h * 0.22, R.cx + R.w * 0.6, y + (r() - 0.5) * R.h * 0.14);
        ctx.stroke();
    }
    for (let k = 0; k < 70; k++) {                          // grain
        const x = R.cx + (r() - 0.5) * R.w, y = lerp(R.top, R.base + foot, r());
        ctx.fillStyle = r() < 0.5 ? `rgba(255,250,240,${r() * 0.14})` : `rgba(10,10,20,${r() * 0.16})`;
        ctx.beginPath(); ctx.ellipse(x, y, (1 + r() * 3.5) * R.s, (1 + r() * 2) * R.s, r() * 3, 0, TAU); ctx.fill();
    }
    const cap = ctx.createRadialGradient(R.cx - R.w * 0.08, R.top + R.h * 0.2, 0, R.cx - R.w * 0.08, R.top + R.h * 0.2, R.w * 0.42);
    cap.addColorStop(0, 'rgba(255,250,236,0.3)');           // the top catches the sky
    cap.addColorStop(1, 'rgba(255,250,236,0)');
    ctx.fillStyle = cap; ctx.fillRect(R.cx - R.w, R.top - 4, R.w * 2, R.h * 0.8);
    const sh = ctx.createLinearGradient(R.cx + R.w * 0.08, 0, R.cx + R.w * 0.5, 0);    // the side away from the light
    sh.addColorStop(0, 'rgba(12,12,28,0)');
    sh.addColorStop(1, 'rgba(12,12,28,0.36)');
    ctx.fillStyle = sh; ctx.fillRect(R.cx - R.w, R.top - 10, R.w * 2, R.h * 1.6 + foot);
    const under = ctx.createLinearGradient(0, R.base - R.h * 0.15, 0, R.base + foot);  // and the foot is in its own shade
    under.addColorStop(0, 'rgba(8,8,20,0)');
    under.addColorStop(1, 'rgba(8,8,20,0.4)');
    ctx.fillStyle = under; ctx.fillRect(R.cx - R.w, R.base - R.h * 0.15, R.w * 2, R.h * 0.15 + foot);
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,248,232,0.3)';              // light along the top
    ctx.lineWidth = 2.5 * R.s; ctx.lineCap = 'round';
    ctx.beginPath();
    smoothPath(ctx, R.pts.slice(3, Math.floor(R.pts.length * 0.6)).map(p => [p[0] + 1, p[1] + 2.5 * R.s]));
    ctx.stroke();
}

/** A rock as a picture of its own: { canvas, x, y, w, h } in scene coordinates. */
export function rockSprite(R, scale) {
    const pad = 6, x = R.cx - R.w * 0.56 - pad, y = R.top - pad, w = R.w * 1.12 + pad * 2, h = R.base + R.w * 0.13 - R.top + pad * 2;
    const { canvas, ctx } = layer(w, h, scale);
    ctx.translate(-x, -y);
    drawRock(ctx, R);
    return { canvas, x, y, w, h };
}

/** A rock the sand still covers: a low mound, and a corner of stone. */
function drawBuried(ctx, R) {
    const r = seeded(R.seed + 9), w = R.w, e = w * 0.07;
    ctx.fillStyle = 'rgba(40,30,20,0.18)';
    ctx.beginPath(); ctx.ellipse(R.cx + w * 0.05, R.base + e * 0.6, w * 0.6, e * 1.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = rgb(mix([120, 116, 112], [90, 92, 100], r()));
    ctx.beginPath(); ctx.ellipse(R.cx + (r() - 0.5) * w * 0.3, R.base - e * 2.4, w * 0.16, e * 1.9, r() - 0.5, 0, TAU); ctx.fill();
    const g = ctx.createLinearGradient(0, R.base - e * 4, 0, R.base + e);
    g.addColorStop(0, rgb(mix(SAND, [255, 244, 214], 0.3)));
    g.addColorStop(1, rgb(SAND_DEEP));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(R.cx - w * 0.6, R.base + e);
    ctx.bezierCurveTo(R.cx - w * 0.3, R.base - e * 4.2, R.cx + w * 0.3, R.base - e * 3.8, R.cx + w * 0.6, R.base + e);
    ctx.bezierCurveTo(R.cx + w * 0.3, R.base + e * 2.4, R.cx - w * 0.3, R.base + e * 2.4, R.cx - w * 0.6, R.base + e);
    ctx.fill();
    for (let k = 0; k < 14; k++) {
        ctx.fillStyle = `rgba(120,92,56,${0.1 + r() * 0.2})`;
        ctx.fillRect(R.cx + (r() - 0.5) * w * 0.9, R.base - r() * e * 2.6, 1.5, 1.2);
    }
}

/** Draw the rim, the floor of the pool, the near sand, the shadows and the buried rocks into a layer. */
export function buildStatic(L, rocks, on, seed, scale) {
    const { W, H } = L;
    const { canvas, ctx } = layer(W, H, scale);
    const r = seeded(seed * 13 + 3);

    const floor = ctx.createLinearGradient(0, L.yFar, 0, L.yNear);      // the floor: weedy stone far out, sand near
    floor.addColorStop(0, rgb([70, 82, 78]));
    floor.addColorStop(0.35, rgb([112, 116, 98]));
    floor.addColorStop(0.75, rgb(mix(SAND_DEEP, [120, 116, 96], 0.45)));
    floor.addColorStop(1, rgb(SAND_DEEP));
    ctx.fillStyle = floor;
    ctx.fillRect(0, L.yFar - 2, W, L.yNear - L.yFar + H * 0.03);
    for (let k = 0; k < W * 0.9; k++) {                     // pebbles, smaller and closer together far away
        const d = r(), y = L.floorY(d), s = L.sc(d), x = r() * W;
        const size = (1 + r() * r() * 9) * s;
        const tone = mix([70, 74, 80], [190, 180, 160], r());
        ctx.fillStyle = 'rgba(20,20,28,0.22)';
        ctx.beginPath(); ctx.ellipse(x + size * 0.3, y + size * 0.3, size * 1.1, size * 0.45, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = rgba(tone, 0.85);
        ctx.beginPath(); ctx.ellipse(x, y, size, size * 0.5, r() * 0.6 - 0.3, 0, TAU); ctx.fill();
        if (size > 4) { ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.ellipse(x - size * 0.25, y - size * 0.14, size * 0.4, size * 0.14, 0, 0, TAU); ctx.fill(); }
    }
    for (let k = 0; k < W / 9; k++) {                       // patches of weed and pale sand on the floor
        const d = r(), y = L.floorY(d), s = L.sc(d);
        ctx.fillStyle = r() < 0.5 ? `rgba(60,96,56,${0.08 + r() * 0.12})` : `rgba(236,220,180,${0.05 + r() * 0.1})`;
        ctx.beginPath(); ctx.ellipse(r() * W, y, (14 + r() * 50) * s, (4 + r() * 10) * s, 0, 0, TAU); ctx.fill();
    }

    const rim = (y0, amp, tones) => {                       // the rim of rock behind the pool
        const pts = [];
        let y = y0;
        for (let x = -40; x <= W + 40; x += 18 + r() * 26) {
            y = clamp(y + (r() - 0.5) * amp * 1.1, y0 - amp, y0 + amp);
            pts.push([x, y + (r() < 0.2 ? -amp * 0.5 * r() : 0)]);
        }
        const g = ctx.createLinearGradient(0, y0 - amp, 0, L.yFar + H * 0.012);
        g.addColorStop(0, rgb(tones[0])); g.addColorStop(1, rgb(tones[1]));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-40, L.yFar + H * 0.012);
        smoothPath(ctx, pts, false, true);
        ctx.lineTo(W + 40, L.yFar + H * 0.012);
        const n = 14;                                       // its foot is uneven
        for (let k = n; k >= 0; k--) ctx.lineTo((W + 80) * k / n - 40, L.yFar + H * (0.004 + r() * 0.014));
        ctx.closePath(); ctx.fill();
        return pts;
    };
    rim(L.ridge, H * 0.012, [[122, 112, 104], [70, 66, 70]]);
    const near = rim(L.ridge + (L.yFar - L.ridge) * 0.45, H * 0.014, [[100, 92, 86], [44, 46, 58]]);
    ctx.strokeStyle = 'rgba(255,246,230,0.14)'; ctx.lineWidth = 2;
    ctx.beginPath(); smoothPath(ctx, near.map(p => [p[0], p[1] + 2])); ctx.stroke();
    for (let k = 0; k < W / 12; k++) {                      // barnacle dust and cracks on it
        ctx.fillStyle = `rgba(236,230,214,${r() * 0.3})`;
        ctx.fillRect(r() * W, lerp(L.ridge + H * 0.02, L.yFar, r()), 1.5 + r() * 2, 1.2 + r() * 1.4);
    }

    const edge = [];                                        // the near sand, where you stand
    for (let x = -40; x <= W + 40; x += 36) edge.push([x, L.yNear + Math.sin(x * 0.011 + seed) * H * 0.006 + (r() - 0.5) * H * 0.006]);
    const sg = ctx.createLinearGradient(0, L.yNear, 0, H);
    sg.addColorStop(0, rgb(SAND_DEEP));
    sg.addColorStop(0.3, rgb(SAND));
    sg.addColorStop(1, rgb(mix(SAND, [240, 226, 190], 0.5)));
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(-40, H + 4);
    smoothPath(ctx, edge, false, true);
    ctx.lineTo(W + 40, H + 4); ctx.closePath(); ctx.fill();
    for (let k = 0; k < W / 3; k++) {                       // grains, ripples, a few pebbles
        const x = r() * W, y = lerp(L.yNear + H * 0.008, H, r());
        ctx.fillStyle = r() < 0.5 ? `rgba(255,248,225,${r() * 0.3})` : `rgba(110,84,50,${r() * 0.2})`;
        ctx.fillRect(x, y, 1 + r() * 1.6, 1 + r() * 1.2);
    }
    ctx.lineWidth = 1.5;
    for (let k = 0; k < W / 90; k++) {
        const x = r() * W, y = lerp(L.yNear + H * 0.03, H * 0.99, r()), w = 30 + r() * 80;
        ctx.strokeStyle = `rgba(140,112,70,${0.08 + r() * 0.1})`;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w / 2, y - 4 - r() * 5, x + w, y + (r() - 0.5) * 4); ctx.stroke();
    }

    for (const R of rocks) {
        if (!on[R.i]) { if (!R.ledge) drawBuried(ctx, R); continue; }
        ctx.fillStyle = 'rgba(14,14,26,0.3)';               // the shadow it casts on the floor
        ctx.beginPath(); ctx.ellipse(R.cx + R.w * 0.14, R.base + R.w * 0.07, R.w * 0.62, R.w * 0.17, 0, 0, TAU); ctx.fill();
    }
    return canvas;
}

/** A cairn: stones balanced on the floor beside a rock. */
export function drawCairn(ctx, x, y, s, seed) {
    const r = seeded(seed + 77);
    ctx.fillStyle = 'rgba(30,24,20,0.3)';
    ctx.beginPath(); ctx.ellipse(x + s * 0.2, y + s * 0.12, s * 1.3, s * 0.3, 0, 0, TAU); ctx.fill();
    let yy = y, w = s;
    for (let k = 0; k < 4; k++) {
        const hh = w * (0.42 + r() * 0.1), tone = mix([150, 152, 158], [226, 216, 200], r());
        const dx = (r() - 0.5) * w * 0.22;
        const g = ctx.createLinearGradient(0, yy - hh * 2, 0, yy);
        g.addColorStop(0, rgb(mix(tone, [255, 255, 255], 0.35)));
        g.addColorStop(1, rgb(mix(tone, [30, 30, 44], 0.45)));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x + dx, yy - hh, w, hh, (r() - 0.5) * 0.16, 0, TAU); ctx.fill();
        yy -= hh * 1.72; w *= 0.72;
    }
}
