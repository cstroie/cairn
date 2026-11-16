/*
 * Service worker: keeps the app for offline use.
 *
 * Every file of the app is cached under the version's own name
 * (lowwater-{VERSION}-{BUILD}) and served from there, so a page always
 * runs one consistent version. A new version installs beside the old one
 * and waits; the page tells it when to take over ('skip-waiting'): at
 * once when nobody is looking, or at the next start. The old cache is
 * removed when the new worker takes over.
 */
importScripts('js/version.js');
const { VERSION, BUILD } = self.LowWater;
const CACHE = `lowwater-${VERSION}-${BUILD}`;
const SHELL = [
    './',
    'index.html',
    'manifest.webmanifest',
    'css/low-water.css',
    'js/version.js',
    'js/main.js',
    'js/pwa.js',
    'js/i18n.js',
    'js/core/rng.js',
    'js/core/tide.js',
    'js/core/sim.js',
    'js/core/state.js',
    'js/render/util.js',
    'js/render/sky.js',
    'js/render/water.js',
    'js/render/rocks.js',
    'js/render/creatures.js',
    'js/render/scene.js',
    'js/audio/engine.js',
    'js/ui/icons.js',
    'js/ui/hud.js',
    'js/ui/panels.js',
    'lang/en.js',
    'lang/ro.js',
    'icons/icon-32.png',
    'icons/icon-180.png',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
    // Fetch past the HTTP cache, so the new version is really new.
    event.waitUntil(caches.open(CACHE).then(cache =>
        cache.addAll(SHELL.map(url => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            // Only our own caches: the origin may be shared with other apps.
            .then(keys => Promise.all(keys.filter(k => k.startsWith('lowwater-') && k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('message', event => {
    const msg = event.data || {};
    if (msg.type === 'skip-waiting') self.skipWaiting();
    if (msg.type === 'version' && event.ports[0]) event.ports[0].postMessage({ version: VERSION, build: BUILD });
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== location.origin) return;
    // This version's copy, else the network.
    event.respondWith(caches.open(CACHE).then(cache =>
        cache.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req))));
});
