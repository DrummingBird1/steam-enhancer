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

  SE.currency = {
    forCountry: (cc) => CC_TO_CUR[String(cc || '').toLowerCase()] || 'USD',
    list: () => Object.keys(CC_TO_CUR).sort()
  };

  // Detect current Steam currency from page if available (set by Steam JS).
  SE.detectSteamCurrency = () => {
    try {
      const meta = document.querySelector('meta[itemprop="priceCurrency"]');
      if (meta?.content) return meta.content;
    } catch {}
    return null;
  };

})(window);
