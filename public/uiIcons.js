// Flat, modern outline icons for app UI chrome (nav, buttons, banners).
// Distinct from itemIcons.js (hand-drawn catalogue item icons).
(function () {
  const PATHS = {
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.4l1.9 11.1a2 2 0 0 0 2 1.65h8.86a2 2 0 0 0 1.97-1.62L21.5 8H6.2"/>',
    utensils: '<path d="M6 2.5v7.2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2.5"/><path d="M8 11.7V21.5"/><path d="M18.5 2.5c-2 0-3.5 2-3.5 4.6v4.4c0 1 .8 1.8 1.8 1.8h1.7v8.2"/>',
    settings: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v3M12 18.4v3M4.8 4.8l2.1 2.1M17.1 17.1l2.1 2.1M2.6 12h3M18.4 12h3M4.8 19.2l2.1-2.1M17.1 6.9l2.1-2.1"/>',
    trash: '<path d="M4 6.5h16"/><path d="M18.4 6.5L17.3 20a2 2 0 0 1-2 1.9H8.7a2 2 0 0 1-2-1.9L5.6 6.5"/><path d="M9.7 6.5V4.3a1 1 0 0 1 1-1h2.6a1 1 0 0 1 1 1v2.2"/><path d="M10.2 10.6v6.4M13.8 10.6v6.4"/>',
    more: '<circle cx="12" cy="5.2" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="18.8" r="1.3"/>',
    check: '<polyline points="20 6.5 9.5 17 4.5 12.2"/>',
    close: '<line x1="18.5" y1="5.5" x2="5.5" y2="18.5"/><line x1="5.5" y1="5.5" x2="18.5" y2="18.5"/>',
    download: '<path d="M5 16.5v2.6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2.6"/><polyline points="7.5 11 12 15.5 16.5 11"/><line x1="12" y1="15.5" x2="12" y2="3"/>',
    chevronDown: '<polyline points="5.5 9.5 12 16 18.5 9.5"/>',
    list: '<line x1="4" y1="6.5" x2="20" y2="6.5"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17.5" x2="20" y2="17.5"/>',
    grid: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.5"/>',
  };

  function uiIcon(name, size) {
    const inner = PATHS[name];
    if (!inner) return "";
    const s = size || 22;
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ui-icon">${inner}</svg>`;
  }

  window.uiIcon = uiIcon;
  window.UI_ICON_PATHS = PATHS;
})();
