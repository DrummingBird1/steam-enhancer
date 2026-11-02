#!/usr/bin/env node
// Static consistency checks — NOT loaded by the extension. No dependencies,
// no network. Run with: node scripts/check-manifest.js
//
// Catches the mistakes that otherwise only show up as a blank panel or a
// raw "someKey" label after loading the unpacked extension:
//   - a file referenced by manifest.json that doesn't exist
//   - a __MSG_x__ placeholder in the manifest with no locale entry
//   - an SE.t('key') / data-i18n="key" used in src/ that's missing from _locales/en

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const problems = [];

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, '_locales', 'en', 'messages.json'), 'utf8'));

function mustExist(rel, where) {
  if (!fs.existsSync(path.join(root, rel))) problems.push(`${where}: missing file ${rel}`);
}

Object.values(manifest.icons || {}).forEach((p) => mustExist(p, 'icons'));
Object.values(manifest.action?.default_icon || {}).forEach((p) => mustExist(p, 'action.default_icon'));
if (manifest.action?.default_popup) mustExist(manifest.action.default_popup, 'action.default_popup');
if (manifest.options_ui?.page) mustExist(manifest.options_ui.page, 'options_ui.page');
if (manifest.background?.service_worker) mustExist(manifest.background.service_worker, 'background');
(manifest.content_scripts || []).forEach((cs, i) => {
  [...(cs.js || []), ...(cs.css || [])].forEach((p) => mustExist(p, `content_scripts[${i}]`));
});

for (const m of JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)) {
  if (!en[m[1]]) problems.push(`manifest: __MSG_${m[1]}__ has no entry in _locales/en`);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
}
const used = new Map();
for (const file of walk(path.join(root, 'src'))) {
  if (!/\.(js|html)$/.test(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file).replace(/\\/g, '/');
  for (const m of text.matchAll(/SE\.t\(\s*'(\w+)'/g)) used.set(m[1], rel);
  for (const m of text.matchAll(/data-i18n="(\w+)"/g)) used.set(m[1], rel);
  for (const m of text.matchAll(/getMessage\(\s*'(\w+)'/g)) used.set(m[1], rel);
  // The service worker and options page have their own t() (same {0} placeholders as SE.t).
  if (rel.startsWith('src/background/') || rel.startsWith('src/options/')) for (const m of text.matchAll(/\bt\(\s*'(\w+)'/g)) used.set(m[1], rel);
}
for (const [key, file] of used) {
  if (!en[key]) problems.push(`${file}: i18n key "${key}" missing from _locales/en (add it to scripts/gen-locales.js)`);
}

if (problems.length) {
  problems.forEach((p) => console.log(`FAIL  ${p}`));
  console.log(`\n${problems.length} problem(s).`);
  process.exit(1);
}
console.log(`OK  manifest files, ${used.size} i18n keys checked.`);
