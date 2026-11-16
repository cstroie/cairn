/* util.js: small helpers for drawing. Colours are [r, g, b] arrays. */
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
export const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const TAU = Math.PI * 2;

/** A canvas of its own, to draw something once and reuse it. */
export function layer(w, h, scale = 1) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * scale));
    c.height = Math.max(1, Math.ceil(h * scale));
    const ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    return { canvas: c, ctx };
}

/**
 * A smooth path through points [[x, y], ...]: closed, or open. An open
 * path goes on from where the pen is when `join` is true.
 */
export function smoothPath(ctx, pts, close = false, join = false) {
    const n = pts.length;
    if (n < 2) return;
    if (close) {
        const mx = (pts[n - 1][0] + pts[0][0]) / 2, my = (pts[n - 1][1] + pts[0][1]) / 2;
        ctx.moveTo(mx, my);
        for (let i = 0; i < n; i++) {
            const a = pts[i], b = pts[(i + 1) % n];
            ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        }
        ctx.closePath();
    } else {
        if (join) ctx.lineTo(pts[0][0], pts[0][1]); else ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < n - 1; i++) {
            const a = pts[i], b = pts[i + 1];
            ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        }
        ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
}
