#!/usr/bin/env node
// Builds the store uploads in dist/:
//   dist/steam-enhancer-v<version>.zip            Chrome Web Store (the same zip works for Edge)
//   dist/steam-enhancer-firefox-v<version>.zip    with --firefox: EXPERIMENTAL, never run in a real Firefox
// Not loaded by the extension. No dependencies (uses git).
//
//   node scripts/package.js                       package the current commit (HEAD)
//   node scripts/package.js v1.5.0                package a tag (what was actually released)
//   node scripts/package.js --firefox [ref]       same files, but manifest.json rewritten for Firefox
//
// The ZIP holds only manifest.json, src/, icons/, _locales/ and LICENSE —
// taken from git, so it is exactly what's committed. Packaging HEAD refuses
// when those paths have uncommitted changes. A previous version's ZIP in dist/
// (of the same kind: Chrome or Firefox) moves to dist/ARCHIVE/.
//
// The Firefox zip is written from the committed bytes (LF). `git archive` for the Chrome zip may
// convert line endings on a machine with core.autocrlf=true, so the two zips can differ that way.
//
// The Firefox manifest differs only here: background.service_worker becomes an event page
// (background.scripts), browser_specific_settings.gecko gets an add-on id and strict_min_version,
// and minimum_chrome_version (Chrome only) is dropped. data_collection_permissions is NOT declared
// on purpose: decide what to declare before submitting to addons.mozilla.org.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const PATHS = ['manifest.json', 'src', 'icons', '_locales', 'LICENSE'];

const FIREFOX = process.argv.includes('--firefox');
const GECKO_ID = 'steam-enhancer@drummingbird1.github.io'; // proposed id, not registered on AMO yet
const GECKO_MIN_VERSION = '128.0'; // content scripts with "world": "MAIN" need Firefox 128

function firefoxManifest(m) {
  const f = structuredClone(m);
  delete f.minimum_chrome_version;
  if (f.background && f.background.service_worker) {
    f.background = {
      scripts: [f.background.service_worker],
      ...(f.background.type ? { type: f.background.type } : {}),
    };
  }
  for (const key of ['permissions', 'optional_permissions']) {
    if (f[key]) {
      f[key] = f[key].filter((p) => p !== 'favicon'); // Chrome-only permission
      if (!f[key].length) delete f[key];
    }
  }
  for (const war of f.web_accessible_resources || []) delete war.use_dynamic_url; // Chrome-only key
  f.browser_specific_settings = { gecko: { id: GECKO_ID, strict_min_version: GECKO_MIN_VERSION } };
  return f;
}

// Minimal zip writer (deflate) for the Firefox package, where git archive can't rewrite a file.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01, fixed so rebuilding gives the same bytes
function makeZip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const comp = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    local.writeUInt16LE(8, 8); // method: deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, comp);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); // version made by
    cd.writeUInt16LE(20, 6); // version needed
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(DOS_TIME, 12);
    cd.writeUInt16LE(DOS_DATE, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(comp.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cdBuf, end]);
}

const ref = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'HEAD';
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
const prefix = FIREFOX ? 'steam-enhancer-firefox-v' : 'steam-enhancer-v';
const name = `${prefix}${version}.zip`;
for (const f of fs.readdirSync(dist)) {
  if (f.startsWith(prefix) && f.endsWith('.zip') && f !== name) {
    fs.renameSync(path.join(dist, f), path.join(archive, f));
    console.log(`moved ${f} → dist/ARCHIVE/`);
  }
}

const out = path.join(dist, name);
const files = git('ls-tree', '-r', '-z', '--name-only', ref, '--', ...PATHS).split('\0').filter(Boolean);
if (FIREFOX) {
  const entries = files.map((f) => ({
    name: f,
    data:
      f === 'manifest.json'
        ? Buffer.from(JSON.stringify(firefoxManifest(manifest), null, 2) + '\n', 'utf8')
        : execFileSync('git', ['show', `${ref}:${f}`], { cwd: root, maxBuffer: 256 * 1024 * 1024 }),
  }));
  fs.writeFileSync(out, makeZip(entries));
} else {
  git('archive', '--format=zip', '-o', out, ref, '--', ...PATHS);
}
const kb = Math.round(fs.statSync(out).size / 1024);
console.log(`wrote dist/${name} (${kb} KB, ${files.length} files, from ${ref === 'HEAD' ? git('rev-parse', '--short', 'HEAD') : ref})`);
if (FIREFOX) console.log('EXPERIMENTAL: not run in a real Firefox yet; data_collection_permissions is not declared.');
