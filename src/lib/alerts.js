// Pure helpers for the notification center: the alert history kept in
// chrome.storage.local (newest first, capped) and quiet hours. Shared by the
// service worker (imported) and the popup (classic script), so it attaches to
// globalThis. No chrome.* here — unit-tested.
(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  const HISTORY_MAX = 50;
  const toMinutes = (hhmm) => {
    const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]), min = Number(m[2]);
    return h < 24 && min < 60 ? h * 60 + min : null;
  };

  SE.alerts = {
    KEY: 'se_alert_history',

    // Adds an entry ({ kind, appid?, title, message }) to the front, stamped
    // and unread. Returns a new array; the input isn't modified.
    add(list, entry, now = Date.now()) {
      return [{ ...entry, ts: now, read: false }, ...(Array.isArray(list) ? list : [])].slice(0, HISTORY_MAX);
    },

    markAllRead(list) {
      return (Array.isArray(list) ? list : []).map((e) => ({ ...e, read: true }));
    },

    unreadCount(list) {
      return (Array.isArray(list) ? list : []).filter((e) => !e.read).length;
    },

    // Quiet hours as "HH:MM" strings; a window may wrap past midnight
    // ("23:00"–"08:00"). Either one empty or invalid means no quiet hours.
    inQuietHours(date, start, end) {
      const s = toMinutes(start), e = toMinutes(end);
      if (s == null || e == null || s === e) return false;
      const now = date.getHours() * 60 + date.getMinutes();
      return s < e ? now >= s && now < e : now >= s || now < e;
    },

    // "5m", "3h", "2d" — compact age for the popup list.
    age(ts, now = Date.now()) {
      const m = Math.max(0, Math.round((now - ts) / 60000));
      if (m < 60) return `${m}m`;
      const h = Math.round(m / 60);
      return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
    }
  };
})(globalThis);
