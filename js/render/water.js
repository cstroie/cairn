/*
 * water.js: the sea beyond the pool, and the water in it. The surface
 * stands as high as the tide; the wind raises the waves.
 */
import { clamp, lerp, mix, rgb, rgba, smoothstep, TAU } from './util.js';
import { hash } from '../core/rng.js';
import { lamp } from './sky.js';
import { drawLand, seaTint } from './land.js';

/** The far sea, the headland and its lighthouse. */
export function drawSea(ctx, L, env, t, col) {
    const { W, H, horizon } = L;
    const bottom = L.ridge + H * 0.08;
    const deep = seaTint(L.land, col, 0.6) || mix([10, 26, 58], [38, 112, 150], col.light);
    const far = mix(col.bot, deep, 0.45);
    const g = ctx.createLinearGradient(0, horizon, 0, bottom);
    g.addColorStop(0, rgb(far));
    g.addColorStop(1, rgb(deep));
    ctx.fillStyle = g;
    ctx.fillRect(0, horizon, W, bottom - horizon);

    drawLand(ctx, L, env, t, col);

    const band = bottom - horizon;                          // the swell
    ctx.lineWidth = 1;
    for (let j = 1; j < 9; j++) {
        const f = j / 9, y = horizon + Math.pow(f, 1.7) * band;
        const amp = (0.6 + 2.2 * f) * (0.5 + env.weather.wind);
        ctx.strokeStyle = rgba(mix(col.bot, [255, 255, 255], 0.5), 0.05 + 0.11 * f);
        ctx.beginPath();
        for (let x = 0; x <= W + 12; x += 12) {
            const yy = y + amp * Math.sin((x + L.pan * (0.1 + 0.5 * f)) * 0.02 / (0.3 + f) + t * (0.6 + f) + j * 1.7);
            if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
    }

    const p = lamp(L, env);                                 // the glitter under the sun or the moon
    const strength = (p.up ? 0.75 : 0.42 * (0.2 + 0.8 * (1 - Math.abs(env.moon - 0.5) * 2))) * (1 - env.weather.cloud * 0.8);
    if (strength > 0.03) {
        const c = p.up ? mix([255, 250, 225], [255, 196, 140], 1 - smoothstep(0, 0.5, env.sun.alt)) : [220, 230, 255];
        const tick = Math.floor(t * 7);
        ctx.fillStyle = rgb(c);
        for (let i = 0; i < 70; i++) {
            const f = hash(i, 41);
            const y = horizon + 1 + f * f * band;
            const spread = (4 + f * band * 0.5) * (1 + env.weather.wind);
            const x = p.x + (hash(i, tick) - 0.5) * 2 * spread;
            ctx.globalAlpha = strength * hash(i + 99, tick) * (1 - f * 0.5);
            ctx.fillRect(x, y, 3 + f * 9, 1 + f * 1.2);
        }
        ctx.globalAlpha = 1;
    }
}

/** The near edge of the water, on the sand: it comes up the beach with the tide. */
export function shoreY(L, env, t, x) {
    const a = L.H * (0.003 + 0.006 * env.weather.wind);
    return L.shore + a * (Math.sin(x * 0.012 + t * 0.9) + 0.6 * Math.sin(x * 0.031 - t * 1.4 + 1.3)) + L.H * 0.004 * Math.sin(t * 0.7);
}

/**
 * The surface of the pool, seen from above: a sheet from the rim to the
 * near sand, standing L.hw above the floor. Thin at low water (a wet
 * floor), deep and reflecting the sky at high water. What is under it
 * was drawn before; what stands out of it is drawn again after.
 */
export function drawSurface(ctx, L, env, t, col) {
    const { W, H } = L, y0 = L.waterY(0) - 1;
    const body = clamp(0.2 + env.level * 1.25);             // how much water there is to look through
    ctx.beginPath();
    ctx.moveTo(-10, y0);
    ctx.lineTo(W + 10, y0);
    for (let x = W + 10; x >= -10; x -= 12) ctx.lineTo(x, shoreY(L, env, t, x));
    ctx.closePath();
    const sky = mix(col.bot, [255, 255, 255], 0.1);
    const far = mix(mix([14, 40, 70], [60, 150, 176], col.light), sky, 0.35);
    const near = seaTint(L.land, col, 1) || mix([10, 44, 66], [64, 170, 172], col.light);
    const g = ctx.createLinearGradient(0, y0, 0, L.shore);
    g.addColorStop(0, rgba(far, 0.55 * body));
    g.addColorStop(0.4, rgba(mix(far, near, 0.6), 0.4 * body));
    g.addColorStop(1, rgba(near, 0.22 * body));
    ctx.fillStyle = g;
    ctx.fill();

    ctx.save();
    ctx.clip();
    const span = L.shore - y0, wind = env.weather.wind + (env.storm ? 0.5 : 0);
    ctx.lineCap = 'round';
    for (let j = 1; j < 34; j++) {                          // ripples: short broken glints, closer together far away
        const f = j / 34, y = y0 + Math.pow(f, 1.5) * span, s = 0.5 + f;
        const amp = (0.4 + 2 * f) * (0.4 + wind) * L.H / 700;
        const len = (10 + 30 * f) * (0.6 + wind * 0.6), drift = t * (6 + 22 * f) * (0.4 + wind);
        const a = (0.04 + 0.16 * f) * (0.4 + 0.6 * body) * (0.5 + wind * 0.7);
        for (let k = -1; k < W / len + 1; k++) {
            const seedk = k + j * 997, life = (hash(seedk, 7) + t * (0.12 + 0.2 * wind)) % 1;
            const fade = Math.sin(life * Math.PI);
            if (fade < 0.25 || hash(seedk, 11) < 0.35) continue;
            const x = k * len * 1.3 + (hash(seedk, 3) - 0.5) * len + (drift % (len * 1.3));
            const yy = y + (hash(seedk, 5) - 0.5) * span * 0.03 + amp * Math.sin(x * 0.04 + t + j);
            const l = len * (0.3 + 0.7 * hash(seedk, 9)) * fade;
            ctx.strokeStyle = rgba(mix(sky, [255, 255, 255], 0.55 + 0.3 * hash(seedk, 13)), a * fade);
            ctx.lineWidth = (0.6 + 1.2 * f) * s * 0.8;
            ctx.beginPath(); ctx.moveTo(x - l / 2, yy); ctx.quadraticCurveTo(x, yy - amp * 0.8, x + l / 2, yy + amp * 0.2); ctx.stroke();
            if (hash(seedk, 17) < 0.5) {                    // the dark side of the ripple
                ctx.strokeStyle = rgba(mix(near, [0, 0, 0], 0.5), a * fade * 0.6);
                ctx.beginPath(); ctx.moveTo(x - l * 0.4, yy + 1.4 * s); ctx.lineTo(x + l * 0.4, yy + 1.4 * s); ctx.stroke();
            }
        }
    }
    const p = lamp(L, env);                                 // the sun or the moon on the water
    const strength = (p.up ? 0.7 : 0.4 * (0.2 + 0.8 * (1 - Math.abs(env.moon - 0.5) * 2))) * (1 - env.weather.cloud * 0.8) * body;
    if (strength > 0.03) {
        const c = p.up ? mix([255, 250, 225], [255, 196, 140], 1 - smoothstep(0, 0.5, env.sun.alt)) : [220, 230, 255];
        const tick = Math.floor(t * 6);
        ctx.fillStyle = rgb(c);
        for (let i = 0; i < 60; i++) {
            const f = hash(i, 45);
            const y = y0 + f * f * span * 0.8;
            const x = p.x + (hash(i, tick) - 0.5) * 2 * (W * 0.05 + f * W * 0.16) * (1 + wind * 0.6);
            ctx.globalAlpha = strength * hash(i + 77, tick) * (1 - f * 0.6);
            ctx.fillRect(x, y, 3 + f * 12, 1 + f * 1.6);
        }
        ctx.globalAlpha = 1;
    }
    if (env.weather.rain > 0.03) {                          // rings where the rain falls
        ctx.strokeStyle = rgba([255, 255, 255], 0.35);
        ctx.lineWidth = 1;
        for (let i = 0; i < env.weather.rain * 26; i++) {
            const life = (hash(i, 61) + t * 1.1) % 1, beat = Math.floor(hash(i, 61) + t * 1.1);
            const d = hash(i, beat + 3), x = hash(i, beat + 9) * W, y = L.waterY(d), s = L.sc(d);
            ctx.globalAlpha = 1 - life;
            ctx.beginPath(); ctx.ellipse(x, y, life * 16 * s, life * 5 * s, 0, 0, TAU); ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
    ctx.restore();

    drawSwash(ctx, L, env, t, col);
}

/**
 * The beach under the water's edge: dark wet sand the tide has just left,
 * and the swash, a thin sheet that runs up the sand, stops, and slides
 * back, with a lace of foam along its front.
 */
function drawSwash(ctx, L, env, t, col) {
    const { W, H } = L, wind = env.weather.wind + (env.storm ? 0.5 : 0);
    const reach = H * (0.012 + 0.03 * wind), step = 8;
    ctx.fillStyle = rgba(mix([60, 46, 30], [120, 96, 64], col.light), 0.28);    // wet sand
    ctx.beginPath();
    for (let x = -10; x <= W + 10; x += step) ctx.lineTo(x, shoreY(L, env, t, x) - 2);
    for (let x = W + 10; x >= -10; x -= step) ctx.lineTo(x, shoreY(L, env, t, x) + reach * 1.25 + H * 0.004 * Math.sin(x * 0.02));
    ctx.closePath(); ctx.fill();

    const P = 8, cyc = t / P;                               // the run and the backwash
    const run = x => {
        const ph = (cyc + 0.35 * Math.sin(x * 0.004 + 1.3) + 0.15 * Math.sin(x * 0.013)) % 1;
        const up = ph < 0.4 ? Math.sin(ph / 0.4 * Math.PI / 2) : Math.pow(1 - (ph - 0.4) / 0.6, 1.6);
        return { up, ph };
    };
    const front = [];
    for (let x = -10; x <= W + 10; x += step) {
        const { up, ph } = run(x), y = shoreY(L, env, t, x) + up * reach * (0.75 + 0.25 * Math.sin(x * 0.031 + 2));
        front.push([x, y, up, ph]);
    }
    const water = mix([90, 120, 150], [170, 210, 214], col.light);
    ctx.fillStyle = rgba(water, 0.3);
    ctx.beginPath();
    for (const p of front) ctx.lineTo(p[0], shoreY(L, env, t, p[0]) - 1);
    for (let k = front.length - 1; k >= 0; k--) ctx.lineTo(front[k][0], front[k][1]);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgba(mix(water, [255, 255, 255], 0.5), 0.25);            // its glassy edge
    ctx.lineWidth = 1;
    ctx.beginPath(); front.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();

    const foam = mix([150, 170, 200], [250, 252, 248], col.light);              // the lace of foam
    ctx.fillStyle = rgb(foam);
    for (let k = 0; k < front.length - 1; k++) {
        const [x, y, up, ph] = front[k], [x2, y2] = front[k + 1];
        const fresh = ph < 0.4 ? 1 : 1 - (ph - 0.4) / 0.6;
        for (let b = 0; b < 6; b++) {
            const id = k * 6 + b, u = hash(id, 21), d = hash(id, 23);
            if (hash(id, 29) > 0.35 + 0.5 * fresh) continue;
            const bx = lerp(x, x2, u), by = lerp(y, y2, u) - d * d * reach * 0.5 * (0.4 + up);
            ctx.globalAlpha = (0.25 + 0.6 * hash(id, 31)) * (0.3 + 0.7 * fresh);
            const r = (0.6 + 1.8 * hash(id, 37)) * (1 - d * 0.5);
            ctx.beginPath(); ctx.ellipse(bx, by, r * 1.6, r * 0.7, 0, 0, TAU); ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
}

/** Where the surface meets a rock that stands out of it: a bright ring around it. */
export function drawRing(ctx, R, wl, t, col) {
    let x0 = Infinity, x1 = -Infinity;
    for (const p of R.pts) if (p[1] < wl) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
    if (x1 <= x0 || wl >= R.base) return;
    const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2 + 3 * R.s + Math.sin(t * 1.3 + R.i) * 1.5 * R.s;
    ctx.strokeStyle = rgba(mix([150, 175, 215], [255, 255, 255], col.light), 0.5);
    ctx.lineWidth = 1.2 * R.s;
    ctx.setLineDash([3 * R.s, 2 * R.s, 7 * R.s, 3 * R.s]);
    ctx.lineDashOffset = -t * 4 * R.s;
    ctx.beginPath(); ctx.ellipse(cx, wl, rx, rx * 0.2, 0, 0.05, Math.PI - 0.05); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = rgba([255, 255, 255], 0.08);
    ctx.lineWidth = 4 * R.s;
    ctx.beginPath(); ctx.ellipse(cx, wl, rx * 1.2, rx * 0.26, 0, 0.1, Math.PI - 0.1); ctx.stroke();
}
