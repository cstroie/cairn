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
    'js/core/world.js',
    'js/render/util.js',
    'js/render/sky.js',
    'js/render/water.js',
    'js/render/rocks.js',
    'js/render/creatures.js',
    'js/render/ambient.js',
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

/*
 * The low water alert. Where the browser wakes the worker now and then
 * (periodic background sync, an installed app), say so when low water is
 * within the hour and it is day. The page writes what to say, and whether
 * to say it, in the cache 'lw-prefs' (the worker cannot read the save).
 */
self.addEventListener('periodicsync', event => {
    if (event.tag !== 'low-water') return;
    event.waitUntil((async () => {
        const res = await (await caches.open('lw-prefs')).match('alert');
        const prefs = res ? await res.json() : null;
        if (!prefs || !prefs.on) return;
        const d = new Date();
        const M = (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()) - Date.UTC(1977, 11, 31)) / 60000;
        const phase = M % 745;
        if (phase < 312 || phase > 392 || d.getHours() < 8 || d.getHours() > 20) return;
        await self.registration.showNotification(prefs.title, { body: prefs.body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'low-water' });
    })());
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => (list[0] ? list[0].focus() : self.clients.openWindow('./'))));
});
