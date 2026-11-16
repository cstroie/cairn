/*
 * hud.js: what lies over the picture: the tide chip, the buttons, the
 * cairn stones, the card of the rock you are looking at, the line of the
 * latest happening, banners and toasts.
 */
import { t, L, duration } from '../i18n.js';
import { ICON } from './icons.js';
import { LOW, TIDE, nextWaters } from '../core/tide.js';
import { stage, stonesLeft } from '../core/sim.js';

const $ = id => document.getElementById(id);
const el = (tag, attrs = {}, html = '') => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else e.setAttribute(k, v); }
    e.innerHTML = html;
    return e;
};
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const rockName = (st, i) => st.rocks[i].name || t('rockN', { n: i + 1 });

/** What the tide is doing, in words. */
export function tideWords(env) {
    const p = env.phase;
    const state = p < 20 || p > TIDE - 20 ? t('highWater') : Math.abs(p - LOW) < 20 ? t('lowWater') : env.flooding ? t('flood') : t('ebb');
    const next = nextWaters(env.M, 1)[0];
    return { state, next: t(next.high ? 'nextHigh' : 'nextLow', { d: duration(next.M - env.M) }) };
}

export class Hud {
    constructor(hooks) {
        this.hooks = hooks;
        this.card = -1;
        this.build();
    }

    build() {
        const tools = $('tools');
        tools.innerHTML = '';
        for (const name of ['diary', 'tides', 'settings']) {
            const b = el('button', { 'aria-label': t(name), title: t(name) }, ICON[name]);
            b.addEventListener('click', () => this.hooks.tool(name));
            tools.appendChild(b);
        }
        const chip = $('tidechip');
        chip.innerHTML = '<div class="gauge"><i></i></div><div class="txt"><b></b><span></span></div>';
        chip.onclick = () => this.hooks.tool('tides');
        $('stones').title = t('stones');
        this.sig = '';
    }

    /** Once a second or so. */
    update(env, st) {
        const w = tideWords(env);
        const sig = `${w.state}|${w.next}|${env.season}|${stonesLeft(st)}|${st.stones}`;
        const chip = $('tidechip');
        chip.querySelector('i').style.height = `${Math.round(env.level * 100)}%`;
        if (sig === this.sig) return;
        this.sig = sig;
        chip.querySelector('b').textContent = w.state;
        const tag = env.spring > 0.85 ? ` · ${t('springTide')}` : '';
        chip.querySelector('span').textContent = `${w.next} · ${L().season[env.season]}${tag}`;
        const left = stonesLeft(st), box = $('stones');
        box.innerHTML = '';
        for (let i = 0; i < st.stones; i++) box.appendChild(el('i', i < left ? {} : { class: 'used' }));
        box.setAttribute('aria-label', `${t('stones')}: ${left}`);
    }

    showCard(i, st) {
        this.card = i;
        const r = st.rocks[i], c = $('card');
        const quiet = r.calm > 0 ? t('quiet', { d: duration(r.calm * TIDE) }) : t('quietNone');
        const life = r.sp ? `<b>${esc(cap(L().sp[r.sp]))}.</b> ${r.sp < 6 ? L().grown[stage(r.g)] + ' ' : ''}` : '';
        c.innerHTML = `
            <header><h3><span>${esc(rockName(st, i))}</span><button class="ren" aria-label="${esc(t('rename'))}" title="${esc(t('rename'))}">✎</button></h3>
            <small>${esc(t('rockOf', { n: i + 1, m: st.open }))}</small><button class="x" aria-label="${esc(t('close'))}">${ICON.close}</button></header>
            <p class="what">${life}${esc(L().desc[r.sp])}</p>
            <p class="fate">${esc(quiet)} ${esc(r.cairn ? t('guarded') : t('crossed'))}</p>
            <button class="btn ${r.cairn ? 'plain' : ''}">${esc(r.cairn ? t('liftCairn') : t('placeCairn'))}</button>`;
        c.hidden = false;
        const btn = c.querySelector('.btn');
        if (!r.cairn && stonesLeft(st) <= 0) { btn.disabled = true; btn.textContent = t('noStones'); }
        btn.onclick = () => this.hooks.cairn(i);
        c.querySelector('.x').onclick = () => this.hooks.select(-1);
        c.querySelector('.ren').onclick = () => this.rename(i, st);
    }

    rename(i, st) {
        const h = $('card').querySelector('h3');
        if (!h) return;
        h.innerHTML = `<input maxlength="14" placeholder="${esc(t('namePlaceholder'))}" value="${esc(st.rocks[i].name || '')}" aria-label="${esc(t('rename'))}">`;
        const input = h.querySelector('input');
        input.focus(); input.select();
        let done = false;
        const finish = keep => { if (done) return; done = true; this.hooks.rename(i, keep ? input.value.trim() : st.rocks[i].name || ''); };
        input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
        input.addEventListener('blur', () => finish(true));
    }

    hideCard() { this.card = -1; $('card').hidden = true; }

    /** A passing line under the top bar: the latest happening. */
    latest(text) {
        const e = $('latest');
        e.textContent = text;
        e.classList.add('show');
        clearTimeout(this.latestTimer);
        this.latestTimer = setTimeout(() => e.classList.remove('show'), 9000);
    }

    toast(text) {
        const e = el('div', { class: 'banner' });
        e.textContent = text;
        $('banners').appendChild(e);
        setTimeout(() => e.remove(), 4500);
    }

    /** A lasting message with buttons: [{ label, primary, action }]. */
    banner(text, buttons) {
        const e = el('div', { class: 'banner' });
        e.appendChild(el('span')).textContent = text;
        for (const b of buttons) {
            const btn = el('button', b.primary ? { class: 'primary' } : {});
            btn.textContent = b.label;
            btn.onclick = () => { e.remove(); if (b.action) b.action(); };
            e.appendChild(btn);
        }
        $('banners').appendChild(e);
    }
}

export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
