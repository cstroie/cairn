#!/usr/bin/env node
/*
 * icons.js: draw the app's icons into icons/ (needs Playwright; run when
 * the drawing changes, and commit the PNGs).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');

function draw(size, maskable) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d'), s = size / 100;
    x.scale(s, s);
    if (!maskable) { x.beginPath(); x.roundRect(0, 0, 100, 100, 22); x.clip(); }
    let g = x.createLinearGradient(0, 0, 0, 56);
    g.addColorStop(0, '#f7a46e'); g.addColorStop(0.55, '#f9cf9a'); g.addColorStop(1, '#fde9c4');
    x.fillStyle = g; x.fillRect(0, 0, 100, 100);
    x.fillStyle = '#fff6da'; x.beginPath(); x.arc(64, 34, 11, 0, 7); x.fill();
    g = x.createLinearGradient(0, 46, 0, 100);
    g.addColorStop(0, '#2f8fa6'); g.addColorStop(1, '#0d4664');
    x.fillStyle = g; x.fillRect(0, 46, 100, 54);
    x.fillStyle = 'rgba(255,246,218,0.55)';
    for (const [px, py, w] of [[58, 50, 12], [61, 54, 8], [56, 58, 14], [62, 62, 6]]) x.fillRect(px, py, w, 1.6);
    x.fillStyle = '#39343c';                                 // the rock
    x.beginPath(); x.moveTo(8, 82); x.bezierCurveTo(10, 60, 24, 50, 40, 52); x.bezierCurveTo(56, 54, 62, 70, 64, 82); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.12)';
    x.beginPath(); x.moveTo(14, 74); x.bezierCurveTo(16, 60, 26, 54, 38, 55); x.bezierCurveTo(28, 58, 20, 64, 18, 76); x.closePath(); x.fill();
    let y = 52, w = 9;                                       // the cairn
    for (const tone of ['#8d8f98', '#c9c2b6', '#a2a5ad', '#ded8cc']) {
        x.fillStyle = tone; x.beginPath(); x.ellipse(36, y - w * 0.42, w, w * 0.44, 0, 0, 7); x.fill();
        y -= w * 0.74; w *= 0.74;
    }
    x.fillStyle = '#e8d3a4';                                 // sand, and the water's edge
    x.beginPath(); x.moveTo(0, 84); x.bezierCurveTo(30, 78, 70, 88, 100, 80); x.lineTo(100, 100); x.lineTo(0, 100); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 1.6;
    x.beginPath(); x.moveTo(0, 70); x.bezierCurveTo(12, 66, 20, 74, 34, 70); x.bezierCurveTo(48, 66, 58, 74, 72, 70); x.bezierCurveTo(84, 66, 92, 72, 100, 69); x.stroke();
    return c.toDataURL('image/png');
}

const browser = await chromium.launch();
const page = await browser.newPage();
fs.mkdirSync(OUT, { recursive: true });
for (const [name, size, maskable] of [['icon-32', 32, false], ['icon-180', 180, true], ['icon-192', 192, false], ['icon-512', 512, false], ['icon-maskable-512', 512, true]]) {
    const url = await page.evaluate(`(${draw})(${size}, ${maskable})`);
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(url.split(',')[1], 'base64'));
    console.log(name);
}
await browser.close();
