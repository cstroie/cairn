/*
 * panels.js: the sheets that open over the pool: the first words, the
 * welcome back, the diary, the tide table, the settings.
 */
import { t, L, LANGS, lang, duration, sentence } from '../i18n.js';
import { ICON } from './icons.js';
import { esc, cap, rockName } from './hud.js';
import { EVENTS } from '../core/sim.js';
import { ALBUM, found, has, nextUnlock } from '../core/world.js';
import { portrait } from '../render/creatures.js';
import { glyph } from '../render/ambient.js';
import { TIDE, DAY, level, nextWaters, fieldsOf, sun, dayOf, bestLow } from '../core/tide.js';
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

function entryLine(e, nowTide, st) {
    const days = Math.floor((nowTide - e.t) * TIDE / DAY);
    const when = days <= 0 ? t('today') : days === 1 ? t('yesterday') : t('daysAgo', { n: days });
    const rock = e.rock >= 0 ? (e.name || rockName(st, e.rock)) : '';
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
    const what = list.length ? `<p class="sub">${esc(t('whileGone'))}</p><ul class="log">${list.map(e => entryLine(e, env.tide, st)).join('')}</ul>`
        : `<p><i>${esc(t('keptToItself'))}</i></p>`;
    const s = open(t('welcome'), `<div class="story">${away}${walk}</div>${what}<button class="btn">${esc(t('begin'))}</button>`, { onClose: done });
    s.querySelector('.btn').onclick = close;
}

export function diary(st, env, replay) {
    const list = st.journal.slice().reverse(), days = Math.floor(((st.hist || []).length - 1));
    const s = open(t('diary'), `<p class="sub">${esc(t('diarySub'))}</p>` +
        (replay && days >= 3 ? `<button class="btn replay">${esc(t('replay', { d: days }))}</button>` : '') + (list.length
        ? `<ul class="log">${list.map(e => entryLine(e, env.tide, st)).join('')}</ul>`
        : `<p><i>${esc(t('diaryEmpty'))}</i></p>`));
    const b = s.querySelector('.replay');
    if (b) b.onclick = () => { close(); replay(); };
}

export function tides(env) {
    const rows = nextWaters(env.M, 4).map(w => {
        const d = dayOf(w.M) - dayOf(env.M);
        const day = d === 0 ? t('today') : d === 1 ? t('tomorrow') : '';
        return `<tr><td>${esc(t(w.high ? 'highWater' : 'lowWater'))} <small>${esc(day)}</small></td><td>${clock(w.M)}</td></tr>`;
    }).join('');
    const best = bestLow(env.M), bf = best && fieldsOf(best);
    const when = best ? new Date(Date.UTC(bf.year, bf.month, bf.day)).toLocaleDateString(lang(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) + ', ' + clock(best) : '';
    const tip = best ? `<p class="best"><b>${esc(t('bestLow'))}</b> ${esc(when)}. ${esc(t('bestLowWhy'))}</p>` : '';
    const s = open(t('tides'), `<p class="sub">${esc(t('tidesSub'))}</p><canvas class="curve"></canvas><table>${rows}</table>${tip}`);
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
    const quals = ['auto', 'high', 'medium', 'low'].map(k => `<option value="${k}"${k === (st.settings.quality || 'auto') ? ' selected' : ''}>${esc(t('q' + k[0].toUpperCase() + k.slice(1)))}</option>`).join('');
    const s = open(t('settings'), `
        <div class="row"><div>${esc(t('language'))}</div><select id="s-lang" aria-label="${esc(t('language'))}">${langs}</select></div>
        <div class="row"><div>${esc(t('quality'))}<small>${esc(t('qualitySub'))}</small></div><select id="s-quality" aria-label="${esc(t('quality'))}">${quals}</select></div>
        <div class="row"><div>${esc(t('sound'))}</div>${sw('s-sound', st.settings.sound)}</div>
        <div class="row"><div>${esc(t('bell'))}<small>${esc(t('bellSub'))}</small></div>${sw('s-bell', st.settings.bell)}</div>
        ${'Notification' in window ? `<div class="row"><div>${esc(t('alert'))}<small>${esc(t('alertSub'))}</small></div>${sw('s-alert', st.settings.alert)}</div>` : ''}
        <div class="row"><div>${esc(t('tides'))}</div><button id="s-tides">${esc(t('tides'))}</button></div>
        <div class="row"><div>${esc(t('postcard'))}<small>${esc(t('postcardSub'))}</small></div><button id="s-card">${esc(t('postcardSave'))}</button></div>
        <div class="row"><div>${esc(t('version'))}<small>${esc(versionLabel())}</small></div><button id="s-update">${esc(t('checkUpdate'))}</button></div>
        ${canInstall() ? `<div class="row"><div>${esc(t('install'))}</div><button id="s-install">${esc(t('install'))}</button></div>` : ''}
        <div class="row"><div>${esc(t('newPool'))}</div><button id="s-new">${esc(cap(t('newPool')))}</button></div>
        <p class="about">${esc(t('about'))}</p>`);
    s.querySelector('#s-lang').onchange = e => hooks.set('lang', e.target.value);
    s.querySelector('#s-quality').onchange = e => hooks.set('quality', e.target.value);
    for (const k of ['sound', 'bell', 'alert']) {
        const b = s.querySelector(`#s-${k}`);
        if (!b) continue;
        b.onclick = async () => {
            const on = b.getAttribute('aria-checked') !== 'true';
            b.setAttribute('aria-checked', on);
            if ((await hooks.set(k, on)) === false) b.setAttribute('aria-checked', false);
        };
    }
    s.querySelector('#s-tides').onclick = hooks.tides;
    s.querySelector('#s-card').onclick = () => { close(); setTimeout(hooks.postcard, 350); };
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

/** The name of a page of the guide. */
export function pageName(a) {
    if (!a.sp) return L().album[a.id][0];
    const name = cap(L().sp[a.sp]);
    return a.stage == null ? name : `${name}, ${L().grown[a.stage].replace('.', '').toLowerCase()}`;
}
export const pageById = id => ALBUM.find(a => a.id === id);

function tile(c, a) {
    const dpr = Math.min(2, devicePixelRatio || 1), w = 72, h = 72, ctx = c.getContext('2d');
    c.width = w * dpr; c.height = h * dpr; ctx.scale(dpr, dpr);
    if (a.sp) {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, a.kind === 'ledge' ? '#2f6f8e' : '#8fd0d8'); g.addColorStop(1, a.kind === 'ledge' ? '#123a56' : '#2f8fa6');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        portrait(ctx, a.sp, a.stage == null ? 200 : a.stage * 64 + 40, w, h, 1.3);
    } else glyph(ctx, a.id, w, h, 0.4);
}

export function guide(st) {
    const kinds = ['life', 'shore', 'under', 'wonder', 'ledge'];
    const nx = nextUnlock(st);
    const body = kinds.map(k => {
        const list = ALBUM.filter(a => a.kind === k);
        if (k === 'ledge' && !st.ledge && !list.some(a => has(st, a.id))) return '';
        return `<h4>${esc(L().kind[k])} <small>${list.filter(a => has(st, a.id)).length}/${list.length}</small></h4><div class="tiles">${list.map(a =>
            (has(st, a.id) ? `<button class="tile" data-id="${a.id}"><canvas></canvas><span>${esc(pageName(a))}</span></button>`
                : `<button class="tile unknown" data-id="${a.id}"><i>?</i><span>${esc(t('unknown'))}</span></button>`)).join('')}</div>`;
    }).join('');
    const s = open(t('guide'), `<p class="sub">${esc(t('guideSub', { n: found(st), m: ALBUM.length }))}${nx ? ' ' + esc(L().unlock[nx.kind].replace('{n}', nx.left)) : ''}</p>
        <div class="page" hidden></div>${body}`);
    const page = s.querySelector('.page');
    s.querySelectorAll('.tile').forEach(b => {
        const a = pageById(b.dataset.id);
        const c = b.querySelector('canvas');
        if (c) tile(c, a);
        b.onclick = () => {
            s.querySelectorAll('.tile.sel').forEach(x => x.classList.remove('sel'));
            b.classList.add('sel');
            page.hidden = false;
            page.innerHTML = has(st, a.id)
                ? `<b>${esc(pageName(a))}</b><p>${esc(a.sp ? L().desc[a.sp] : '')} ${esc(a.sp ? L().fact[a.sp] : L().album[a.id][1])}</p>`
                : `<b>${esc(t('unknown'))}</b><p>${esc(L().hint[a.kind])}</p>`;
            page.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        };
    });
}

export function bottle(n) {
    const list = L().bottles;
    const s = open(t('bottleTitle'), `<div class="letter"><p>${esc(list[n % list.length])}</p></div><button class="btn">${esc(t('close'))}</button>`);
    s.querySelector('.btn').onclick = close;
}
