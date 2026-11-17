/*
 * creatures.js: what lives on a rock. Each drawing takes the rock R, the
 * growth g (0-255), the time t, and the scene (for the water line): they
 * behave differently under water and in the air.
 */
import { clamp, lerp, mix, rgb, rgba, TAU } from './util.js';
import { seeded } from '../core/rng.js';

const size = g => 0.55 + 0.6 * g / 255;
const stage = g => g >> 6;
const under = (S, y) => clamp((y - S.yWater) / (S.H * 0.03));     // 0 in the air, 1 well covered

function film(ctx, R, g, t, S) {
    const r = seeded(R.seed + 101);
    const n = 4 + stage(g) * 4;
    for (let k = 0; k < n; k++) {
        const p = R.at(r()), s = R.w * (0.05 + 0.07 * r()) * size(g);
        ctx.save();
        ctx.translate(p.x, p.y + s * 0.25); ctx.rotate(p.a);
        ctx.fillStyle = rgba(mix([88, 132, 52], [150, 160, 58], r()), 0.42 + 0.3 * g / 255);
        ctx.beginPath(); ctx.ellipse(0, 0, s * 1.5, s * 0.5, 0, 0, TAU); ctx.fill();
        ctx.restore();
    }
    if (stage(g) < 2) return;
    ctx.lineCap = 'round';
    for (let k = 0; k < 5 + stage(g) * 4; k++) {                   // tufts
        const p = R.at(r()), wet = under(S, p.y), len = R.w * (0.04 + 0.05 * r()) * size(g);
        const lean = wet * Math.sin(t * 1.4 + k * 1.7 + R.i) * 0.5 + (1 - wet) * (r() - 0.5) * 2.4;
        ctx.strokeStyle = rgba(mix([70, 140, 60], [120, 170, 70], r()), 0.85);
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(p.x, p.y + 1);
        ctx.quadraticCurveTo(p.x + lean * len * 0.3, p.y - len * 0.6 * (0.4 + 0.6 * wet), p.x + lean * len, p.y - len * (0.3 + 0.7 * wet));
        ctx.stroke();
    }
}

function barnacles(ctx, R, g, t, S) {
    const r = seeded(R.seed + 202);
    const n = [3, 6, 10, 15][stage(g)];
    const list = Array.from({ length: n }, () => [r(), r(), r()]).sort((a, b) => a[1] - b[1]);
    for (const [u, sz, ph] of list) {
        const p = R.at(u), s = R.w * 0.05 * (0.7 + 0.7 * sz) * size(g), wet = under(S, p.y - s);
        ctx.save();
        ctx.translate(p.x, p.y + s * 0.3); ctx.rotate(p.a * 0.8);
        if (wet > 0.3) {                                           // feeding: the feathered legs sweep
            const beat = Math.max(0, Math.sin(t * 2.6 + ph * 20)) * wet * (1 - S.poke);
            ctx.strokeStyle = 'rgba(250,232,210,0.85)'; ctx.lineWidth = 1; ctx.lineCap = 'round';
            for (let k = -2; k <= 2; k++) {
                const a = -Math.PI / 2 + k * 0.3 + Math.sin(t * 2.6 + ph * 20) * 0.25;
                ctx.beginPath(); ctx.moveTo(0, -s * 1.1);
                ctx.quadraticCurveTo(Math.cos(a) * s * 0.8 * beat, -s * 1.1 + Math.sin(a) * s * 0.9 * beat,
                    Math.cos(a + 0.5) * s * 1.5 * beat, -s * 1.1 + Math.sin(a + 0.5) * s * 1.5 * beat);
                ctx.stroke();
            }
        }
        const gr = ctx.createLinearGradient(-s, 0, s, 0);
        gr.addColorStop(0, '#ece6d8'); gr.addColorStop(0.6, '#c9c1b0'); gr.addColorStop(1, '#8f887c');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(-s, 0); ctx.quadraticCurveTo(-s * 0.8, -s * 0.8, -s * 0.42, -s * 1.15);
        ctx.lineTo(s * 0.42, -s * 1.15); ctx.quadraticCurveTo(s * 0.8, -s * 0.8, s, 0);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(90,80,70,0.35)'; ctx.lineWidth = 0.8;
        for (const x of [-0.45, 0, 0.45]) { ctx.beginPath(); ctx.moveTo(x * s * 1.5, 0); ctx.lineTo(x * s * 0.6, -s * 1.1); ctx.stroke(); }
        ctx.fillStyle = '#3a3230';
        ctx.beginPath(); ctx.ellipse(0, -s * 1.13, s * 0.4, s * 0.16, 0, 0, TAU); ctx.fill();
        ctx.restore();
    }
}

function kelp(ctx, R, g, t, S) {
    const r = seeded(R.seed + 303);
    const n = 2 + stage(g);
    const len = S.H * (0.05 + 0.3 * g / 255);
    const SEG = 14;
    for (let f = 0; f < n; f++) {
        const p = R.at(0.25 + 0.5 * (n === 1 ? 0.5 : f / (n - 1)) + (r() - 0.5) * 0.08);
        const L = len * (0.6 + 0.4 * r()), seg = L / SEG, side = f % 2 ? 1 : -1, ph = r() * 9;
        const wmax = R.w * (0.035 + 0.035 * g / 255) * (0.7 + 0.5 * r());
        const pts = [[p.x, p.y + 2]];
        let a = -Math.PI / 2 + side * 0.12, x = p.x, y = p.y;
        for (let k = 1; k <= SEG; k++) {
            const wet = under(S, y);
            const sway = Math.sin(t * (0.9 + 5 * S.poke) + k * 0.42 + ph + x * 0.01) * (0.05 + 0.02 * k) * (0.5 + S.wind + S.poke);
            const up = -Math.PI / 2 + side * 0.1 + sway * 4;
            a = lerp(a, up, 0.5) * wet + (1 - wet) * (a + side * 0.42);   // in the air it falls over
            a = clamp(a, -Math.PI * 1.42, Math.PI * 0.42);
            x += Math.cos(a) * seg; y += Math.sin(a) * seg;
            if (wet === 0 && y > R.base) y = R.base;
            pts.push([x, y]);
        }
        const tone = mix([92, 78, 26], [128, 112, 36], r());
        const left = [], right = [];                               // a ribbon around the midline
        for (let k = 0; k <= SEG; k++) {
            const q = pts[k], q2 = pts[Math.min(SEG, k + 1)], q0 = pts[Math.max(0, k - 1)];
            const na = Math.atan2(q2[1] - q0[1], q2[0] - q0[0]) + Math.PI / 2;
            const u = k / SEG;
            const w = wmax * (0.18 + Math.sin(Math.PI * Math.pow(u, 0.75)) * (1 + 0.12 * Math.sin(k * 2.1 + ph)));
            left.push([q[0] + Math.cos(na) * w, q[1] + Math.sin(na) * w]);
            right.push([q[0] - Math.cos(na) * w, q[1] - Math.sin(na) * w]);
        }
        const gr = ctx.createLinearGradient(p.x, p.y, p.x, p.y - L);
        gr.addColorStop(0, rgb(mix(tone, [30, 24, 10], 0.4)));
        gr.addColorStop(1, rgba(mix(tone, [190, 170, 60], 0.35), 0.92));
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(left[0][0], left[0][1]);
        for (let k = 1; k <= SEG; k++) ctx.lineTo(left[k][0], left[k][1]);
        for (let k = SEG; k >= 0; k--) ctx.lineTo(right[k][0], right[k][1]);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(220,200,110,0.3)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k <= SEG; k++) ctx.lineTo(pts[k][0], pts[k][1]);
        ctx.stroke();
        ctx.fillStyle = rgb(mix(tone, [30, 24, 10], 0.5));         // the holdfast
        ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, wmax * 0.7, wmax * 0.4, 0, 0, TAU); ctx.fill();
    }
}

function mussels(ctx, R, g, t, S) {
    const r = seeded(R.seed + 404);
    const n = [4, 8, 13, 19][stage(g)];
    const list = Array.from({ length: n }, () => [0.12 + 0.76 * r(), r(), r(), r()]).sort((a, b) => a[1] - b[1]);
    for (const [u, depth, sz, tilt] of list) {
        const p = R.at(u), s = R.w * 0.085 * (0.7 + 0.6 * sz) * size(g), wet = under(S, p.y);
        ctx.save();
        ctx.translate(p.x, p.y + s * 0.25 + depth * s * 0.5); ctx.rotate(p.a + (tilt - 0.5) * 1.3);
        const gr = ctx.createLinearGradient(-s * 0.5, -s, s * 0.5, 0);
        gr.addColorStop(0, '#4c5468'); gr.addColorStop(0.35, '#23262f'); gr.addColorStop(1, '#0d0d12');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.1);
        ctx.bezierCurveTo(-s * 0.72, -s * 0.1, -s * 0.56, -s * 1.2, 0, -s * 1.4);
        ctx.bezierCurveTo(s * 0.5, -s * 1.2, s * 0.56, -s * 0.2, 0, s * 0.1);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200,210,226,0.22)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.2); ctx.quadraticCurveTo(-s * 0.42, -s * 0.9, -s * 0.06, -s * 1.22); ctx.stroke();
        if (wet > 0.5 && S.poke < 0.2) {                           // open a crack to feed
            ctx.strokeStyle = `rgba(240,160,90,${0.6 * wet * (0.6 + 0.4 * Math.sin(t * 1.3 + u * 30))})`;
            ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(s * 0.08, -s * 0.1); ctx.quadraticCurveTo(s * 0.42, -s * 0.7, s * 0.1, -s * 1.3); ctx.stroke();
        }
        ctx.restore();
    }
}

const ANEMONE = [[[150, 34, 42], [220, 120, 120]], [[176, 104, 64], [236, 200, 160]], [[96, 132, 90], [200, 220, 170]], [[140, 92, 120], [220, 186, 206]]];   // beadlet red, strawberry-brown, snakelocks green, plumose mauve

function anemone(ctx, R, g, t, S) {
    const r = seeded(R.seed + 505);
    const p = R.at(0.4 + 0.2 * r());
    const s = R.w * (0.13 + 0.17 * g / 255);
    const open = under(S, p.y - s * 0.9) * (1 - S.poke);      // touched, it folds up
    const [body, tip] = ANEMONE[Math.floor(r() * 4)];
    ctx.save();
    ctx.translate(p.x, p.y + s * 0.12);
    const n = 26 + stage(g) * 8;
    ctx.lineCap = 'round';
    const tentacles = front => {
        for (let k = 0; k < n; k++) {
            if ((k % 2 === 0) !== front) continue;
            const f = k / (n - 1);
            const a = -Math.PI * (0.08 + 0.84 * f) + Math.sin(t * 1.2 + k * 0.9) * 0.14;
            const len = s * (0.75 + 0.4 * ((k * 7) % 5) / 5) * (0.12 + 0.88 * open);
            const bx = Math.cos(a) * s * 0.42, by = -s * 0.62 + Math.sin(a) * s * 0.1;
            const ex = bx + Math.cos(a) * len + Math.sin(t * 1.6 + k) * s * 0.08 * open;
            const ey = by + Math.sin(a) * len * 0.9;
            const gr = ctx.createLinearGradient(bx, by, ex, ey);
            gr.addColorStop(0, rgb(mix(body, [40, 20, 30], front ? 0 : 0.25)));
            gr.addColorStop(1, rgb(tip));
            ctx.strokeStyle = gr;
            ctx.lineWidth = s * 0.075;
            ctx.beginPath(); ctx.moveTo(bx, by);
            ctx.quadraticCurveTo(bx + Math.cos(a) * len * 0.5, by + Math.sin(a) * len * 0.5 - s * 0.14 * open, ex, ey);
            ctx.stroke();
        }
    };
    if (open > 0.05) tentacles(false);
    const h = s * lerp(0.5, 0.72, open);
    const gr = ctx.createLinearGradient(-s * 0.5, 0, s * 0.5, 0);
    gr.addColorStop(0, rgb(mix(body, [255, 255, 255], 0.22))); gr.addColorStop(1, rgb(mix(body, [30, 10, 30], 0.42)));
    ctx.fillStyle = gr;
    ctx.beginPath();                                               // the column; a jelly dome when shut
    ctx.moveTo(-s * 0.52, 0);
    ctx.bezierCurveTo(-s * 0.5, -h * 0.7, -s * 0.5, -h * (1.1 + 0.3 * (1 - open)), 0, -h * (1.05 + 0.3 * (1 - open)));
    ctx.bezierCurveTo(s * 0.5, -h * (1.1 + 0.3 * (1 - open)), s * 0.5, -h * 0.7, s * 0.52, 0);
    ctx.closePath(); ctx.fill();
    if (open > 0.05) tentacles(true);
    else {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.ellipse(-s * 0.16, -h * 0.9, s * 0.14, s * 0.07, -0.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
}

function seaStar(ctx, R, g, t, S) {
    const r = seeded(R.seed + 606);
    const p = R.at(0.5 + 0.22 * Math.sin(t * 0.021 + r() * 6));    // slow as a thought
    const s = R.w * (0.17 + 0.12 * g / 255);
    ctx.save();
    ctx.translate(p.x, p.y + s * 0.1); ctx.rotate(p.a + Math.sin(t * 0.05) * 0.3 + S.poke * 0.5); ctx.scale(1 - 0.14 * S.poke, 0.72 * (1 - 0.14 * S.poke));
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
    gr.addColorStop(0, '#d9904e'); gr.addColorStop(0.7, '#b65a2e'); gr.addColorStop(1, '#8a3a1e');
    ctx.fillStyle = gr;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + k * TAU / 5 + Math.sin(t * 0.6 + k * 2) * 0.07;
        const a0 = a - TAU / 10, a1 = a + TAU / 10;
        const ix = Math.cos(a0) * s * 0.36, iy = Math.sin(a0) * s * 0.36;
        if (k === 0) ctx.moveTo(ix, iy); else ctx.lineTo(ix, iy);
        ctx.quadraticCurveTo(Math.cos(a - 0.12) * s * 0.8, Math.sin(a - 0.12) * s * 0.8, Math.cos(a) * s, Math.sin(a) * s);
        ctx.quadraticCurveTo(Math.cos(a + 0.12) * s * 0.8, Math.sin(a + 0.12) * s * 0.8, Math.cos(a1) * s * 0.36, Math.sin(a1) * s * 0.36);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(70,20,10,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(246,222,186,0.55)';
    for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + k * TAU / 5;
        for (let d = 0.15; d < 0.9; d += 0.07) { const o = (r() - 0.5) * s * 0.12 * (1 - d); ctx.beginPath(); ctx.arc(Math.cos(a) * s * d - Math.sin(a) * o, Math.sin(a) * s * d + Math.cos(a) * o, s * (0.012 + r() * 0.022), 0, TAU); ctx.fill(); }
    }
    ctx.restore();
}

function hermit(ctx, R, g, t, S) {
    const r = seeded(R.seed + 707);
    const ph = r() * 6, walk = t * 0.22 + ph;
    const hid = S.poke > 0.25;                                     // touched, it pulls into the shell
    const pause = hid || Math.sin(walk * 2.7) > 0.55;              // it stops to look around
    const p = R.at(0.5 + 0.34 * Math.sin(walk));
    const dir = Math.cos(walk) >= 0 ? 1 : -1;
    const s = R.w * 0.13, step = pause ? 0 : t * 9;
    ctx.save();
    ctx.translate(p.x, p.y - s * 0.55 - (pause ? 0 : Math.abs(Math.sin(step)) * s * 0.08)); ctx.rotate(p.a * 0.6); ctx.scale(dir, 1);
    ctx.strokeStyle = '#b4502e'; ctx.lineWidth = s * 0.14; ctx.lineCap = 'round';
    for (let k = 0; k < (hid ? 0 : 3); k++) {                      // legs
        const sw = Math.sin(step + k * 2.1) * s * 0.22;
        ctx.beginPath(); ctx.moveTo(s * (0.3 + k * 0.16), s * 0.1);
        ctx.quadraticCurveTo(s * (0.55 + k * 0.2) + sw, s * 0.1, s * (0.6 + k * 0.22) + sw, s * 0.62);
        ctx.stroke();
    }
    ctx.fillStyle = '#c85e34';                                     // the claw
    if (!hid) { ctx.beginPath(); ctx.ellipse(s * 1.12, s * 0.22 + Math.sin(t * 2 + ph) * s * 0.06, s * 0.3, s * 0.2, 0.3, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#c85e34'; ctx.lineWidth = s * 0.07;         // eyes on stalks
    for (const e of hid ? [] : [0.62, 0.84]) {
        ctx.beginPath(); ctx.moveTo(s * e, -s * 0.05); ctx.lineTo(s * (e + 0.12), -s * 0.52); ctx.stroke();
        ctx.fillStyle = '#16121a'; ctx.beginPath(); ctx.arc(s * (e + 0.12), -s * 0.56, s * 0.085, 0, TAU); ctx.fill();
    }
    const gr = ctx.createRadialGradient(-s * 0.3, -s * 0.3, s * 0.1, 0, 0, s * 1.05);
    gr.addColorStop(0, '#fbeacb'); gr.addColorStop(0.7, '#d7a56c'); gr.addColorStop(1, '#8c5a34');
    ctx.fillStyle = gr;                                            // the borrowed shell
    ctx.beginPath();
    ctx.moveTo(s * 0.72, s * 0.34);
    ctx.bezierCurveTo(s * 0.9, -s * 0.5, s * 0.1, -s * 1.1, -s * 0.6, -s * 0.72);
    ctx.bezierCurveTo(-s * 1.2, -s * 0.36, -s * 1.0, s * 0.36, -s * 0.3, s * 0.42);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(110,60,30,0.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let a = 0; a < 9; a += 0.3) {
        const rr = s * 0.07 * a, x = -s * 0.18 + Math.cos(a) * rr, y = -s * 0.16 + Math.sin(a) * rr * 0.9;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
}

function urchin(ctx, R, g, t, S) {
    const r = seeded(R.seed + 808);
    const p = R.at(0.3 + 0.4 * r());
    const s = R.w * (0.09 + 0.06 * g / 255);
    ctx.save();
    ctx.translate(p.x, p.y - s * 0.55);
    ctx.lineCap = 'round';
    for (let k = 0; k < 34; k++) {
        const a = Math.PI * (0.92 + 1.16 * k / 33) + Math.sin(t * 0.9 + k * 1.3) * 0.07;
        const len = s * (1.5 + 0.5 * ((k * 5) % 7) / 7) * (1 + 0.3 * S.poke);
        ctx.strokeStyle = k % 3 ? '#3a2e3c' : '#6a5070';
        ctx.lineWidth = s * 0.07;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.7);
        ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len); ctx.stroke();
    }
    const gr = ctx.createRadialGradient(-s * 0.3, -s * 0.3, 0, 0, 0, s);
    gr.addColorStop(0, '#6e5872'); gr.addColorStop(1, '#221a26');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.86, 0, 0, TAU); ctx.fill();
    ctx.restore();
}

function sponge(ctx, R, g, t, S) {
    const r = seeded(R.seed + 909);
    const n = 5 + stage(g) * 3;
    const list = Array.from({ length: n }, () => [0.15 + 0.7 * r(), r(), r()]).sort((a, b) => a[2] - b[2]);
    for (const [u, sz, d] of list) {
        const p = R.at(u), s = R.w * (0.07 + 0.07 * sz) * size(g);
        const gr = ctx.createRadialGradient(p.x - s * 0.3, p.y - s * 0.5, s * 0.1, p.x, p.y, s * 1.2);
        gr.addColorStop(0, '#e8c27a'); gr.addColorStop(0.6, '#c98a3c'); gr.addColorStop(1, '#8a5420');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.ellipse(p.x, p.y - s * 0.2 + d * s * 0.3, s * 1.15, s * 0.8, p.a, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(70,30,8,0.75)';                      // the holes it breathes out of
        const hole = s * 0.2 * (1 - 0.6 * S.poke);
        ctx.beginPath(); ctx.ellipse(p.x + (sz - 0.5) * s * 0.5, p.y - s * 0.55 + d * s * 0.3, hole, hole * 0.6, 0, 0, TAU); ctx.fill();
    }
}

function nudibranch(ctx, R, g, t, S) {
    const r = seeded(R.seed + 1010);
    const crawl = t * 0.035 + r() * 6;
    const p = R.at(0.5 + 0.3 * Math.sin(crawl)), dir = Math.cos(crawl) >= 0 ? 1 : -1;
    const s = R.w * 0.2;
    ctx.save();
    ctx.translate(p.x, p.y - s * 0.12); ctx.rotate(p.a); ctx.scale(dir, 1);
    const squeeze = 1 - 0.25 * S.poke;
    const gr = ctx.createLinearGradient(0, -s * 0.3, 0, s * 0.15);
    gr.addColorStop(0, '#f4f8ff'); gr.addColorStop(1, '#9db8f0');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(-s * squeeze, s * 0.1);
    ctx.bezierCurveTo(-s * 0.8 * squeeze, -s * 0.3, s * 0.6 * squeeze, -s * 0.34, s * squeeze, -s * 0.02);
    ctx.bezierCurveTo(s * 0.9 * squeeze, s * 0.16, -s * 0.6, s * 0.18, -s * squeeze, s * 0.1);
    ctx.fill();
    ctx.lineCap = 'round'; ctx.lineWidth = s * 0.07;
    for (let k = 0; k < 9; k++) {                                  // the cerata on its back
        const x = -s * 0.75 + k * s * 0.17, len = s * (0.26 + 0.12 * Math.sin(k * 2.3)) * (1 - 0.5 * S.poke);
        const sw = Math.sin(t * 1.3 + k) * s * 0.05;
        ctx.strokeStyle = k % 2 ? '#ff7a3c' : '#ffb03c';
        ctx.beginPath(); ctx.moveTo(x * squeeze, -s * 0.2); ctx.lineTo(x * squeeze - s * 0.05 + sw, -s * 0.2 - len); ctx.stroke();
    }
    ctx.strokeStyle = '#6a50c8'; ctx.lineWidth = s * 0.06;         // the horns it smells with
    for (const dx of [0.72, 0.86]) { ctx.beginPath(); ctx.moveTo(s * dx * squeeze, -s * 0.16); ctx.lineTo(s * (dx + 0.08) * squeeze, -s * 0.42 * (1 - 0.5 * S.poke)); ctx.stroke(); }
    ctx.restore();
}

function brittle(ctx, R, g, t, S) {
    const r = seeded(R.seed + 1111);
    const p = R.at(0.35 + 0.3 * r());
    const s = R.w * 0.07;
    ctx.save();
    ctx.translate(p.x, p.y - s * 0.3); ctx.rotate(p.a);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let k = 0; k < 5; k++) {
        const a0 = -Math.PI / 2 + (k - 2) * 0.62;
        ctx.beginPath(); ctx.moveTo(0, 0);
        let x = 0, y = 0, a = a0;
        for (let j = 1; j <= 9; j++) {
            a += Math.sin(t * (1.6 + 4 * S.poke) + k * 1.9 + j * 0.7) * 0.22 + (k - 2) * 0.03;
            x += Math.cos(a) * s * 0.5 * (1 - 0.4 * S.poke); y += Math.sin(a) * s * 0.5 * (1 - 0.4 * S.poke);
            ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#6b4a32'; ctx.lineWidth = s * 0.24; ctx.stroke();
        ctx.strokeStyle = '#c9a070'; ctx.lineWidth = s * 0.1; ctx.setLineDash([s * 0.2, s * 0.3]); ctx.stroke(); ctx.setLineDash([]);
    }
    const gr = ctx.createRadialGradient(-s * 0.2, -s * 0.2, 0, 0, 0, s * 0.7);
    gr.addColorStop(0, '#d9b384'); gr.addColorStop(1, '#6b4a32');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.62, 0, TAU); ctx.fill();
    ctx.restore();
}

const DRAW = [null, film, barnacles, kelp, mussels, anemone, seaStar, hermit, urchin, sponge, nudibranch, brittle];

/** Draw what lives on rock R. S: { yWater, H, wind, poke }. */
export function drawCreature(ctx, R, rock, t, S) {
    const fn = DRAW[rock.sp];
    if (!fn) return;
    if ((rock.sp >= 2 && rock.sp <= 5) || rock.sp === 9) film(ctx, R, 70, t, S);   // settled things sit on a little green
    fn(ctx, R, rock.g, t, S);
}

/** A small picture of a species at growth g, for the field guide: a w x h box. */
export function portrait(ctx, sp, g, w, h, t = 0) {
    const base = h * 0.92, rw = w * 0.74, rh = h * 0.3, cx = w / 2;
    const top = u => { const a = Math.PI * (1 - (0.1 + 0.8 * u)); return [cx + Math.cos(a) * rw / 2, base - Math.pow(Math.sin(a), 0.8) * rh]; };
    const R = { cx, w: rw, h: rh, base, i: 0, seed: 4242 + sp * 13,
        at: u => { const [x, y] = top(u), [x2, y2] = top(Math.min(1, u + 0.02)); return { x, y, a: Math.atan2(y2 - y, x2 - x) }; } };
    const gr = ctx.createLinearGradient(0, base - rh, 0, base);
    gr.addColorStop(0, '#9a9288'); gr.addColorStop(1, '#4a464c');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(cx - rw / 2, base);
    for (let u = -0.125; u <= 1.13; u += 0.05) { const [x, y] = top(u); ctx.lineTo(x, Math.min(base, y)); }
    ctx.lineTo(cx + rw / 2, base); ctx.closePath(); ctx.fill();
    drawCreature(ctx, R, { sp, g }, t, { yWater: -h, H: h * 2.2, wind: 0.3, poke: 0 });
}
