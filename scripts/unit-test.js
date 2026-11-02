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
for (const file of ['utils.js', 'currency.js', 'itad.js']) {
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

console.log('SE.itad (response parsers)');
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
const GAME = '018d937f-1234-7000-9000-000000000001';
t('lookup: found / not found', () => {
  const g = SE.itad.gameFromLookup(fixture('itad-lookup.json'));
  assert.strictEqual(g.id, GAME);
  assert.strictEqual(g.slug, 'portal-2');
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

console.log('SE.sparklineSvg');
t('too few points returns empty string', () => {
  assert.strictEqual(SE.sparklineSvg([], {}), '');
  assert.strictEqual(SE.sparklineSvg([{ t: 1, v: 1 }], {}), '');
});
t('two points produces a valid SVG with an M and L path command', () => {
  const svg = SE.sparklineSvg([{ t: 0, v: 1 }, { t: 1000, v: 2 }], {});
  assert.ok(svg.startsWith('<svg'), 'should start with <svg');
  assert.ok(/<path d="M[\d.]+,[\d.]+ L[\d.]+,[\d.]+"/.test(svg), 'path should have one M and one L command');
});
t('flat series (all same value) does not divide by zero into NaN/Infinity', () => {
  const svg = SE.sparklineSvg([{ t: 0, v: 5 }, { t: 1000, v: 5 }, { t: 2000, v: 5 }], {});
  assert.ok(!svg.includes('NaN'), 'flat series should not produce NaN coordinates');
  assert.ok(!svg.includes('Infinity'), 'flat series should not produce Infinity coordinates');
});
t('custom labels are used verbatim', () => {
  const svg = SE.sparklineSvg([{ t: 0, v: 1 }, { t: 1000, v: 2 }], { labelLeft: 'low 1.00', labelRight: 'today' });
  assert.ok(svg.includes('>low 1.00<'), 'labelLeft should appear in output');
  assert.ok(svg.includes('>today<'), 'labelRight should appear in output');
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
      addEventListener() {}
    }),
    createTextNode: (text) => ({ nodeType: 3, textContent: text })
  };
  assert.doesNotThrow(() => SE.el('div', null, 'hello'));
});

console.log(`\n${passed}/${passed + failed} tests passed.`);
process.exit(failed ? 1 : 0);
