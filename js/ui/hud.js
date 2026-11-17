/*
 * hud.js: what lies over the picture: the tide chip, the buttons, the
 * cairn stones, the card of the rock you are looking at, the line of the
 * latest happening, banners and toasts.
 */
import { t, L, duration } from '../i18n.js';
import { ICON } from './icons.js';
import { LOW, TIDE, nextWaters } from '../core/tide.js';
import { stage, stonesLeft, grows, LEDGE } from '../core/sim.js';
import { nextUnlock } from '../core/world.js';

const $ = id => document.getElementById(id);
const el = (tag, attrs = {}, html = '') => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else e.setAttribute(k, v); }
    e.innerHTML = html;
    return e;
};
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** A rock's name: the one the player gave it, else its shore name in this language. */
export function rockName(st, i) {
    const r = st.rocks[i], ledge = i >= LEDGE;
    return r.name || (ledge ? L().ledgeNames : L().rockNames)[r.nick] || (ledge ? t('ledgeN', { n: i - LEDGE + 1 }) : t('rockN', { n: i + 1 }));
}
export const fmtClock = f => `${String(f.hour).padStart(2, '0')}:${String(f.minute).padStart(2, '0')}`;

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
        for (const name of ['guide', 'diary', 'peek', 'settings']) {
            const b = el('button', { 'aria-label': t(name), title: t(name) }, ICON[name]);
            b.addEventListener('click', () => this.hooks.tool(name));
            tools.appendChild(b);
        }
        const chip = $('tidechip');
        chip.innerHTML = '<div class="gauge"><i></i></div><div class="txt"><b></b><span></span></div>';
        chip.onclick = () => this.hooks.tool('tides');
        $('stones').title = t('stones');
        const peek = $('peek');
        peek.innerHTML = `<button class="play" aria-label="${esc(t('play'))}">▶</button><input type="range" min="0" max="1490" step="5" value="0" aria-label="${esc(t('peek'))}"><b></b><button class="x" aria-label="${esc(t('close'))}">${ICON.close}</button>`;
        peek.querySelector('input').oninput = e => this.hooks.peek({ off: Number(e.target.value), play: false });
        peek.querySelector('.play').onclick = () => this.hooks.peek({ toggle: true });
        peek.querySelector('.x').onclick = () => this.hooks.peek(null);
        this.sig = '';
    }

    /** The time-lapse bar: p is null (closed) or { off, play, label }. */
    peek(p) {
        const bar = $('peek');
        bar.hidden = !p;
        document.body.classList.toggle('peeking', !!p);
        if (!p) return;
        bar.querySelector('input').value = p.off;
        bar.querySelector('b').textContent = p.label;
        bar.querySelector('.play').textContent = p.play ? '❚❚' : '▶';
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

    /** The card of rock i. exposed: its top is out of the water. */
    showCard(i, st, exposed) {
        this.card = i;
        const r = st.rocks[i], c = $('card'), ledge = i >= LEDGE;
        const x = `<button class="x" aria-label="${esc(t('close'))}">${ICON.close}</button>`;
        if (!r.on) {                                            // still under the sand
            const nx = nextUnlock(st);
            c.innerHTML = `<header><h3>${esc(t('buried'))}</h3>${x}</header>
                <p class="what">${esc(t('buriedSub'))}</p>${nx ? `<p class="fate">${esc(L().unlock[nx.kind].replace('{n}', nx.left))}</p>` : ''}`;
            c.hidden = false;
            c.querySelector('.x').onclick = () => this.hooks.select(-1);
            return;
        }
        const quiet = r.calm > 0 ? t('quiet', { d: duration(r.calm * TIDE) }) : t('quietNone');
        const since = r.sp && r.t != null && st.last - r.t >= 2 ? ' ' + t('hereFor', { d: duration((st.last - r.t) * TIDE) }) : '';
        const life = r.sp ? `<b>${esc(cap(L().sp[r.sp]))}.</b> ${grows(r.sp) ? L().grown[stage(r.g)] + ' ' : ''}` : '';
        const deep = ledge && !exposed;
        c.innerHTML = `
            <header><h3><span>${esc(rockName(st, i))}</span><button class="ren" aria-label="${esc(t('rename'))}" title="${esc(t('rename'))}">✎</button></h3>
            <small>${esc(ledge ? t('ledgeRock') : t('rockOf', { n: i + 1, m: 10 }))}</small>${x}</header>
            <p class="what">${life}${esc(L().desc[r.sp])}</p>
            <p class="fate">${esc(quiet)}${esc(since)} ${esc(deep ? t('ledgeDeep') : r.cairn ? t('guarded') : t('crossed'))}</p>
            <div class="two"><button class="btn cairn ${r.cairn ? 'plain' : ''}">${esc(r.cairn ? t('liftCairn') : t('placeCairn'))}</button>
            <button class="btn plain look" title="${esc(t('lookCost'))}">${esc(t('lookUnder'))}</button></div>
            <p class="note"></p>`;
        c.hidden = false;
        const btn = c.querySelector('.cairn'), look = c.querySelector('.look'), note = c.querySelector('.note');
        if (deep) btn.disabled = true;
        else if (!r.cairn && stonesLeft(st) <= 0) { btn.disabled = true; note.textContent = t('noStones'); }
        if (r.cairn) look.disabled = true;
        else if (!exposed) { look.disabled = true; if (!deep && !note.textContent) note.textContent = t('tooDeep'); }
        else if (!note.textContent) note.textContent = t('lookCost');
        btn.onclick = () => this.hooks.cairn(i);
        look.onclick = () => this.hooks.look(i);
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
        const e = el('div', { class: 'banner toast' }), box = $('banners');
        e.textContent = text;
        box.appendChild(e);
        const toasts = box.querySelectorAll('.toast');
        if (toasts.length > 3) toasts[0].remove();
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
        return e;
    }
}

export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
