/*
 * water.js: the sea beyond the pool, and the water in it. The surface
 * stands as high as the tide; the wind raises the waves.
 */
import { clamp, lerp, mix, rgb, rgba, smoothstep, TAU } from './util.js';
import { hash } from '../core/rng.js';
import { lamp } from './sky.js';

/** The height of the surface at scene x. */
export function surfaceY(L, env, t, x) {
    const a = L.H * (0.004 + 0.011 * env.weather.wind + (env.storm ? 0.008 : 0));
    const k = TAU / (L.H * 0.55);
    return L.yWater + a * (Math.sin(x * k + t * 1.1) + 0.55 * Math.sin(x * k * 2.3 - t * 1.7 + 1.3) + 0.3 * Math.sin(x * k * 5.1 + t * 2.6));
}

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

/** The water of the pool, over the rocks and what lives on them. Scene coordinates. */
export function drawWater(ctx, L, env, t, col) {
    const x0 = L.pan - 20, x1 = L.pan + L.W + 20;
    const bottom = L.floor + L.H * 0.022;
    const step = 10;
    ctx.beginPath();
    ctx.moveTo(x0, bottom);
    for (let x = x0; x <= x1; x += step) ctx.lineTo(x, Math.min(bottom, surfaceY(L, env, t, x)));
    ctx.lineTo(x1, bottom);
    ctx.closePath();

    const top = mix([18, 60, 92], [70, 186, 190], col.light);
    const deep = mix([4, 18, 44], [10, 74, 112], col.light);
    const g = ctx.createLinearGradient(0, L.yWater, 0, bottom);
    g.addColorStop(0, rgba(top, 0.3));
    g.addColorStop(0.5, rgba(mix(top, deep, 0.5), 0.36));
    g.addColorStop(1, rgba(deep, 0.5));
    ctx.fillStyle = g;
    ctx.fill();

    ctx.save();
    ctx.clip();
    const depth = bottom - L.yWater;
    if (col.light > 0.35 && depth > L.H * 0.05) {           // shafts of light
        ctx.globalCompositeOperation = 'lighter';
        const n = Math.ceil(L.W / (L.H * 0.16)) + 2;
        const first = Math.floor(x0 / (L.H * 0.16));
        for (let i = first; i < first + n; i++) {
            const a = (0.5 + 0.5 * Math.sin(t * 0.5 + i * 2.1)) * 0.085 * (col.light - 0.35) * (1 - env.weather.cloud * 0.8);
            if (a < 0.004) continue;
            const x = i * L.H * 0.16 + Math.sin(t * 0.2 + i) * 14, w = L.H * (0.02 + 0.03 * hash(i, 51));
            const sg = ctx.createLinearGradient(0, L.yWater, 0, bottom);
            sg.addColorStop(0, `rgba(210,255,240,${a})`);
            sg.addColorStop(1, 'rgba(210,255,240,0)');
            ctx.fillStyle = sg;
            ctx.beginPath();
            ctx.moveTo(x, L.yWater - 6); ctx.lineTo(x + w, L.yWater - 6);
            ctx.lineTo(x + w * 2.4 - depth * 0.3, bottom); ctx.lineTo(x - w * 0.8 - depth * 0.3, bottom);
            ctx.closePath(); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = rgba(mix([120, 150, 190], [235, 255, 250], col.light), 0.5);   // drifting specks
    const cell = L.H * 0.09, f0 = Math.floor(x0 / cell);
    for (let i = f0; i < f0 + Math.ceil(L.W / cell) + 2; i++) {
        for (let j = 0; j < 3; j++) {
            const px = (i + hash(i, j + 60)) * cell + Math.sin(t * 0.4 + i + j) * 6;
            const py = L.yWater + ((hash(i, j + 70) + t * 0.008 * (1 + j)) % 1) * depth;
            ctx.globalAlpha = 0.25 + 0.4 * hash(i, j + 80);
            ctx.fillRect(px, py, 1.4, 1.4);
        }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.lineWidth = 2;                                      // the surface
    ctx.strokeStyle = rgba(mix([150, 175, 215], [255, 255, 255], col.light), 0.75);
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) {
        const y = surfaceY(L, env, t, x);
        if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = rgba(mix([90, 120, 170], [220, 250, 248], col.light), 0.16);
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) {
        const y = surfaceY(L, env, t, x) + 4;
        if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (env.weather.wind > 0.45) {                          // foam
        const k = smoothstep(0.45, 1, env.weather.wind);
        ctx.fillStyle = rgba(mix([170, 190, 220], [255, 255, 255], col.light), 0.75);
        const fc = L.H * 0.05, a0 = Math.floor(x0 / fc);
        for (let i = a0; i < a0 + Math.ceil(L.W / fc) + 2; i++) {
            const life = (hash(i, 90) + t * 0.25) % 1;
            if (hash(i, Math.floor(hash(i, 90) + t * 0.25)) > k * 0.6) continue;
            const x = (i + hash(i, 91)) * fc;
            ctx.globalAlpha = Math.sin(life * Math.PI) * 0.8;
            ctx.beginPath(); ctx.ellipse(x, surfaceY(L, env, t, x) - 1, 5 + 7 * hash(i, 92), 2, 0, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}
