/*
 * pwa.js: the app side of the PWA. Registers the service worker, lets a
 * new version take over, suggests installing, shows the version.
 *
 *   init({ beforeReload, toast, banner })
 *
 * The pool is saved on every change, so an update costs nothing: a new
 * version that is waiting when the app starts, or while nobody is
 * looking, takes over at once. While the pool is being watched it only
 * says so, with a button.
 */
import { t } from './i18n.js';

const HOUR = 3600000;
const info = () => window.Cairn || { VERSION: '?', BUILD: '?' };
export const versionLabel = () => `${info().VERSION} (${info().BUILD})`;

let registration = null, deferredPrompt = null, reloading = false, hooks = {};
const startedAt = Date.now();

export const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const canInstall = () => !standalone() && (!!deferredPrompt || isIos());

function takeOver(worker) {
    try { hooks.beforeReload && hooks.beforeReload(); } catch (e) { /* reload anyway */ }
    reloading = true;
    worker.postMessage({ type: 'skip-waiting' });
    setTimeout(() => location.reload(), 4000);              // in case controllerchange never comes
}

function offer(worker) {
    if (!navigator.serviceWorker.controller) return;        // the first install: nothing to replace
    if (document.hidden || Date.now() - startedAt < 5000) return takeOver(worker);
    hooks.banner(t('updateReady'), [
        { label: t('updateNow'), primary: true, action: () => takeOver(worker) },
        { label: t('later') }
    ]);
    const hidden = () => { if (document.hidden) { document.removeEventListener('visibilitychange', hidden); takeOver(worker); } };
    document.addEventListener('visibilitychange', hidden);
}

function watch(reg) {
    if (reg.waiting) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
            if (w.state !== 'installed') return;
            if (navigator.serviceWorker.controller) offer(w);
            else hooks.toast(t('offlineReady'));
        });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) location.reload(); });
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    addEventListener('online', check);
    setInterval(check, HOUR);
}

export const registration_ = () => registration;

export async function checkNow() {
    if (!registration) return hooks.toast(t('updateFail'));
    try {
        await registration.update();
        if (registration.waiting) offer(registration.waiting);
        else if (!registration.installing) hooks.toast(t('upToDate'));
    } catch (e) { hooks.toast(t('updateFail')); }
}

export async function install() {
    if (deferredPrompt) {
        const p = deferredPrompt;
        deferredPrompt = null;
        try { await p.prompt(); await p.userChoice; } catch (e) { /* refused */ }
    } else hooks.toast(isIos() ? t('installHint') : t('installMenu'));
}

/**
 * Suggest installing, once the pool has been looked at for a while: an
 * installed app opens offline and keeps its own window. Asked again at
 * most every two weeks after "Later"; never once installed.
 */
const ASKED = 'cairn.installAsked', AGAIN = 14 * 24 * HOUR;
function suggestInstall() {
    let last = 0;
    try { last = Number(localStorage.getItem(ASKED)) || 0; } catch (e) { /* no storage: ask anyway */ }
    if (!canInstall() || Date.now() - last < AGAIN || /[?&](at|demo|rate)=/.test(location.search)) return;
    const asked = () => { try { localStorage.setItem(ASKED, String(Date.now())); } catch (e) { /* fine */ } };
    hooks.banner(t('installOffer'), [
        { label: t('install'), primary: true, action: () => { asked(); install(); } },
        { label: t('later'), action: asked }
    ]);
}

export function init(h) {
    hooks = h;
    setTimeout(suggestInstall, 40000);
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
    addEventListener('appinstalled', () => { deferredPrompt = null; });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        navigator.serviceWorker.register('sw.js').then(reg => { registration = reg; watch(reg); }).catch(() => {});
    }
}
