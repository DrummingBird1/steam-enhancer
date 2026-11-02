# Chrome Web Store submission package

Everything needed to fill in the Chrome Web Store Developer Dashboard.

## Graphics

| File | Spec | Status |
|---|---|---|
| `store-icon-128x128.png` | 128×128 PNG, store icon (96×96 artwork with 16 px transparent padding, per Chrome's guidance); the in-extension icons stay in `../icons/` | ✅ |
| `promo-small-440x280.png` | 440×280 PNG, small promo tile | ✅ |
| `promo-marquee-1400x560.png` | 1400×560 PNG, marquee tile (optional) | ✅ |
| `screenshot-1-store-page.png` | 1280×800 PNG, real capture: store page panel | ✅ |
| `screenshot-2-search.png` | 1280×800 PNG, real capture: search / specials | ✅ |
| `screenshot-3-options.png` | 1280×800 PNG, real capture: options page | ✅ |
| `screenshot-4-popup.png` | 1280×800 PNG, real capture: toolbar popup (enlarged) | ✅ |

The screenshots were captured from version 1.4.1 on live Steam pages while signed out and without an IsThereAnyDeal key, so the price panels show the "add a free key" notice, and the options page and popup show the old design. **For 1.5.0, retake them** signed in and with an ITAD key — the store page (price chart), the wishlist panel, the new options page and the popup with alerts are the best candidates. See `docs/TESTING-1.5.0.md`.

At least 1 screenshot is required, up to 5 allowed.

## Listing text

| Language | File |
|---|---|
| English (default) | `description.md` |
| Hebrew | `listing/he.md` |
| German | `listing/de.md` |
| Portuguese (Brazil) | `listing/pt_BR.md` |
| Russian | `listing/ru.md` |

Each file has a short description (132 characters max) and a detailed description. Paste them into the matching language tab of the dashboard. `description.md` also has the single-purpose statement and the permission justifications.

- **Category**: Productivity
- **Privacy policy URL**: `https://raw.githubusercontent.com/DrummingBird1/steam-enhancer/main/store-assets/privacy-policy.md`

## Packaging

The upload package is built into `../dist/` (git-ignored) as `steam-enhancer-vX.Y.Z.zip`; older versions go in `../dist/ARCHIVE/`.

It must contain only: `manifest.json`, `src/`, `icons/`, `_locales/`, `LICENSE`. Do **not** include `.git/`, `.claude/`, `store-assets/`, `scripts/`, `assets/`, `dist/` or `node_modules/`.

Build it with the packaging script, which takes the files from git (so it's exactly what's committed) and moves the previous ZIP to `ARCHIVE/`:

```
node scripts/package.js           # current commit
node scripts/package.js vX.Y.Z    # a release tag
```

Before uploading, check that the `version` inside the ZIP's `manifest.json` is higher than the one already on the store.
