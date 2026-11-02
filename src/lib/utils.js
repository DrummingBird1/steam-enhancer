// Shared utilities. Loaded into every content script bundle. Not a module.
(function (global) {
  'use strict';

  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  SE.log = (...args) => console.log('%c[SteamEnhancer]', 'color:#66c0f4;font-weight:bold', ...args);
  SE.warn = (...args) => console.warn('[SteamEnhancer]', ...args);
  SE.err = (...args) => console.error('[SteamEnhancer]', ...args);

  SE.$  = (sel, root = document) => root.querySelector(sel);
  SE.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  SE.el = (tag, props, ...children) => {
    // Default parameters only trigger for `undefined`, not `null` — and this
    // codebase calls SE.el(tag, null, ...children) constantly, so normalize here.
    props = props || {};
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') node.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
      // Handlers only as functions: a string "on…" attribute would be inline
      // script. There is deliberately no way to set innerHTML here — text
      // (Steam names, API data) always goes in as text nodes below.
      else if (k.startsWith('on')) { if (typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v); }
      else if (v === true) node.setAttribute(k, '');
      else if (v !== false && v != null) node.setAttribute(k, v);
    }
    // ParentNode.append() inserts nodes as-is and turns every string into a
    // text node — strings (Steam names, review text, API data) can never
    // become markup here.
    const kids = children.flat().filter((c) => c != null && c !== false);
    node.append(...kids.map((c) => (c instanceof Node ? c : String(c))));
    return node;
  };

  SE.debounce = (fn, ms = 200) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  SE.throttle = (fn, ms = 200) => {
    let last = 0, pending = null;
    return (...args) => {
      const now = Date.now();
      const run = () => { last = Date.now(); pending = null; fn(...args); };
      if (now - last >= ms) run();
      else { clearTimeout(pending); pending = setTimeout(run, ms - (now - last)); }
    };
  };

  SE.sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Extract Steam app/sub/bundle id from URL or element href.
  SE.extractAppId = (url) => {
    const m = String(url || location.href).match(/\/app\/(\d+)/);
    return m ? m[1] : null;
  };
  SE.extractSubId = (url) => {
    const m = String(url || location.href).match(/\/sub\/(\d+)/);
    return m ? m[1] : null;
  };
  SE.extractBundleId = (url) => {
    const m = String(url || location.href).match(/\/bundle\/(\d+)/);
    return m ? m[1] : null;
  };

  // Parse a Steam-formatted price like "$19.99", "19,99 €", "₪75.00", "Free".
  SE.parsePrice = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    // "Free" only when there's no number at all — "Free Weekend $19.99" is 19.99.
    if (!/\d/.test(s)) return /free|kostenlos|gratis|gratuito|gratuit|бесплатно|חינם/i.test(s) ? 0 : null;
    // Capture the first run of digits/separators (spaces between digit groups
    // allowed, as in "1 234,56 руб." or "Rp 150 000") as one number, so
    // thousands + decimal together — "$1,234.56" — aren't truncated before the
    // separator logic below runs. Trailing separators ("руб.") are dropped.
    const m = s.match(/-?\d[\d.,\s  ']*/);
    if (!m) return null;
    let n = m[0].replace(/[\s  ']/g, '').replace(/[.,]+$/, '');
    const hasDot = n.includes('.'), hasComma = n.includes(',');
    if (hasDot && hasComma) {
      // Both present: the last one is the decimal separator.
      if (n.lastIndexOf('.') > n.lastIndexOf(',')) n = n.replace(/,/g, '');
      else n = n.replace(/\./g, '').replace(',', '.');
    } else if (hasComma || hasDot) {
      const sep = hasComma ? ',' : '.';
      const parts = n.split(sep);
      // One separator followed by exactly 3 digits is a thousands separator
      // ("$1,234", "¥ 1,980", "12.000₫") — no Steam currency uses 3 decimals,
      // except the dinar-style ones, which only ever use a dot.
      const threeDecimals = /\b(KD|KWD|BHD|OMR|JOD)\b/i.test(s);
      const isThousands = parts.length > 2
        || (parts[1].length === 3 && !(sep === '.' && threeDecimals));
      n = isThousands ? parts.join('') : parts.join('.');
    }
    const v = parseFloat(n);
    return Number.isFinite(v) ? v : null;
  };

  // Steam Deck compatibility category (store API / page data) → [i18n key, tag kind].
  const DECK = { 1: ['deckUnsupported', 'ignored'], 2: ['deckPlayable', 'wish'], 3: ['deckVerified', 'good'] };
  SE.deckLabel = (category) => DECK[category] || null;

  // Steam's review-summary tooltip, in any UI language → { pct, total }.
  // `countMeta` is the page's meta[itemprop=reviewCount] content, preferred
  // for the total; otherwise the largest other number in the tooltip.
  SE.parseReviewSummary = (tooltip, countMeta) => {
    const pctMatch = String(tooltip || '').match(/(\d{1,3})\s*%/);
    if (!pctMatch) return null;
    const pct = Number(pctMatch[1]);
    let total = Number(countMeta);
    if (!(total > 0)) {
      const nums = String(tooltip).replace(pctMatch[0], '').match(/\d[\d.,\s  ]*\d|\d/g) || [];
      total = Math.max(0, ...nums.map((n) => Number(n.replace(/[.,\s  ]/g, ''))));
    }
    return total > 0 && pct <= 100 ? { pct, total } : null;
  };

  // Steam Community Market fees, in integer cents of the wallet currency.
  // The seller sets what they receive; the buyer pays that plus a 5% Steam fee
  // and a (usually 10%) publisher fee, each rounded down with a 1-cent minimum.
  // Mirrors how the market's own sell dialog computes it.
  SE.marketFees = {
    buyerPays(receiveCents, publisherFee = 0.10) {
      const r = Math.max(1, Math.floor(receiveCents));
      const steam = Math.max(1, Math.floor(r * 0.05));
      const pub = publisherFee > 0 ? Math.max(1, Math.floor(r * publisherFee)) : 0;
      return r + steam + pub;
    },
    // Largest amount the seller can receive while the buyer pays at most `buyerCents`.
    sellerReceives(buyerCents, publisherFee = 0.10) {
      const b = Math.floor(buyerCents);
      if (b < 3) return 0;
      let r = Math.max(1, Math.floor(b / (1.05 + publisherFee)));
      while (SE.marketFees.buyerPays(r + 1, publisherFee) <= b) r++;
      while (r > 1 && SE.marketFees.buyerPays(r, publisherFee) > b) r--;
      return SE.marketFees.buyerPays(r, publisherFee) <= b ? r : 0;
    }
  };

  SE.formatMoney = (amount, currency = 'USD', locale = undefined) => {
    if (amount == null || !Number.isFinite(amount)) return '—';
    try {
      // RTL locales (he, ar, fa) wrap the parts in direction marks (U+200F…),
      // which scramble the order once the amount sits inside LTR text
      // ("Low: $29.99 · date" rendered as "Low: date · $29.99"). Drop them;
      // CSS unicode-bidi isolation handles RTL panels.
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
        .replace(/[\u200e\u200f\u061c]/g, '');
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  SE.bg = (msg) => new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (resp) => {
        if (chrome.runtime.lastError) {
          SE.warn('bg error:', chrome.runtime.lastError.message);
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else resolve(resp);
      });
    } catch (e) {
      resolve({ ok: false, error: String(e) });
    }
  });

  // Call a named operation in src/content/page-bridge.js, which runs in the
  // page's own JS world where Steam's globals (g_sessionID, g_ActiveInventory,
  // …) live. Resolves { ok, result } or { ok: false, error }.
  SE.pageCall = (op, args = {}) => new Promise((resolve) => {
    const id = 'se-call-' + Math.random().toString(36).slice(2);
    let timer = null;
    const onMsg = (ev) => {
      if (ev.source !== window || !ev.data || ev.data.__se_id !== id) return;
      window.removeEventListener('message', onMsg);
      clearTimeout(timer);
      resolve(ev.data);
    };
    window.addEventListener('message', onMsg);
    window.postMessage({ __se_req: id, op, args }, location.origin);
    timer = setTimeout(() => { window.removeEventListener('message', onMsg); resolve({ ok: false, error: 'timeout' }); }, 8000);
  });

  SE.onUrlChange = (cb) => {
    let last = location.href;
    const obs = new MutationObserver(() => {
      if (location.href !== last) { last = location.href; cb(location.href); }
    });
    obs.observe(document, { subtree: true, childList: true });
    window.addEventListener('popstate', () => cb(location.href));
    return obs;
  };

  SE.waitFor = async (sel, { timeout = 5000, root = document } = {}) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const node = root.querySelector(sel);
      if (node) return node;
      await SE.sleep(80);
    }
    return null;
  };

  // Extracts the /id/<vanity> or /profiles/<steamid> slug so different scripts
  // (library.js, profile.js) can key shared local data to "the same profile"
  // without needing an authenticated Steam Web API lookup.
  SE.profileKeyFromPath = (pathname = location.pathname) => {
    const m = pathname.match(/\/(?:id|profiles)\/([^/]+)/);
    return m ? m[1] : null;
  };

  SE.fmtPercent = (a, b) => {
    if (!a || !b || a <= 0) return null;
    return Math.round((1 - b / a) * 100);
  };

  SE.tag = (text, kind = 'info') =>
    SE.el('span', { class: `se-tag se-tag-${kind}` }, text);

  // Run a feature in try/catch so one broken selector can't kill the whole script.
  // Works for sync fns and promise-returning fns. Returns undefined on failure.
  SE.safe = (label, fn) => {
    try {
      const out = fn();
      if (out && typeof out.then === 'function') {
        return out.catch((e) => SE.warn(`feature "${label}" failed:`, e));
      }
      return out;
    } catch (e) {
      SE.warn(`feature "${label}" failed:`, e);
      return undefined;
    }
  };

  // Idempotency guard for things that must run only once per page-load
  // (e.g. setInterval loops) even if se-ready fires again after SPA navigation.
  const _onceKeys = new Set();
  SE.once = (key) => {
    if (_onceKeys.has(key)) return false;
    _onceKeys.add(key);
    return true;
  };

  // Subscribe to se-ready. Unlike a raw { once: true } listener, this fires again
  // when common.js re-dispatches se-ready after an SPA navigation, so per-page
  // decoration re-runs. Guard any setInterval/global side-effects with SE.once().
  SE.onReady = (fn) => {
    document.addEventListener('se-ready', (ev) => SE.safe('onReady', () => fn(ev.detail)));
  };

})(window);
