# Steam Enhancer v1.5.0 — תוכנית עבודה

גרסה אחת גדולה, בלי גרסאות ביניים. עבודה ב-branch `release/1.5.0`, commit נפרד לכל שלב.
עקרונות שלא משתנים: בלי build step, בלי מפתחות API מובנים, בלי להרחיב `host_permissions`.

סימון: ✅ בוצע · 🔄 בעבודה · ⬜ פתוח · ⏭️ נדחה ל-1.6.0

## שלב 0 — הכנה
- ✅ branch `release/1.5.0` מ-`main`, כולל אייקון החנות מ-PR #4
- ✅ CI ב-GitHub Actions: unit tests, בדיקה ש-`gen-locales` לא מייצר diff, ולידציה של ה-manifest
- ✅ תיקון הגרסה ב-ROADMAP.md
- ⬜ merge ל-PR #4 וניקוי branches שמוזגו (דורש אישור)

## שלב 1 — תיקוני באגים
| # | באג | תיקון |
|---|---|---|
| 1 | mass-list מוכר בהפסד (USD מול מטבע הארנק, price כולל עמלה, contextid קבוע 2) | מטבע הארנק מ-`g_rgWalletInfo`, חישוב סכום המוכר אחרי עמלה, contextid מהפריט, תצוגה מקדימה "הקונה משלם / אתה מקבל" |
| 2 | התראות ברקע לא עובדות (`data.data`) | parsing משותף לתשובות ITAD |
| 3 | התנגשות app/package IDs | `ownedApps` ו-`ownedPackages` נפרדים |
| 4 | `parsePrice`: `$1,234`, `¥ 1,980`, `₩ 12,000`, "Free Weekend" | זיהוי פסיק כמפריד אלפים, מטבעות בלי סנטים |
| 5 | DRM: "origin" תופס "original" | גבולות מילה, חיפוש רק באזורים רלוונטיים |
| 6 | גרף מחירים בעמוד משחק לא מוצג | התאמה לתשובת ITAD האמיתית (שלב 4א) |
| 7 | עמלת market (15% מהמחיר) | `net ≈ price / 1.15` עם מינימום עמלות כמו ב-Steam |
| 8 | trade offers: ערך 0 לקלפים | contextid דינמי (753/6) |
| 9 | השוואה בין מטבעות שונים | זיהוי country/מטבע מהעמוד, הגדרה ידנית כ-override |
| 10 | race ב-cache | מפתח storage לכל רשומה + ניקוי ב-alarm |
| 11 | observer כפול ב-wishlist, alarms רק ב-onInstalled | `SE.once`, יצירה גם ב-onStartup |

לכל תיקון unit test; fixtures של תשובות ב-`scripts/fixtures/`.

## שלב 2 — תשתית
- ⬜ מקור אחד לברירות מחדל (popup/options טוענים `storage.js`)
- ⬜ `"world": "MAIN"` במקום הזרקת `<script>` inline
- ⬜ תור בקשות ב-service worker עם rate limit לכל host ו-backoff ב-429
- ⬜ ניקוי קוד מת (`SE.api.hltb`, `SE.cache`, `featuredSpecials`) והורדת host permissions שמשמשים רק ללינקים
- ⬜ פירוק `app.js` לקבצי פאנלים
- ⬜ השלמת i18n (אונבורדינג, changelog, "net ≈", כלי inventory, popup)
- ⬜ זיהוי לפי classes/ערכים ולא regex באנגלית (ביקורות, Early Access)

## שלב 3 — Wishlist חדש
- ⬜ נתונים מ-`IWishlistService/GetWishlist` במקום ה-DOM של React
- ⬜ פאנל: עלות כוללת, כמה במבצע, כמה במחיר הנמוך בהיסטוריה
- ⬜ מיון/סינון לפי % מעל ה-low, הנחה, ProtonDB
- ⬜ Export מהנתונים
- ⬜ יעדי מחיר בטבלה אחת; ה-service worker בודק את כל ה-wishlist ב-batch

## שלב 4 — שדרוגים
- ⬜ **4א היסטוריית מחירים מלאה** — גרף SVG אינטראקטיבי. `games/history/v2` של ITAD אם יאומת, אחרת היסטוריה מקומית
- ⬜ **4ב מנוע מטבעות אחיד** — הכול במטבע המשתמש, מחירים אזוריים מומרים
- ⬜ **4ג Market Pro** — מנהל listings, Quick/Instant sell עם עמלה ומטבע נכונים ואישור כפול
- ⏭️ **4ד Trade Guard** — נדחה ל-1.6.0 (צריך trade offers אמיתיים לכיול)
- ⬜ **4ה מרכז התראות** — היסטוריה ב-popup, לחיצה פותחת את המשחק, שעות שקטות
- ⬜ **4ו Options חדש** — חיפוש, קטגוריות, presets, גיבוי מלא, הפרדת sync/local
- ⬜ **4ז עמוד משחק** — תג Steam Deck, התקדמות הישגים. HLTB נשאר לינק בלבד

## שלב 5 — בדיקה ושחרור
- ⬜ הרחבת smoke test (wishlist API, inventory JSON)
- ⬜ בדיקה ידנית מחובר (Idan): market, inventory, trade, mass-list — מכירה אמיתית אחת בכמה סנטים
- ⬜ CHANGELOG, תרגומים ל-5 שפות, צילומי מסך, גרסה 1.5.0, tag, ZIP, העלאה לחנות (Idan)

## נקודות בדיקה מחובר
1. אחרי שלב 1 — market ו-mass-list
2. בסוף — הכול

## דורש את Idan
- מפתח ITAD (נשאר ב-Options, לא בקוד)
- בדיקות מחובר
- אישור לפעולות פומביות: merge PR #4, push, אזהרה ב-release notes של 1.4.1
