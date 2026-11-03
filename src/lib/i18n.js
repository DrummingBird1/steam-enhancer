// Thin i18n wrapper. Uses chrome.i18n.getMessage but falls back to the key itself.
// Values passed after the key fill {0}, {1}, … in the message:
//   SE.t('invSorted', 12) → "Sorted 12 tiles by estimated value (highest first)."
(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});
  SE.t = (key, ...subs) => {
    let msg = '';
    try { msg = chrome.i18n.getMessage(key); } catch {}
    msg = msg || key;
    return subs.length
      ? msg.replace(/\{(\d)\}/g, (m, i) => (subs[i] != null ? String(subs[i]) : m))
      : msg;
  };
  // Text direction of the extension's own UI language, for blocks that are
  // all our text (modals) — Steam's page itself stays as it is.
  SE.uiDir = () => {
    let ui = '';
    try { ui = chrome.i18n.getUILanguage(); } catch {}
    return /^(he|ar|fa)/.test(ui) ? 'rtl' : 'ltr';
  };
})(window);
