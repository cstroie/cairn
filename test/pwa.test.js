import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shell, build, current } from '../tools/stamp.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = dir => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .flatMap(e => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));

test('the service worker caches every file of the app, and only files that exist', () => {
    const list = shell();
    const app = ['index.html', 'manifest.webmanifest', ...walk('js'), ...walk('css'), ...walk('lang'), ...walk('icons')];
    assert.deepEqual([...list].sort(), app.sort());
    assert.equal(new Set(list).size, list.length);
});

test('the build stamp is current (run node tools/stamp.js)', () => {
    assert.equal(current(), build());
});

test('every module a file imports is in the cache', () => {
    const list = new Set(shell());
    for (const f of list) {
        if (!f.endsWith('.js')) continue;
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
        for (const m of src.matchAll(/from '(\.[^']+)'/g)) {
            const dep = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1]));
            assert.ok(list.has(dep), `${f} imports ${dep}`);
        }
    }
});

test('the manifest and the page name icons that exist', () => {
    const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
    for (const i of man.icons) assert.ok(fs.existsSync(path.join(ROOT, i.src)), i.src);
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    for (const m of html.matchAll(/(?:href|src)="([^"#]+)"/g)) assert.ok(fs.existsSync(path.join(ROOT, m[1])), m[1]);
});
