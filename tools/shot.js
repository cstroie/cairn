#!/usr/bin/env node
/*
 * shot.js: pictures of the app at chosen moments, to look at before a
 * change is pushed. Needs Playwright (not a dependency of the app).
 *
 *   node tools/shot.js <dir> [name ...]
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { serve } from './serve.js';

const { chromium } = createRequire(import.meta.url)('playwright');

const SHOTS = {
    noon: { q: 'at=2026-06-21T13:00&demo=1&seed=7', w: 1280, h: 720 },
    low: { q: 'at=2026-06-21T13:00&demo=1&seed=7', w: 1280, h: 720, low: true },
    dusk: { q: 'at=2026-09-10T19:40&demo=1&seed=7', w: 1280, h: 720 },
    night: { q: 'at=2026-11-05T23:30&demo=1&seed=7', w: 1280, h: 720 },
    phone: { q: 'at=2026-06-21T10:00&demo=1&seed=7&lang=ro', w: 390, h: 844, low: true, tap: true },
    wide: { q: 'at=2026-03-12T08:20&seed=11', w: 844, h: 390 },
    ledge: { q: 'at=2026-06-15T13:00&demo=1&seed=7', w: 1280, h: 720, low: true },
    tall: { q: 'at=2026-06-21T16:00&demo=1&seed=7', w: 390, h: 844 },
    fresh: { q: 'at=2026-06-21T11:00&seed=3', w: 390, h: 844 },
    guide: { q: 'at=2026-06-21T13:00&demo=1&seed=7', w: 520, h: 1500, key: 'g', pages: true }
};

const out = process.argv[2] || '.';
const want = process.argv.slice(3);
const server = await serve(8126);
const browser = await chromium.launch();
for (const [name, s] of Object.entries(SHOTS)) {
    if (want.length && !want.includes(name)) continue;
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    let q = s.q;
    if (s.low) {                                    // move the hour to the nearest low water
        const { TIDE, LOW, minuteOf } = await import('../js/core/tide.js');
        const d = new Date(q.match(/at=([^&]+)/)[1]);
        const M = minuteOf(d), p = M - Math.floor(M / TIDE) * TIDE;
        const iso = new Date(d.getTime() + (LOW - p) * 60000);
        const pad = n => String(n).padStart(2, '0');
        q = q.replace(/at=[^&]+/, `at=${iso.getFullYear()}-${pad(iso.getMonth() + 1)}-${pad(iso.getDate())}T${pad(iso.getHours())}:${pad(iso.getMinutes())}`);
    }
    await page.goto(`http://localhost:8126/?${q}`);
    await page.waitForTimeout(700);
    const btn = page.locator('#panel .btn').first();
    if (await btn.isVisible()) await btn.click();
    if (s.tap) await page.evaluate(() => { const R = window.lowWater.scene.rocks[4]; window.lowWater.tap = [R.cx, (R.top + R.base) / 2]; }).then(() => page.evaluate(() => window.lowWater.tap)).then(p => page.mouse.click(p[0], p[1]));
    if (s.pages) await page.evaluate(() => { for (const a of window.lowWater.world.ALBUM) window.lowWater.state.album[a.id] = 1; });
    if (s.key) { await page.waitForTimeout(1500); await page.keyboard.press(s.key); }
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    console.log(name, errors.length ? `ERRORS: ${errors.join(' | ')}` : 'ok');
    await page.close();
}
await browser.close();
server.close();
