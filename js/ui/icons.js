/* icons.js: the few drawings on the buttons (24x24, stroked). */
const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const ICON = {
    diary: svg('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/><path d="M9 8h6"/>'),
    tides: svg('<path d="M2 9c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2.2 5-1"/><path d="M2 16c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2.2 5-1"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    guide: svg('<path d="M12 3.200l2.500 5.400 5.900.700-4.400 4 1.200 5.800L12 16.200l-5.200 2.900L8 13.300 3.600 9.300l5.900-.7z"/>'),
    peek: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.500 2"/>')
};
