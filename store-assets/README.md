# Chrome Web Store submission package

Everything needed to fill in the Chrome Web Store Developer Dashboard.

## Graphics

| File | Spec | Status |
|---|---|---|
| `store-icon-128x128.png` | 128×128 PNG, store icon (96×96 artwork with 16 px transparent padding, per Chrome's guidance); the in-extension icons stay in `../icons/` | ✅ |
| `promo-small-440x280.png` | 440×280 PNG, small promo tile | ✅ |
| `promo-marquee-1400x560.png` | 1400×560 PNG, marquee tile (optional) | ✅ |
| `screenshot-1-store-page.png` | 1280×800 PNG, real capture: store page panel with regional prices | ✅ |
| `screenshot-2-store-panel.png` | 1280×800 PNG, real capture: ProtonDB, Steam Deck, achievements, price alert | ✅ |
| `screenshot-3-options.png` | 1280×800 PNG, real capture: the new options page | ✅ |
| `screenshot-4-popup.png` | 1280×800 PNG, real capture of the popup (2×) with recent alerts, on a captioned background | ✅ |

Captured from 1.5.0 on live Steam pages (Hades II, US store via `?cc=us`), signed out and without an IsThereAnyDeal key, so the ITAD-only features (lowest price, historical low, price chart) were switched off rather than showing the "add a key" notice. The popup's alert list was filled with three real US deals from the day of capture (prices checked against the Steam API), in the format the background writes them. Signed-in features (market, inventory, trade offers, wishlist panel) and the ITAD price chart aren't shown; a 5th screenshot of the price chart can be added once it's captured with a key.

### Localized screenshots

`localized/<lang>/` holds the same four screenshots for Hebrew (`he`), German (`de`), Russian (`ru`) and Portuguese (`pt_BR`). In the dashboard, pick the language at the top of the Store listing tab and upload that folder's four images; languages without their own screenshots show the English ones.

Each set was captured with Chrome in that language (so the extension's own UI is localized) and Steam in the matching language (Steam has no Hebrew, so the Hebrew set shows Steam in English with the extension in Hebrew, right to left). Store country per set: Israel (₪), Germany (€), US ($ — Russian-language users are spread across regions), Brazil (R$). The popup's alerts are real Steam specials for that country on the day of capture, written in that language the way the background writes them; the caption beside the popup is translated.

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
