// Shared utilities. Loaded into every content script bundle. Not a module.
(function (global) {
  'use strict';

  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  SE.log = (...args) => console.log('%c[SteamEnhancer]', 'color:#66c0f4;font-weight:bold', ...args);
  SE.warn = (...args) => console.warn('[SteamEnhancer]', ...args);
  SE.err = (...args) => console.error('[SteamEnhancer]', ...args);

  SE.$  = (sel, root = document) => root.querySelector(sel);
  SE.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  SE.el = (tag, props = {}, ...children) => {
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

  SE.fmtPercent = (a, b) => {
    if (!a || !b || a <= 0) return null;
    return Math.round((1 - b / a) * 100);
  };

  SE.tag = (text, kind = 'info') =>
    SE.el('span', { class: `se-tag se-tag-${kind}` }, text);

})(window);
