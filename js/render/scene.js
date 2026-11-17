/*
 * scene.js: the picture. The pool is seen from above and behind: the sky
 * and the far sea, a rim of rock, the floor of the pool running towards
 * you, the near sand. The rocks stand scattered on the floor, larger the
 * nearer they are; the water is a sheet at the height of the tide.
 *
 * A frame: sky, sea, the still layer (rim, floor, sand); the rocks from
 * far to near with their cairns and what lives on them; what swims; the
 * surface over all of it; then, far to near again, the part of each rock
 * that stands out of the water; names, weather, grain.
 */
import { clamp, lerp, mix, rgba, layer } from './util.js';
import { skyColours, drawSky, drawWeather } from './sky.js';
import { drawSea, drawSurface, drawRing } from './water.js';
import { places, makeRock, rockSprite, buildStatic, drawCairn } from './rocks.js';
import { drawCreature } from './creatures.js';
import { drawFar, drawPool, drawOver, drawBeach } from './ambient.js';
import { seeded } from '../core/rng.js';

export class Scene {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.seed = 1;
        this.on = [];
        this.L = null;
        this.rocks = [];
        this.order = [];
        this.grain = null;
        this.hits = [];
        this.poke = { i: -1, at: -9 };
        this.prints = { rocks: [], at: -99 };
    }

    /** The pool to draw: its seed, and which rocks lie bare. Rebuilds the still layer when either changes. */
    setPool(seed, on) {
        const same = seed === this.seed && on.length === this.on.length && on.every((v, i) => v === this.on[i]);
        this.seed = seed; this.on = on.slice();
        if (this.L && !same) this.resize();
    }

    /** Touch rock i: what lives on it reacts for a moment. */
    touch(i, t) { this.poke = { i, at: t }; }

    /** Footprints in front of these rocks, fading over a minute. */
    walk(rocks, t) { this.prints = { rocks, at: t }; }

    /** Is the top of rock i out of the water? */
    exposed(i) { const R = this.rocks[i]; return !!R && R.top < this.L.waterAt(R); }

    /** The thing under a point of the view that can be picked up or spotted, or null. */
    thingAt(x, y) {
        let best = null, dist = Infinity;
        for (const h of this.hits) {
            const d = Math.hypot(x - h.x, y - h.y);
            if (d < Math.max(h.r, 22) && d < dist) { best = h; dist = d; }
        }
        return best;
    }

    resize() {
        const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
        if (!W || !H) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        this.dpr = dpr;
        this.canvas.width = Math.round(W * dpr);
        this.canvas.height = Math.round(H * dpr);
        const tall = W / H < 0.8;
        const plan = places(W / H, this.seed);
        const L = this.L = { W, H, SW: W, MW: W, pan: 0, hw: 0, shore: 0, spots: [],
            horizon: H * (tall ? 0.27 : 0.33), ridge: H * (tall ? 0.322 : 0.385),
            yFar: H * (tall ? 0.375 : 0.45), yNear: H * (tall ? 0.9 : 0.87) };
        L.floor = L.yNear;
        const lr = seeded(this.seed * 211 + 5);                        // the land around: from the seed
        L.land = { side: lr() < 0.5 ? -1 : 1, x: 0.04 + lr() * 0.16, w: 0.24 + lr() * 0.2, hgt: 0.6 + lr() * 0.8,
            peak: 0.25 + lr() * 0.5, isle: lr() < 0.65 ? { x: 0.35 + lr() * 0.5, w: 0.04 + lr() * 0.08, hgt: 0.15 + lr() * 0.35 } : null,
            rim: 0.7 + lr() * 0.9, seed: this.seed };
        L.unit = Math.min(W * 0.88 / plan.cols * 0.8, (L.yNear - L.yFar) / plan.rows * 1.3, H * 0.2);
        L.sc = d => lerp(0.62, 1.1, clamp(d));                         // how large a thing is at depth d
        L.floorY = d => lerp(L.yFar, L.yNear, Math.pow(clamp(d), 0.92));
        L.px = (u, d) => W / 2 + (u - 0.5) * W * lerp(0.86, 1, clamp(d));
        L.waterY = d => L.floorY(d) - L.hw * L.sc(d);                  // the surface above a place on the floor
        L.waterAt = R => R.base - L.hw * R.s;
        this.rocks = plan.list.map((p, i) => makeRock(i, L, this.seed, p));
        this.order = this.rocks.filter(R => this.on[R.i]).sort((a, b) => a.base - b.base);
        L.spots = this.order.filter(R => !R.ledge);
        this.sprites = this.rocks.map(R => (this.on[R.i] ? rockSprite(R, dpr) : null));
        this.scale = dpr;
        this.still = buildStatic(L, this.rocks, this.on, this.seed, dpr);
        if (!this.grain) {
            const g = layer(160, 160), r = seeded(4);
            for (let i = 0; i < 2600; i++) {
                g.ctx.fillStyle = r() < 0.5 ? `rgba(255,255,255,${r() * 0.045})` : `rgba(0,0,0,${r() * 0.045})`;
                g.ctx.fillRect(r() * 160, r() * 160, 1 + r() * 1.5, 1 + r() * 1.5);
            }
            this.grain = this.ctx.createPattern(g.canvas, 'repeat');
        }
    }

    /** The rock under a point of the view (near rocks first), or -1. */
    rockAt(x, y) {
        const L = this.L;
        if (y < L.ridge) return -1;
        const byDepth = this.rocks.filter(R => !R.ledge || this.on[R.i]).sort((a, b) => b.base - a.base);
        const top = R => (this.on[R.i] ? R.top - R.unit * 0.25 : R.base - R.w * 0.3);    // a buried rock is only a mound
        for (const R of byDepth) if (Math.abs(x - R.cx) < R.w * 0.56 && y > top(R) && y < R.base + R.w * 0.3) return R.i;
        let best = -1, dist = L.unit * 0.9;
        for (const R of byDepth) {
            const d = Math.hypot(x - R.cx, y - (top(R) + R.base) / 2);
            if (d < dist) { best = R.i; dist = d; }
        }
        return best;
    }

    /**
     * Draw a frame. env: the moment (tide.env); rocks: the pool's rocks;
     * t: seconds; ui: { sel, names: [text of each rock], about: the
     * surprises of the moment, beach: what lies on the sand }.
     */
    draw(env, rocks, t, ui) {
        const { ctx, L } = this;
        if (!L) return;
        L.hw = L.unit * (0.05 + 1.02 * env.level);
        L.shore = lerp(L.yNear - L.H * 0.012, L.yNear + L.H * 0.04, env.level);
        L.yWater = L.waterY(0.5);
        L.wind = env.weather.wind;
        const col = skyColours(env);
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        drawSky(ctx, L, env, t, col);
        drawSea(ctx, L, env, t, col);
        const hits = this.hits = [];
        drawFar(ctx, L, env, t, col, ui.about, hits);
        ctx.drawImage(this.still, 0, 0, L.W, L.H);

        const deepTint = [lerp(6, 14, col.light), lerp(22, 70, col.light), lerp(48, 104, col.light)];
        const one = (R, under) => {                                     // a rock, its cairn, what lives on it
            const sp = this.sprites[R.i], rock = rocks[R.i];
            ctx.drawImage(sp.canvas, sp.x, sp.y, sp.w, sp.h);
            const wl = L.waterAt(R);
            if (under && wl < R.base) {                                 // the deeper under water, the bluer and dimmer
                const depth = clamp((R.base - wl) / (R.unit * 0.9));
                const g = ctx.createLinearGradient(0, Math.max(wl, R.top), 0, R.base + R.w * 0.13);
                const wash = mix([70, 120, 140], [120, 182, 186], col.light);   // water filters the light: multiply, so the stone still shows
                g.addColorStop(0, rgba(wash, 0.35 + 0.25 * depth));
                g.addColorStop(1, rgba(mix(wash, deepTint, 0.5), 0.55 + 0.35 * depth));
                ctx.save(); ctx.clip(R.body);
                ctx.globalCompositeOperation = 'multiply';
                ctx.fillStyle = g; ctx.fillRect(sp.x, Math.max(wl, R.top) - 1, sp.w, sp.h);
                ctx.globalCompositeOperation = 'source-over';
                if (col.light > 0.4) {                                  // and the light of the waves plays on it
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.strokeStyle = `rgba(190,255,235,${0.1 * depth * (col.light - 0.4)})`; ctx.lineWidth = 2 * R.s;
                    for (let k = 0; k < 4; k++) {
                        const y = lerp(Math.max(wl, R.top), R.base, 0.12 + 0.2 * k) + Math.sin(t * 1.3 + k * 2 + R.i) * R.h * 0.04;
                        ctx.beginPath(); ctx.moveTo(R.cx - R.w * 0.6, y);
                        ctx.bezierCurveTo(R.cx - R.w * 0.2, y + Math.sin(t + k) * R.h * 0.1, R.cx + R.w * 0.2, y - Math.sin(t * 0.8 + k) * R.h * 0.1, R.cx + R.w * 0.6, y);
                        ctx.stroke();
                    }
                }
                ctx.restore();
            }
            if (rock.cairn) drawCairn(ctx, R.cx + R.w * 0.5, R.base + R.w * 0.1, R.unit * 0.1, R.seed);
            drawCreature(ctx, R, rock, t, { yWater: L.waterAt(R), H: R.unit * 3.2, wind: L.wind,
                poke: this.poke.i === R.i ? clamp(1 - (t - this.poke.at) / 2.5) : 0 });
        };
        for (const R of this.order) one(R, true);
        drawPool(ctx, L, env, t, col, ui.about, hits);
        drawSurface(ctx, L, env, t, col);
        for (const R of this.order) {                                   // what stands out of the water
            const wl = L.waterAt(R);
            if (wl < R.top - R.unit * 1.2) continue;
            ctx.save();
            ctx.beginPath(); ctx.rect(R.cx - R.unit * 1.6, 0, R.unit * 3.2, wl); ctx.clip();
            one(R, false);
            ctx.restore();
            drawRing(ctx, R, wl, t, col);
        }
        drawOver(ctx, L, env, t, col, ui.about, hits);

        const fade = clamp(1 - (t - this.prints.at) / 60);              // where you waded out
        if (fade > 0) {
            ctx.fillStyle = `rgba(110,82,50,${0.36 * fade})`;
            const n = Math.ceil(L.W / (L.H * 0.05));
            for (let k = 0; k < n; k++) {
                const x = L.W * (k + 0.5) / n, y = L.yNear + L.H * (0.045 + (k % 2) * 0.014) + Math.sin(k * 1.7) * L.H * 0.006;
                ctx.beginPath(); ctx.ellipse(x, y, L.H * 0.011, L.H * 0.0055, -0.2, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(x + L.H * 0.012, y - L.H * 0.003, L.H * 0.0032, 0, Math.PI * 2); ctx.fill();
            }
            ctx.strokeStyle = `rgba(255,255,255,${0.5 * fade})`; ctx.lineWidth = 1.5;
            for (const i of this.prints.rocks) {                        // and the rocks you stepped on
                const R = this.rocks[i];
                if (R) { ctx.beginPath(); ctx.ellipse(R.cx, R.base + R.w * 0.06, R.w * 0.66, R.w * 0.2, 0, 0, Math.PI * 2); ctx.stroke(); }
            }
        }
        drawBeach(ctx, L, t, ui.beach, hits);

        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tags = [];                                                // names already placed, so two never overlap
        const order = [...this.order].sort((a, b) => (b.i === ui.sel) - (a.i === ui.sel) || b.base - a.base);
        for (const R of order) {                                        // the names, and the rock you are looking at
            const sel = ui.sel === R.i, fs = clamp(L.unit * 0.15 * R.s, 10, 15);
            if (sel) {
                ctx.strokeStyle = `rgba(255,255,255,${0.7 + 0.25 * Math.sin(t * 3)})`;
                ctx.lineWidth = 2.5;
                ctx.setLineDash([7, 6]); ctx.lineDashOffset = -t * 9;
                ctx.beginPath(); ctx.ellipse(R.cx, R.base + R.w * 0.05, R.w * 0.7, R.w * 0.24, 0, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.font = `${sel ? 700 : 600} ${fs}px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif`;
            const name = ui.names[R.i], tw = Math.min(ctx.measureText(name).width, R.w * 1.5) / 2 + 3;
            // under the rock; if a nearer rock stands there, above it; if there too, only when it is chosen
            const free = y => !this.order.some(Q => Q !== R && Q.base > R.base &&
                R.cx + tw > Q.cx - Q.w * 0.5 && R.cx - tw < Q.cx + Q.w * 0.5 && y + fs * 0.6 > Q.top && y - fs * 0.6 < Q.base + Q.w * 0.1);
            let y = R.base + R.w * 0.2 + fs * 0.6;
            if (!free(y)) { const up = R.top - fs * 0.9; if (free(up) || sel) y = up; else continue; }
            const pw = tw * 2 + fs * 0.5, ph = fs * 1.45;               // a soft tag, so the name reads over water or sand
            if (tags.some(q => Math.abs(q[0] - R.cx) < (q[2] + pw) / 2 && Math.abs(q[1] - y) < ph)) continue;
            tags.push([R.cx, y, pw]);
            ctx.fillStyle = sel ? 'rgba(10,24,40,0.7)' : 'rgba(10,24,40,0.38)';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(R.cx - pw / 2, y - ph / 2, pw, ph, ph / 2); else ctx.rect(R.cx - pw / 2, y - ph / 2, pw, ph);
            ctx.fill();
            ctx.fillStyle = sel ? '#fff' : 'rgba(255,255,255,0.94)';
            ctx.fillText(name, R.cx, y, R.w * 1.5);
        }

        const dark = 1 - col.light;                                     // the night lies on the pool
        if (dark > 0.02) {
            const g = ctx.createLinearGradient(0, L.horizon, 0, L.yFar);
            g.addColorStop(0, rgba([6, 10, 34], 0));
            g.addColorStop(1, rgba([6, 10, 34], dark * 0.6));
            ctx.fillStyle = g;
            ctx.fillRect(0, L.horizon, L.W, L.H - L.horizon);
        }
        if (col.warm > 0.02) { ctx.fillStyle = `rgba(255,150,90,${col.warm * 0.09})`; ctx.fillRect(0, 0, L.W, L.H); }
        drawWeather(ctx, L, env, t, col);
        ctx.fillStyle = this.grain;
        ctx.fillRect(0, 0, L.W, L.H);
    }
}
