# Chrome Web Store submission package

Drop these into the Chrome Web Store Developer Dashboard when submitting.

## Required assets

| File | Spec | Status |
|---|---|---|
| `../icons/icon128.png` | 128×128 PNG, store icon | ✅ |
| `promo-small-440x280.png` | 440×280 PNG, "small promo tile" | ✅ |
| `promo-marquee-1400x560.png` | 1400×560 PNG, marquee tile (optional, recommended) | ✅ |
| `screenshot-1-store-page.png` | 1280×800 PNG | ✅ |
| `screenshot-2-search.png` | 1280×800 PNG | ✅ |
| `screenshot-3-wishlist.png` | 1280×800 PNG | ✅ |
| `screenshot-4-market.png` | 1280×800 PNG | ✅ |
| `screenshot-5-options.png` | 1280×800 PNG | ✅ |

You need at least 1 screenshot; up to 5 are allowed. All five are provided.

## Required listing text
- **Short description** — see `description.md`
- **Detailed description** — see `description.md`
- **Category** — Productivity
- **Privacy policy URL** — host `privacy-policy.md` (e.g. as a GitHub raw URL) and paste the URL into the dashboard.

## Permission justifications
Each requested permission has a justification in `description.md` for the "permissions justification" form in the dashboard.

## Packaging
From the repo root:

```
# Windows PowerShell
Compress-Archive -Path manifest.json, src, icons, LICENSE, README.md -DestinationPath steam-enhancer-v1.0.0.zip -Force
```

Upload the zip to the dashboard. Make sure to **exclude** `.git/`, `.claude/`, `store-assets/`, and `node_modules/`.
