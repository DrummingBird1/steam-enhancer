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
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') node.innerHTML = v;
      else if (v === true) node.setAttribute(k, '');
      else if (v !== false && v != null) node.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
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
    if (/free|kostenlos|gratis|gratuito|gratuit|חינם/i.test(s)) return 0;
    const m = s.replace(/[^\d.,-]/g, '').match(/(-?\d+(?:[.,]\d+)?)/);
    if (!m) return null;
    let n = m[1];
    // Heuristic: if string has both . and , the last is the decimal separator.
    const hasDot = n.includes('.'), hasComma = n.includes(',');
    if (hasDot && hasComma) {
      if (n.lastIndexOf('.') > n.lastIndexOf(',')) n = n.replace(/,/g, '');
      else n = n.replace(/\./g, '').replace(',', '.');
    } else if (hasComma && !hasDot) {
      n = n.replace(',', '.');
    }
    const v = parseFloat(n);
    return Number.isFinite(v) ? v : null;
  };

  SE.formatMoney = (amount, currency = 'USD', locale = undefined) => {
    if (amount == null || !Number.isFinite(amount)) return '—';
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
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

  // Inject a <script> into the page to run in the page context (for Steam globals like g_AccountID, g_sessionID).
  SE.injectPage = (fnOrCode, argsArr = []) => new Promise((resolve) => {
    const id = 'se-inject-' + Math.random().toString(36).slice(2);
    const code = typeof fnOrCode === 'function'
      ? `(${fnOrCode.toString()}).apply(null, ${JSON.stringify(argsArr)});`
      : String(fnOrCode);
    const script = document.createElement('script');
    script.textContent = `
      try {
        const __se_result = (function(){ ${code} })();
        Promise.resolve(__se_result).then(r => {
          window.postMessage({ __se_id: ${JSON.stringify(id)}, ok: true, result: r }, '*');
        }).catch(e => window.postMessage({ __se_id: ${JSON.stringify(id)}, ok: false, error: String(e) }, '*'));
      } catch (e) { window.postMessage({ __se_id: ${JSON.stringify(id)}, ok: false, error: String(e) }, '*'); }
    `;
    const onMsg = (ev) => {
      if (ev.source !== window || !ev.data || ev.data.__se_id !== id) return;
      window.removeEventListener('message', onMsg);
      resolve(ev.data);
    };
    window.addEventListener('message', onMsg);
    (document.head || document.documentElement).appendChild(script);
    script.remove();
    setTimeout(() => { window.removeEventListener('message', onMsg); resolve({ ok: false, error: 'timeout' }); }, 8000);
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

  // Small inline SVG sparkline for {t: timestamp, v: value} point series.
  // Shared by the store-page price-history chart and the inventory value-over-time chart.
  SE.sparklineSvg = (points, opts = {}) => {
    if (!points || points.length < 2) return '';
    const { w = 240, h = 60, pad = 4, color = '#66c0f4', bg = '#0d1620' } = opts;
    const minV = Math.min(...points.map(p => p.v));
    const maxV = Math.max(...points.map(p => p.v));
    const minT = points[0].t, maxT = points[points.length - 1].t;
    const x = (t) => pad + (w - 2 * pad) * (t - minT) / Math.max(1, maxT - minT);
    const y = (v) => h - pad - (h - 2 * pad) * (v - minV) / Math.max(0.01, maxV - minV);
    const d = points.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ',' + y(p.v).toFixed(1)).join(' ');
    const left = opts.labelLeft != null ? opts.labelLeft : minV.toFixed(2);
    const right = opts.labelRight != null ? opts.labelRight : new Date(maxT).toISOString().slice(0, 10);
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="${bg}" />
      <path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" />
      <text x="${pad}" y="12" fill="#8f98a0" font-size="10">${left}</text>
      <text x="${w - pad}" y="12" fill="#8f98a0" font-size="10" text-anchor="end">${right}</text>
    </svg>`;
  };

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
