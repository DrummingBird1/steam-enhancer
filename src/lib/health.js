// "Steam changed this page" notes and the diagnostic report.
//
// Steam keeps rebuilding its pages, and the extension has no telemetry, so a
// feature whose place on the page is gone used to just do nothing. Call
// SE.health.miss(feature, labelKey) where a tool couldn't find where it goes:
// it remembers the miss (feature + page type, never a URL or id) and shows a
// small dismissible note with a "Report a problem" button. The report itself
// is built here too (SE.health.diagnostics), shown in Options → Help for the
// user to read and copy; nothing is ever sent anywhere.
//
// The pure parts (pageType, addMiss, changedFromDefaults, diagnostics) have no
// DOM and no chrome.* and are unit-tested.
(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  const KEY = 'se_health_v1';
  const DISMISS_KEY = 'se_health_dismissed';
  const MAX_MISSES = 20;
  const DISMISS_MS = 7 * 24 * 3600_000;

  // Page type from the address only: no ids, names or query strings leave it.
  function pageType(hostname, pathname) {
    const p = String(pathname || '/');
    if (hostname === 'store.steampowered.com') {
      if (p === '/' || p === '') return 'store-home';
      if (/^\/app\//.test(p)) return 'store-app';
      if (/^\/(sub|bundle)\//.test(p)) return 'store-package';
      if (/^\/(search|specials|sale)/.test(p)) return 'store-list';
      if (/^\/wishlist\//.test(p)) return 'store-wishlist';
      return 'store-other';
    }
    if (hostname === 'steamcommunity.com') {
      if (/^\/market\/listings\//.test(p)) return 'market-item';
      if (/^\/market(\/|$)/.test(p)) return 'market';
      if (/^\/(my|id\/[^/]+|profiles\/\d+)\/inventory/.test(p)) return 'inventory';
      if (/^\/(my|id\/[^/]+|profiles\/\d+)\/games/.test(p)) return 'library';
      if (/^\/(my|id\/[^/]+|profiles\/\d+)\/badges/.test(p)) return 'badges';
      if (/^\/tradeoffer\//.test(p)) return 'trade-offer';
      if (/^\/(id|profiles)\//.test(p)) return 'profile';
      if (/^\/(app\/\d+\/)?discussions/.test(p)) return 'forum';
      return 'community-other';
    }
    return 'other';
  }

  // The remembered misses, newest first, one entry per feature+page with a count.
  function addMiss(list, { feature, page, ts }) {
    const rest = [];
    let count = 1;
    for (const m of Array.isArray(list) ? list : []) {
      if (m.feature === feature && m.page === page) count = (m.count || 1) + 1;
      else rest.push(m);
    }
    return [{ feature, page, ts, count }, ...rest].slice(0, MAX_MISSES);
  }

  // Which toggles and numbers differ from the defaults. Strings are left out
  // on purpose: that is where keys, custom CSS and the country live.
  function changedFromDefaults(settings, defaults) {
    return Object.keys(defaults || {}).sort().filter((k) => {
      const d = defaults[k];
      return (typeof d === 'boolean' || typeof d === 'number') && settings && settings[k] !== d && settings[k] != null;
    }).map((k) => `${k}=${settings[k]}`);
  }

  // The text of the report. Whatever is in here, the user reads before copying.
  function diagnostics({ version, userAgent, language, settings, defaults, misses, now }) {
    const ua = String(userAgent || '');
    const chrome = (ua.match(/Chrome\/([\d.]+)/) || [])[1] || 'unknown';
    const os = (ua.match(/Windows|Macintosh|CrOS|Linux|Android/) || ['unknown'])[0];
    const changed = changedFromDefaults(settings, defaults);
    const lines = [
      `Steam Enhancer ${version}`,
      `Chrome ${chrome} on ${os}`,
      `UI language: ${language || 'unknown'}`,
      `IsThereAnyDeal key set: ${settings && settings.itadApiKey ? 'yes' : 'no'}`,
      `Steam Web API key set: ${settings && settings.steamWebApiKey ? 'yes' : 'no'}`,
      `Settings changed from default: ${changed.length ? changed.join(', ') : 'none'}`
    ];
    const list = Array.isArray(misses) ? misses : [];
    if (list.length) {
      lines.push('Recent problems (a tool could not find its place on the page):');
      for (const m of list) {
        const day = new Date(m.ts || now || 0).toISOString().slice(0, 10);
        lines.push(`- ${m.feature} on ${m.page}${m.count > 1 ? ` (x${m.count})` : ''}, last ${day}`);
      }
    } else {
      lines.push('Recent problems: none recorded');
    }
    lines.push('', 'What happened (please describe):', '');
    return lines.join('\n');
  }

  const get = (keys) => new Promise((res) => chrome.storage.local.get(keys, res));
  const shown = new Set();

  SE.health = {
    KEY, pageType, addMiss, changedFromDefaults, diagnostics,

    async read() { return (await get([KEY]))[KEY] || []; },

    // A tool could not find where it goes on this page. `labelKey` is the
    // i18n key naming the tool for the note.
    async miss(feature, labelKey) {
      try {
        const page = pageType(location.hostname, location.pathname);
        const d = await get([KEY, DISMISS_KEY]);
        await chrome.storage.local.set({ [KEY]: addMiss(d[KEY], { feature, page, ts: Date.now() }) });
        if (shown.has(feature) || document.getElementById('se-health-note')) return;
        const at = (d[DISMISS_KEY] || {})[feature];
        if (at && Date.now() - at < DISMISS_MS) return;
        shown.add(feature);
        const note = SE.el('div', { id: 'se-health-note', class: 'se-health-note', role: 'status', dir: SE.uiDir() },
          SE.el('span', null, SE.t('healthMissNote', SE.t(labelKey))),
          SE.el('button', { class: 'se-btn', onclick: () => { SE.bg({ type: 'openOptions', hash: 'help' }); } }, SE.t('healthReport')),
          SE.el('button', {
            class: 'se-btn', onclick: async () => {
              note.remove();
              const cur = (await get([DISMISS_KEY]))[DISMISS_KEY] || {};
              chrome.storage.local.set({ [DISMISS_KEY]: { ...cur, [feature]: Date.now() } });
            }
          }, SE.t('healthDismiss')));
        document.body.appendChild(note);
      } catch (e) { SE.warn?.('health.miss failed', e); }
    }
  };
})(globalThis);
