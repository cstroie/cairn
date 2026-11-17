/*
 * main.js: the start, the clock and the hands. Loads the pool (or makes
 * one), brings it up to date, and runs: a frame of the picture each
 * animation frame; the tide, the looking and the text once a second.
 *
 * For looking at a moment without waiting for it (nothing is saved):
 *   ?at=2026-06-21T12:00   the time      &rate=600   how fast it runs
 *   &seed=7                the pool      &demo=1     one of everything
 *   &lang=ro               &all=1        every rock uncovered, the ledge too
 */
import { minuteOf, env as envOf, tideOf, fieldsOf, nextWaters, LOW } from './core/tide.js';
import { catchUp, toggleCairn, EVENTS, LEDGE } from './core/sim.js';
import { newPool, load, save, arrive } from './core/state.js';
import * as world from './core/world.js';
import { Scene } from './render/scene.js';
import { Audio } from './audio/engine.js';
import { Hud, rockName, fmtClock } from './ui/hud.js';
import * as panels from './ui/panels.js';
import * as pwa from './pwa.js';
import { setLang, sentence, t, L } from './i18n.js';

const params = new URLSearchParams(location.search);
const dev = ['at', 'rate', 'demo', 'seed', 'all'].some(k => params.has(k));
const t0 = Date.now();
const offset = params.get('at') ? new Date(params.get('at')).getTime() - t0 : 0;
const rate = Number(params.get('rate')) || 1;
const nowMs = () => t0 + offset + (Date.now() - t0) * rate;
const nowM = () => minuteOf(new Date(nowMs()));

const memory = new Map();
const store = dev ? { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) } : window.localStorage;

let st = null, fresh = false;
try { st = load(store); } catch (e) { st = null; }
if (!st) {
    st = newPool(Number(params.get('seed')) || (Math.random() * 0xffffffff) >>> 0, nowM());
    fresh = true;
}
if (params.has('all') || params.has('demo')) { st.rocks.forEach(r => { r.on = true; }); st.ledge = true; st.stones = 5; }
if (params.has('demo')) {
    const show = [[2, 250], [3, 255], [4, 220], [5, 230], [6, 150], [1, 200], [7, 100], [8, 160], [3, 120], [2, 90], [9, 200], [10, 120], [11, 100]];
    st.rocks.forEach((r, i) => { r.sp = show[i][0]; r.g = show[i][1]; r.cairn = i === 1 || i === 3; });
}
setLang(params.get('lang') || st.settings.lang);

const canvas = document.getElementById('scene');
const scene = new Scene(canvas);
const audio = new Audio();
audio.enabled = st.settings.sound;
let sel = -1, env = envOf(nowM(), st.lastStorm), lastPhase = env.phase, about = new Set();
let lapse = null;               // coming back: the tides you missed, run fast
let peek = null;                // looking ahead: { off (minutes), play }
let time = 0;                   // seconds, for the picture
let nameList = [];

const persist = () => { st.away = nowMs(); st.seen = Math.floor(nowM()); save(store, st); };
const settingsHooks = () => ({ set: setting, newPool: startOver, tides: () => panels.tides(env) });

const hud = new Hud({
    tool: name => {
        audio.unlock(); audio.click();
        if (name === 'diary') panels.diary(st, env);
        else if (name === 'guide') panels.guide(st);
        else if (name === 'tides') panels.tides(env);
        else if (name === 'peek') setPeek(peek ? null : { off: 0, play: true });
        else panels.settings(st, settingsHooks());
    },
    cairn: i => {
        if (toggleCairn(st, i)) { audio.click(); if (st.rocks[i].cairn) audio.plop(); }
        persist(); refresh();
    },
    look: i => {
        const res = world.lookUnder(st, i);
        if (!res) return;
        audio.plop(); scene.touch(i, time);
        if (res.id) hud.toast(t('underFound', { name: L().album[res.id][0] })); else hud.toast(t('underSame'));
        announce(res.fresh ? [res.id] : []);
        persist(); refresh();
    },
    rename: (i, name) => { st.rocks[i].name = name.slice(0, 14); persist(); refresh(); },
    select: i => select(i),
    peek: p => setPeek(p)
});

function refresh() {
    nameList = st.rocks.map((r, i) => (r.on ? rockName(st, i) : '?'));
    scene.setPool(st.seed, st.rocks.map(r => r.on));
    hud.sig = '';
    hud.update(env, st);
    if (sel >= 0) hud.showCard(sel, st, scene.exposed(sel));
}

function select(i) {
    sel = i;
    if (i < 0) return hud.hideCard();
    audio.unlock(); audio.click();
    if (st.rocks[i].on) scene.touch(i, time);
    hud.showCard(i, st, scene.exposed(i));
}

/** New pages of the field guide: say so, and give what they have earned. */
function announce(ids) {
    if (!ids.length) return;
    const res = world.unlock(st);
    if (ids.length === 1) hud.toast(t('newPage', { name: panels.pageName(panels.pageById(ids[0])) }));
    else hud.toast(t('newPages', { n: ids.length }));
    audio.chime(Math.min(5, 2 + ids.length));
    for (const i of res.rocks) hud.toast(t('gotRock', { name: rockName(st, i) }));
    if (res.stones) hud.toast(t('gotStone'));
    if (res.ledge) hud.toast(t('gotLedge'));
    persist(); refresh();
}

/** Look at the pool: what is about, what is seen for the first time, what the sea left. */
function look() {
    about = world.surprises(env);
    if (lapse || peek || panels.isOpen() || document.hidden) return;
    world.tideLine(st, env);
    announce(world.observe(st, env, about));
}

async function setting(key, value) {
    if (key === 'alert' && value) {
        const perm = 'Notification' in window ? await Notification.requestPermission() : 'denied';
        if (perm !== 'granted') { hud.toast(t('alertDenied')); return false; }
    }
    st.settings[key] = value;
    if (key === 'sound') { audio.enabled = value; if (value) audio.unlock(); audio.setEnabled(value); }
    if (key === 'lang') { setLang(value); hud.build(); refresh(); panels.settings(st, settingsHooks()); }
    if (key === 'alert' || key === 'lang') alertPrefs();
    persist();
    return true;
}

function startOver() {
    const keep = st.settings;
    st = newPool((Math.random() * 0xffffffff) >>> 0, nowM(), keep);
    select(-1);
    persist(); refresh();
    panels.intro(() => {});
}

/** Coming back to the pool: at the start, and when the page is shown again. */
function comeBack(first) {
    const M = nowM();
    const res = arrive(st, nowMs(), M);
    env = envOf(M, st.lastStorm);
    lastPhase = env.phase;
    about = world.surprises(env);
    save(store, st);
    refresh();
    const welcome = () => {
        if (res.walked) scene.walk(res.stepped, time);
        panels.welcome(res, st, env, () => { audio.unlock(); look(); });
    };
    if (first && fresh) panels.intro(() => { audio.unlock(); look(); });
    else if (res.tides > 0) {                               // the tides you missed, in a few seconds
        setPeek(null);
        const before = st.rocks.map((r, i) => Object.assign({}, r, res.before[i]));
        lapse = { from: Math.max(M - res.awayMin, M - 3 * 1440), to: M, start: null, dur: 4.5, before, done: welcome };
    } else if (res.walked) welcome();
}

/** Once a second: the tide may have turned. */
function tick() {
    const M = nowM();
    const before = st.jseq || 0;
    if (tideOf(M) > st.last) {
        catchUp(st, tideOf(M));
        if (st.settings.bell) audio.bell();
        persist(); refresh();
    }
    env = envOf(M, st.lastStorm);
    if (lastPhase < LOW && env.phase >= LOW && st.settings.bell) audio.bell();
    lastPhase = env.phase;
    const news = st.journal.filter(e => e.n > before);
    look();
    if (news.length) {
        const e = news[news.length - 1];
        hud.latest(sentence({ evName: EVENTS[e.ev], sp: e.sp }, e.rock >= 0 ? (e.name || rockName(st, e.rock)) : ''));
    }
    hud.update(env, st);
    if (sel >= 0 && sel >= LEDGE) hud.showCard(sel, st, scene.exposed(sel));
    if (about.has('gull') && Math.random() < 0.035) audio.gull();
}

/* ---------- looking ahead ---------- */

function setPeek(p) {
    if (p && p.toggle) p = peek ? { off: peek.off, play: !peek.play } : { off: 0, play: true };
    if (p && lapse) return;
    peek = p ? { off: p.off || 0, play: !!p.play } : null;
    if (peek) select(-1);
    showPeek();
}
const showPeek = () => hud.peek(peek && { off: peek.off, play: peek.play, label: fmtClock(fieldsOf(nowM() + peek.off)) });

/* ---------- the picture ---------- */

const still = matchMedia('(prefers-reduced-motion: reduce)');
const ease = k => k * k * (3 - 2 * k);
let lastFrame = 0;
function frame(ms) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    if (still.matches && ms - lastFrame < 250) return;
    const dt = Math.min(0.1, (ms - lastFrame) / 1000);
    lastFrame = ms;
    time = ms / 1000;
    let e = env, rocks = st.rocks, things = about, beach = st.beach;
    if (lapse) {
        if (lapse.start == null) lapse.start = time;
        const k = (time - lapse.start) / lapse.dur;
        if (k >= 1) { const done = lapse.done; lapse = null; done(); }
        else {
            e = envOf(lapse.from + (lapse.to - lapse.from) * ease(k), -1);
            rocks = k < 0.8 ? lapse.before : st.rocks;
            things = world.surprises(e); beach = null;
        }
    } else if (peek) {
        if (peek.play) { peek.off = (peek.off + dt * 124) % 1490; showPeek(); }
        e = envOf(nowM() + peek.off, -1);
        things = world.surprises(e);
    } else if (rate !== 1) e = env = envOf(nowM(), st.lastStorm);
    scene.draw(e, rocks, time, { sel, names: nameList, about: things, beach });
    audio.setEnv(e, 0.5 + 0.5 * Math.sin(time * 1.1));
}

/* ---------- the hands ---------- */

const SPOT = new Set(['fish', 'shrimp', 'gull', 'wader', 'seal', 'dolphin', 'octopus', 'jelly']);

function tapThing(h) {
    if (SPOT.has(h.id)) {
        audio.plop();
        if (h.id === 'gull') audio.gull();
        if (world.discover(st, h.id, env.tide)) announce([h.id]);
        else hud.toast(t('spotted', { name: L().album[h.id][0] }));
        return;
    }
    const page = h.id === 'bottle' ? 'bottle' : h.id.startsWith('stranded') ? 'rescue' : 'cleanup';
    const isNew = !world.has(st, page);
    const res = world.pickUp(st, h.k);
    if (!res) return;
    audio.plop();
    if (res.kind === 'bottle') panels.bottle(res.message);
    else hud.toast(t(res.kind === 'rescue' ? 'rescued' : 'cleaned'));
    announce(isNew ? [page] : []);
    persist();
}

let drag = null;
canvas.addEventListener('pointerdown', e => {
    audio.unlock();
    drag = { x: e.clientX, y: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
    if (drag && Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 12) drag.moved = true;
});
const drop = e => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.moved || e.type === 'pointercancel' || lapse || peek) return;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const thing = scene.thingAt(x, y);
    if (thing) return tapThing(thing);
    const i = scene.rockAt(x, y);
    select(i === sel ? -1 : i);
};
canvas.addEventListener('pointerup', drop);
canvas.addEventListener('pointercancel', drop);

addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
    audio.unlock();
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (panels.isOpen()) panels.close(); else if (peek) setPeek(null); else select(-1); return; }
    if (panels.isOpen() || lapse) return;
    const open = st.rocks.map((r, i) => (r.on ? i : -1)).filter(i => i >= 0);
    const step = d => { const at = open.indexOf(sel); select(open[Math.max(0, Math.min(open.length - 1, at < 0 ? 0 : at + d))]); };
    if (k === 'arrowright' || k === '.' || k === '>') step(1);
    else if (k === 'arrowleft' || k === ',' || k === '<') step(-1);
    else if (k >= '0' && k <= '9') select(k === '0' ? 9 : Number(k) - 1);
    else if ((k === ' ' || k === 'enter') && sel >= 0 && st.rocks[sel].on) { e.preventDefault(); if (sel < LEDGE || scene.exposed(sel)) hud.hooks.cairn(sel); }
    else if (k === 'n' && sel >= 0 && st.rocks[sel].on) { e.preventDefault(); hud.rename(sel, st); }
    else if (k === 't') panels.tides(env);
    else if (k === 'j') panels.diary(st, env);
    else if (k === 'g') panels.guide(st);
    else if (k === 'p') setPeek({ toggle: true });
    else if (k === 'b') { setting('bell', !st.settings.bell); hud.toast(`${t('bell')}: ${t(st.settings.bell ? 'on' : 'off')}`); if (st.settings.bell) audio.bell(); }
    else if (k === '?') panels.intro(() => {});
});

/* ---------- the low water alert ---------- */

let alertTimer = null;

/** Tell the service worker what to say (it cannot read the save). */
function alertPrefs() {
    if (!('caches' in window)) return;
    const body = JSON.stringify({ on: !!st.settings.alert, title: t('alertTitle'), body: t('alertBody') });
    caches.open('lw-prefs').then(c => c.put('alert', new Response(body))).catch(() => {});
    const reg = pwa.registration_();
    if (reg && reg.periodicSync) {
        (reg.periodicSync.unregister('low-water').catch(() => {}), st.settings.alert ? reg.periodicSync.register('cairn', { minInterval: 3 * 3600000 }) : reg.periodicSync.unregister('cairn')).catch(() => {});
    }
}

/** While the page sleeps in the background: a notification a little before the next low water. */
function armAlert() {
    clearTimeout(alertTimer);
    if (!st.settings.alert || !('Notification' in window) || Notification.permission !== 'granted') return;
    const low = nextWaters(nowM(), 2).find(w => !w.high);
    const wait = (low.M - nowM() - 20) * 60000 / rate;
    if (wait <= 60000 || wait > 12 * 3600000) return;
    alertTimer = setTimeout(() => {
        const reg = pwa.registration_();
        if (document.hidden && reg) reg.showNotification(t('alertTitle'), { body: t('alertBody'), icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'low-water' }).catch(() => {});
    }, wait);
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) { persist(); armAlert(); }
    else { clearTimeout(alertTimer); comeBack(false); }
});
addEventListener('pagehide', persist);
addEventListener('resize', () => { scene.resize(); if (sel >= 0) hud.showCard(sel, st, scene.exposed(sel)); });
setInterval(() => { if (!document.hidden) persist(); }, 30000);

scene.setPool(st.seed, st.rocks.map(r => r.on));
scene.resize();
comeBack(true);
setInterval(tick, 1000);
requestAnimationFrame(frame);
pwa.init({ beforeReload: persist, toast: s => hud.toast(s), banner: (s, b) => hud.banner(s, b) });
if (st.settings.alert) setTimeout(alertPrefs, 3000);
window.cairn = { get state() { return st; }, scene, world };
