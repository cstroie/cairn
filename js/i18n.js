/*
 * i18n.js: the words. A language is a module in lang/ with strings, lists
 * and a few functions (plurals, the journal's sentences). t('key', vars)
 * fills {name} places; L() gives the whole language for lists and
 * functions.
 */
import en from '../lang/en.js';
import ro from '../lang/ro.js';

export const LANGS = { en, ro };
let cur = en, code = 'en';

export function setLang(want) {
    const nav = (typeof navigator !== 'undefined' && navigator.language || 'en').slice(0, 2).toLowerCase();
    code = LANGS[want] ? want : LANGS[nav] ? nav : 'en';
    cur = LANGS[code];
    if (typeof document !== 'undefined') document.documentElement.lang = code;
    return code;
}

export const lang = () => code;
export const L = () => cur;

export function t(key, vars) {
    let s = cur[key] ?? en[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
    return s;
}

/** A length of time in words: minutes below an hour, hours and minutes below a day, then days. */
export function duration(min) {
    min = Math.max(0, Math.round(min));
    if (min < 60) return cur.minutes(min);
    if (min < 1440) { const h = Math.floor(min / 60), m = min % 60; return m ? `${cur.hours(h)} ${cur.minutes(m)}` : cur.hours(h); }
    return cur.days(Math.round(min / 1440));
}

/** The sentence of a journal entry. `rock` is the rock's name as it was then. */
export function sentence(e, rock) {
    const fn = cur.ev[e.evName];
    return fn ? fn(e.sp, rock) : '';
}
