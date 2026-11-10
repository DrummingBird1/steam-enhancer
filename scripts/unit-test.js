#!/usr/bin/env node
// Standalone unit tests for the pure (non-DOM) logic in src/lib/utils.js —
// NOT loaded by the extension. No dependencies (plain Node assert), no
// network. Run with: node scripts/unit-test.js
//
// Complements scripts/smoke-test.js, which checks live endpoints/markup but
// can't catch a regression in pure parsing/formatting logic. This can, and
// runs instantly with no network calls.

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

// utils.js does `(function (global) { ... })(window)` and only touches
// `document` inside function bodies we won't call here, so a bare object
// stands in for `window` at load time.
// itad.js attaches to globalThis (it's shared with the service worker), so
// make the fake window the sandbox's own global.
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const file of ['utils.js', 'currency.js', 'itad.js', 'wishlist.js', 'chart.js', 'market.js', 'alerts.js', 'health.js', 'steamdata.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', file), 'utf8');
  vm.runInContext(src, sandbox, { filename: file });
}
const SE = sandbox.window.SteamEnhancer;
assert.ok(SE, 'SteamEnhancer failed to load onto the fake window');

let failed = 0, passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`  OK  ${name}`); }
  catch (e) { failed++; console.log(`FAIL  ${name}`); console.log(`      ${e.message}`); }
}

// Real or doc-shaped API responses, see scripts/fixtures/.
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));

console.log('SE.parsePrice');
t('plain dollars', () => assert.strictEqual(SE.parsePrice('$19.99'), 19.99));
t('euro comma-decimal', () => assert.strictEqual(SE.parsePrice('19,99 €'), 19.99));
t('thousands + decimal (US style)', () => assert.strictEqual(SE.parsePrice('$1,234.56'), 1234.56));
t('thousands + decimal (EU style)', () => assert.strictEqual(SE.parsePrice('1.234,56 €'), 1234.56));
t('free (english)', () => assert.strictEqual(SE.parsePrice('Free'), 0));
t('free (hebrew)', () => assert.strictEqual(SE.parsePrice('חינם'), 0));
t('shekel symbol', () => assert.strictEqual(SE.parsePrice('₪75.00'), 75));
t('garbage input returns null', () => assert.strictEqual(SE.parsePrice('N/A'), null));
t('empty/null input returns null', () => {
  assert.strictEqual(SE.parsePrice(''), null);
  assert.strictEqual(SE.parsePrice(null), null);
});
// v1.5.0: a lone comma/dot followed by exactly 3 digits is a thousands separator.
t('thousands without decimals (US style)', () => assert.strictEqual(SE.parsePrice('$1,234'), 1234));
t('yen', () => assert.strictEqual(SE.parsePrice('¥ 1,980'), 1980));
t('won', () => assert.strictEqual(SE.parsePrice('₩ 12,000'), 12000));
t('dong (dot thousands)', () => assert.strictEqual(SE.parsePrice('12.000₫'), 12000));
t('chilean peso', () => assert.strictEqual(SE.parsePrice('CLP$ 5.200'), 5200));
t('rupiah with space thousands', () => assert.strictEqual(SE.parsePrice('Rp 150 000'), 150000));
t('ruble with space thousands and trailing dot', () => assert.strictEqual(SE.parsePrice('1 234,56 руб.'), 1234.56));
t('real (BRL)', () => assert.strictEqual(SE.parsePrice('R$ 1.299,90'), 1299.9));
t('millions', () => assert.strictEqual(SE.parsePrice('₩ 1,234,000'), 1234000));
t('kuwaiti dinar keeps 3 decimals', () => assert.strictEqual(SE.parsePrice('2.150 KD'), 2.15));
t('"Free Weekend $19.99" is the price, not free', () => assert.strictEqual(SE.parsePrice('Free Weekend $19.99'), 19.99));
t('"Free to Play" is 0', () => assert.strictEqual(SE.parsePrice('Free to Play'), 0));

console.log('SE.marketFees');
t('buyer pays receive + 5% + 10%, floored, 1-cent minimums', () => {
  assert.strictEqual(SE.marketFees.buyerPays(100), 115);
  assert.strictEqual(SE.marketFees.buyerPays(1), 3);
  assert.strictEqual(SE.marketFees.buyerPays(19), 21);
});
t('sellerReceives inverts buyerPays', () => {
  assert.strictEqual(SE.marketFees.sellerReceives(115), 100);
  assert.strictEqual(SE.marketFees.sellerReceives(3), 1);
  assert.strictEqual(SE.marketFees.sellerReceives(2), 0);
  for (let b = 3; b < 5000; b++) {
    const r = SE.marketFees.sellerReceives(b);
    assert.ok(SE.marketFees.buyerPays(r) <= b, `buyer ${b}: pays ${SE.marketFees.buyerPays(r)} > ${b}`);
    assert.ok(SE.marketFees.buyerPays(r + 1) > b, `buyer ${b}: ${r} is not the max`);
  }
});
t('net is ~13% below the buyer price, not 15%', () => {
  assert.strictEqual(SE.marketFees.sellerReceives(1000), 870);
});

console.log('SE.wishlistModel');
const W = SE.wishlistModel;
t('owner steamid from /profiles/ URL', () =>
  assert.strictEqual(W.ownerSteamId('/wishlist/profiles/76561197960287930/', ''), '76561197960287930'));
t('owner steamid from SSR state on a vanity URL (escaped JSON, as served)', () => {
  const ssr = String.raw`[\"wishlistcategories\"],{\"error\":\"WishlistLoadFailed\",\"steamid\":\"76561197960287930\",\"sort\":\"order\",\"filter\":{}}`;
  assert.strictEqual(W.ownerSteamId('/wishlist/id/gabelogannewell/', ssr), '76561197960287930');
  assert.strictEqual(W.ownerSteamId('/wishlist/id/x/', 'nothing here'), null);
});
t('private/empty wishlist → null', () => {
  assert.strictEqual(W.items({ response: {} }), null);
  assert.strictEqual(W.items(undefined), null);
});
const wlItems = W.items(fixture('steam-getwishlist.json'));
const storeMap = W.storeItems(fixture('steam-getitems.json'));
t('wishlist items parsed', () => {
  assert.strictEqual(wlItems.length, 3);
  assert.strictEqual(wlItems[0].appid, '1326470');
});
t('store items: discounted, full price, and failed lookups', () => {
  const sale = storeMap.get('1326470');
  assert.strictEqual(sale.priceCents, 839);
  assert.strictEqual(sale.regularCents, 2999);
  assert.strictEqual(sale.discount, 72);
  const full = storeMap.get('620');
  assert.strictEqual(full.priceCents, 999);
  assert.strictEqual(full.regularCents, 999);
  assert.strictEqual(full.discount, 0);
  assert.strictEqual(storeMap.has('999999999'), false);
});
const itadMap = new Map([['620', { historicalLow: { price: 1.99 }, currentLow: null }], ['1326470', { historicalLow: { price: 8.39 } }]]);
const wlRows = W.buildRows(wlItems, storeMap, itadMap, { 620: 5 });
t('rows: vs-low, at-low, targets, unknown app', () => {
  const byId = Object.fromEntries(wlRows.map((r) => [r.appid, r]));
  assert.strictEqual(byId['620'].vsLow, 402);
  assert.strictEqual(byId['620'].atTarget, false);
  assert.strictEqual(byId['1326470'].atLow, true);
  assert.strictEqual(byId['999999999'].price, null);
  assert.strictEqual(byId['999999999'].name, 'App 999999999');
});
t('summary', () => {
  const s = W.summary(wlRows);
  assert.strictEqual(s.count, 3);
  assert.strictEqual(s.priced, 2);
  assert.strictEqual(Math.round(s.total * 100), 1838);
  assert.strictEqual(Math.round(s.totalRegular * 100), 3998);
  assert.strictEqual(s.onSale, 1);
  assert.strictEqual(s.atLow, 1);
});
t('sort: unknowns last in both directions', () => {
  assert.strictEqual(W.sortRows(wlRows, 'price').map((r) => r.appid).join(','), ['1326470', '620', '999999999'].join(','));
  assert.strictEqual(W.sortRows(wlRows, 'price', -1).map((r) => r.appid).join(','), ['620', '1326470', '999999999'].join(','));
  assert.strictEqual(W.sortRows(wlRows, 'priority').map((r) => r.appid).join(','), ['620', '1326470', '999999999'].join(','));
});
t('filter', () => {
  assert.strictEqual(W.filterRows(wlRows, { onSale: true }).map((r) => r.appid).join(','), ['1326470'].join(','));
  assert.strictEqual(W.filterRows(wlRows, { text: 'portal' }).map((r) => r.appid).join(','), ['620'].join(','));
  assert.strictEqual(W.filterRows(wlRows, { maxPrice: 9 }).map((r) => r.appid).join(','), ['1326470'].join(','));
});
t('csv escapes quotes and commas', () => {
  const csv = W.toCsv([{ ...wlRows[0], name: 'A "quoted", name' }]);
  assert.ok(csv.split('\n')[1].includes('"A ""quoted"", name"'));
  assert.ok(csv.startsWith('appid,name,price'));
});

console.log('SE.parseReviewSummary');
t('english tooltip + meta count', () => {
  const r = SE.parseReviewSummary('98% of the 174,783 user reviews in your language are positive', '174783');
  assert.strictEqual(r.pct, 98);
  assert.strictEqual(r.total, 174783);
});
t('german tooltip, no meta: total from the tooltip', () => {
  const r = SE.parseReviewSummary('99 % der 8.757 Nutzerrezensionen in Ihrer Sprache sind positiv.', null);
  assert.strictEqual(r.pct, 99);
  assert.strictEqual(r.total, 8757);
});
t('no percentage → null', () => assert.strictEqual(SE.parseReviewSummary('No user reviews', null), null));

console.log('SE.marketMath');
const MM = SE.marketMath;
t('keep N of each when mass-listing: holds copies back, stack by stack', () => {
  const items = [
    { id: 'a', market_hash_name: 'Gems', amount: 5 },
    { id: 'b', market_hash_name: 'Card', amount: 1 },
    { id: 'c', market_hash_name: 'Card', amount: 1 },
    { id: 'd', market_hash_name: 'Card', amount: 1 }
  ];
  const sel = (keep) => MM.selectForListing(items, keep).map((x) => `${x.item.id}:${x.amount}`).join(' ');
  assert.strictEqual(sel(0), 'a:5 b:1 c:1 d:1');
  assert.strictEqual(sel(1), 'a:4 c:1 d:1');        // first copy of each name stays
  assert.strictEqual(sel(2), 'a:3 d:1');            // two cards stay, the third is listed
  assert.strictEqual(sel(9), '');                    // keeping more than you own lists nothing
  assert.strictEqual(sel(-3), 'a:5 b:1 c:1 d:1');   // nonsense counts as 0
  assert.strictEqual(MM.selectForListing(null, 1).length, 0);
});
t('order book (Market Beta): by-name response → the few numbers used', () => {
  const b = MM.orderBookSummary(fixture('steam-orderbook.json'));
  assert.deepStrictEqual({ ...b }, { currency: 35, highestBuy: 214, lowestSell: 218, buyCount: 331296, sellCount: 23183 });
  assert.strictEqual(MM.orderBookSummary({ data: { success: false } }), null);
  assert.strictEqual(MM.orderBookSummary(null), null);
  // No buy orders: the field is 0 or missing → null, not 0 (nothing to sell into).
  const empty = MM.orderBookSummary({ data: { success: true, data: { eCurrency: 1, amtMaxBuyOrder: 0, amtMinSellOrder: 150 } } });
  assert.strictEqual(empty.highestBuy, null);
  assert.strictEqual(empty.lowestSell, 150);
});
t('price history: Steam\'s `prices` rows → UTC points', () => {
  const pts = MM.historyPoints({ success: true, price_prefix: '₪', prices: [['Dec 11 2014 01: +0', 1.13, '1249'], ['Jan 2 2026 13: +0', '2.5', '7'], ['garbage', 1, '1']] });
  assert.strictEqual(pts.length, 2);
  assert.strictEqual(pts[0].t, Date.UTC(2014, 11, 11, 1));
  assert.strictEqual(pts[1].t, Date.UTC(2026, 0, 2, 13));
  assert.strictEqual(pts[1].v, 2.5);
  assert.strictEqual(MM.historyPoints(null).length, 0);
  assert.strictEqual(MM.historyPoints({ success: false }).length, 0);
});
t('quick sell: one cent under the lowest, 3-cent floor', () => {
  assert.strictEqual(MM.quickSellBuyerCents(125), 124);
  assert.strictEqual(MM.quickSellBuyerCents(3), 3);
  assert.strictEqual(MM.quickSellBuyerCents(null), null);
});
t('instant sell: exactly the highest buy order', () => {
  assert.strictEqual(MM.instantSellBuyerCents('87'), 87);
  assert.strictEqual(MM.instantSellBuyerCents(null), null);
  assert.strictEqual(MM.instantSellBuyerCents('2'), null);
});
t('listing status', () => {
  assert.deepStrictEqual({ ...MM.listingStatus(120, 120) }, { status: 'lowest', byCents: 0 });
  assert.deepStrictEqual({ ...MM.listingStatus(120, 110) }, { status: 'undercut', byCents: 10 });
  assert.strictEqual(MM.listingStatus(120, null).status, 'unknown');
});
t('my-listing price cell: buyer pays / you receive, US and EU formats', () => {
  const us = MM.parseMyListingPrice('$1.15\n($1.00)');
  assert.strictEqual(us.buyerCents, 115);
  assert.strictEqual(us.receiveCents, 100);
  const eu = MM.parseMyListingPrice('1,15€ (1,00€)');
  assert.strictEqual(eu.buyerCents, 115);
  assert.strictEqual(eu.receiveCents, 100);
  assert.strictEqual(MM.parseMyListingPrice('₪3.40').receiveCents, null);
});
t('order-book id and listing URL parsing', () => {
  assert.strictEqual(MM.itemNameIdFromHtml('<script>Market_LoadOrderSpread( 176096390 );</script>'), '176096390');
  assert.strictEqual(MM.itemNameIdFromHtml('nothing'), null);
  const l = MM.listingFromUrl('https://steamcommunity.com/market/listings/730/AK-47%20%7C%20Redline%20(Field-Tested)?filter=x');
  assert.strictEqual(l.appid, '730');
  assert.strictEqual(l.name, 'AK-47 | Redline (Field-Tested)');
});

console.log('SE.alerts');
const A = SE.alerts;
t('history: newest first, unread, capped at 50, input untouched', () => {
  let list = [];
  for (let i = 0; i < 55; i++) list = A.add(list, { title: `#${i}` }, 1000 + i);
  assert.strictEqual(list.length, 50);
  assert.strictEqual(list[0].title, '#54');
  assert.strictEqual(A.unreadCount(list), 50);
  const read = A.markAllRead(list);
  assert.strictEqual(A.unreadCount(read), 0);
  assert.strictEqual(A.unreadCount(list), 50);
});
t('quiet hours: same-day and overnight windows', () => {
  const at = (h, m = 0) => new Date(2026, 0, 1, h, m);
  assert.strictEqual(A.inQuietHours(at(23, 30), '23:00', '08:00'), true);
  assert.strictEqual(A.inQuietHours(at(7, 59), '23:00', '08:00'), true);
  assert.strictEqual(A.inQuietHours(at(8, 0), '23:00', '08:00'), false);
  assert.strictEqual(A.inQuietHours(at(13), '12:00', '14:00'), true);
  assert.strictEqual(A.inQuietHours(at(15), '12:00', '14:00'), false);
  assert.strictEqual(A.inQuietHours(at(3), '', '08:00'), false);
  assert.strictEqual(A.inQuietHours(at(3), '25:00', '08:00'), false);
});
t('age labels', () => {
  assert.strictEqual(A.age(0, 5 * 60000), '5m');
  assert.strictEqual(A.age(0, 3 * 3600000), '3h');
  assert.strictEqual(A.age(0, 3 * 86400000), '3d');
});

console.log('SE.currency');
t('steam currency ids', () => {
  assert.strictEqual(SE.currency.isoForSteamId(35), 'ILS');
  assert.strictEqual(SE.currency.isoForSteamId(1), 'USD');
  assert.strictEqual(SE.currency.isoForSteamId(999), null);
  assert.strictEqual(SE.currency.steamIdForIso('eur'), 3);
});
t('effectiveCountry: override > detected > us', () => {
  assert.strictEqual(SE.effectiveCountry({ countryOverride: 'DE' }, 'il'), 'de');
  assert.strictEqual(SE.effectiveCountry({ countryOverride: '' }, 'il'), 'il');
  assert.strictEqual(SE.effectiveCountry({}, null), 'us');
});

t('compareRegions: cheapest first, % vs mine, unsold dropped', () => {
  const r = SE.compareRegions([
    { cc: 'il', amount: 50 }, { cc: 'us', amount: 60 }, { cc: 'tr', amount: 20 }, { cc: 'ru', amount: null }
  ], 'il');
  assert.strictEqual(r.map((x) => x.cc).join(','), 'tr,il,us');
  assert.strictEqual(r[0].pct, -60);
  assert.strictEqual(r[1].mine, true);
  assert.strictEqual(r[2].pct, 20);
  assert.strictEqual(SE.compareRegions([{ cc: 'us', amount: 5 }], 'il')[0].pct, null);
});

console.log('SE.itad (response parsers)');
const GAME = '018d937f-1234-7000-9000-000000000001';
t('lookup: found / not found', () => {
  const g = SE.itad.gameFromLookup(fixture('itad-lookup.json'));
  assert.strictEqual(g.id, GAME);
  assert.strictEqual(g.slug, 'portal-2');
  assert.strictEqual(g.title, 'Portal 2');
  assert.strictEqual(SE.itad.gameFromLookup({ found: false }), null);
  assert.strictEqual(SE.itad.gameFromLookup(undefined), null);
});
t('prices: picks the cheapest deal regardless of order', () => {
  const d = SE.itad.bestDeal(fixture('itad-prices.json'), GAME);
  assert.strictEqual(d.price, 1.99);
  assert.strictEqual(d.shop, 'GOG');
  assert.strictEqual(d.currency, 'USD');
  assert.strictEqual(SE.itad.bestDeal(fixture('itad-prices.json'), 'missing'), null);
});
t('storelow: reads lows[] (v1.4 read .low and never showed a historical low)', () => {
  const l = SE.itad.storeLow(fixture('itad-storelow.json'), GAME);
  assert.strictEqual(l.price, 0.99);
  assert.strictEqual(l.shop, 'Steam');
});
t('history: sorted points, bad rows dropped', () => {
  const pts = SE.itad.historyPoints(fixture('itad-history.json'));
  assert.strictEqual(pts.length, 3);
  assert.ok(pts[0].t < pts[1].t && pts[1].t < pts[2].t);
  assert.strictEqual(pts[0].v, 9.99);
});

console.log('SE.fmtPercent');
t('50% off', () => assert.strictEqual(SE.fmtPercent(20, 10), 50));
t('no discount', () => assert.strictEqual(SE.fmtPercent(10, 10), 0));
t('price increase (negative cut)', () => assert.strictEqual(SE.fmtPercent(10, 20), -100));
t('zero/undefined baseline returns null', () => {
  assert.strictEqual(SE.fmtPercent(0, 10), null);
  assert.strictEqual(SE.fmtPercent(undefined, 10), null);
});

console.log('SE.formatMoney');
t('USD', () => assert.strictEqual(SE.formatMoney(19.99, 'USD', 'en-US'), '$19.99'));
t('null amount renders em-dash', () => assert.strictEqual(SE.formatMoney(null, 'USD'), '—'));
t('NaN amount renders em-dash', () => assert.strictEqual(SE.formatMoney(NaN, 'USD'), '—'));
t('RTL locales: no direction marks (they reorder LTR text around the amount)', () => {
  for (const loc of ['he-IL', 'ar-EG', 'fa-IR']) {
    assert.ok(!/[\u200e\u200f\u061c]/.test(SE.formatMoney(29.99, 'USD', loc)), loc);
  }
});

console.log('SE.chartModel / chartPointAt / chartSince');
const stepPts = [{ t: 0, v: 10 }, { t: 1000, v: 5 }, { t: 3000, v: 8 }];
t('fewer than 2 points → null', () => {
  assert.strictEqual(SE.chartModel([], {}), null);
  assert.strictEqual(SE.chartModel([{ t: 1, v: 1 }], {}), null);
});
t('step path uses H/V segments and finds the low', () => {
  const m = SE.chartModel(stepPts, { w: 100, h: 50, padL: 0, padR: 0, padT: 0, padB: 0 });
  assert.ok(/^M0\.0,0\.0 H33\.3 V50\.0 H100\.0 V20\.0$/.test(m.d), m.d);
  assert.strictEqual(m.low.v, 5);
});
t('line mode uses L segments; unsorted input is sorted', () => {
  const m = SE.chartModel([stepPts[2], stepPts[0], stepPts[1]], { step: false });
  assert.ok(m.d.includes(' L') && !m.d.includes(' H'));
});
t('flat or all-zero series never yields NaN/Infinity', () => {
  for (const v of [5, 0]) {
    const m = SE.chartModel([{ t: 0, v }, { t: 10, v }], {});
    assert.ok(!/NaN|Infinity/.test(m.d), m.d);
  }
});
t('pointAt is the price in effect (step semantics)', () => {
  assert.strictEqual(SE.chartPointAt(stepPts, 999).v, 10);
  assert.strictEqual(SE.chartPointAt(stepPts, 1000).v, 5);
  assert.strictEqual(SE.chartPointAt(stepPts, 99999).v, 8);
});
t('chartSince carries in the price already in effect', () => {
  const r = SE.chartSince(stepPts, 2000);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].t, 2000);
  assert.strictEqual(r[0].v, 5);
});

console.log('SE.health (page types, misses, report)');
t('pageType: addresses become types, nothing else', () => {
  const H = SE.health;
  assert.strictEqual(H.pageType('store.steampowered.com', '/app/1145350/Hades_II/'), 'store-app');
  assert.strictEqual(H.pageType('store.steampowered.com', '/wishlist/profiles/7656119909117/'), 'store-wishlist');
  assert.strictEqual(H.pageType('store.steampowered.com', '/'), 'store-home');
  assert.strictEqual(H.pageType('steamcommunity.com', '/market/listings/753/Sack%20of%20Gems'), 'market-item');
  assert.strictEqual(H.pageType('steamcommunity.com', '/market/'), 'market');
  assert.strictEqual(H.pageType('steamcommunity.com', '/my/inventory/'), 'inventory');
  assert.strictEqual(H.pageType('steamcommunity.com', '/profiles/76561199091177266/inventory'), 'inventory');
  assert.strictEqual(H.pageType('steamcommunity.com', '/id/someone/games/'), 'library');
  assert.strictEqual(H.pageType('steamcommunity.com', '/tradeoffer/new/'), 'trade-offer');
  assert.strictEqual(H.pageType('example.com', '/app/1'), 'other');
});
t('addMiss: one entry per feature and page, counted, newest first, capped', () => {
  let list = [];
  list = SE.health.addMiss(list, { feature: 'a', page: 'store-app', ts: 1 });
  list = SE.health.addMiss(list, { feature: 'b', page: 'inventory', ts: 2 });
  list = SE.health.addMiss(list, { feature: 'a', page: 'store-app', ts: 3 });
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].feature, 'a');
  assert.strictEqual(list[0].count, 2);
  assert.strictEqual(list[0].ts, 3);
  for (let i = 0; i < 30; i++) list = SE.health.addMiss(list, { feature: 'f' + i, page: 'x', ts: i });
  assert.strictEqual(list.length, 20);
});
t('changedFromDefaults: toggles and numbers only, never strings', () => {
  const defaults = { a: true, b: false, n: 25, itadApiKey: '', customCss: '' };
  const settings = { a: false, b: false, n: 40, itadApiKey: 'SECRET', customCss: 'body{}' };
  assert.deepStrictEqual(Array.from(SE.health.changedFromDefaults(settings, defaults)), ['a=false', 'n=40']);
});
t('diagnostics: the report carries no key, url or id', () => {
  const text = SE.health.diagnostics({
    version: '1.6.0', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.6723.92 Safari/537.36',
    language: 'he', defaults: { a: true }, settings: { a: false, itadApiKey: 'SECRET-KEY', steamWebApiKey: '', customCss: '.x{}' },
    misses: [{ feature: 'storePanel', page: 'store-app', ts: Date.UTC(2026, 10, 10), count: 3 }], now: 0
  });
  assert.ok(text.includes('Steam Enhancer 1.6.0'));
  assert.ok(text.includes('Chrome 130.0.6723.92 on Windows'));
  assert.ok(text.includes('IsThereAnyDeal key set: yes'));
  assert.ok(text.includes('Steam Web API key set: no'));
  assert.ok(text.includes('a=false'));
  assert.ok(text.includes('- storePanel on store-app (x3), last 2026-11-10'));
  assert.ok(!text.includes('SECRET'));
  assert.ok(!text.includes('.x{}'));
});

console.log('SE.steamData.ownedAppIds');
t('owned games reduced to app ids, same shape', () => {
  const r = SE.steamData.ownedAppIds({ response: { game_count: 2, games: [{ appid: 620, name: 'Portal 2', playtime_forever: 900, img_icon_url: 'x' }, { appid: 400, name: 'Portal' }] } });
  assert.strictEqual(JSON.stringify(r), JSON.stringify({ response: { game_count: 2, games: [{ appid: 620 }, { appid: 400 }] } }));
  assert.strictEqual(SE.steamData.ownedAppIds({ response: {} }).response.games.length, 0);   // private profile
  assert.strictEqual(SE.steamData.ownedAppIds(null).response.games.length, 0);
});

console.log('Alerts near the historical low, price stats, region list');
t('nearLow: within X% of the low, never when off', () => {
  assert.strictEqual(SE.alerts.nearLow(12.49, 12.49, 10), true);
  assert.strictEqual(SE.alerts.nearLow(13.5, 12.49, 10), true);   // 8% above
  assert.strictEqual(SE.alerts.nearLow(14, 12.49, 10), false);    // 12% above
  assert.strictEqual(SE.alerts.nearLow(12.49, 12.49, 0), false);  // off
  assert.strictEqual(SE.alerts.nearLow(12.49, null, 10), false);  // no low known
});
t('shouldAnnounceNear: once, then only when lower', () => {
  assert.strictEqual(SE.alerts.shouldAnnounceNear(undefined, 13), true);
  assert.strictEqual(SE.alerts.shouldAnnounceNear(13, 13), false);
  assert.strictEqual(SE.alerts.shouldAnnounceNear(13, 12.5), true);
  assert.strictEqual(SE.alerts.shouldAnnounceNear(13, 14), false);
});
t('priceStats: held days and the last drop', () => {
  const day = 86400000, now = Date.UTC(2026, 10, 10);
  const pts = [{ t: now - 300 * day, v: 30 }, { t: now - 100 * day, v: 15 }, { t: now - 40 * day, v: 30 }];
  const s = SE.itad.priceStats(pts, now);
  assert.strictEqual(s.heldDays, 40);
  assert.strictEqual(s.lastDropDaysAgo, 100);
  assert.strictEqual(s.dropIsCurrent, false);
  const d = SE.itad.priceStats([{ t: now - 90 * day, v: 30 }, { t: now - 3 * day, v: 15 }], now);
  assert.strictEqual(d.dropIsCurrent, true);
  assert.strictEqual(d.heldDays, 3);
  const none = SE.itad.priceStats([{ t: now - 90 * day, v: 15 }, { t: now - 3 * day, v: 30 }], now);
  assert.strictEqual(none.lastDropAt, null);
  assert.strictEqual(SE.itad.priceStats([{ t: now, v: 1 }], now), null);
});
t('parseRegionList: valid codes only, distinct, capped; fallback otherwise', () => {
  const R = SE.currency.parseRegionList;
  assert.strictEqual(R('US, de  pl;tr', ['x']).join(','), 'us,de,pl,tr');
  assert.strictEqual(R('us,us,DE', ['x']).join(','), 'us,de');
  assert.strictEqual(R('usa, 12, ', ['x']).join(','), 'x');
  assert.strictEqual(R('', ['us']).join(','), 'us');
  assert.strictEqual(R('aa bb cc dd ee ff gg hh ii jj kk ll mm nn oo pp', ['x']).length, 15);
});

console.log('SE.appidFromInventoryHash / assetIdFromTileId / steamId64FromAccountId / appIdsFromHrefs');
t('inventory hash → game', () => {
  assert.strictEqual(SE.appidFromInventoryHash('#730'), '730');
  assert.strictEqual(SE.appidFromInventoryHash('#753_6'), '753');
  assert.strictEqual(SE.appidFromInventoryHash('#inventory_76561198000000000_440'), '440');
  assert.strictEqual(SE.appidFromInventoryHash(''), null);
  assert.strictEqual(SE.appidFromInventoryHash('#abc'), null);
});
t('tile id → asset id', () => {
  assert.strictEqual(SE.assetIdFromTileId('730_2_10995123456'), '10995123456');
  assert.strictEqual(SE.assetIdFromTileId('item730_2_42'), '42');
  assert.strictEqual(SE.assetIdFromTileId('empty-slot'), null);
  assert.strictEqual(SE.assetIdFromTileId(undefined), null);
});
t('trade partner account id → SteamID64', () => {
  assert.strictEqual(SE.steamId64FromAccountId('130899538'), '76561198091165266');
  assert.strictEqual(SE.steamId64FromAccountId('not a number'), null);
});
t('store links → distinct app ids', () => {
  const ids = SE.appIdsFromHrefs(['https://store.steampowered.com/app/620/Portal_2/', 'https://store.steampowered.com/app/620/', 'https://store.steampowered.com/app/400/', 'https://store.steampowered.com/']);
  assert.strictEqual(ids.join(','), '620,400');
});

console.log('SE.steamLanguage');
t('page language → Steam API language', () => {
  assert.strictEqual(SE.steamLanguage('de'), 'german');
  assert.strictEqual(SE.steamLanguage('pt-BR'), 'brazilian');
  assert.strictEqual(SE.steamLanguage('zh-TW'), 'tchinese');
  assert.strictEqual(SE.steamLanguage('he'), 'english');
  assert.strictEqual(SE.steamLanguage(''), 'english');
});

console.log('SE.profileKeyFromPath');
t('/id/ vanity URL', () => assert.strictEqual(SE.profileKeyFromPath('/id/gaben/games/'), 'gaben'));
t('/profiles/ steamid64 URL', () => assert.strictEqual(SE.profileKeyFromPath('/profiles/76561197960287930/badges/'), '76561197960287930'));
t('unrelated path returns null', () => assert.strictEqual(SE.profileKeyFromPath('/app/620/'), null));

console.log('SE.el (null-props regression — see v1.2.0 CHANGELOG)');
t('SE.el(tag, null, ...) does not throw', () => {
  // This exact bug shipped in v1.0.0-v1.1.1 and was fixed in v1.2.0: default
  // parameters only cover `undefined`, not an explicitly-passed `null`.
  // Guard against it ever regressing. Needs a minimal `document` shim.
  // SE.el() checks `c instanceof Node` — real browsers always have a global
  // Node constructor; this bare VM sandbox doesn't, so stub one.
  sandbox.Node = function Node() {};
  sandbox.document = {
    createElement: (tag) => ({
      tagName: tag, style: {}, dataset: {}, children: [],
      setAttribute() {}, appendChild(c) { this.children.push(c); },
      // Like ParentNode.append(): strings become text nodes.
      append(...xs) { for (const x of xs) this.children.push(typeof x === 'string' ? { nodeType: 3, textContent: x } : x); },
      addEventListener() {}
    }),
    createTextNode: (text) => ({ nodeType: 3, textContent: text })
  };
  assert.doesNotThrow(() => SE.el('div', null, 'hello'));
});
t('SE.el never writes HTML: no html prop, no string on* handlers, text stays text', () => {
  const made = [];
  sandbox.document.createElement = (tag) => {
    const n = { tagName: tag, style: {}, dataset: {}, children: [], attrs: {}, listeners: [],
      setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.children.push(c); },
      // Like ParentNode.append(): strings become text nodes.
      append(...xs) { for (const x of xs) this.children.push(typeof x === 'string' ? { nodeType: 3, textContent: x } : x); },
      addEventListener(k) { this.listeners.push(k); } };
    Object.defineProperty(n, 'innerHTML', { set() { throw new Error('innerHTML was set'); } });
    made.push(n);
    return n;
  };
  const n = SE.el('a', { html: '<img src=x onerror=alert(1)>', onclick: 'alert(1)', onmouseover: () => {} }, '<b>name</b>');
  assert.strictEqual(n.attrs.html, '<img src=x onerror=alert(1)>', 'html is just an inert attribute now');
  assert.ok(!('onclick' in n.attrs), 'string handler must not become an attribute');
  assert.deepStrictEqual([...n.listeners], ['mouseover']);
  assert.strictEqual(n.children[0].textContent, '<b>name</b>');
});

console.log(`\n${passed}/${passed + failed} tests passed.`);
process.exit(failed ? 1 : 0);
