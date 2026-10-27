# Chrome Web Store submission package

Everything needed to fill in the Chrome Web Store Developer Dashboard.

## Graphics

| File | Spec | Status |
|---|---|---|
| `../icons/icon128.png` | 128×128 PNG, store icon | ✅ |
| `promo-small-440x280.png` | 440×280 PNG, small promo tile | ✅ |
| `promo-marquee-1400x560.png` | 1400×560 PNG, marquee tile (optional) | ✅ |
| `screenshot-1-store-page.png` | 1280×800 PNG, real capture: store page panel | ✅ |
| `screenshot-2-search.png` | 1280×800 PNG, real capture: search / specials | ✅ |
| `screenshot-3-options.png` | 1280×800 PNG, real capture: options page | ✅ |
| `screenshot-4-popup.png` | 1280×800 PNG, real capture: toolbar popup (enlarged) | ✅ |

The screenshots were captured from the real extension on live Steam pages while signed out and without an IsThereAnyDeal key, so the price panels show the "add a free key" notice. Market, inventory, wishlist and trade-offer screens need a signed-in session and are not included; add them if you want a fuller gallery.

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

For a tagged release, build it from the tag so it matches exactly what was released:

```
git archive --format=zip -o dist/steam-enhancer-vX.Y.Z.zip vX.Y.Z -- manifest.json src icons _locales LICENSE
```

Before uploading, check that the `version` inside the ZIP's `manifest.json` is higher than the one already on the store.
