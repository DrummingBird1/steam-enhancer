// Thin i18n wrapper. Uses chrome.i18n.getMessage but falls back to the key itself.
(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});
  SE.t = (key, ...subs) => {
    try {
      const msg = chrome.i18n.getMessage(key, subs.length ? subs.map(String) : undefined);
      return msg || key;
    } catch { return key; }
  };
})(window);
