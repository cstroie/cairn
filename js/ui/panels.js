/*
 * panels.js: the sheets that open over the pool: the first words, the
 * welcome back, the diary, the tide table, the settings.
 */
import { t, L, LANGS, lang, duration, sentence } from '../i18n.js';
import { ICON } from './icons.js';
import { esc, cap } from './hud.js';
import { EVENTS } from '../core/sim.js';
import { TIDE, DAY, level, nextWaters, fieldsOf, sun, dayOf } from '../core/tide.js';
import { entriesSince } from '../core/state.js';
import { versionLabel, checkNow, install, canInstall } from '../pwa.js';

const panel = () => document.getElementById('panel');
let onClose = null;

export const isOpen = () => !panel().hidden;

export function close() {
    if (panel().hidden) return;
    panel().hidden = true;
    const fn = onClose; onClose = null;
    if (fn) fn();
}

function open(title, html, opts = {}) {
    const p = panel(), sheet = p.querySelector('.sheet');
    sheet.innerHTML = `<header><h2>${esc(title)}</h2><button class="x" aria-label="${esc(t('close'))}">${ICON.close}</button></header>${html}`;
    sheet.setAttribute('aria-label', title);
    sheet.querySelector('.x').onclick = close;
    p.onclick = e => { if (e.target === p) close(); };
    p.hidden = false;
    sheet.scrollTop = 0;
    onClose = opts.onClose || null;
    return sheet;
}

const clock = M => { const f = fieldsOf(M); return `${String(f.hour).padStart(2, '0')}:${String(f.minute).padStart(2, '0')}`; };

function entryLine(e, nowTide) {
    const days = Math.floor((nowTide - e.t) * TIDE / DAY);
    const when = days <= 0 ? t('today') : days === 1 ? t('yesterday') : t('daysAgo', { n: days });
    const rock = e.rock >= 0 ? (e.name || t('rockN', { n: e.rock + 1 })) : '';
    return `<li><small>${esc(when)}</small><span>${esc(sentence({ evName: EVENTS[e.ev], sp: e.sp }, rock))}</span></li>`;
}

export function intro(done) {
    const s = open(t('title'), `<p class="tag">${esc(t('tagline'))}</p><div class="story">${L().intro.map(p => `<p>${esc(p)}</p>`).join('')}</div>
        <button class="btn">${esc(t('begin'))}</button>`, { onClose: done });
    s.querySelector('.btn').onclick = close;
}

export function welcome(res, st, env, done) {
    const list = entriesSince(st, res.since).slice().reverse().slice(0, 30);
    const away = res.tides > 0 ? `<p>${esc(t('away', { d: duration(res.awayMin), t: L().tideCount(res.tides) }))}</p>` : '';
    const walk = res.walked ? `<p>${esc(res.stepped.length ? t('walked') : t('walkedNone'))}</p>` : '';
    const what = list.length ? `<p class="sub">${esc(t('whileGone'))}</p><ul class="log">${list.map(e => entryLine(e, env.tide)).join('')}</ul>`
        : `<p><i>${esc(t('keptToItself'))}</i></p>`;
    const s = open(t('welcome'), `<div class="story">${away}${walk}</div>${what}<button class="btn">${esc(t('begin'))}</button>`, { onClose: done });
    s.querySelector('.btn').onclick = close;
}

export function diary(st, env) {
    const list = st.journal.slice().reverse();
    open(t('diary'), `<p class="sub">${esc(t('diarySub'))}</p>` + (list.length
        ? `<ul class="log">${list.map(e => entryLine(e, env.tide)).join('')}</ul>`
        : `<p><i>${esc(t('diaryEmpty'))}</i></p>`));
}

export function tides(env) {
    const rows = nextWaters(env.M, 4).map(w => {
        const d = dayOf(w.M) - dayOf(env.M);
        const day = d === 0 ? t('today') : d === 1 ? t('tomorrow') : '';
        return `<tr><td>${esc(t(w.high ? 'highWater' : 'lowWater'))} <small>${esc(day)}</small></td><td>${clock(w.M)}</td></tr>`;
    }).join('');
    const s = open(t('tides'), `<p class="sub">${esc(t('tidesSub'))}</p><canvas class="curve"></canvas><table>${rows}</table>`);
    const c = s.querySelector('canvas'), dpr = Math.min(2, devicePixelRatio || 1);
    const W = c.clientWidth, H = c.clientHeight, ctx = c.getContext('2d');
    c.width = W * dpr; c.height = H * dpr; ctx.scale(dpr, dpr);
    const span = 25 * 60, x = m => (m / span) * W, y = l => H - 22 - l * (H - 40);
    for (let px = 0; px < W; px += 2) {                         // day and night behind the curve
        const a = sun(env.M + (px / W) * span).alt;
        const k = Math.max(0, Math.min(1, 0.5 + a * 2));
        ctx.fillStyle = `rgb(${24 + k * 170 | 0},${40 + k * 180 | 0},${82 + k * 160 | 0})`;
        ctx.fillRect(px, 0, 2, H);
    }
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let m = 0; m <= span; m += 5) ctx.lineTo(x(m), y(level(env.M + m)));
    ctx.lineTo(W, H); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(88,196,192,0.95)'); g.addColorStop(1, 'rgba(18,90,120,0.95)');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let m = 0; m <= span; m += 5) { if (m) ctx.lineTo(x(m), y(level(env.M + m))); else ctx.moveTo(0, y(level(env.M))); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center';
    const first = Math.ceil(env.M / 180) * 180;
    for (let M = first; M < env.M + span; M += 180) {
        const px = x(M - env.M);
        if (px < 16 || px > W - 16) continue;
        ctx.fillRect(px, H - 18, 1, 4);
        ctx.fillText(clock(M), px, H - 4);
    }
    ctx.beginPath(); ctx.arc(3, y(level(env.M)), 5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
}

export function settings(st, hooks) {
    const sw = (id, on) => `<button class="switch" id="${id}" role="switch" aria-checked="${on}"></button>`;
    const langs = Object.entries(LANGS).map(([k, v]) => `<option value="${k}"${k === lang() ? ' selected' : ''}>${esc(v.name)}</option>`).join('');
    const s = open(t('settings'), `
        <div class="row"><div>${esc(t('language'))}</div><select id="s-lang" aria-label="${esc(t('language'))}">${langs}</select></div>
        <div class="row"><div>${esc(t('sound'))}</div>${sw('s-sound', st.settings.sound)}</div>
        <div class="row"><div>${esc(t('bell'))}<small>${esc(t('bellSub'))}</small></div>${sw('s-bell', st.settings.bell)}</div>
        <div class="row"><div>${esc(t('version'))}<small>${esc(versionLabel())}</small></div><button id="s-update">${esc(t('checkUpdate'))}</button></div>
        ${canInstall() ? `<div class="row"><div>${esc(t('install'))}</div><button id="s-install">${esc(t('install'))}</button></div>` : ''}
        <div class="row"><div>${esc(t('newPool'))}</div><button id="s-new">${esc(cap(t('newPool')))}</button></div>
        <p class="about">${esc(t('about'))}</p>`);
    s.querySelector('#s-lang').onchange = e => hooks.set('lang', e.target.value);
    for (const k of ['sound', 'bell']) {
        const b = s.querySelector(`#s-${k}`);
        b.onclick = () => { const on = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', on); hooks.set(k, on); };
    }
    s.querySelector('#s-update').onclick = checkNow;
    const inst = s.querySelector('#s-install');
    if (inst) inst.onclick = install;
    s.querySelector('#s-new').onclick = () => {
        const p = open(t('newPool'), `<p>${esc(t('newPoolAsk'))}</p><button class="btn">${esc(t('yes'))}</button><button class="btn plain">${esc(t('no'))}</button>`);
        const [yes, no] = p.querySelectorAll('.btn');
        yes.onclick = () => { close(); hooks.newPool(); };
        no.onclick = close;
    };
}
