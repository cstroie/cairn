/*
 * fx.js: the light and the weather on the pool. Caustics, the nets of
 * sunlight on a shallow floor; reflections of what stands out of a calm
 * surface; rocks wet with rain; spray thrown over them in a gale; the
 * Milky Way on a dark night; and a shore crab about its business on the
 * sand at low water. None of it has state: it all comes from the moment.
 */
import { clamp, lerp, mix, rgba, layer, TAU } from './util.js';
import { hash, seeded } from '../core/rng.js';

/** Nets of light on the floor, where the sun shines through shallow water. */
export function drawCaustics(ctx, L, env, t, sunK) {
    const depth = L.hw / L.unit;
    const k = sunK * clamp(env.sun.alt * 1.8) * clamp(depth * 3) * clamp(1.6 - depth) * (1 - env.weather.rain);
    if (k < 0.03) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, L.waterY(0), L.W, L.shore - L.waterY(0)); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const rows = 26, wind = 0.5 + env.weather.wind;
    for (let fam = 0; fam < 2; fam++) for (let j = 0; j < rows; j++) {
        const d = (j + 0.5 * fam) / rows, y0 = L.floorY(d), s = L.sc(d), step = 14 * s;
        ctx.strokeStyle = `rgba(255,250,215,${(0.16 + 0.16 * d) * k})`;
        ctx.lineWidth = (1.2 + 2 * d) * s;
        ctx.beginPath();
        for (let x = -step; x <= L.W + step; x += step) {
            const ph = x * 0.012 / s + t * (0.6 + 0.2 * fam) * wind + j * 1.7 + fam * 3;
            const y = y0 + Math.abs(Math.sin(ph) + 0.5 * Math.sin(ph * 2.3 - t * 0.7)) * 9 * s - 6 * s;
            if (x <= -step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.restore();
}

/** What stands out of a calm surface, upside down and broken by the ripples. */
export function drawReflection(ctx, R, sp, wl, t, wind, scale, body) {
    const above = wl - Math.max(R.top, sp.y);
    const a = 0.3 * (1 - clamp(wind * 1.2)) * body;
    if (above <= 2 || a < 0.03) return;
    const slice = 2, depth = Math.min(above, R.w * 0.6);
    ctx.save();
    ctx.globalAlpha = a;
    for (let dy = 0; dy < depth; dy += slice) {
        const srcY = wl - dy - slice;                                  // the line of the rock this far above the water
        const wob = Math.sin(dy * 0.35 + t * 2.2 + R.i) * (0.6 + dy * 0.05) * (1 + wind * 4);
        const fade = 1 - dy / depth;
        ctx.globalAlpha = a * fade;
        ctx.drawImage(sp.canvas, 0, (srcY - sp.y) * scale, sp.canvas.width, slice * scale, sp.x + wob, wl + dy, sp.w, slice);
    }
    ctx.restore();
}

/** A rock in the rain: darker, and shining where the light runs down it. */
export function drawWet(ctx, R, wl, env, t, col) {
    const rain = env.weather.rain;
    if (rain < 0.05) return;
    ctx.save();
    ctx.clip(R.body);
    ctx.beginPath(); ctx.rect(R.cx - R.w, R.top - 4, R.w * 2, wl - R.top + 4); ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = rgba([150, 156, 170], 0.7 * rain);
    ctx.fillRect(R.cx - R.w, R.top - 4, R.w * 2, R.h * 1.4);
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createLinearGradient(R.cx - R.w * 0.3, 0, R.cx + R.w * 0.1, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, rgba(mix([120, 130, 150], [255, 255, 255], col.light), 0.22 * rain)); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(R.cx - R.w, R.top - 4, R.w * 2, R.h * 1.4);
    ctx.restore();
}

/** Spray thrown up where a gale drives the water against a rock. */
export function drawSpray(ctx, R, wl, env, t, col) {
    const wind = env.weather.wind + (env.storm ? 0.6 : 0);
    if (wind < 0.7 || wl <= R.top) return;
    const k = clamp((wind - 0.7) * 2.5), period = 3.2 + hash(R.i, 5) * 2;
    const ph = ((t + hash(R.i, 6) * period) % period) / period;
    if (ph > 0.45) return;
    const burst = Math.sin(ph / 0.45 * Math.PI), c = mix([150, 170, 200], [255, 255, 255], col.light);
    ctx.fillStyle = rgba(c, 0.55 * k * burst);
    for (let i = 0; i < 26; i++) {
        const u = hash(i, R.i * 7 + 1), up = hash(i, R.i * 7 + 2);
        const x = R.cx + (u - 0.5) * R.w * 0.9 + (u - 0.5) * R.w * 0.4 * ph;
        const y = wl - up * R.h * 0.9 * k * Math.sin(ph / 0.45 * Math.PI * 0.9) - 2;
        const r = (1 + hash(i, R.i * 7 + 3) * 3) * R.s * (1 + ph);
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
}

let milky = null;
/** The Milky Way: a soft band of light and a dust of stars, on a dark night. */
export function drawMilkyWay(ctx, L, env, col) {
    const dark = clamp(1 - col.light * 2.2) * clamp(1.2 - env.weather.cloud * 1.4) * (1 - clamp(1 - Math.abs(env.moon - 0.5) * 2) * 0.7);
    if (dark < 0.05) return;
    if (!milky) {
        const { canvas, ctx: c } = layer(900, 220), r = seeded(77);
        for (let k = 0; k < 40; k++) {
            const x = r() * 900, y = 110 + (r() - 0.5) * 90 * Math.sin(x / 900 * Math.PI), rad = 30 + r() * 70;
            const g = c.createRadialGradient(x, y, 0, x, y, rad);
            g.addColorStop(0, `rgba(210,215,255,${0.1 + r() * 0.1})`); g.addColorStop(1, 'rgba(210,215,255,0)');
            c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
        for (let k = 0; k < 2200; k++) {
            const x = r() * 900, y = 110 + (r() + r() + r() - 1.5) * 60;
            c.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.7})`;
            c.fillRect(x, y, r() < 0.9 ? 0.8 : 1.6, r() < 0.9 ? 0.8 : 1.6);
        }
        for (let k = 0; k < 30; k++) {                                  // dark lanes of dust
            const x = 200 + r() * 500, y = 110 + (r() - 0.5) * 30, rad = 15 + r() * 30;
            const g = c.createRadialGradient(x, y, 0, x, y, rad);
            g.addColorStop(0, 'rgba(0,0,10,0.12)'); g.addColorStop(1, 'rgba(0,0,10,0)');
            c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
        milky = canvas;
    }
    ctx.save();
    ctx.globalAlpha = Math.min(1, dark * 1.3);
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); ctx.rect(0, 0, L.W, L.horizon); ctx.clip();
    ctx.translate(L.W * 0.5, L.horizon * 0.45);
    ctx.rotate(-0.5 + env.season * 0.15);
    const w = Math.hypot(L.W, L.horizon) * 1.2;
    ctx.drawImage(milky, -w / 2, -w * 0.12, w, w * 0.24);
    ctx.restore();
}

/** A shore crab crossing the wet sand at low water, now and then. */
export function drawCrab(ctx, L, env, t, col) {
    if (env.level > 0.35) return;
    const leg = 26, n = Math.floor(t / leg), ph = (t % leg) / leg;
    if (hash(n, env.tide + 91) > 0.55 || ph > 0.7) return;
    const dir = hash(n, 92) < 0.5 ? 1 : -1, u = ph / 0.7;
    const stop = Math.sin(u * TAU * 3) > 0.6 ? 0 : 1;                  // it scuttles, stops, scuttles
    const x = dir > 0 ? lerp(-30, L.W + 30, u) : lerp(L.W + 30, -30, u);
    const y = L.shore + L.H * (0.015 + 0.03 * hash(n, 93)), s = L.unit * 0.07;
    const c = mix([30, 26, 24], [96, 104, 58], col.light), legC = mix([20, 18, 16], [70, 74, 40], col.light);
    ctx.fillStyle = 'rgba(20,16,10,0.25)';
    ctx.beginPath(); ctx.ellipse(x + s * 0.2, y + s * 0.4, s * 1.2, s * 0.35, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(legC, 1); ctx.lineWidth = Math.max(1, s * 0.14); ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) for (const sd of [-1, 1]) {
        const step = Math.sin(t * 22 * stop + k * 1.6 + (sd > 0 ? 0 : 1.5)) * s * 0.18;
        const bx = x + sd * s * 0.55, by = y - s * 0.1 + k * s * 0.08;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + sd * s * 0.45, by - s * 0.15 + step); ctx.lineTo(bx + sd * s * 0.75, by + s * 0.35 + step); ctx.stroke();
    }
    const g = ctx.createRadialGradient(x - s * 0.3, y - s * 0.4, 0, x, y - s * 0.1, s);
    g.addColorStop(0, rgba(mix(c, [255, 255, 255], 0.25), 1)); g.addColorStop(1, rgba(mix(c, [0, 0, 0], 0.3), 1));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y - s * 0.1, s * 0.7, s * 0.5, 0, Math.PI, 0); ctx.quadraticCurveTo(x, y + s * 0.15, x - s * 0.7, y - s * 0.1); ctx.fill();
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sd * s * 0.75, y - s * 0.3, s * 0.2, 0, TAU); ctx.fill(); }
}
