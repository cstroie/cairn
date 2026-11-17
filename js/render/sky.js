/*
 * sky.js: the sky and what crosses it: the sun, the moon with its phase,
 * the stars, the clouds, rain and fog. Drawn in view coordinates (the sky
 * does not move when the pool is panned, the clouds only a little).
 */
import { drawMilkyWay } from './fx.js';
import { clamp, lerp, mix, rgb, rgba, smoothstep, layer, TAU } from './util.js';
import { seeded, hash } from '../core/rng.js';

const NIGHT = { top: [7, 10, 30], bot: [22, 34, 70] };
const DUSK = { top: [52, 62, 118], bot: [247, 164, 112] };
const NOON = { top: [62, 142, 212], bot: [198, 230, 244] };
const GREY = [128, 136, 146];

/** The colours of the moment: sky top and bottom, and light 0 (night) to 1 (day). */
export function skyColours(env) {
    const alt = env.sun.alt;
    let top, bot;
    if (alt >= 0) {
        const k = smoothstep(0, 0.38, alt);
        top = mix(DUSK.top, NOON.top, k); bot = mix(DUSK.bot, NOON.bot, k);
    } else {
        const k = smoothstep(0, 0.32, -alt);
        top = mix(DUSK.top, NIGHT.top, k); bot = mix(DUSK.bot, NIGHT.bot, k);
    }
    const moonlit = 0.2 + 0.14 * (1 - Math.abs(env.moon - 0.5) * 2);      // a full moon lights the pool
    const light = clamp(0.5 + alt * 1.6, moonlit, 1) * (1 - 0.25 * env.weather.cloud) * (env.storm ? 0.8 : 1);
    const dull = env.weather.cloud * 0.75;
    const g = mix([20, 24, 38], GREY, clamp(0.5 + alt * 1.6, 0.1, 1));
    return { top: mix(top, g, dull), bot: mix(bot, mix(g, [215, 220, 224], clamp(alt, 0, 1) * 0.6), dull), light,
        warm: (1 - smoothstep(0, 0.4, Math.abs(alt))) * (1 - dull) };
}

let stars = null;
const sprites = [];

function cloudSprite(seed) {
    const r = seeded(seed);
    const w = 360, h = 150;
    const { canvas, ctx } = layer(w, h);
    for (let i = 0; i < 9; i++) {
        const x = w * (0.18 + 0.64 * r()), y = h * (0.42 + 0.3 * r()), rad = h * (0.22 + 0.24 * r());
        const g = ctx.createRadialGradient(x, y - rad * 0.2, 0, x, y, rad);
        g.addColorStop(0, 'rgba(255,255,255,0.85)');
        g.addColorStop(0.6, 'rgba(255,255,255,0.4)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y, rad * 1.5, rad, 0, 0, TAU); ctx.fill();
    }
    return canvas;
}

const tints = new Map();
function tinted(i, colour) {
    const key = i + rgb(colour);
    if (tints.has(key)) return tints.get(key);
    if (tints.size > 60) tints.clear();
    const src = sprites[i];
    const { canvas, ctx } = layer(src.width, src.height);
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = rgb(colour);
    ctx.fillRect(0, 0, src.width, src.height);
    tints.set(key, canvas);
    return canvas;
}

function moon(ctx, x, y, r, phase, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.35);
    ctx.globalAlpha = alpha;
    const glow = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 5);
    glow.addColorStop(0, 'rgba(210,225,255,0.22)');
    glow.addColorStop(1, 'rgba(210,225,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, r * 5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(70,84,120,0.55)';                 // the dark of the moon
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    let p = phase;
    if (p > 0.5) { ctx.scale(-1, 1); p = 1 - p; }           // waning: lit on the left
    const c = Math.cos(TAU * p);                            // 1 new ... -1 full
    ctx.fillStyle = '#f4f1e2';
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    if (c >= 0) ctx.ellipse(0, 0, r * c, r, 0, Math.PI / 2, -Math.PI / 2, true);
    else ctx.ellipse(0, 0, -r * c, r, 0, Math.PI / 2, Math.PI * 1.5, false);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.12;                         // the seas
    ctx.fillStyle = '#5a6078';
    for (const [dx, dy, s] of [[0.25, -0.3, 0.26], [-0.2, 0.2, 0.32], [0.4, 0.35, 0.16]]) {
        ctx.beginPath(); ctx.arc(dx * r, dy * r, s * r, 0, TAU); ctx.fill();
    }
    ctx.restore();
}

/** Where the sun or the moon is, in the view. */
export function lamp(L, env) {
    const s = env.sun;
    const a = s.up ? s.arc : s.night;
    return { x: L.W * (0.1 + 0.8 * a), y: L.horizon - Math.sin(Math.PI * a) * L.horizon * 0.82 + L.H * 0.03, up: s.up };
}

export function drawSky(ctx, L, env, t, col) {
    const { W, H, horizon } = L;
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, rgb(col.top));
    g.addColorStop(1, rgb(col.bot));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, horizon + 2);

    const dark = clamp(1 - col.light * 1.6) * (1 - env.weather.cloud * 0.9);
    if (dark > 0.02) {                                      // the stars
        if (!stars) { const r = seeded(1978); stars = Array.from({ length: 150 }, () => [r(), r(), r(), r()]); }
        ctx.fillStyle = '#fff';
        for (const [sx, sy, sz, ph] of stars) {
            ctx.globalAlpha = dark * (0.35 + 0.65 * sz) * (0.7 + 0.3 * Math.sin(t * (1 + ph * 2) + ph * 40));
            const rad = 0.5 + sz * 1.1;
            ctx.fillRect(sx * W, sy * sy * horizon * 0.95, rad, rad);
        }
        ctx.globalAlpha = 1;
    }
    drawMilkyWay(ctx, L, env, col);

    const p = lamp(L, env);
    const veil = 1 - env.weather.cloud * 0.7;
    if (p.up) {                                             // the sun
        const r = Math.min(W, H) * 0.045;
        const low = 1 - smoothstep(0, 0.5, env.sun.alt);
        const core = mix([255, 252, 232], [255, 190, 120], low);
        const halo = ctx.createRadialGradient(p.x, p.y, r * 0.5, p.x, p.y, r * 7);
        halo.addColorStop(0, rgba(core, 0.55 * veil));
        halo.addColorStop(0.3, rgba(core, 0.16 * veil));
        halo.addColorStop(1, rgba(core, 0));
        ctx.fillStyle = halo;
        ctx.fillRect(p.x - r * 7, p.y - r * 7, r * 14, r * 14);
        ctx.fillStyle = rgba(core, 0.35 + 0.65 * veil);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    } else {
        moon(ctx, p.x, p.y, Math.min(W, H) * 0.04, env.moon, 0.25 + 0.75 * veil);
    }

    if (!sprites.length) for (let i = 0; i < 4; i++) sprites.push(cloudSprite(31 + i * 17));
    const cover = env.weather.cloud;                        // the clouds
    const cc = mix(mix([34, 40, 62], [250, 250, 252], clamp(col.light * 1.15)), [255, 200, 170], col.warm * 0.5);
    const shade = mix(cc, [70, 76, 92], env.storm ? 0.6 : cover * 0.35);
    const q = [Math.round(shade[0] / 8) * 8, Math.round(shade[1] / 8) * 8, Math.round(shade[2] / 8) * 8];
    for (let i = 0; i < 14; i++) {
        const a = clamp(cover * 16 - i + 1.2);
        if (a <= 0) continue;
        const sc = (0.7 + hash(i, 7) * 1.1) * Math.max(0.6, H / 700);
        const cw = 360 * sc, ch = 150 * sc;
        const speed = (4 + 26 * env.weather.wind) * (0.5 + hash(i, 8));
        const span = W + cw * 2;
        const x = ((hash(i, 9) * span + t * speed - L.pan * 0.08) % span + span) % span - cw;
        const y = horizon * (0.02 + 0.62 * hash(i, 10)) - ch * 0.4;
        ctx.globalAlpha = a * (0.55 + 0.4 * cover);
        ctx.drawImage(tinted(i % 4, q), x, y, cw, ch);
    }
    ctx.globalAlpha = 1;
}

/** Rain, fog and lightning go over everything. */
export function drawWeather(ctx, L, env, t, col) {
    const { W, H } = L;
    const w = env.weather;
    if (w.fog > 0.02) {
        const g = ctx.createLinearGradient(0, L.horizon - H * 0.2, 0, L.floor);
        const c = mix([60, 70, 90], [236, 240, 244], col.light);
        g.addColorStop(0, rgba(c, 0));
        g.addColorStop(0.35, rgba(c, 0.6 * w.fog));
        g.addColorStop(1, rgba(c, 0.15 * w.fog));
        ctx.fillStyle = g;
        ctx.fillRect(0, L.horizon - H * 0.2, W, L.floor - L.horizon + H * 0.2);
    }
    if (w.rain > 0.02) {
        const n = Math.floor(w.rain * 140 * (W / 900 + 0.4));
        const slant = 0.12 + 0.3 * w.wind;
        ctx.strokeStyle = rgba(mix([150, 170, 200], [235, 242, 250], col.light), 0.34);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const sp = 0.9 + hash(i, 21) * 0.6;
            const y = ((hash(i, 22) + t * sp * 1.3) % 1) * (H * 1.1) - H * 0.05;
            const x = ((hash(i, 23) * (W + H * slant) - y * slant) % (W + 40) + W + 40) % (W + 40) - 20;
            const len = 12 + 16 * sp;
            ctx.moveTo(x, y); ctx.lineTo(x - len * slant, y + len);
        }
        ctx.stroke();
    }
    if (env.storm) {                                        // lightning, now and then
        const k = Math.floor(t / 0.09), beat = Math.floor(t / 7);
        const on = hash(beat, 31) < 0.5 && (k % 78 === Math.floor(hash(beat, 32) * 70) || k % 78 === Math.floor(hash(beat, 32) * 70) + 2);
        if (on) { ctx.fillStyle = 'rgba(235,240,255,0.32)'; ctx.fillRect(0, 0, W, H); }
    }
}
