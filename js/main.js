/*
 * main.js: the start, the clock and the hands. Loads the pool (or makes
 * one), brings it up to date, and runs: a frame of the picture each
 * animation frame, the tide and the text once a second.
 *
 * For looking at a moment without waiting for it (nothing is saved):
 *   ?at=2026-06-21T12:00   the time      &rate=600   how fast it runs
 *   &seed=7                the pool      &demo=1     one of everything
 *   &lang=ro
 */
import { minuteOf, env as envOf, tideOf, LOW } from './core/tide.js';
import { catchUp, toggleCairn, EVENTS } from './core/sim.js';
import { newPool, load, save, arrive } from './core/state.js';
import { Scene } from './render/scene.js';
import { Audio } from './audio/engine.js';
import { Hud, rockName } from './ui/hud.js';
import * as panels from './ui/panels.js';
import * as pwa from './pwa.js';
import { setLang, sentence, t } from './i18n.js';

const params = new URLSearchParams(location.search);
const dev = params.has('at') || params.has('rate') || params.has('demo') || params.has('seed');
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
if (params.has('demo')) {
    const show = [[2, 250], [3, 255], [4, 220], [5, 230], [6, 150], [1, 200], [7, 100], [8, 160], [3, 120], [2, 90]];
    st.rocks.forEach((r, i) => { r.sp = show[i][0]; r.g = show[i][1]; r.cairn = i === 1 || i === 3; });
}
setLang(params.get('lang') || st.settings.lang);

const canvas = document.getElementById('scene');
const scene = new Scene(canvas);
const audio = new Audio();
audio.enabled = st.settings.sound;
let sel = -1, env = envOf(nowM(), st.lastStorm), lastPhase = env.phase;

const persist = () => { st.away = nowMs(); st.seen = Math.floor(nowM()); save(store, st); };
const names = () => st.rocks.map((r, i) => rockName(st, i));
let nameList = [];

const hud = new Hud({
    tool: name => {
        audio.unlock(); audio.click();
        if (name === 'diary') panels.diary(st, env);
        else if (name === 'tides') panels.tides(env);
        else panels.settings(st, { set: setting, newPool: startOver });
    },
    cairn: i => {
        if (toggleCairn(st, i)) { audio.click(); if (st.rocks[i].cairn) audio.plop(); }
        persist(); refresh();
    },
    rename: (i, name) => { st.rocks[i].name = name.slice(0, 14); persist(); refresh(); },
    select: i => select(i)
});

function refresh() {
    nameList = names();
    hud.sig = '';
    hud.update(env, st);
    if (sel >= 0) hud.showCard(sel, st);
}

function select(i) {
    sel = i;
    if (i < 0) return hud.hideCard();
    audio.unlock(); audio.click();
    scene.panTo(i);
    hud.showCard(i, st);
}

function setting(key, value) {
    st.settings[key] = value;
    if (key === 'sound') { audio.enabled = value; if (value) audio.unlock(); audio.setEnabled(value); }
    if (key === 'lang') { setLang(value); hud.build(); refresh(); panels.settings(st, { set: setting, newPool: startOver }); }
    persist();
}

function startOver() {
    const keep = st.settings;
    st = newPool((Math.random() * 0xffffffff) >>> 0, nowM(), keep);
    scene.setPool(st.seed, st.open);
    select(-1);
    persist(); refresh();
    panels.intro(() => {});
}

/** Coming back to the pool: at the start, and when the page is shown again. */
function comeBack(first) {
    const res = arrive(st, nowMs(), nowM());
    env = envOf(nowM(), st.lastStorm);
    lastPhase = env.phase;
    save(store, st);
    refresh();
    if (first && fresh) panels.intro(() => audio.unlock());
    else if (res.walked || res.tides > 0) panels.welcome(res, st, env, () => audio.unlock());
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
    if (news.length) {
        const e = news[news.length - 1];
        hud.latest(sentence({ evName: EVENTS[e.ev], sp: e.sp }, e.rock >= 0 ? (e.name || t('rockN', { n: e.rock + 1 })) : ''));
        audio.chime(3);
    }
    hud.update(env, st);
}

/* ---------- the picture ---------- */

const still = matchMedia('(prefers-reduced-motion: reduce)');
let lastFrame = 0;
function frame(ms) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    if (still.matches && ms - lastFrame < 250) return;
    lastFrame = ms;
    const time = ms / 1000;
    if (rate !== 1) env = envOf(nowM(), st.lastStorm);
    scene.draw(env, st, time, { sel, names: nameList });
    audio.setEnv(env, 0.5 + 0.5 * Math.sin(time * 1.1));
}

/* ---------- the hands ---------- */

let drag = null;
canvas.addEventListener('pointerdown', e => {
    audio.unlock();
    drag = { x: e.clientX, y: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) + Math.abs(e.clientY - drag.y) < 8) return;
    drag.moved = true;
    scene.target = null;
    scene.panBy(-dx);
    drag.x = e.clientX;
});
const drop = e => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.moved || e.type === 'pointercancel') return;
    const r = canvas.getBoundingClientRect();
    const i = scene.rockAt(e.clientX - r.left, e.clientY - r.top);
    select(i === sel ? -1 : i);
};
canvas.addEventListener('pointerup', drop);
canvas.addEventListener('pointercancel', drop);
canvas.addEventListener('wheel', e => { scene.target = null; scene.panBy(e.deltaX || e.deltaY); }, { passive: true });

addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
    audio.unlock();
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (panels.isOpen()) panels.close(); else select(-1); return; }
    if (panels.isOpen()) return;
    if (k === 'arrowright' || k === '.' || k === '>') select(Math.min(st.open - 1, sel + 1));
    else if (k === 'arrowleft' || k === ',' || k === '<') select(Math.max(0, sel < 0 ? 0 : sel - 1));
    else if (k >= '0' && k <= '9') { const i = k === '0' ? 9 : Number(k) - 1; if (i < st.open) select(i); }
    else if ((k === ' ' || k === 'enter') && sel >= 0) { e.preventDefault(); hud.hooks.cairn(sel); }
    else if (k === 'n' && sel >= 0) { e.preventDefault(); hud.rename(sel, st); }
    else if (k === 't') panels.tides(env);
    else if (k === 'j') panels.diary(st, env);
    else if (k === 'b') { setting('bell', !st.settings.bell); hud.toast(`${t('bell')}: ${t(st.settings.bell ? 'on' : 'off')}`); if (st.settings.bell) audio.bell(); }
    else if (k === '?') panels.intro(() => {});
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) persist();
    else comeBack(false);
});
addEventListener('pagehide', persist);
addEventListener('resize', () => scene.resize());
setInterval(() => { if (!document.hidden) persist(); }, 30000);

scene.setPool(st.seed, st.open);
scene.resize();
comeBack(true);
setInterval(tick, 1000);
requestAnimationFrame(frame);
pwa.init({ beforeReload: persist, toast: s => hud.toast(s), banner: (s, b) => hud.banner(s, b) });
window.lowWater = { get state() { return st; }, scene };
