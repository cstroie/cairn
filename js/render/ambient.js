/*
 * ambient.js: what comes and goes around the pool: fish and prawns in the
 * water, gulls, a wading bird on the sand, a seal or dolphins out at sea,
 * an octopus at night, jellyfish, the sparkle of the sea, a rainbow,
 * shooting stars, and what a storm leaves on the sand.
 *
 * Nothing here has a state: where a thing is comes from the time, so it
 * can be drawn at any moment. Each thing that can be tapped is added to
 * `hits` as { id, x, y, r } in view coordinates (k: its number, for the
 * things on the sand).
 */
import { clamp, lerp, mix, rgb, rgba, smoothstep, TAU } from './util.js';
import { hash } from '../core/rng.js';
import { dayOf } from '../core/tide.js';
import { surfaceY } from './water.js';
import { lamp } from './sky.js';

/* ---------- the shapes ---------- */

function fish(ctx, x, y, s, dir, t, k = 0) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(dir, 1);
    const wag = Math.sin(t * 9 + k * 3) * 0.35;
    const g = ctx.createLinearGradient(0, -s * 0.4, 0, s * 0.4);
    g.addColorStop(0, k % 2 ? '#6d7a4a' : '#7a6a4a'); g.addColorStop(1, '#d8d2b0');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.bezierCurveTo(s * 0.6, -s * 0.5, -s * 0.5, -s * 0.42, -s * 0.9, 0);
    ctx.bezierCurveTo(-s * 0.5, s * 0.42, s * 0.6, s * 0.46, s, 0);
    ctx.fill();
    ctx.beginPath();                                               // the tail
    ctx.moveTo(-s * 0.8, 0); ctx.lineTo(-s * 1.4, -s * 0.4 + wag * s); ctx.lineTo(-s * 1.25, wag * s * 0.6); ctx.lineTo(-s * 1.4, s * 0.4 + wag * s);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(60,50,30,0.5)';
    for (const d of [-0.3, 0.05, 0.4]) { ctx.beginPath(); ctx.ellipse(d * s, -s * 0.12, s * 0.1, s * 0.16, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.62, -s * 0.1, s * 0.13, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(s * 0.66, -s * 0.1, s * 0.07, 0, TAU); ctx.fill();
    ctx.restore();
}

function shrimp(ctx, x, y, s, dir, t) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(dir, 1);
    ctx.strokeStyle = 'rgba(255,214,200,0.75)'; ctx.lineWidth = s * 0.32; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s, s * 0.25); ctx.quadraticCurveTo(-s * 0.2, -s * 0.5, s * 0.8, 0); ctx.stroke();
    ctx.lineWidth = s * 0.07; ctx.strokeStyle = 'rgba(255,230,220,0.8)';
    ctx.beginPath(); ctx.moveTo(s * 0.8, 0); ctx.quadraticCurveTo(s * 1.5, -s * 0.6, s * 2 + Math.sin(t * 3) * s * 0.2, -s * 0.2); ctx.stroke();
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-s * 0.4 + k * s * 0.3, 0); ctx.lineTo(-s * 0.45 + k * s * 0.3 + Math.sin(t * 12 + k) * s * 0.1, s * 0.4); ctx.stroke(); }
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(s * 0.75, -s * 0.12, s * 0.09, 0, TAU); ctx.fill();
    ctx.restore();
}

function gull(ctx, x, y, s, flap, col) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = col; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.1 - flap * s * 0.4);
    ctx.quadraticCurveTo(-s * 0.5, -s * 0.5 - flap * s * 0.15, 0, 0);
    ctx.quadraticCurveTo(s * 0.5, -s * 0.5 - flap * s * 0.15, s, -s * 0.1 - flap * s * 0.4);
    ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, s * 0.04, s * 0.2, s * 0.1, 0, 0, TAU); ctx.fill();
    ctx.restore();
}

function wader(ctx, x, y, s, dir, t, peck) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(dir, 1);
    const step = peck ? 0 : Math.sin(t * 8);
    ctx.strokeStyle = '#e88a8a'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.5); ctx.lineTo(-s * 0.1 + step * s * 0.2, 0); ctx.moveTo(s * 0.1, -s * 0.5); ctx.lineTo(s * 0.1 - step * s * 0.2, 0); ctx.stroke();
    ctx.rotate(peck ? 0.7 : 0);
    ctx.fillStyle = '#16161c';
    ctx.beginPath(); ctx.ellipse(0, -s * 0.72, s * 0.5, s * 0.3, -0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f6f4ee';
    ctx.beginPath(); ctx.ellipse(s * 0.02, -s * 0.6, s * 0.4, s * 0.17, -0.1, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#16161c';
    ctx.beginPath(); ctx.arc(s * 0.5, -s * 1.02, s * 0.19, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#f0702a'; ctx.lineWidth = s * 0.09;
    ctx.beginPath(); ctx.moveTo(s * 0.64, -s * 1.0); ctx.lineTo(s * 1.2, -s * 0.9); ctx.stroke();
    ctx.fillStyle = '#e03020'; ctx.beginPath(); ctx.arc(s * 0.54, -s * 1.05, s * 0.05, 0, TAU); ctx.fill();
    ctx.restore();
}

function seal(ctx, x, y, s, t, col) {
    const up = Math.sin(t * 0.23) > -0.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.ellipse(x, y, s * (1.2 + k * 0.8 + (t * 0.3 % 0.8)), s * 0.14 * (1 + k), 0, 0, TAU); ctx.stroke(); }
    if (!up) return;
    const bob = Math.sin(t * 1.3) * s * 0.08;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.55, y);
    ctx.bezierCurveTo(x - s * 0.6, y - s * 1.1 + bob, x + s * 0.4, y - s * 1.2 + bob, x + s * 0.75, y - s * 0.55 + bob);
    ctx.bezierCurveTo(x + s * 0.9, y - s * 0.4 + bob, x + s * 0.7, y - s * 0.1, x + s * 0.55, y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0a0a10'; ctx.beginPath(); ctx.arc(x + s * 0.28, y - s * 0.72 + bob, s * 0.09, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + s * 0.76, y - s * 0.5 + bob, s * 0.06, 0, TAU); ctx.fill();
}

function dolphin(ctx, x, y, s, p, col) {
    if (p < 0 || p > 1) return;
    ctx.save();
    ctx.translate(x + p * s * 4, y - Math.sin(Math.PI * p) * s * 1.6);
    ctx.rotate(lerp(-0.9, 0.9, p));
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.bezierCurveTo(s * 0.5, -s * 0.45, -s * 0.6, -s * 0.4, -s, 0);
    ctx.lineTo(-s * 1.3, -s * 0.25); ctx.lineTo(-s * 1.2, s * 0.05); ctx.lineTo(-s * 1.3, s * 0.3); ctx.lineTo(-s, 0.05 * s);
    ctx.bezierCurveTo(-s * 0.4, s * 0.3, s * 0.5, s * 0.25, s, 0);
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.3); ctx.lineTo(-s * 0.35, -s * 0.72); ctx.lineTo(-s * 0.45, -s * 0.28); ctx.fill();
    ctx.restore();
}

function octopus(ctx, x, y, s, t) {
    ctx.save();
    ctx.translate(x, y);
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.8);
    const body = mix([196, 84, 56], [226, 130, 92], pulse);
    ctx.lineCap = 'round';
    for (let k = 0; k < 6; k++) {                                  // arms
        const a0 = Math.PI * (0.05 + 0.18 * k), len = s * (1.1 + 0.3 * Math.sin(k * 2.2));
        ctx.strokeStyle = rgb(mix(body, [90, 30, 30], 0.2)); ctx.lineWidth = s * 0.2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a0) * s * 0.4, s * 0.1);
        const ex = Math.cos(a0) * len, ey = s * 0.5 + Math.sin(t * 1.1 + k * 1.3) * s * 0.12;
        ctx.bezierCurveTo(Math.cos(a0) * len * 0.6, s * 0.75, ex, s * 0.75, ex + Math.cos(t * 0.9 + k) * s * 0.15, ey);
        ctx.stroke();
    }
    const g = ctx.createRadialGradient(-s * 0.2, -s * 0.6, s * 0.1, 0, -s * 0.3, s);
    g.addColorStop(0, rgb(mix(body, [255, 220, 190], 0.4))); g.addColorStop(1, rgb(mix(body, [70, 20, 30], 0.35)));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, -s * 0.35, s * 0.62, s * (0.7 + 0.04 * pulse), 0, 0, TAU); ctx.fill();
    for (const dx of [-0.26, 0.26]) {
        ctx.fillStyle = '#f6e8b8'; ctx.beginPath(); ctx.ellipse(dx * s, -s * 0.08, s * 0.14, s * 0.12, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#111'; ctx.fillRect(dx * s - s * 0.1, -s * 0.11, s * 0.2, s * 0.055);
    }
    ctx.restore();
}

function jelly(ctx, x, y, s, t, k = 0) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + k * 2);
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(255,235,250,0.4)'; ctx.lineWidth = 1; ctx.lineCap = 'round';
    for (let j = -3; j <= 3; j++) {
        ctx.beginPath(); ctx.moveTo(j * s * 0.22, 0);
        ctx.quadraticCurveTo(j * s * 0.22 + Math.sin(t * 1.2 + j) * s * 0.25, s * 0.8, j * s * 0.16, s * (1.3 + 0.3 * pulse));
        ctx.stroke();
    }
    const g = ctx.createRadialGradient(0, -s * 0.4, 0, 0, -s * 0.2, s);
    g.addColorStop(0, 'rgba(255,240,255,0.75)'); g.addColorStop(1, 'rgba(210,180,255,0.22)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, s * (0.82 + 0.12 * pulse), s * (0.7 - 0.12 * pulse), 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,240,0.6)'; ctx.lineWidth = 1.4;
    for (const [dx, dy] of [[-0.2, -0.3], [0.2, -0.3], [-0.2, -0.12], [0.2, -0.12]]) { ctx.beginPath(); ctx.arc(dx * s, dy * s, s * 0.13, 0, TAU); ctx.stroke(); }
    ctx.restore();
}

function star(ctx, x, y, s, t) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(1, 0.6);
    ctx.fillStyle = '#e8743a';
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + k * TAU / 5 + (k === 1 ? Math.sin(t * 3) * 0.25 : 0);
        ctx.lineTo(Math.cos(a - TAU / 10) * s * 0.4, Math.sin(a - TAU / 10) * s * 0.4);
        ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,190,0.8)';
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * TAU / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5, s * 0.07, 0, TAU); ctx.fill(); }
    ctx.restore();
}

function bottle(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(-1.15);
    ctx.fillStyle = 'rgba(70,150,110,0.78)';
    ctx.beginPath(); ctx.roundRect(-s * 0.3, -s * 0.5, s * 0.6, s * 1.2, s * 0.14); ctx.fill();
    ctx.fillRect(-s * 0.12, -s * 0.95, s * 0.24, s * 0.5);
    ctx.fillStyle = '#b98a50'; ctx.fillRect(-s * 0.13, -s * 1.1, s * 0.26, s * 0.2);
    ctx.fillStyle = '#f6edd2'; ctx.fillRect(-s * 0.14, -s * 0.3, s * 0.28, s * 0.75);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-s * 0.24, -s * 0.42, s * 0.08, s * 0.95);
    ctx.restore();
}

function driftwood(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(0.12);
    ctx.fillStyle = '#8a7256';
    ctx.beginPath(); ctx.roundRect(-s * 1.5, -s * 0.26, s * 3, s * 0.46, s * 0.2); ctx.fill();
    ctx.fillRect(s * 0.4, -s * 0.6, s * 0.2, s * 0.4);
    ctx.strokeStyle = 'rgba(50,36,22,0.5)'; ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-s * 1.3, -s * 0.14 + k * s * 0.13); ctx.lineTo(s * 1.3, -s * 0.16 + k * s * 0.13); ctx.stroke(); }
    ctx.restore();
}

function net(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
        ctx.strokeStyle = k % 2 ? 'rgba(40,150,160,0.85)' : 'rgba(60,170,110,0.85)';
        const a = hash(k, 301) * TAU, b = hash(k, 302) * TAU;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 1.2, Math.sin(a) * s * 0.4);
        ctx.bezierCurveTo(Math.cos(b) * s, -s * 0.7 * hash(k, 303), Math.cos(a + 2) * s, s * 0.3, Math.cos(b + 1) * s * 1.2, Math.sin(b) * s * 0.4);
        ctx.stroke();
    }
    ctx.fillStyle = '#f08030'; ctx.beginPath(); ctx.ellipse(s * 0.7, -s * 0.25, s * 0.26, s * 0.2, 0, 0, TAU); ctx.fill();
    ctx.restore();
}

/* ---------- where they are ---------- */

/** Out at sea and in the sky. View coordinates; call after the sea, before the pool. */
export function drawFar(ctx, L, env, t, col, about, hits) {
    const { W, H, horizon } = L, d = dayOf(env.M);
    const dark = rgb(mix([14, 18, 30], [52, 58, 66], col.light));
    if (about.has('rainbow')) {
        const p = lamp(L, env), cx = W - p.x, cy = horizon + H * 0.12, R = Math.min(W * 0.5, H * 0.5);
        const a = clamp(env.weather.rain * 3) * 0.2 * (1 - env.weather.cloud * 0.5);
        ctx.lineWidth = R * 0.022;
        ['255,60,60', '255,160,40', '250,230,70', '80,200,90', '70,140,240', '140,90,220'].forEach((c, k) => {
            ctx.strokeStyle = `rgba(${c},${a})`;
            ctx.beginPath(); ctx.arc(cx, cy, R - k * R * 0.022, Math.PI, TAU); ctx.stroke();
        });
    }
    if (about.has('shooting')) {
        const every = env.fields.month === 7 ? 6 : 13, beat = Math.floor(t / every), u = (t % every) / 0.7;
        if (u < 1 && hash(beat, 201) < 0.6) {
            const x = W * (0.15 + 0.7 * hash(beat, 202)), y = horizon * (0.1 + 0.45 * hash(beat, 203)), len = H * 0.18;
            const hx = x + u * len, hy = y + u * len * 0.45;
            const g = ctx.createLinearGradient(hx - len * 0.35, hy - len * 0.16, hx, hy);
            g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(255,255,255,${Math.sin(Math.PI * u)})`);
            ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(hx - len * 0.35, hy - len * 0.16); ctx.lineTo(hx, hy); ctx.stroke();
        }
    }
    const band = L.ridge - horizon;
    if (about.has('seal')) {
        const x = W * (0.3 + 0.5 * hash(d, 211)) - L.pan * 0.08, y = horizon + band * 0.45, s = H * 0.022;
        seal(ctx, x, y, s, t, dark);
        hits.push({ id: 'seal', x, y: y - s * 0.5, r: s * 2.6 });
    }
    if (about.has('dolphin')) {
        const x0 = W * (0.2 + 0.4 * hash(d, 212)) - L.pan * 0.06 + ((t * 9) % (W * 0.3)), y = horizon + band * 0.22, s = H * 0.016;
        for (let k = 0; k < 3; k++) dolphin(ctx, x0 + k * s * 3, y, s, ((t * 0.45 + k * 0.37) % 2.2), dark);
        hits.push({ id: 'dolphin', x: x0 + s * 5, y: y - s, r: s * 7 });
    }
    if (about.has('gull')) {
        const wing = rgb(mix([40, 44, 60], [250, 250, 250], col.light));
        for (let k = 0; k < 3; k++) {
            const sp = 0.012 + 0.012 * hash(k, 221), dir = k % 2 ? -1 : 1;
            const f = ((hash(k, 222) + t * sp * dir) % 1 + 1) % 1;
            const x = f * (W + 240) - 120, y = horizon * (0.22 + 0.5 * hash(k, 223)) + Math.sin(t * 0.4 + k * 2) * H * 0.02;
            const s = H * (0.016 + 0.012 * hash(k, 224));
            const glide = Math.sin(t * 0.3 + k * 4) > 0.2;
            gull(ctx, x, y, s, glide ? Math.sin(t * 0.8 + k) * 0.15 : Math.sin(t * 7 + k), wing);
            hits.push({ id: 'gull', x, y, r: s * 2.4 });
        }
    }
}

/** In the water. Scene coordinates; call before the water is drawn over. */
export function drawPool(ctx, L, env, t, col, about, hits) {
    const depth = L.floor - L.yWater, H = L.H;
    const hit = (id, x, y, r) => hits.push({ id, x: x - L.pan, y, r });
    if (about.has('octopus') && L.spots.length) {
        const R = L.spots[Math.floor(hash(env.tide, 231) * L.spots.length)], s = H * 0.032;
        const x = R.cx + R.w * 0.56, y = L.floor - s * 0.45;
        octopus(ctx, x, y, s, t);
        hit('octopus', x, y - s * 0.3, s * 1.8);
    }
    if (about.has('jelly') && depth > H * 0.1) {
        for (let k = 0; k < 2; k++) {
            const x = ((hash(env.tide, 241 + k) * L.MW + t * (4 + 3 * k)) % (L.MW + 200)) - 100;
            const y = L.yWater + depth * (0.25 + 0.3 * hash(k, 243)) + Math.sin(t * 0.5 + k * 3) * depth * 0.08, s = H * 0.026;
            jelly(ctx, x, y, s, t, k);
            hit('jelly', x, y, s * 2);
        }
    }
    if (about.has('fish') && depth > H * 0.07) {
        const n = depth > H * 0.16 ? 7 : 3;
        for (let k = 0; k < n; k++) {
            const dir = k % 3 ? 1 : -1, sp = H * (0.035 + 0.04 * hash(k, 251));
            const span = L.SW + 300;
            const dart = Math.max(0, Math.sin(t * 0.35 + k * 1.7)) * 40;
            const x = (((hash(k, 252) * span + dir * (t * sp + dart)) % span) + span) % span - 150;
            const y = L.yWater + depth * (0.22 + 0.62 * hash(k, 253)) + Math.sin(t * 0.7 + k) * H * 0.008, s = H * (0.011 + 0.006 * hash(k, 254));
            fish(ctx, x, y, s, dir, t, k);
            hit('fish', x, y, s * 2.6);
        }
    }
    if (about.has('shrimp') && depth > H * 0.03) {
        for (let k = 0; k < 4; k++) {
            const hop = Math.floor(t * 0.4 + hash(k, 261) * 9), dir = hash(k, hop) < 0.5 ? 1 : -1;
            const u = (t * 0.4 + hash(k, 261) * 9) % 1;
            const x0 = L.MW * (0.08 + 0.84 * hash(k, hop + 5)), x = x0 + dir * smoothstep(0, 0.25, u) * H * 0.05;
            const y = Math.max(L.yWater + H * 0.012, L.floor - H * (0.012 + 0.02 * hash(k, 263))), s = H * 0.008;
            shrimp(ctx, x, y, s, dir, t);
            hit('shrimp', x, y, s * 3.4);
        }
    }
}

/** Over the water and on the sand. Scene coordinates. */
export function drawOver(ctx, L, env, t, col, about, hits) {
    const H = L.H;
    if (about.has('glow')) {                                        // the sea sparkles where it moves
        ctx.globalCompositeOperation = 'lighter';
        const cell = H * 0.035, first = Math.floor(L.pan / cell);
        for (let i = first; i < first + Math.ceil(L.W / cell) + 1; i++) {
            const tw = Math.pow(Math.max(0, Math.sin(t * (1.5 + hash(i, 271) * 2) + hash(i, 272) * 9)), 6);
            if (tw < 0.05) continue;
            const x = (i + hash(i, 273)) * cell, y = surfaceY(L, env, t, x) + hash(i, 274) * H * 0.02;
            const g = ctx.createRadialGradient(x, y, 0, x, y, H * 0.012);
            g.addColorStop(0, `rgba(120,235,255,${0.9 * tw})`); g.addColorStop(1, 'rgba(60,160,255,0)');
            ctx.fillStyle = g; ctx.fillRect(x - H * 0.012, y - H * 0.012, H * 0.024, H * 0.024);
        }
        ctx.globalCompositeOperation = 'source-over';
    }
    if (about.has('wader')) {
        const ph = t * 0.05 + hash(dayOf(env.M), 281) * 6;
        const x = L.MW * (0.5 + 0.36 * Math.sin(ph)), dir = Math.cos(ph) >= 0 ? 1 : -1;
        const y = L.floor + H * 0.05, s = H * 0.03, peck = Math.sin(t * 0.9) > 0.72;
        wader(ctx, x, y, s, dir, peck ? 0 : t, peck);
        hits.push({ id: 'wader', x: x - L.pan, y: y - s * 0.6, r: s * 1.5 });
    }
}

/** What lies on the sand: beach.items [{ k, x, done }]. Scene coordinates. */
export function drawBeach(ctx, L, t, beach, hits) {
    if (!beach) return;
    const s = L.H * 0.02;
    beach.items.forEach((it, k) => {
        if (it.done) return;
        const x = L.MW * (0.05 + 0.9 * it.x), y = L.floor + L.H * (0.04 + 0.03 * hash(k, 291));
        ctx.strokeStyle = `rgba(255,255,255,${0.25 + 0.25 * Math.sin(t * 2.5 + k)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x, y, s * 2.3, s * 1.1, 0, 0, TAU); ctx.stroke();
        if (it.k === 'strandedStar') star(ctx, x, y, s * 1.1, t);
        else if (it.k === 'strandedFish') {
            ctx.fillStyle = 'rgba(70,150,180,0.5)'; ctx.beginPath(); ctx.ellipse(x, y + s * 0.2, s * 1.9, s * 0.7, 0, 0, TAU); ctx.fill();
            ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 6) * 0.25); fish(ctx, 0, 0, s * 0.8, 1, t * 2, 1); ctx.restore();
        } else if (it.k === 'driftwood') driftwood(ctx, x, y, s * 0.9);
        else if (it.k === 'net') net(ctx, x, y, s * 1.3);
        else bottle(ctx, x, y, s * 1.1);
        hits.push({ id: it.k, k, x: x - L.pan, y, r: s * 2.6 });
    });
}

/** A small picture of thing `id` for the field guide. Returns false when there is none. */
export function glyph(ctx, id, w, h, t = 0) {
    const cx = w / 2, cy = h / 2, s = Math.min(w, h);
    const sea = () => { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#58c4c0'); g.addColorStop(1, '#17647e'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); };
    const sky = () => { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6fb2e0'); g.addColorStop(1, '#d8eef6'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); };
    const farSea = () => { sky(); ctx.fillStyle = '#2f7f9c'; ctx.fillRect(0, h * 0.62, w, h * 0.38); };
    const sand = () => { ctx.fillStyle = '#e2cca0'; ctx.fillRect(0, 0, w, h); };
    switch (id) {
    case 'fish': sea(); fish(ctx, cx, cy, s * 0.26, 1, t); break;
    case 'shrimp': sea(); shrimp(ctx, cx - s * 0.1, cy, s * 0.17, 1, t); break;
    case 'jelly': sea(); jelly(ctx, cx, cy - s * 0.08, s * 0.3, t); break;
    case 'octopus': sea(); octopus(ctx, cx, cy + s * 0.06, s * 0.3, t); break;
    case 'gull': sky(); gull(ctx, cx, cy + s * 0.08, s * 0.34, 0.2, '#fff'); break;
    case 'wader': sand(); wader(ctx, cx - s * 0.08, cy + s * 0.34, s * 0.4, 1, 0, false); break;
    case 'seal': farSea(); seal(ctx, cx - s * 0.04, h * 0.66, s * 0.22, 0, '#39404a'); break;
    case 'dolphin': farSea(); dolphin(ctx, cx - s * 0.36, h * 0.74, s * 0.2, 0.42, '#39404a'); break;
    default: return false;
    }
    return true;
}
