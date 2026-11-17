#!/usr/bin/env node
/*
 * stamp.js: write the build stamp into js/version.js.
 *
 *   node tools/stamp.js            write it
 *   node tools/stamp.js --check    exit 1 when it is stale
 *
 * The stamp is the first 12 hex digits of a SHA-256 over every file the
 * service worker caches (the SHELL list in sw.js), with the stamp itself
 * set to zeros. The cache is named cairn-{VERSION}-{BUILD}, so any
 * change to the app is a new cache and a new service worker. Run it
 * after any change to a file of the app; a test fails when it is stale.
 *
 * For a release: raise VERSION in js/version.js (semver), then run this.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_FILE = path.join(ROOT, 'js/version.js');
const STAMP = /BUILD: '([0-9a-f]{12})'/;

export function shell() {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const list = /const SHELL = \[([\s\S]*?)\];/.exec(sw)[1];
    return [...list.matchAll(/'([^']+)'/g)].map(m => m[1]).filter(f => f !== './');
}

export function build() {
    const h = crypto.createHash('sha256');
    for (const f of [...shell(), 'sw.js']) {
        let data = fs.readFileSync(path.join(ROOT, f));
        if (f === 'js/version.js') data = Buffer.from(data.toString('utf8').replace(STAMP, "BUILD: '000000000000'"));
        h.update(f + '\0').update(data);
    }
    return h.digest('hex').slice(0, 12);
}

export const current = () => STAMP.exec(fs.readFileSync(VERSION_FILE, 'utf8'))[1];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const stamp = build();
    if (process.argv.includes('--check')) {
        if (stamp !== current()) { console.error(`js/version.js: build ${current()} is stale, run node tools/stamp.js (${stamp})`); process.exit(1); }
        console.log(`build ${stamp} is current`);
    } else {
        fs.writeFileSync(VERSION_FILE, fs.readFileSync(VERSION_FILE, 'utf8').replace(STAMP, `BUILD: '${stamp}'`));
        console.log(`js/version.js: build ${stamp}`);
    }
}
