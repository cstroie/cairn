/*
 * scene.js: the picture. Lays the scene out for the size of the window,
 * keeps the still layer, and draws a frame: sky, sea, ridge and rocks,
 * what lives on them, the water, the sand with its cairns, the weather.
 *
 * The scene can be wider than the window (a phone held upright): `pan`
 * is how far it is scrolled.
 */
import { clamp, lerp, rgba, layer } from './util.js';
import { skyColours, drawSky, drawWeather } from './sky.js';
import { drawSea, drawWater } from './water.js';
import { makeRock, buildStatic, drawCairn } from './rocks.js';
import { drawCreature } from './creatures.js';
import { drawFar, drawPool, drawOver, drawBeach } from './ambient.js';
import { seeded } from '../core/rng.js';

export class Scene {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.pan = 0;
        this.seed = 1;
        this.on = [];
        this.hits = [];
        this.poke = { i: -1, at: -9 };
        this.prints = { rocks: [], at: -99 };
        this.L = null;
        this.rocks = [];
        this.grain = null;
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
    exposed(i) { return this.rocks[i] && this.rocks[i].top < this.L.yWater; }

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
        const MW = Math.max(W, H * 1.6);                           // the ten rocks; the ledge lies beyond
        const ledge = this.on.slice(10).some(Boolean);
        const SW = ledge ? MW * 1.3 : MW;
        const centre = this.L ? (this.pan + this.L.W / 2) / this.L.MW : 0.5;
        this.L = { W, H, SW, MW, pan: 0, horizon: H * 0.4, ridge: H * 0.5, floor: H * 0.84,
            yHigh: H * 0.452, yLow: H * 0.802, yWater: H * 0.6, spots: [] };
        this.rocks = Array.from({ length: ledge ? 13 : 10 }, (_, i) => makeRock(i, this.L, this.seed));
        this.L.spots = this.rocks.filter(R => this.on[R.i] && !R.ledge);
        this.scale = Math.min(dpr, 4096 / SW);
        this.still = buildStatic(this.L, this.rocks, this.on, this.seed, this.scale);
        this.pan = clamp(centre * MW - W / 2, 0, SW - W);
        if (!this.grain) {
            const g = layer(160, 160), r = seeded(4);
            for (let i = 0; i < 2600; i++) {
                g.ctx.fillStyle = r() < 0.5 ? `rgba(255,255,255,${r() * 0.045})` : `rgba(0,0,0,${r() * 0.045})`;
                g.ctx.fillRect(r() * 160, r() * 160, 1 + r() * 1.5, 1 + r() * 1.5);
            }
            this.grain = this.ctx.createPattern(g.canvas, 'repeat');
        }
    }

    panBy(dx) { this.pan = clamp(this.pan + dx, 0, this.L.SW - this.L.W); }

    /** Scroll so rock i is in view (smoothly: call each frame with the target). */
    panTo(i) {
        const R = this.rocks[i];
        if (R) this.target = clamp(R.cx - this.L.W / 2, 0, this.L.SW - this.L.W);
    }

    /** The rock under a point of the view, or -1. */
    rockAt(x, y) {
        const L = this.L, sx = x + this.pan;
        if (y < L.ridge) return -1;
        let best = -1, dist = Infinity;
        for (const R of this.rocks) {
            const d = Math.abs(sx - R.cx);
            if (d < dist && d < R.slot * 0.7 && y > R.top - L.H * 0.12) { best = R.i; dist = d; }
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
        if (this.target != null) {
            this.pan = lerp(this.pan, this.target, 0.12);
            if (Math.abs(this.pan - this.target) < 0.5) { this.pan = this.target; this.target = null; }
        }
        L.pan = this.pan;
        L.yWater = lerp(L.yLow, L.yHigh, env.level);
        L.wind = env.weather.wind;
        const col = skyColours(env);
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        drawSky(ctx, L, env, t, col);
        drawSea(ctx, L, env, t, col);
        const hits = this.hits = [];
        drawFar(ctx, L, env, t, col, ui.about, hits);
        ctx.drawImage(this.still, this.pan * this.scale, 0, L.W * this.scale, L.H * this.scale, 0, 0, L.W, L.H);

        ctx.save();
        ctx.translate(-this.pan, 0);
        const S = { yWater: L.yWater, H: L.H, wind: L.wind, poke: 0 };
        for (const R of this.rocks) {
            if (!this.on[R.i] || R.cx + R.slot < this.pan || R.cx - R.slot > this.pan + L.W) continue;
            S.poke = this.poke.i === R.i ? clamp(1 - (t - this.poke.at) / 2.5) : 0;
            drawCreature(ctx, R, rocks[R.i], t, S);
        }
        drawPool(ctx, L, env, t, col, ui.about, hits);
        drawWater(ctx, L, env, t, col);
        drawOver(ctx, L, env, t, col, ui.about, hits);

        const fade = clamp(1 - (t - this.prints.at) / 60);            // where you waded out
        if (fade > 0) {
            ctx.fillStyle = `rgba(110,82,50,${0.34 * fade})`;
            for (const i of this.prints.rocks) {
                const R = this.rocks[i];
                if (!R) continue;
                for (let k = 0; k < 4; k++) {
                    const x = R.cx - R.slot * 0.36 + k * R.slot * 0.24, y = L.floor + L.H * (0.03 + (k % 2) * 0.014);
                    ctx.beginPath(); ctx.ellipse(x, y, L.H * 0.011, L.H * 0.0055, -0.2, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(x + L.H * 0.012, y - L.H * 0.003, L.H * 0.0032, 0, Math.PI * 2); ctx.fill();
                }
            }
        }
        drawBeach(ctx, L, t, ui.beach, hits);

        const fs = Math.max(11, L.H * 0.021);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `600 ${fs}px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif`;
        for (const R of this.rocks) {
            if (R.ledge && !this.on[R.i]) continue;
            const y = L.floor + L.H * 0.075, sel = ui.sel === R.i;
            if (sel) {                                              // the rock you are looking at
                ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.25 * Math.sin(t * 3)})`;
                ctx.lineWidth = 2.5;
                ctx.setLineDash([7, 6]); ctx.lineDashOffset = -t * 9;
                ctx.beginPath(); ctx.ellipse(R.cx, y - L.H * 0.012, R.slot * 0.44, L.H * 0.045, 0, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
            }
            if (rocks[R.i].cairn) drawCairn(ctx, R.cx, y, L.H * 0.021, R.seed);
            ctx.fillStyle = sel ? 'rgba(60,40,20,0.95)' : this.on[R.i] ? 'rgba(96,72,44,0.7)' : 'rgba(96,72,44,0.35)';
            ctx.fillText(ui.names[R.i], R.cx, L.floor + L.H * 0.118, R.slot * 0.96);
        }
        ctx.restore();

        const dark = 1 - col.light;                                 // the night lies on the pool
        if (dark > 0.02) {
            const g = ctx.createLinearGradient(0, L.horizon, 0, L.ridge + L.H * 0.06);
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
