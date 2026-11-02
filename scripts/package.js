#!/usr/bin/env node
// Builds the Chrome Web Store upload: dist/steam-enhancer-v<version>.zip.
// Not loaded by the extension. No dependencies (uses git archive).
//
//   node scripts/package.js            package the current commit (HEAD)
//   node scripts/package.js v1.5.0     package a tag (what was actually released)
//
// The ZIP holds only manifest.json, src/, icons/, _locales/ and LICENSE —
// taken from git, so it is exactly what's committed. Packaging HEAD refuses
// when those paths have uncommitted changes. A previous version's ZIP in dist/
// moves to dist/ARCHIVE/.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const PATHS = ['manifest.json', 'src', 'icons', '_locales', 'LICENSE'];

const ref = process.argv[2] || 'HEAD';
if (ref === 'HEAD') {
  const dirty = git('status', '--porcelain', '--', ...PATHS);
  if (dirty) {
    console.error('Uncommitted changes in packaged files — commit them first:\n' + dirty);
    process.exit(1);
  }
}

const manifest = JSON.parse(git('show', `${ref}:manifest.json`));
const version = manifest.version;
if (ref !== 'HEAD' && ref.replace(/^v/, '') !== version) {
  console.error(`Tag ${ref} has manifest version ${version} — they should match.`);
  process.exit(1);
}

const dist = path.join(root, 'dist');
const archive = path.join(dist, 'ARCHIVE');
fs.mkdirSync(archive, { recursive: true });
const name = `steam-enhancer-v${version}.zip`;
for (const f of fs.readdirSync(dist)) {
  if (/^steam-enhancer-v.*\.zip$/.test(f) && f !== name) {
    fs.renameSync(path.join(dist, f), path.join(archive, f));
    console.log(`moved ${f} → dist/ARCHIVE/`);
  }
}

const out = path.join(dist, name);
git('archive', '--format=zip', '-o', out, ref, '--', ...PATHS);
const kb = Math.round(fs.statSync(out).size / 1024);
const files = git('ls-tree', '-r', '--name-only', ref, '--', ...PATHS).split('\n').filter(Boolean);
console.log(`wrote dist/${name} (${kb} KB, ${files.length} files, from ${ref === 'HEAD' ? git('rev-parse', '--short', 'HEAD') : ref})`);
