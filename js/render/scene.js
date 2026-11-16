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
import { seeded } from '../core/rng.js';

export class Scene {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.pan = 0;
        this.seed = 1;
        this.count = 10;
        this.L = null;
        this.rocks = [];
        this.grain = null;
    }

    setPool(seed, count) {
        this.seed = seed; this.count = count;
        if (this.L) this.resize();
    }

    resize() {
        const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
        if (!W || !H) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        this.dpr = dpr;
        this.canvas.width = Math.round(W * dpr);
        this.canvas.height = Math.round(H * dpr);
        const SW = Math.max(W, H * 1.6);
        const centre = this.L ? (this.pan + this.L.W / 2) / this.L.SW : 0.5;
        this.L = { W, H, SW, pan: 0, horizon: H * 0.4, ridge: H * 0.5, floor: H * 0.84,
            yHigh: H * 0.452, yLow: H * 0.802, yWater: H * 0.6 };
        this.rocks = Array.from({ length: this.count }, (_, i) => makeRock(i, this.count, this.L, this.seed));
        this.scale = Math.min(dpr, 4096 / SW);
        this.still = buildStatic(this.L, this.rocks, this.seed, this.scale);
        this.pan = clamp(centre * SW - W / 2, 0, SW - W);
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
     * Draw a frame. env: the moment (tide.env); st: the pool; t: seconds;
     * ui: { sel, names: [text of each rock] }.
     */
    draw(env, st, t, ui) {
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
        ctx.drawImage(this.still, this.pan * this.scale, 0, L.W * this.scale, L.H * this.scale, 0, 0, L.W, L.H);

        ctx.save();
        ctx.translate(-this.pan, 0);
        const S = { yWater: L.yWater, H: L.H, wind: L.wind };
        for (const R of this.rocks) {
            if (R.cx + R.slot < this.pan || R.cx - R.slot > this.pan + L.W) continue;
            drawCreature(ctx, R, st.rocks[R.i], t, S);
        }
        drawWater(ctx, L, env, t, col);

        const fs = Math.max(11, L.H * 0.021);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `600 ${fs}px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif`;
        for (const R of this.rocks) {
            const y = L.floor + L.H * 0.075, sel = ui.sel === R.i;
            if (sel) {                                              // the rock you are looking at
                ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.25 * Math.sin(t * 3)})`;
                ctx.lineWidth = 2.5;
                ctx.setLineDash([7, 6]); ctx.lineDashOffset = -t * 9;
                ctx.beginPath(); ctx.ellipse(R.cx, y - L.H * 0.012, R.slot * 0.44, L.H * 0.045, 0, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
            }
            if (st.rocks[R.i].cairn) drawCairn(ctx, R.cx, y, L.H * 0.021, R.seed);
            ctx.fillStyle = sel ? 'rgba(60,40,20,0.95)' : 'rgba(96,72,44,0.7)';
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
