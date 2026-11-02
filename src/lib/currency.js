(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});

  // Steam country → currency mapping (subset; falls back to USD).
  const CC_TO_CUR = {
    us: 'USD', gb: 'GBP', uk: 'GBP', de: 'EUR', fr: 'EUR', it: 'EUR', es: 'EUR', nl: 'EUR',
    fi: 'EUR', be: 'EUR', at: 'EUR', ie: 'EUR', pt: 'EUR', gr: 'EUR', ee: 'EUR', sk: 'EUR',
    lv: 'EUR', lt: 'EUR', lu: 'EUR', mt: 'EUR', cy: 'EUR', si: 'EUR',
    pl: 'PLN', cz: 'CZK', hu: 'HUF', ro: 'RON', bg: 'BGN', se: 'SEK', no: 'NOK', dk: 'DKK',
    ch: 'CHF', ru: 'RUB', ua: 'UAH', tr: 'TRY', il: 'ILS', sa: 'SAR', ae: 'AED', qa: 'QAR',
    kw: 'KWD', jp: 'JPY', kr: 'KRW', cn: 'CNY', hk: 'HKD', tw: 'TWD', sg: 'SGD', th: 'THB',
    vn: 'VND', id: 'IDR', my: 'MYR', ph: 'PHP', in: 'INR', pk: 'PKR', au: 'AUD', nz: 'NZD',
    ca: 'CAD', mx: 'MXN', br: 'BRL', ar: 'ARS', cl: 'CLP', co: 'COP', pe: 'PEN', uy: 'UYU',
    za: 'ZAR', eg: 'EGP', ma: 'MAD', ng: 'NGN', ke: 'KES'
  };

  // Steam's own numeric currency ids (ECurrencyCode), as used by the market
  // endpoints' `currency=` parameter and g_rgWalletInfo.wallet_currency.
  const STEAM_CURRENCY = {
    1: 'USD', 2: 'GBP', 3: 'EUR', 4: 'CHF', 5: 'RUB', 6: 'PLN', 7: 'BRL', 8: 'JPY',
    9: 'NOK', 10: 'IDR', 11: 'MYR', 12: 'PHP', 13: 'SGD', 14: 'THB', 15: 'VND', 16: 'KRW',
    17: 'TRY', 18: 'UAH', 19: 'MXN', 20: 'CAD', 21: 'AUD', 22: 'NZD', 23: 'CNY', 24: 'INR',
    25: 'CLP', 26: 'PEN', 27: 'COP', 28: 'ZAR', 29: 'HKD', 30: 'TWD', 31: 'SAR', 32: 'AED',
    33: 'SEK', 34: 'ARS', 35: 'ILS', 36: 'BYN', 37: 'KZT', 38: 'KWD', 39: 'QAR', 40: 'CRC',
    41: 'UYU'
  };

  SE.currency = {
    forCountry: (cc) => CC_TO_CUR[String(cc || '').toLowerCase()] || 'USD',
    list: () => Object.keys(CC_TO_CUR).sort(),
    isoForSteamId: (id) => STEAM_CURRENCY[Number(id)] || null,
    steamIdForIso: (iso) => {
      const want = String(iso || '').toUpperCase();
      const hit = Object.entries(STEAM_CURRENCY).find(([, v]) => v === want);
      return hit ? Number(hit[0]) : null;
    }
  };

  // Detect current Steam currency from page if available (set by Steam JS).
  SE.detectSteamCurrency = () => {
    try {
      const meta = document.querySelector('meta[itemprop="priceCurrency"]');
      if (meta?.content) return meta.content;
    } catch {}
    return null;
  };

  // The storefront country Steam is pricing this page for. Classic store pages
  // carry it in #application_config's data-userinfo; the React pages (wishlist)
  // in the server-rendered state script #valve-ssr-data. Verified live, logged
  // in or not.
  SE.pageCountry = () => {
    try {
      const raw = document.getElementById('application_config')?.dataset?.userinfo;
      const cc = raw && JSON.parse(raw).country_code;
      if (cc) return String(cc).toLowerCase();
    } catch {}
    const ssr = document.getElementById('valve-ssr-data')?.textContent || '';
    const m = ssr.match(/\\?"country_code\\?"\s*:\s*\\?"([A-Za-z]{2})\\?"/);
    return m ? m[1].toLowerCase() : null;
  };

  // The country to ask price APIs about: the Options override if set, else the
  // last country Steam itself reported (remembered in local storage so
  // community pages and the background alarms use it too), else 'us'.
  SE.effectiveCountry = (settings, detected) =>
    String(settings?.countryOverride || '').trim().toLowerCase() || detected || 'us';

  // The user's Steam wallet currency, which is what the market charges and
  // pays out in. Read from the page's g_rgWalletInfo when present (community
  // pages, logged in) and remembered, so pages without it still know.
  // `known: false` means we fell back to a guess — callers that move money
  // (selling) must refuse in that case rather than list at a wrong price.
  const WALLET_KEY = 'se_wallet_currency';
  let walletPromise = null;
  SE.walletCurrency = () => {
    if (walletPromise) return walletPromise;
    walletPromise = (async () => {
      let id = null;
      try {
        const r = await SE.pageCall('walletCurrency');
        if (r?.ok && r.result) id = Number(r.result);
      } catch {}
      if (id && STEAM_CURRENCY[id]) {
        chrome.storage.local.set({ [WALLET_KEY]: id });
        return { id, iso: STEAM_CURRENCY[id], known: true };
      }
      const stored = await new Promise((res) => chrome.storage.local.get([WALLET_KEY], (d) => res(d[WALLET_KEY] || null)));
      if (stored && STEAM_CURRENCY[stored]) return { id: stored, iso: STEAM_CURRENCY[stored], known: true };
      return { id: 1, iso: 'USD', known: false };
    })();
    return walletPromise;
  };

})(window);
