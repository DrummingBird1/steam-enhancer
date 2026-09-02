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
const sandbox = { window: {}, console };
vm.createContext(sandbox);
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'utils.js'), 'utf8');
vm.runInContext(src, sandbox, { filename: 'utils.js' });
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
