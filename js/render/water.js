/*
 * water.js: the sea beyond the pool, and the water in it. The surface
 * stands as high as the tide; the wind raises the waves.
 */
import { clamp, lerp, mix, rgb, rgba, smoothstep, TAU } from './util.js';
import { hash } from '../core/rng.js';
import { lamp } from './sky.js';

/** The far sea, the headland and its lighthouse. */
export function drawSea(ctx, L, env, t, col) {
    const { W, H, horizon } = L;
    const bottom = L.ridge + H * 0.08;
    const deep = mix([10, 26, 58], [38, 112, 150], col.light);
    const far = mix(col.bot, deep, 0.45);
    const g = ctx.createLinearGradient(0, horizon, 0, bottom);
    g.addColorStop(0, rgb(far));
    g.addColorStop(1, rgb(deep));
    ctx.fillStyle = g;
    ctx.fillRect(0, horizon, W, bottom - horizon);

    const hx = W * 0.08 - L.pan * 0.05, hw = Math.max(W * 0.3, H * 0.34);
    const land = mix([10, 14, 30], [70, 92, 104], col.light);
    ctx.fillStyle = rgb(mix(land, col.bot, 0.35));          // the headland
    ctx.beginPath();
    ctx.moveTo(hx - hw * 0.6, horizon + 1);
    ctx.bezierCurveTo(hx - hw * 0.3, horizon - H * 0.035, hx - hw * 0.05, horizon - H * 0.05, hx + hw * 0.1, horizon - H * 0.032);
    ctx.bezierCurveTo(hx + hw * 0.3, horizon - H * 0.02, hx + hw * 0.42, horizon - H * 0.006, hx + hw * 0.6, horizon + 1);
    ctx.closePath(); ctx.fill();
    const lx = hx + hw * 0.02, ly = horizon - H * 0.046, lh = H * 0.05;
    ctx.fillStyle = rgb(mix([40, 44, 60], [238, 236, 228], col.light));
    ctx.beginPath();                                        // the lighthouse
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
    const near = mix([10, 44, 66], [64, 170, 172], col.light);
    const g = ctx.createLinearGradient(0, y0, 0, L.shore);
    g.addColorStop(0, rgba(far, 0.66 * body));
    g.addColorStop(0.4, rgba(mix(far, near, 0.6), 0.52 * body));
    g.addColorStop(1, rgba(near, 0.32 * body));
    ctx.fillStyle = g;
    ctx.fill();

    ctx.save();
    ctx.clip();
    const span = L.shore - y0, wind = env.weather.wind + (env.storm ? 0.5 : 0);
    ctx.lineCap = 'round';
    for (let j = 1; j < 18; j++) {                          // the waves, closer together far away
        const f = j / 18, y = y0 + Math.pow(f, 1.6) * span;
        const amp = (0.5 + 3.2 * f) * (0.4 + wind) * L.H / 700;
        ctx.strokeStyle = rgba(mix(sky, [255, 255, 255], 0.6), (0.05 + 0.13 * f) * (0.5 + 0.5 * body));
        ctx.lineWidth = 0.8 + 1.4 * f;
        ctx.beginPath();
        const k = 0.05 / (0.25 + f), run = t * (0.5 + 0.9 * f) + j * 1.9;
        for (let x = -10; x <= W + 10; x += 10) {
            const yy = y + amp * (Math.sin(x * k + run) + 0.5 * Math.sin(x * k * 2.3 - run * 1.3));
            if (x === -10) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
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

    ctx.lineWidth = 2.5;                                    // the edge on the sand, and its foam
    ctx.strokeStyle = rgba(mix([150, 175, 215], [255, 255, 255], col.light), 0.8);
    ctx.beginPath();
    for (let x = -10; x <= W + 10; x += 12) { const y = shoreY(L, env, t, x); if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = rgba(mix([90, 120, 170], [230, 250, 248], col.light), 0.18);
    ctx.beginPath();
    for (let x = -10; x <= W + 10; x += 12) { const y = shoreY(L, env, t, x) - 5; if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
}

/** Where the surface meets a rock that stands out of it: a bright ring around it. */
export function drawRing(ctx, R, wl, t, col) {
    let x0 = Infinity, x1 = -Infinity;
    for (const p of R.pts) if (p[1] < wl) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
    if (x1 <= x0 || wl >= R.base) return;
    const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2 + 3 * R.s + Math.sin(t * 1.3 + R.i) * 1.5 * R.s;
    ctx.strokeStyle = rgba(mix([150, 175, 215], [255, 255, 255], col.light), 0.6);
    ctx.lineWidth = 1.6 * R.s;
    ctx.beginPath(); ctx.ellipse(cx, wl, rx, rx * 0.2, 0, 0.05, Math.PI - 0.05); ctx.stroke();
    ctx.strokeStyle = rgba([255, 255, 255], 0.14);
    ctx.lineWidth = 4 * R.s;
    ctx.beginPath(); ctx.ellipse(cx, wl, rx * 1.2, rx * 0.26, 0, 0.1, Math.PI - 0.1); ctx.stroke();
}
