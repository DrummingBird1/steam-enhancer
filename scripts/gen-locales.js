#!/usr/bin/env node
// One-off generator for _locales/*/messages.json from a single source table.
// Not loaded by the extension. Run with: node scripts/gen-locales.js
// Rationale: hand-editing 5 near-identical JSON files for ~180 keys is
// extremely error-prone (easy to drop/misalign a key in one language);
// generating all of them from one table keeps every locale in lockstep.

const fs = require('fs');
const path = require('path');

// key: { en, he, ru, de, ptBR }
const T = {
  extName: { en: 'Steam Enhancer', he: 'Steam Enhancer', ru: 'Steam Enhancer', de: 'Steam Enhancer', ptBR: 'Steam Enhancer' },
  extDesc: {
    en: 'All-in-one Steam upgrade: price history, lowest prices, wishlist, market & inventory tools.',
    he: 'שדרוג כולל ל-Steam: היסטוריית מחירים, מחירים נמוכים, רשימת משאלות, market ומלאי.',
    ru: 'Всё для Steam в одном месте: история цен, минимальные цены, список желаемого, рынок и инвентарь.',
    de: 'Das Alles-in-einem-Upgrade für Steam: Preisverlauf, niedrigste Preise, Wunschliste, Markt- und Inventar-Tools.',
    ptBR: 'O upgrade completo para a Steam: histórico de preços, preços mais baixos, lista de desejos, mercado e inventário.'
  },
  panelTitle: { en: 'Steam Enhancer', he: 'Steam Enhancer', ru: 'Steam Enhancer', de: 'Steam Enhancer', ptBR: 'Steam Enhancer' },
  lowestNow: { en: 'Lowest now:', he: 'הנמוך ביותר כעת:', ru: 'Сейчас дешевле всего:', de: 'Aktuell günstigster Preis:', ptBR: 'Preço mais baixo agora:' },
  historicalLow: { en: 'Historical low:', he: 'שפל היסטורי:', ru: 'Исторический минимум:', de: 'Historischer Tiefstpreis:', ptBR: 'Menor preço histórico:' },
  viewOnItad: { en: 'View on ITAD', he: 'צפה ב-ITAD', ru: 'Открыть на ITAD', de: 'Auf ITAD ansehen', ptBR: 'Ver no ITAD' },
  playingNow: { en: 'Playing now:', he: 'משחקים כרגע:', ru: 'Сейчас играют:', de: 'Spielen gerade:', ptBR: 'Jogando agora:' },
  achievements: { en: 'Achievements:', he: 'הישגים:', ru: 'Достижения:', de: 'Erfolge:', ptBR: 'Conquistas:' },
  dlcOwned: { en: 'DLC owned:', he: 'DLC בבעלותך:', ru: 'DLC в наличии:', de: 'DLC im Besitz:', ptBR: 'DLC possuído:' },
  regional: { en: 'Regional:', he: 'אזורי:', ru: 'По регионам:', de: 'Regional:', ptBR: 'Regional:' },
  reviews: { en: 'Reviews:', he: 'ביקורות:', ru: 'Обзоры:', de: 'Rezensionen:', ptBR: 'Avaliações:' },
  cards: { en: 'Cards:', he: 'קלפים:', ru: 'Карточки:', de: 'Karten:', ptBR: 'Cartas:' },
  links: { en: 'Links:', he: 'קישורים:', ru: 'Ссылки:', de: 'Links:', ptBR: 'Links:' },
  community: { en: 'Community:', he: 'קהילה:', ru: 'Сообщество:', de: 'Community:', ptBR: 'Comunidade:' },
  addToWaitlist: { en: 'Add to ITAD waitlist', he: 'הוסף לרשימת המתנה ב-ITAD', ru: 'Добавить в список ожидания ITAD', de: 'Zur ITAD-Warteliste hinzufügen', ptBR: 'Adicionar à lista de espera do ITAD' },
  yourNotes: { en: 'Your notes:', he: 'ההערות שלך:', ru: 'Ваши заметки:', de: 'Deine Notizen:', ptBR: 'Suas notas:' },
  notesPlaceholder: { en: 'Private notes (saved locally)…', he: 'הערות פרטיות (נשמרות מקומית)…', ru: 'Личные заметки (хранятся локально)…', de: 'Private Notizen (lokal gespeichert)…', ptBR: 'Notas privadas (salvas localmente)…' },
  onWishlist: { en: 'On your wishlist', he: 'ברשימת המשאלות שלך', ru: 'В вашем списке желаемого', de: 'Auf deiner Wunschliste', ptBR: 'Na sua lista de desejos' },
  owned: { en: 'OWNED', he: 'בבעלות', ru: 'В НАЛИЧИИ', de: 'IM BESITZ', ptBR: 'POSSUÍDO' },
  wishlist: { en: 'WISHLIST', he: 'במשאלות', ru: 'ЖЕЛАЕМОЕ', de: 'WUNSCHLISTE', ptBR: 'DESEJADO' },
  ignored: { en: 'IGNORED', he: 'התעלמת', ru: 'ИГНОРИРУЕТСЯ', de: 'IGNORIERT', ptBR: 'IGNORADO' },
  earlyAccess: { en: 'EARLY ACCESS', he: 'גישה מוקדמת', ru: 'РАННИЙ ДОСТУП', de: 'EARLY ACCESS', ptBR: 'ACESSO ANTECIPADO' },
  comingSoon: { en: 'COMING SOON', he: 'בקרוב', ru: 'СКОРО', de: 'DEMNÄCHST', ptBR: 'EM BREVE' },
  priceDrop: { en: 'PRICE DROP', he: 'ירידת מחיר', ru: 'СНИЖЕНИЕ ЦЕНЫ', de: 'PREISSENKUNG', ptBR: 'QUEDA DE PREÇO' },
  valueMismatch: { en: 'VALUE MISMATCH', he: 'פער שווי', ru: 'НЕРАВНОЦЕННЫЙ ОБМЕН', de: 'WERTUNTERSCHIED', ptBR: 'VALOR DESIGUAL' },
  drm: { en: 'DRM:', he: 'DRM:', ru: 'DRM:', de: 'DRM:', ptBR: 'DRM:' },
  topTags: { en: 'Top tags:', he: 'תגיות מובילות:', ru: 'Популярные теги:', de: 'Top-Tags:', ptBR: 'Principais tags:' },
  filterReviews: { en: 'Quick review filters:', he: 'פילטרי ביקורות מהירים:', ru: 'Быстрые фильтры обзоров:', de: 'Schnelle Rezensionsfilter:', ptBR: 'Filtros rápidos de avaliação:' },
  exportCsv: { en: 'Export CSV', he: 'ייצא CSV', ru: 'Экспорт в CSV', de: 'CSV exportieren', ptBR: 'Exportar CSV' },
  exportJson: { en: 'Export JSON', he: 'ייצא JSON', ru: 'Экспорт в JSON', de: 'JSON exportieren', ptBR: 'Exportar JSON' },
  copyAsText: { en: 'Copy as text', he: 'העתק כטקסט', ru: 'Копировать как текст', de: 'Als Text kopieren', ptBR: 'Copiar como texto' },
  openOnItad: { en: 'Open on ITAD', he: 'פתח ב-ITAD', ru: 'Открыть на ITAD', de: 'Auf ITAD öffnen', ptBR: 'Abrir no ITAD' },
  sortByDeal: { en: 'Sort: best deal vs low', he: 'מיון: הקרוב לשפל', ru: 'Сортировка: близость к минимуму', de: 'Sortieren: bester Deal vs. Tiefstpreis', ptBR: 'Ordenar: melhor oferta vs. mínimo' },
  sortByPrice: { en: 'Sort: price ↑', he: 'מיון: מחיר ↑', ru: 'Сортировка: цена ↑', de: 'Sortieren: Preis ↑', ptBR: 'Ordenar: preço ↑' },
  estimateValue: { en: 'Estimate value', he: 'אמוד שווי', ru: 'Оценить стоимость', de: 'Wert schätzen', ptBR: 'Estimar valor' },
  findDuplicates: { en: 'Find duplicates', he: 'מצא כפילויות', ru: 'Найти дубликаты', de: 'Duplikate finden', ptBR: 'Encontrar duplicatas' },
  markDuplicates: { en: 'Mark duplicates', he: 'סמן כפילויות', ru: 'Отметить дубликаты', de: 'Duplikate markieren', ptBR: 'Marcar duplicatas' },
  cardSetProgress: { en: 'Card set progress', he: 'התקדמות סטי קלפים', ru: 'Прогресс наборов карточек', de: 'Kartenset-Fortschritt', ptBR: 'Progresso do conjunto de cartas' },
  filterByName: { en: 'Filter by name…', he: 'סינון לפי שם…', ru: 'Фильтр по названию…', de: 'Nach Name filtern…', ptBR: 'Filtrar por nome…' },
  tradeSummary: { en: 'Trade summary (estimated)', he: 'סיכום עסקה (אומדן)', ru: 'Сводка обмена (оценка)', de: 'Tausch-Übersicht (geschätzt)', ptBR: 'Resumo da troca (estimado)' },
  youOffer: { en: 'You offer', he: 'אתה מציע', ru: 'Вы предлагаете', de: 'Du bietest', ptBR: 'Você oferece' },
  theyOffer: { en: 'They offer', he: 'הם מציעים', ru: 'Вам предлагают', de: 'Gegenüber bietet', ptBR: 'Eles oferecem' },
  difference: { en: 'Difference', he: 'הפרש', ru: 'Разница', de: 'Differenz', ptBR: 'Diferença' },
  settings: { en: 'Settings', he: 'הגדרות', ru: 'Настройки', de: 'Einstellungen', ptBR: 'Configurações' },
  save: { en: 'Save', he: 'שמור', ru: 'Сохранить', de: 'Speichern', ptBR: 'Salvar' },
  reset: { en: 'Reset to defaults', he: 'אפס לברירת מחדל', ru: 'Сбросить настройки', de: 'Auf Standard zurücksetzen', ptBR: 'Restaurar padrão' },
  clearCache: { en: 'Clear cache', he: 'נקה מטמון', ru: 'Очистить кэш', de: 'Cache leeren', ptBR: 'Limpar cache' },
  exportSettings: { en: 'Export settings', he: 'ייצא הגדרות', ru: 'Экспорт настроек', de: 'Einstellungen exportieren', ptBR: 'Exportar configurações' },
  importSettings: { en: 'Import settings', he: 'ייבא הגדרות', ru: 'Импорт настроек', de: 'Einstellungen importieren', ptBR: 'Importar configurações' },
  viewOnMarket: { en: 'View on Market', he: 'צפה ב-Market', ru: 'Открыть на площадке', de: 'Im Markt ansehen', ptBR: 'Ver no Mercado' },
  remainingCardDrops: { en: 'Your remaining card drops', he: 'drops קלפים שנותרו', ru: 'Оставшиеся карточки', de: 'Verbleibende Kartendrops', ptBR: 'Cartas restantes para dropar' },
  openStore: { en: 'Open Steam Store', he: 'פתח את חנות Steam', ru: 'Открыть магазин Steam', de: 'Steam Store öffnen', ptBR: 'Abrir a Steam Store' },
  myWishlist: { en: 'My Wishlist', he: 'רשימת המשאלות שלי', ru: 'Мой список желаемого', de: 'Meine Wunschliste', ptBR: 'Minha lista de desejos' },
  myInventory: { en: 'My Inventory', he: 'המלאי שלי', ru: 'Мой инвентарь', de: 'Mein Inventar', ptBR: 'Meu inventário' },
  tShowLowest: { en: 'Show lowest prices', he: 'הצג מחירים נמוכים', ru: 'Показывать минимальные цены', de: 'Niedrigste Preise anzeigen', ptBR: 'Mostrar preços mais baixos' },
  tHighlightOwned: { en: 'Highlight owned games', he: 'הדגש משחקים בבעלות', ru: 'Выделять игры в наличии', de: 'Besessene Spiele hervorheben', ptBR: 'Destacar jogos possuídos' },
  tHighlightWish: { en: 'Highlight wishlisted', he: 'הדגש משחקים במשאלות', ru: 'Выделять из списка желаемого', de: 'Wunschliste hervorheben', ptBR: 'Destacar lista de desejos' },
  tHideIgnored: { en: 'Hide ignored in search', he: "הסתר 'התעלמתי' בחיפוש", ru: 'Скрывать игнорируемое в поиске', de: 'Ignorierte in Suche ausblenden', ptBR: 'Ocultar ignorados na busca' },
  tShowProton: { en: 'Show ProtonDB rating', he: 'הצג דירוג ProtonDB', ru: 'Показывать рейтинг ProtonDB', de: 'ProtonDB-Bewertung anzeigen', ptBR: 'Mostrar avaliação do ProtonDB' },
  tShowRegional: { en: 'Show regional prices', he: 'הצג מחירים אזוריים', ru: 'Показывать региональные цены', de: 'Regionale Preise anzeigen', ptBR: 'Mostrar preços regionais' },
  tNotifyDeals: { en: 'Notify on wishlist deals', he: 'התרעות על מבצעים ברשימת משאלות', ru: 'Уведомлять о скидках из списка желаемого', de: 'Bei Wunschlisten-Angeboten benachrichtigen', ptBR: 'Notificar ofertas da lista de desejos' },
  allSettings: { en: 'All settings…', he: 'כל ההגדרות…', ru: 'Все настройки…', de: 'Alle Einstellungen…', ptBR: 'Todas as configurações…' },
  optSubtitle: { en: 'All settings. Changes apply on next page load.', he: 'כל ההגדרות. שינויים חלים בטעינת הדף הבאה.', ru: 'Все настройки. Изменения вступят в силу при следующей загрузке страницы.', de: 'Alle Einstellungen. Änderungen gelten beim nächsten Laden der Seite.', ptBR: 'Todas as configurações. As alterações se aplicam no próximo carregamento da página.' },
  secRegion: { en: 'Region', he: 'אזור', ru: 'Регион', de: 'Region', ptBR: 'Região' },
  secStore: { en: 'Store pages', he: 'דפי חנות', ru: 'Страницы магазина', de: 'Store-Seiten', ptBR: 'Páginas da loja' },
  secSearch: { en: 'Search & lists', he: 'חיפוש ורשימות', ru: 'Поиск и списки', de: 'Suche & Listen', ptBR: 'Busca e listas' },
  secMarket: { en: 'Market, Inventory, Trade', he: 'Market, מלאי ועסקאות', ru: 'Площадка, инвентарь, обмен', de: 'Markt, Inventar, Handel', ptBR: 'Mercado, inventário, trocas' },
  secNotify: { en: 'Notifications', he: 'התראות', ru: 'Уведомления', de: 'Benachrichtigungen', ptBR: 'Notificações' },
  secAdvanced: { en: 'Advanced', he: 'מתקדם', ru: 'Дополнительно', de: 'Erweitert', ptBR: 'Avançado' },
  importExportNote: { en: 'Export or import all settings, notes and blocklist as JSON.', he: 'ייצא או ייבא את כל ההגדרות, ההערות והחסימות כ-JSON.', ru: 'Экспорт или импорт всех настроек, заметок и чёрного списка в формате JSON.', de: 'Alle Einstellungen, Notizen und die Sperrliste als JSON exportieren oder importieren.', ptBR: 'Exportar ou importar todas as configurações, notas e lista de bloqueio como JSON.' },

  // --- v1.4.0 additions ---
  checkingDeals: { en: 'Checking deals…', he: 'בודק מבצעים…', ru: 'Проверка предложений…', de: 'Angebote werden geprüft…', ptBR: 'Verificando ofertas…' },
  noDealData: { en: 'No deal data', he: 'אין נתוני מבצע', ru: 'Нет данных о цене', de: 'Keine Preisdaten', ptBR: 'Sem dados de preço' },
  needsItadKeyMsg: { en: 'Add a free IsThereAnyDeal API key to see prices.', he: 'הוסף מפתח API חינמי של IsThereAnyDeal כדי לראות מחירים.', ru: 'Добавьте бесплатный API-ключ IsThereAnyDeal, чтобы видеть цены.', de: 'Füge einen kostenlosen IsThereAnyDeal-API-Schlüssel hinzu, um Preise zu sehen.', ptBR: 'Adicione uma chave de API gratuita do IsThereAnyDeal para ver os preços.' },
  openOptionsLink: { en: 'Open settings →', he: 'פתח הגדרות →', ru: 'Открыть настройки →', de: 'Einstellungen öffnen →', ptBR: 'Abrir configurações →' },
  setPricePerAlerts: { en: 'set per-price alerts', he: 'הגדר התראות לפי מחיר', ru: 'настройка оповещений о цене', de: 'preisbasierte Alarme einrichten', ptBR: 'definir alertas de preço' },
  protonDbLabel: { en: 'ProtonDB:', he: 'ProtonDB:', ru: 'ProtonDB:', de: 'ProtonDB:', ptBR: 'ProtonDB:' },
  reportsWord: { en: 'reports', he: 'דיווחים', ru: 'отчётов', de: 'Berichte', ptBR: 'relatórios' },
  hltbLabel: { en: 'HowLongToBeat:', he: 'HowLongToBeat:', ru: 'HowLongToBeat:', de: 'HowLongToBeat:', ptBR: 'HowLongToBeat:' },
  searchWord: { en: 'Search', he: 'חיפוש', ru: 'Поиск', de: 'Suchen', ptBR: 'Buscar' },
  easiestWord: { en: 'easiest', he: 'הקל ביותר', ru: 'самое лёгкое', de: 'einfachste', ptBR: 'mais fácil' },
  rarestWord: { en: 'rarest', he: 'הנדיר ביותר', ru: 'самое редкое', de: 'seltenste', ptBR: 'mais raro' },
  positiveWord: { en: 'positive', he: 'חיוביות', ru: 'положительных', de: 'positiv', ptBR: 'positivas' },
  negativeWord: { en: 'negative', he: 'שליליות', ru: 'отрицательных', de: 'negativ', ptBR: 'negativas' },
  cardsMarket: { en: 'Cards market', he: 'שוק קלפים', ru: 'Рынок карточек', de: 'Kartenmarkt', ptBR: 'Mercado de cartas' },
  earlyAccessDesc: { en: 'This game is in active development.', he: 'המשחק הזה בפיתוח פעיל.', ru: 'Эта игра находится в активной разработке.', de: 'Dieses Spiel befindet sich in aktiver Entwicklung.', ptBR: 'Este jogo está em desenvolvimento ativo.' },
  comingSoonDesc: { en: 'Not released yet.', he: 'עדיין לא יצא.', ru: 'Ещё не вышла.', de: 'Noch nicht veröffentlicht.', ptBR: 'Ainda não foi lançado.' },
  thirdPartyDrm: { en: '3rd-party DRM', he: 'DRM צד שלישי', ru: 'Стороннее DRM', de: 'DRM von Drittanbietern', ptBR: 'DRM de terceiros' },
  reloadWithFilter: { en: 'Reload with filter:', he: 'טען מחדש עם פילטר:', ru: 'Перезагрузить с фильтром:', de: 'Mit Filter neu laden:', ptBR: 'Recarregar com filtro:' },
  allLanguages: { en: 'All languages', he: 'כל השפות', ru: 'Все языки', de: 'Alle Sprachen', ptBR: 'Todos os idiomas' },
  recentOnly: { en: 'Recent only', he: 'רק אחרונות', ru: 'Только недавние', de: 'Nur aktuelle', ptBR: 'Somente recentes' },
  positiveOnly: { en: 'Positive only', he: 'רק חיוביות', ru: 'Только положительные', de: 'Nur positive', ptBR: 'Somente positivas' },
  negativeOnly: { en: 'Negative only', he: 'רק שליליות', ru: 'Только отрицательные', de: 'Nur negative', ptBR: 'Somente negativas' },
  minHrsPlaceholder: { en: 'min hrs', he: 'שעות מינ׳', ru: 'мин. часов', de: 'Min. Std.', ptBR: 'horas mín.' },
  minWordsPlaceholder: { en: 'min words', he: 'מילים מינ׳', ru: 'мин. слов', de: 'Min. Wörter', ptBR: 'palavras mín.' },
  anyRecommendation: { en: 'Any recommendation', he: 'כל המלצה', ru: 'Любая рекомендация', de: 'Beliebige Empfehlung', ptBR: 'Qualquer recomendação' },
  recommendedOnly: { en: 'Recommended only', he: 'מומלץ בלבד', ru: 'Только рекомендованные', de: 'Nur empfohlen', ptBR: 'Somente recomendados' },
  notRecommendedOnly: { en: 'Not recommended only', he: 'לא מומלץ בלבד', ru: 'Только нерекомендованные', de: 'Nur nicht empfohlen', ptBR: 'Somente não recomendados' },
  liveFilterLabel: { en: 'Live filter loaded reviews:', he: 'סינון חי של ביקורות טעונות:', ru: 'Живой фильтр загруженных обзоров:', de: 'Live-Filter für geladene Rezensionen:', ptBR: 'Filtro em tempo real das avaliações carregadas:' },
  applyWord: { en: 'Apply', he: 'החל', ru: 'Применить', de: 'Anwenden', ptBR: 'Aplicar' },
  resetWord: { en: 'Reset', he: 'איפוס', ru: 'Сбросить', de: 'Zurücksetzen', ptBR: 'Redefinir' },
  shownWord: { en: 'shown', he: 'מוצגות', ru: 'показано', de: 'angezeigt', ptBR: 'exibidas' },
  noReviewCardsYet: { en: 'No review cards found on this page yet.', he: 'לא נמצאו כרטיסי ביקורת בדף זה עדיין.', ru: 'На этой странице пока нет карточек обзоров.', de: 'Auf dieser Seite wurden noch keine Rezensionen gefunden.', ptBR: 'Nenhuma avaliação encontrada nesta página ainda.' },
  alreadyOwnedInPackage: { en: 'Already owned in package:', he: 'כבר בבעלותך בחבילה:', ru: 'Уже в наличии из набора:', de: 'Bereits im Paket enthalten:', ptBR: 'Já possuído no pacote:' },
  lowWord: { en: 'low', he: 'שפל', ru: 'минимум', de: 'Tief', ptBR: 'mínimo' },
  priceHistoryLabel: { en: 'Price history:', he: 'היסטוריית מחיר:', ru: 'История цен:', de: 'Preisverlauf:', ptBR: 'Histórico de preços:' },
  boosterPackCreator: { en: 'Booster pack creator', he: 'יצירת booster pack', ru: 'Создание бустер-паков', de: 'Booster-Pack-Ersteller', ptBR: 'Criador de pacotes de reforço' },
  foilCards: { en: 'Foil cards', he: 'קלפי Foil', ru: 'Фольгированные карточки', de: 'Foil-Karten', ptBR: 'Cartas foil' },
  bundleMath: { en: 'Bundle math:', he: 'חישוב Bundle:', ru: 'Расчёт набора:', de: 'Bundle-Rechnung:', ptBR: 'Cálculo do pacote:' },
  itemsSeparately: { en: 'items separately', he: 'פריטים בנפרד', ru: 'товаров по отдельности', de: 'Artikel einzeln', ptBR: 'itens separadamente' },
  vsBundle: { en: 'vs bundle', he: 'מול Bundle', ru: 'против набора', de: 'vs. Bundle', ptBR: 'vs. pacote' },
  saveWord: { en: 'SAVE', he: 'חיסכון', ru: 'ЭКОНОМИЯ', de: 'SPARE', ptBR: 'ECONOMIZE' },
  inBundle: { en: 'in bundle', he: 'ב-Bundle', ru: 'в наборе', de: 'im Bundle', ptBR: 'no pacote' },
  bundleNotCheaper: { en: 'bundle is not cheaper here', he: 'ה-Bundle לא זול יותר כאן', ru: 'набор здесь не выгоднее', de: 'Bundle ist hier nicht günstiger', ptBR: 'o pacote não é mais barato aqui' },
  alertMeAt: { en: 'Alert me at:', he: 'התרע לי במחיר:', ru: 'Оповестить при цене:', de: 'Benachrichtige mich bei:', ptBR: 'Avise-me em:' },
  alertMeAtPlaceholder: { en: 'alert me at…', he: 'התרע לי במחיר…', ru: 'оповестить при…', de: 'benachrichtige bei…', ptBR: 'avise-me em…' },
  alertCheckedHourly: { en: 'checked hourly — enable in Options → Notifications', he: 'נבדק כל שעה — הפעל באפשרויות ← התראות', ru: 'проверяется ежечасно — включите в Настройки → Уведомления', de: 'stündlich geprüft — aktivieren unter Optionen → Benachrichtigungen', ptBR: 'verificado a cada hora — ative em Opções → Notificações' },
  mostHelpfulReview: { en: 'Most helpful review', he: 'הביקורת המועילה ביותר', ru: 'Самый полезный обзор', de: 'Hilfreichste Rezension', ptBR: 'Avaliação mais útil' },
  foundHelpfulWord: { en: 'found it helpful', he: 'מצאו אותה מועילה', ru: 'сочли полезным', de: 'fanden das hilfreich', ptBR: 'acharam útil' },
  possibleReviewBomb: { en: 'POSSIBLE REVIEW BOMB', he: 'ייתכן וזו הצפת ביקורות שליליות', ru: 'ВОЗМОЖНАЯ ВОЛНА НЕГАТИВНЫХ ОБЗОРОВ', de: 'MÖGLICHE REZENSIONS-BOMBE', ptBR: 'POSSÍVEL AVALANCHE DE AVALIAÇÕES NEGATIVAS' },
  last3Days: { en: 'last 3 days', he: '3 הימים האחרונים', ru: 'последние 3 дня', de: 'letzte 3 Tage', ptBR: 'últimos 3 dias' },
  negativeVs: { en: 'negative vs', he: 'שליליות מול', ru: 'отрицательных против', de: 'negativ vs.', ptBR: 'negativas vs.' },
  baselineWord: { en: 'baseline', he: 'קו בסיס', ru: 'базовый уровень', de: 'Basiswert', ptBR: 'referência' },
  ownedByFriends: { en: 'Owned by friends:', he: 'בבעלות חברים:', ru: 'Есть у друзей:', de: 'Von Freunden besessen:', ptBR: 'Possuído por amigos:' },
  ofWord: { en: 'of', he: 'מתוך', ru: 'из', de: 'von', ptBR: 'de' },
  friendsCheckedSampled: { en: 'friends checked (sampled, private profiles excluded)', he: 'חברים נבדקו (מדגם, פרופילים פרטיים לא נכללים)', ru: 'друзей проверено (выборка, приватные профили не учтены)', de: 'Freunde geprüft (Stichprobe, private Profile ausgeschlossen)', ptBR: 'amigos verificados (amostra, perfis privados excluídos)' },
  sinceLastVisit: { en: 'since your last visit', he: 'מאז הביקור האחרון שלך', ru: 'с момента вашего последнего визита', de: 'seit deinem letzten Besuch', ptBR: 'desde sua última visita' },
  bundleSavings: { en: 'Bundle savings', he: 'חיסכון ב-Bundle', ru: 'Экономия в наборе', de: 'Bundle-Ersparnis', ptBR: 'Economia no pacote' },

  // Search/wishlist
  hideForeverTitle: { en: 'Hide forever (extension blocklist)', he: 'הסתר לצמיתות (רשימת חסימה של התוסף)', ru: 'Скрыть навсегда (чёрный список расширения)', de: 'Für immer ausblenden (Sperrliste der Erweiterung)', ptBR: 'Ocultar para sempre (lista de bloqueio da extensão)' },
  visibleWord: { en: 'visible', he: 'מוצגות', ru: 'видно', de: 'sichtbar', ptBR: 'visíveis' },
  copiedToClipboard: { en: 'Copied wishlist to clipboard.', he: 'רשימת המשאלות הועתקה ללוח.', ru: 'Список желаемого скопирован в буфер обмена.', de: 'Wunschliste in die Zwischenablage kopiert.', ptBR: 'Lista de desejos copiada para a área de transferência.' },
  nothingToOpen: { en: 'Nothing to open.', he: 'אין מה לפתוח.', ru: 'Нечего открывать.', de: 'Nichts zu öffnen.', ptBR: 'Nada para abrir.' },
  vsLow: { en: 'vs low', he: 'מול השפל', ru: 'от минимума', de: 'vs. Tief', ptBR: 'vs. mínimo' },
  targetWord: { en: 'target', he: 'יעד', ru: 'цель', de: 'Ziel', ptBR: 'meta' },
  atTarget: { en: 'AT TARGET', he: 'ביעד', ru: 'ЦЕЛЬ ДОСТИГНУТА', de: 'ZIEL ERREICHT', ptBR: 'NA META' },

  // Market
  marketQuickTools: { en: 'Market quick tools', he: 'כלים מהירים ל-Market', ru: 'Быстрые инструменты площадки', de: 'Markt-Schnellwerkzeuge', ptBR: 'Ferramentas rápidas do mercado' },
  undercutBtn: { en: 'Undercut', he: 'תמחור מתחת', ru: 'Демпинг', de: 'Unterbieten', ptBR: 'Baixar preço' },
  copyHashBtn: { en: 'Copy hash name', he: 'העתק hash name', ru: 'Копировать hash-имя', de: 'Hash-Namen kopieren', ptBR: 'Copiar nome hash' },
  openSteamDbBtn: { en: 'Open SteamDB', he: 'פתח SteamDB', ru: 'Открыть SteamDB', de: 'SteamDB öffnen', ptBR: 'Abrir SteamDB' },
  salesSummaryBtn: { en: 'Sales summary', he: 'סיכום מכירות', ru: 'Сводка продаж', de: 'Verkaufsübersicht', ptBR: 'Resumo de vendas' },
  buyOrderHelperBtn: { en: 'Buy-order helper', he: 'עוזר הזמנת קנייה', ru: 'Помощник ордеров на покупку', de: 'Kaufauftrags-Helfer', ptBR: 'Assistente de ordem de compra' },
  currencyConverter: { en: 'Currency converter', he: 'ממיר מטבעות', ru: 'Конвертер валют', de: 'Währungsrechner', ptBR: 'Conversor de moeda' },
  convertBtn: { en: 'Convert', he: 'המר', ru: 'Конвертировать', de: 'Umrechnen', ptBR: 'Converter' },
  priceHistoryChart: { en: 'Market price history', he: 'היסטוריית מחיר ב-Market', ru: 'История цен на площадке', de: 'Markt-Preisverlauf', ptBR: 'Histórico de preços do mercado' },
  needsLoginForChart: { en: 'Sign in to Steam to see this chart.', he: 'התחבר ל-Steam כדי לראות את הגרף.', ru: 'Войдите в Steam, чтобы увидеть график.', de: 'Melde dich bei Steam an, um dieses Diagramm zu sehen.', ptBR: 'Faça login na Steam para ver este gráfico.' },

  // Inventory
  valueHistoryBtn: { en: 'Value history', he: 'היסטוריית שווי', ru: 'История стоимости', de: 'Wertverlauf', ptBR: 'Histórico de valor' },
  sortByValueBtn: { en: 'Sort by value ↓', he: 'מיון לפי שווי ↓', ru: 'Сортировка по стоимости ↓', de: 'Nach Wert sortieren ↓', ptBR: 'Ordenar por valor ↓' },
  groupByTypeBtn: { en: 'Group by type', he: 'קיבוץ לפי סוג', ru: 'Группировать по типу', de: 'Nach Typ gruppieren', ptBR: 'Agrupar por tipo' },
  rarityBreakdownBtn: { en: 'Rarity/quality breakdown', he: 'פירוט לפי נדירות/איכות', ru: 'Разбивка по редкости/качеству', de: 'Seltenheit/Qualität-Aufschlüsselung', ptBR: 'Detalhamento por raridade/qualidade' },
  massListBtn: { en: 'Mass-list at median…', he: 'רישום המוני לפי חציון…', ru: 'Массовое выставление по медиане…', de: 'Massen-Angebot zum Median…', ptBR: 'Listar em massa pela mediana…' },
  selectItemsBtn: { en: 'Select items to sell', he: 'בחר פריטים למכירה', ru: 'Выбрать предметы для продажи', de: 'Artikel zum Verkauf auswählen', ptBR: 'Selecionar itens para vender' },
  selectingBtn: { en: 'Selecting… (click to stop)', he: 'בוחר… (לחץ לעצירה)', ru: 'Выбор… (нажмите, чтобы остановить)', de: 'Auswahl läuft… (zum Stoppen klicken)', ptBR: 'Selecionando… (clique para parar)' },
  listSelectedBtn: { en: 'List selected…', he: 'רשום את הנבחרים…', ru: 'Выставить выбранное…', de: 'Auswahl anbieten…', ptBR: 'Listar selecionados…' },
  cs2StickerBtn: { en: 'CS2 sticker prices', he: 'מחירי מדבקות CS2', ru: 'Цены на наклейки CS2', de: 'CS2-Sticker-Preise', ptBR: 'Preços de adesivos CS2' },
  exportJsonBtn: { en: 'Export JSON', he: 'ייצא JSON', ru: 'Экспорт в JSON', de: 'JSON exportieren', ptBR: 'Exportar JSON' },

  // Trade offer
  checkSteamRep: { en: 'Check on SteamRep', he: 'בדוק ב-SteamRep', ru: 'Проверить на SteamRep', de: 'Auf SteamRep prüfen', ptBR: 'Verificar no SteamRep' },
  holdToConfirmTitle: { en: 'Hold for 2 seconds to confirm', he: 'החזק 2 שניות לאישור', ru: 'Удерживайте 2 секунды для подтверждения', de: '2 Sekunden halten zum Bestätigen', ptBR: 'Segure por 2 segundos para confirmar' },
  holdToConfirmTrade: { en: 'Hold to confirm trade', he: 'החזק לאישור העסקה', ru: 'Удерживайте для подтверждения обмена', de: 'Halten, um Tausch zu bestätigen', ptBR: 'Segure para confirmar a troca' },
  useNormalButton: { en: 'use normal button', he: 'השתמש בכפתור הרגיל', ru: 'использовать обычную кнопку', de: 'normalen Button verwenden', ptBR: 'usar botão normal' },
  countingItems: { en: 'Counting items…', he: 'סופר פריטים…', ru: 'Подсчёт предметов…', de: 'Artikel werden gezählt…', ptBR: 'Contando itens…' },
  itemsWord: { en: 'items', he: 'פריטים', ru: 'предметов', de: 'Artikel', ptBR: 'itens' },
  estWord: { en: 'est.', he: 'אומדן', ru: 'оценка', de: 'geschätzt', ptBR: 'estimado' },
  reviewCarefully: { en: 'Review carefully before accepting.', he: 'בדוק בעיון לפני אישור.', ru: 'Внимательно проверьте перед принятием.', de: 'Vor dem Annehmen sorgfältig prüfen.', ptBR: 'Revise com cuidado antes de aceitar.' },

  // Profile / library / badges
  libraryLastSeen: { en: 'Library (last seen):', he: 'ספרייה (נראתה לאחרונה):', ru: 'Библиотека (последний раз видели):', de: 'Bibliothek (zuletzt gesehen):', ptBR: 'Biblioteca (visto por último):' },
  gamesWord: { en: 'games', he: 'משחקים', ru: 'игр', de: 'Spiele', ptBR: 'jogos' },
  hoursTotal: { en: 'hours total', he: 'שעות בסך הכל', ru: 'часов всего', de: 'Stunden insgesamt', ptBR: 'horas no total' },
  atCurrentPrices: { en: 'at current prices', he: 'לפי מחירים נוכחיים', ru: 'по текущим ценам', de: 'zu aktuellen Preisen', ptBR: 'pelos preços atuais' },
  mediaLabel: { en: 'Media:', he: 'מדיה:', ru: 'Медиа:', de: 'Medien:', ptBR: 'Mídia:' },
  badgesLabel: { en: 'Badges:', he: 'Badges:', ru: 'Значки:', de: 'Abzeichen:', ptBR: 'Emblemas:' },
  badgesWord: { en: 'badges', he: 'badges', ru: 'значков', de: 'Abzeichen', ptBR: 'emblemas' },
  libraryWord: { en: 'Library', he: 'ספרייה', ru: 'Библиотека', de: 'Bibliothek', ptBR: 'Biblioteca' },
  sortPlaytimeDesc: { en: 'Sort: playtime ↓', he: 'מיון: זמן משחק ↓', ru: 'Сортировка: время игры ↓', de: 'Sortieren: Spielzeit ↓', ptBR: 'Ordenar: tempo de jogo ↓' },
  neverPlayedFirst: { en: 'Never played first', he: 'לא שוחקו קודם', ru: 'Неигранные сначала', de: 'Nie gespielte zuerst', ptBR: 'Nunca jogados primeiro' },
  sortAZ: { en: 'A → Z', he: 'א → ת', ru: 'А → Я', de: 'A → Z', ptBR: 'A → Z' },
  showUnplayedOnly: { en: 'Show unplayed only', he: 'הצג רק לא-משוחקים', ru: 'Показать только неигранные', de: 'Nur ungespielte anzeigen', ptBR: 'Mostrar somente não jogados' },
  estimateLibraryValue: { en: 'Estimate library value', he: 'אמוד שווי ספרייה', ru: 'Оценить стоимость библиотеки', de: 'Bibliothekswert schätzen', ptBR: 'Estimar valor da biblioteca' },
  badgeSummaryThisPage: { en: 'badge summary (this page)', he: 'סיכום badges (עמוד זה)', ru: 'сводка значков (эта страница)', de: 'Abzeichen-Übersicht (diese Seite)', ptBR: 'resumo de emblemas (esta página)' },
  badgesShown: { en: 'badges shown', he: 'badges מוצגים', ru: 'значков показано', de: 'Abzeichen angezeigt', ptBR: 'emblemas exibidos' },
  withProgress: { en: 'with progress', he: 'עם התקדמות', ru: 'с прогрессом', de: 'mit Fortschritt', ptBR: 'com progresso' },
  totalWord: { en: 'total', he: 'סה"כ', ru: 'всего', de: 'insgesamt', ptBR: 'no total' },
  closestToNextLevel: { en: 'Closest to next level:', he: 'הקרובים ביותר לרמה הבאה:', ru: 'Ближе всего к следующему уровню:', de: 'Am nächsten am nächsten Level:', ptBR: 'Mais próximos do próximo nível:' },

  // Common.js
  fabTitle: { en: 'Steam Enhancer settings', he: 'הגדרות Steam Enhancer', ru: 'Настройки Steam Enhancer', de: 'Steam Enhancer-Einstellungen', ptBR: 'Configurações do Steam Enhancer' },
  gotIt: { en: 'Got it', he: 'הבנתי', ru: 'Понятно', de: 'Verstanden', ptBR: 'Entendi' },
  letsGo: { en: "Let's go", he: 'בואו נתחיל', ru: 'Начнём', de: "Los geht's", ptBR: 'Vamos lá' },
  welcomeTitle: { en: 'Welcome to Steam Enhancer', he: 'ברוכים הבאים ל-Steam Enhancer', ru: 'Добро пожаловать в Steam Enhancer', de: 'Willkommen bei Steam Enhancer', ptBR: 'Bem-vindo ao Steam Enhancer' },
  thanksForUpdating: { en: 'Thanks for updating!', he: 'תודה על העדכון!', ru: 'Спасибо за обновление!', de: 'Danke fürs Aktualisieren!', ptBR: 'Obrigado por atualizar!' },
  changelogItadKey: {
    en: 'Important: IsThereAnyDeal now requires a free API key for all price features. Get one at isthereanydeal.com/apps/my/ and paste it into Options → Region.',
    he: 'חשוב: IsThereAnyDeal דורש כעת מפתח API חינמי לכל פיצ׳רי המחיר. קבלו אחד ב-isthereanydeal.com/apps/my/ והדביקו באפשרויות ← אזור.',
    ru: 'Важно: IsThereAnyDeal теперь требует бесплатный API-ключ для всех функций цен. Получите его на isthereanydeal.com/apps/my/ и вставьте в Настройки → Регион.',
    de: 'Wichtig: IsThereAnyDeal benötigt jetzt einen kostenlosen API-Schlüssel für alle Preisfunktionen. Hol dir einen unter isthereanydeal.com/apps/my/ und füge ihn unter Optionen → Region ein.',
    ptBR: 'Importante: o IsThereAnyDeal agora exige uma chave de API gratuita para todos os recursos de preço. Obtenha uma em isthereanydeal.com/apps/my/ e cole em Opções → Região.'
  },

  // v1.5.0
  netWord: { en: 'you get', he: 'תקבל', ru: 'вы получите', de: 'du erhältst', ptBR: 'você recebe' },
  buyerPaysWord: { en: 'buyer pays', he: 'הקונה משלם', ru: 'покупатель платит', de: 'Käufer zahlt', ptBR: 'comprador paga' },
  youReceiveWord: { en: 'you receive', he: 'אתה מקבל', ru: 'вы получите', de: 'du erhältst', ptBR: 'você recebe' },
  walletUnknown: {
    en: 'Could not read your Steam wallet currency on this page, so nothing will be listed. Reload the inventory page while signed in and try again.',
    he: 'לא הצלחנו לקרוא את מטבע הארנק שלך ב-Steam בעמוד הזה, ולכן שום דבר לא יוצע למכירה. טען מחדש את עמוד המלאי כשאתה מחובר ונסה שוב.',
    ru: 'Не удалось определить валюту вашего кошелька Steam на этой странице, поэтому ничего не будет выставлено. Перезагрузите инвентарь, войдя в аккаунт, и попробуйте снова.',
    de: 'Die Währung deiner Steam-Geldbörse konnte auf dieser Seite nicht gelesen werden, daher wird nichts eingestellt. Lade das Inventar angemeldet neu und versuche es erneut.',
    ptBR: 'Não foi possível ler a moeda da sua carteira Steam nesta página, então nada será anunciado. Recarregue o inventário com a sessão iniciada e tente novamente.'
  },

  // v1.5.0 — strings that were hardcoded English in content scripts.
  // {0}, {1}… are filled in by SE.t(key, ...values).
  invSampling: {
    en: 'Sampling first 25 marketable items…',
    he: 'דוגם את 25 הפריטים הסחירים הראשונים…',
    ru: 'Оцениваем первые 25 продаваемых предметов…',
    de: 'Bewerte die ersten 25 handelbaren Gegenstände…',
    ptBR: 'Avaliando os primeiros 25 itens comercializáveis…'
  },
  invReadFailed: {
    en: 'Could not read inventory.',
    he: 'לא הצלחנו לקרוא את המלאי.',
    ru: 'Не удалось прочитать инвентарь.',
    de: 'Inventar konnte nicht gelesen werden.',
    ptBR: 'Não foi possível ler o inventário.'
  },
  invValueResult: {
    en: 'Sampled {0}/25 · avg ≈ {1} · {2} marketable · estimate ≈ {3}',
    he: 'נדגמו {0}/25 · ממוצע ≈ {1} · {2} סחירים · הערכה ≈ {3}',
    ru: 'Оценено {0}/25 · в среднем ≈ {1} · продаваемых: {2} · итого ≈ {3}',
    de: '{0}/25 bewertet · Ø ≈ {1} · {2} handelbar · Schätzung ≈ {3}',
    ptBR: '{0}/25 avaliados · média ≈ {1} · {2} comercializáveis · estimativa ≈ {3}'
  },
  invNoDuplicates: {
    en: 'No duplicates.',
    he: 'אין כפילויות.',
    ru: 'Дубликатов нет.',
    de: 'Keine Duplikate.',
    ptBR: 'Nenhuma duplicata.'
  },
  invMarkedDuplicates: {
    en: 'Marked {0} duplicate tiles in amber.',
    he: 'סומנו {0} כפילויות בכתום.',
    ru: 'Отмечено дубликатов: {0} (янтарным).',
    de: '{0} Duplikate bernsteinfarben markiert.',
    ptBR: '{0} duplicatas marcadas em âmbar.'
  },
  invNoCards: {
    en: 'No trading cards in current inventory view.',
    he: 'אין קלפי מסחר בתצוגת המלאי הנוכחית.',
    ru: 'В текущем инвентаре нет коллекционных карточек.',
    de: 'Keine Sammelkarten in der aktuellen Inventaransicht.',
    ptBR: 'Nenhuma carta colecionável na visualização atual do inventário.'
  },
  invNoTiles: {
    en: 'No inventory tiles found.',
    he: 'לא נמצאו פריטים במלאי.',
    ru: 'Предметы инвентаря не найдены.',
    de: 'Keine Inventar-Kacheln gefunden.',
    ptBR: 'Nenhum item do inventário encontrado.'
  },
  invPricingForSort: {
    en: 'Pricing tiles for sort (first 60)…',
    he: 'מתמחר פריטים למיון (60 הראשונים)…',
    ru: 'Оцениваем предметы для сортировки (первые 60)…',
    de: 'Bewerte Kacheln zum Sortieren (die ersten 60)…',
    ptBR: 'Precificando itens para ordenar (os primeiros 60)…'
  },
  invSorted: {
    en: 'Sorted {0} tiles by estimated value (highest first).',
    he: 'מוינו {0} פריטים לפי ערך משוער (מהגבוה לנמוך).',
    ru: 'Отсортировано предметов: {0} по оценочной стоимости (сначала дорогие).',
    de: '{0} Kacheln nach geschätztem Wert sortiert (höchster zuerst).',
    ptBR: '{0} itens ordenados por valor estimado (maior primeiro).'
  },
  invGrouped: {
    en: 'Grouped {0} tiles into {1} type(s): {2}',
    he: 'קובצו {0} פריטים ל-{1} סוגים: {2}',
    ru: 'Сгруппировано предметов: {0}, типов: {1}: {2}',
    de: '{0} Kacheln in {1} Typ(en) gruppiert: {2}',
    ptBR: '{0} itens agrupados em {1} tipo(s): {2}'
  },
  invNoRarity: {
    en: 'No rarity/quality tags found on items in this inventory.',
    he: 'לא נמצאו תגיות נדירות/איכות בפריטי המלאי הזה.',
    ru: 'У предметов этого инвентаря нет меток редкости/качества.',
    de: 'Keine Seltenheits-/Qualitäts-Tags in diesem Inventar gefunden.',
    ptBR: 'Nenhuma etiqueta de raridade/qualidade nos itens deste inventário.'
  },
  invSelectionOn: {
    en: 'Selection mode on — {0} selected',
    he: 'מצב בחירה פעיל — {0} נבחרו',
    ru: 'Режим выбора — выбрано: {0}',
    de: 'Auswahlmodus an — {0} ausgewählt',
    ptBR: 'Modo de seleção ativo — {0} selecionado(s)'
  },
  invNoneSelected: {
    en: 'No items selected. Click "Select items to sell", then click checkboxes on tiles.',
    he: 'לא נבחרו פריטים. לחץ על "בחר פריטים למכירה" ואז סמן את הפריטים.',
    ru: 'Ничего не выбрано. Нажмите «Выбрать предметы для продажи» и отметьте предметы.',
    de: 'Nichts ausgewählt. Klicke auf „Gegenstände zum Verkauf auswählen“ und hake dann Kacheln an.',
    ptBR: 'Nenhum item selecionado. Clique em "Selecionar itens para vender" e marque os itens.'
  },
  invNoneMarketableSelected: {
    en: 'None of the selected items are marketable.',
    he: 'אף אחד מהפריטים שנבחרו אינו סחיר.',
    ru: 'Ни один из выбранных предметов нельзя продать.',
    de: 'Keiner der ausgewählten Gegenstände ist handelbar.',
    ptBR: 'Nenhum dos itens selecionados é comercializável.'
  },
  invFewSnapshots: {
    en: 'Only {0} snapshot(s) so far — click "Estimate value" a few more times over the coming days to build a trend.',
    he: 'רק {0} תמונות מצב עד עכשיו — לחץ על "הערך שווי" עוד כמה פעמים בימים הקרובים כדי לבנות מגמה.',
    ru: 'Пока снимков: {0} — нажмите «Оценить стоимость» ещё несколько раз в ближайшие дни, чтобы построить график.',
    de: 'Bisher nur {0} Momentaufnahme(n) — klicke in den nächsten Tagen noch ein paar Mal auf „Wert schätzen“, um einen Verlauf aufzubauen.',
    ptBR: 'Apenas {0} registro(s) até agora — clique em "Estimar valor" mais algumas vezes nos próximos dias para formar uma tendência.'
  },
  invSnapshotsRecorded: {
    en: '{0} snapshots recorded from your own "Estimate value" clicks on this page.',
    he: 'נרשמו {0} תמונות מצב מהלחיצות שלך על "הערך שווי" בעמוד הזה.',
    ru: 'Снимков записано: {0} — по вашим нажатиям «Оценить стоимость» на этой странице.',
    de: '{0} Momentaufnahmen aus deinen Klicks auf „Wert schätzen“ auf dieser Seite.',
    ptBR: '{0} registros feitos a partir dos seus cliques em "Estimar valor" nesta página.'
  },
  invNoStickers: {
    en: 'No stickers visible (open your CS2 inventory).',
    he: 'לא נראות מדבקות (פתח את מלאי ה-CS2 שלך).',
    ru: 'Наклейки не видны (откройте инвентарь CS2).',
    de: 'Keine Sticker sichtbar (öffne dein CS2-Inventar).',
    ptBR: 'Nenhum adesivo visível (abra seu inventário do CS2).'
  },
  invNoMarketable: {
    en: 'No marketable items in current view.',
    he: 'אין פריטים סחירים בתצוגה הנוכחית.',
    ru: 'В текущем виде нет продаваемых предметов.',
    de: 'Keine handelbaren Gegenstände in der aktuellen Ansicht.',
    ptBR: 'Nenhum item comercializável na visualização atual.'
  },
  invDryRun: {
    en: 'Dry run — pricing {0} items (nothing listed yet)…',
    he: 'הרצת ניסיון — מתמחר {0} פריטים (שום דבר עוד לא הוצע למכירה)…',
    ru: 'Пробный прогон — оцениваем предметов: {0} (ничего не выставлено)…',
    de: 'Probelauf — bewerte {0} Gegenstände (noch nichts eingestellt)…',
    ptBR: 'Simulação — precificando {0} itens (nada anunciado ainda)…'
  },
  invNoMedian: {
    en: 'No items had a usable median price.',
    he: 'לאף פריט לא היה מחיר חציוני שמיש.',
    ru: 'Ни у одного предмета нет подходящей медианной цены.',
    de: 'Kein Gegenstand hatte einen brauchbaren Medianpreis.',
    ptBR: 'Nenhum item tinha um preço mediano utilizável.'
  },
  invConfirmMassList: {
    en: '⚠ Confirm: actually list these {0} items for sale',
    he: '⚠ אישור: להציע באמת את {0} הפריטים האלה למכירה',
    ru: '⚠ Подтвердить: выставить на продажу предметов: {0}',
    de: '⚠ Bestätigen: diese {0} Gegenstände wirklich zum Verkauf einstellen',
    ptBR: '⚠ Confirmar: anunciar de verdade estes {0} itens à venda'
  },
  invCancelHint: {
    en: 'You can cancel any listing from the Market page. Listings still need mobile-authenticator confirmation.',
    he: 'אפשר לבטל כל הצעה מעמוד ה-Market. ההצעות עדיין דורשות אישור במאמת הנייד.',
    ru: 'Любой лот можно снять на странице торговой площадки. Лоты всё равно нужно подтвердить в мобильном аутентификаторе.',
    de: 'Jedes Angebot lässt sich auf der Marktseite zurückziehen. Angebote müssen weiterhin im mobilen Authentifikator bestätigt werden.',
    ptBR: 'Você pode cancelar qualquer anúncio na página do Mercado. Os anúncios ainda precisam de confirmação no autenticador móvel.'
  },
  invPricingSelected: {
    en: 'Pricing {0} selected item(s) — edit prices below, nothing listed yet.',
    he: 'מתמחר {0} פריטים שנבחרו — ערוך את המחירים למטה, שום דבר עוד לא הוצע.',
    ru: 'Оцениваем выбранные предметы: {0} — исправьте цены ниже, пока ничего не выставлено.',
    de: 'Bewerte {0} ausgewählte(n) Gegenstand/Gegenstände — Preise unten anpassen, noch nichts eingestellt.',
    ptBR: 'Precificando {0} item(ns) selecionado(s) — edite os preços abaixo, nada anunciado ainda.'
  },
  invConfirmSelected: {
    en: '⚠ Confirm: list these {0} selected items',
    he: '⚠ אישור: להציע את {0} הפריטים שנבחרו',
    ru: '⚠ Подтвердить: выставить выбранные предметы ({0})',
    de: '⚠ Bestätigen: diese {0} ausgewählten Gegenstände einstellen',
    ptBR: '⚠ Confirmar: anunciar estes {0} itens selecionados'
  },
  invListing: {
    en: 'Listing…',
    he: 'מציע למכירה…',
    ru: 'Выставляем…',
    de: 'Wird eingestellt…',
    ptBR: 'Anunciando…'
  },
  invListedResult: {
    en: 'Listed {0}/{1}. Check the Market page and confirm via mobile authenticator.',
    he: 'הוצעו {0}/{1}. בדוק בעמוד ה-Market ואשר במאמת הנייד.',
    ru: 'Выставлено {0}/{1}. Проверьте торговую площадку и подтвердите в мобильном аутентификаторе.',
    de: '{0}/{1} eingestellt. Prüfe die Marktseite und bestätige im mobilen Authentifikator.',
    ptBR: '{0}/{1} anunciados. Confira a página do Mercado e confirme no autenticador móvel.'
  },
  medianWord: {
    en: 'median',
    he: 'חציון',
    ru: 'медиана',
    de: 'Median',
    ptBR: 'mediana'
  },
  libTotalHours: {
    en: 'Total: {0} hours',
    he: 'סה"כ: {0} שעות',
    ru: 'Всего: {0} ч',
    de: 'Gesamt: {0} Stunden',
    ptBR: 'Total: {0} horas'
  },
  libPricing: {
    en: 'Pricing {0}/{1} games (sampled)…',
    he: 'מתמחר {0}/{1} משחקים (מדגם)…',
    ru: 'Оцениваем игр: {0}/{1} (выборка)…',
    de: 'Bewerte {0}/{1} Spiele (Stichprobe)…',
    ptBR: 'Precificando {0}/{1} jogos (amostra)…'
  },
  libValueResult: {
    en: 'Sampled {0}/{1} · avg {2} · estimate ≈ {3} at CURRENT prices across {4} games (not what you paid — Steam doesn\'t expose purchase history)',
    he: 'נדגמו {0}/{1} · ממוצע {2} · הערכה ≈ {3} לפי המחירים הנוכחיים עבור {4} משחקים (לא מה ששילמת — Steam לא חושף היסטוריית רכישות)',
    ru: 'Оценено {0}/{1} · в среднем {2} · итого ≈ {3} по ТЕКУЩИМ ценам для {4} игр (не то, что вы заплатили — Steam не раскрывает историю покупок)',
    de: '{0}/{1} bewertet · Ø {2} · Schätzung ≈ {3} zu AKTUELLEN Preisen für {4} Spiele (nicht, was du bezahlt hast — Steam gibt keine Kaufhistorie heraus)',
    ptBR: '{0}/{1} avaliados · média {2} · estimativa ≈ {3} a preços ATUAIS para {4} jogos (não o que você pagou — a Steam não expõe o histórico de compras)'
  },
  libValueFailed: {
    en: 'Could not price any sampled games (all free-to-play or unavailable in {0}?).',
    he: 'לא הצלחנו לתמחר אף משחק מהמדגם (כולם חינמיים או לא זמינים ב-{0}?).',
    ru: 'Не удалось оценить ни одной игры из выборки (все бесплатные или недоступны в {0}?).',
    de: 'Kein Spiel der Stichprobe ließ sich bewerten (alle Free-to-Play oder in {0} nicht verfügbar?).',
    ptBR: 'Não foi possível precificar nenhum jogo da amostra (todos gratuitos ou indisponíveis em {0}?).'
  },
  mktNoListing: {
    en: 'No listing found.',
    he: 'לא נמצאה הצעה.',
    ru: 'Лоты не найдены.',
    de: 'Kein Angebot gefunden.',
    ptBR: 'Nenhum anúncio encontrado.'
  },
  mktLowestListing: {
    en: 'Lowest listing: {0}',
    he: 'ההצעה הזולה ביותר: {0}',
    ru: 'Самый дешёвый лот: {0}',
    de: 'Günstigstes Angebot: {0}',
    ptBR: 'Anúncio mais barato: {0}'
  },
  mktUndercutRow: {
    en: '-{0} → list {1} (you get ~{2})',
    he: '-{0} ← הצע ב-{1} (תקבל ~{2})',
    ru: '-{0} → выставить за {1} (вы получите ~{2})',
    de: '-{0} → für {1} einstellen (du erhältst ~{2})',
    ptBR: '-{0} → anunciar por {1} (você recebe ~{2})'
  },
  mktCopied: {
    en: 'Copied: {0}',
    he: 'הועתק: {0}',
    ru: 'Скопировано: {0}',
    de: 'Kopiert: {0}',
    ptBR: 'Copiado: {0}'
  },
  mktFetching: {
    en: 'Fetching…',
    he: 'טוען…',
    ru: 'Загрузка…',
    de: 'Wird geladen…',
    ptBR: 'Carregando…'
  },
  mktFetchFailed: {
    en: 'Could not fetch.',
    he: 'הטעינה נכשלה.',
    ru: 'Не удалось загрузить.',
    de: 'Laden fehlgeschlagen.',
    ptBR: 'Não foi possível carregar.'
  },
  mktLowestListed: {
    en: 'Lowest listed: {0}',
    he: 'המחיר הנמוך המוצע: {0}',
    ru: 'Минимальная цена: {0}',
    de: 'Niedrigster Preis: {0}',
    ptBR: 'Menor preço anunciado: {0}'
  },
  mktMedian24: {
    en: 'Median (24h): {0}',
    he: 'חציון (24 שעות): {0}',
    ru: 'Медиана (24 ч): {0}',
    de: 'Median (24 h): {0}',
    ptBR: 'Mediana (24h): {0}'
  },
  mktVolume24: {
    en: 'Volume (24h): {0}',
    he: 'נפח (24 שעות): {0}',
    ru: 'Объём (24 ч): {0}',
    de: 'Volumen (24 h): {0}',
    ptBR: 'Volume (24h): {0}'
  },
  mktNoOrderBookId: {
    en: 'Could not find this listing\'s order book id on the page.',
    he: 'לא נמצא בעמוד המזהה של ספר ההזמנות של הפריט.',
    ru: 'Не удалось найти на странице идентификатор книги заказов.',
    de: 'Die Orderbuch-ID dieses Angebots wurde auf der Seite nicht gefunden.',
    ptBR: 'Não foi possível encontrar o ID do livro de ofertas nesta página.'
  },
  mktFetchingOrderBook: {
    en: 'Fetching order book…',
    he: 'טוען את ספר ההזמנות…',
    ru: 'Загружаем книгу заказов…',
    de: 'Lade Orderbuch…',
    ptBR: 'Carregando livro de ofertas…'
  },
  mktOrderBookFailed: {
    en: 'Could not fetch order book.',
    he: 'טעינת ספר ההזמנות נכשלה.',
    ru: 'Не удалось загрузить книгу заказов.',
    de: 'Orderbuch konnte nicht geladen werden.',
    ptBR: 'Não foi possível carregar o livro de ofertas.'
  },
  mktHighestBuy: {
    en: 'Highest buy order: {0} ({1} orders)',
    he: 'הזמנת הקנייה הגבוהה: {0} ({1} הזמנות)',
    ru: 'Лучший запрос на покупку: {0} (запросов: {1})',
    de: 'Höchster Kaufauftrag: {0} ({1} Aufträge)',
    ptBR: 'Maior ordem de compra: {0} ({1} ordens)'
  },
  mktLowestSell: {
    en: 'Lowest sell listing: {0} ({1} listings)',
    he: 'הצעת המכירה הזולה: {0} ({1} הצעות)',
    ru: 'Самый дешёвый лот: {0} (лотов: {1})',
    de: 'Günstigstes Verkaufsangebot: {0} ({1} Angebote)',
    ptBR: 'Anúncio de venda mais barato: {0} ({1} anúncios)'
  },
  mktSuggestedBuy: {
    en: 'Suggested: place buy order at {0}',
    he: 'מומלץ: הזמנת קנייה ב-{0}',
    ru: 'Совет: запрос на покупку по {0}',
    de: 'Vorschlag: Kaufauftrag bei {0}',
    ptBR: 'Sugestão: ordem de compra em {0}'
  },
  mktSuggestedBuyWhy: {
    en: ' to lead the current queue by the minimum increment.',
    he: ' כדי לעקוף את התור הנוכחי בהפרש המינימלי.',
    ru: ' — так вы опередите очередь на минимальный шаг.',
    de: ' — damit führst du die Warteschlange mit dem kleinsten Schritt an.',
    ptBR: ' para liderar a fila atual pelo incremento mínimo.'
  },
  mktSpread: {
    en: 'Spread: {0}',
    he: 'מרווח: {0}',
    ru: 'Спред: {0}',
    de: 'Spanne: {0}',
    ptBR: 'Spread: {0}'
  },
  mktConverting: {
    en: 'Converting…',
    he: 'ממיר…',
    ru: 'Конвертируем…',
    de: 'Wird umgerechnet…',
    ptBR: 'Convertendo…'
  },
  mktConvertFailed: {
    en: 'Conversion failed (no rate).',
    he: 'ההמרה נכשלה (אין שער).',
    ru: 'Не удалось конвертировать (нет курса).',
    de: 'Umrechnung fehlgeschlagen (kein Kurs).',
    ptBR: 'Falha na conversão (sem cotação).'
  },
  tradePriorOffers: {
    en: 'Seen {0} prior offer(s) with this partner in this browser · avg value gap {1}%',
    he: 'נראו {0} הצעות קודמות עם השותף הזה בדפדפן הזה · פער ערך ממוצע {1}%',
    ru: 'Предыдущих предложений с этим партнёром в этом браузере: {0} · средняя разница в стоимости {1}%',
    de: '{0} frühere(s) Angebot(e) mit diesem Partner in diesem Browser · durchschnittliche Wertdifferenz {1} %',
    ptBR: '{0} oferta(s) anterior(es) com este parceiro neste navegador · diferença média de valor {1}%'
  },
  tradeNone: {
    en: '{0}: (none)',
    he: '{0}: (אין)',
    ru: '{0}: (нет)',
    de: '{0}: (keine)',
    ptBR: '{0}: (nenhum)'
  },
  tradeUnmarketable: {
    en: '(unmarketable item)',
    he: '(פריט לא סחיר)',
    ru: '(непродаваемый предмет)',
    de: '(nicht handelbarer Gegenstand)',
    ptBR: '(item não comercializável)'
  },
  discNoReplyBox: {
    en: 'No reply box found on this page.',
    he: 'לא נמצאה תיבת תגובה בעמוד הזה.',
    ru: 'На этой странице нет поля для ответа.',
    de: 'Auf dieser Seite wurde kein Antwortfeld gefunden.',
    ptBR: 'Nenhuma caixa de resposta encontrada nesta página.'
  },
  changelog150Selling: {
    en: 'Selling from your inventory now uses your wallet currency and shows exactly what you receive after fees.',
    he: 'מכירה מהמלאי משתמשת עכשיו במטבע הארנק שלך ומראה בדיוק כמה תקבל אחרי עמלות.',
    ru: 'Продажа из инвентаря теперь идёт в валюте вашего кошелька и показывает точную сумму после комиссии.',
    de: 'Verkäufe aus dem Inventar nutzen jetzt deine Geldbörsenwährung und zeigen genau, was du nach Gebühren erhältst.',
    ptBR: 'Vender do inventário agora usa a moeda da sua carteira e mostra exatamente o que você recebe após as taxas.'
  },
  changelog150Alerts: {
    en: 'Wishlist-deal and price-alert notifications work again, and the historical low and price chart are back.',
    he: 'התראות על מבצעים ברשימת המשאלות ועל יעדי מחיר עובדות שוב, והשפל ההיסטורי וגרף המחירים חזרו.',
    ru: 'Уведомления о скидках из списка желаемого и о целевых ценах снова работают, вернулись исторический минимум и график цен.',
    de: 'Benachrichtigungen zu Wunschlisten-Angeboten und Preisalarmen funktionieren wieder, Tiefstpreis und Preisdiagramm sind zurück.',
    ptBR: 'As notificações de ofertas da lista de desejos e de alertas de preço voltaram a funcionar, assim como o menor preço histórico e o gráfico de preços.'
  },
  changelog150Country: {
    en: 'Prices now follow the country Steam shows you; you can override it in Options.',
    he: 'המחירים עוקבים עכשיו אחרי המדינה ש-Steam מציג לך; אפשר לשנות אותה באפשרויות.',
    ru: 'Цены теперь соответствуют стране, которую показывает Steam; её можно изменить в настройках.',
    de: 'Preise richten sich jetzt nach dem Land, das Steam dir anzeigt; in den Optionen lässt es sich ändern.',
    ptBR: 'Os preços agora seguem o país que a Steam mostra para você; dá para alterar nas Opções.'
  },
  changelogShortcuts: {
    en: 'Try Ctrl+Shift+S to toggle the panel, Ctrl+Shift+W for wishlist.',
    he: 'נסו Ctrl+Shift+S כדי להציג/להסתיר את הפאנל, ו-Ctrl+Shift+W לרשימת המשאלות.',
    ru: 'Ctrl+Shift+S — показать/скрыть панель, Ctrl+Shift+W — список желаемого.',
    de: 'Strg+Umschalt+S blendet das Panel ein/aus, Strg+Umschalt+W öffnet die Wunschliste.',
    ptBR: 'Use Ctrl+Shift+S para mostrar/ocultar o painel e Ctrl+Shift+W para a lista de desejos.'
  },
  obStep1Title: {
    en: 'Browse any game page',
    he: 'היכנסו לעמוד של משחק',
    ru: 'Откройте страницу игры',
    de: 'Öffne eine Spielseite',
    ptBR: 'Abra a página de um jogo'
  },
  obStep1Desc: {
    en: 'Lowest price, historical low, ProtonDB rating, DLC ownership and more show up automatically in a panel.',
    he: 'המחיר הנמוך, השפל ההיסטורי, דירוג ProtonDB, בעלות על DLC ועוד מופיעים אוטומטית בפאנל.',
    ru: 'Минимальная цена, исторический минимум, рейтинг ProtonDB, наличие DLC и многое другое появятся на панели автоматически.',
    de: 'Tiefstpreis, historischer Tiefstpreis, ProtonDB-Bewertung, DLC-Besitz und mehr erscheinen automatisch in einem Panel.',
    ptBR: 'Menor preço, menor preço histórico, nota do ProtonDB, DLCs possuídos e mais aparecem automaticamente em um painel.'
  },
  obStep2Title: {
    en: 'Highlight owned/wishlisted games',
    he: 'סימון משחקים בבעלותכם וברשימת המשאלות',
    ru: 'Подсветка купленных и желаемых игр',
    de: 'Besessene/gewünschte Spiele hervorheben',
    ptBR: 'Destaque de jogos possuídos/desejados'
  },
  obStep2Desc: {
    en: 'Search and store lists mark games you own, have wishlisted, or are ignoring — with an option to hide any of them.',
    he: 'רשימות החיפוש והחנות מסמנות משחקים שבבעלותכם, ברשימת המשאלות או שהתעלמתם מהם — עם אפשרות להסתיר כל אחד מהם.',
    ru: 'В поиске и списках магазина отмечаются купленные, желаемые и игнорируемые игры — любые из них можно скрыть.',
    de: 'Suche und Shop-Listen markieren Spiele, die du besitzt, auf der Wunschliste hast oder ignorierst — jede Gruppe lässt sich ausblenden.',
    ptBR: 'A busca e as listas da loja marcam jogos que você possui, deseja ou ignora — com opção de ocultar qualquer um deles.'
  },
  obStep3Title: {
    en: 'Market & inventory tools',
    he: 'כלים ל-Market ולמלאי',
    ru: 'Инструменты для рынка и инвентаря',
    de: 'Markt- und Inventar-Tools',
    ptBR: 'Ferramentas de mercado e inventário'
  },
  obStep3Desc: {
    en: 'Open your Steam Market or Inventory page for net-after-fee pricing, value estimates, sort/group tiles, and more.',
    he: 'פתחו את ה-Market או את המלאי ב-Steam לתמחור נטו אחרי עמלה, הערכות שווי, מיון וקיבוץ פריטים ועוד.',
    ru: 'Откройте торговую площадку или инвентарь Steam: цены после комиссии, оценка стоимости, сортировка и группировка и многое другое.',
    de: 'Öffne Steam-Markt oder Inventar für Preise nach Gebühren, Wertschätzungen, Sortieren/Gruppieren und mehr.',
    ptBR: 'Abra o Mercado ou o Inventário da Steam para preço líquido após taxas, estimativas de valor, ordenar/agrupar itens e mais.'
  },
  obStep4Title: {
    en: 'Everything is toggleable',
    he: 'הכול ניתן להפעלה ולכיבוי',
    ru: 'Всё можно отключить',
    de: 'Alles ist abschaltbar',
    ptBR: 'Tudo pode ser ligado/desligado'
  },
  obStep4Desc: {
    en: 'Click the floating "SE" badge (bottom-right of any Steam page) any time to open full settings.',
    he: 'לחצו על התג הצף "SE" (בפינה הימנית התחתונה של כל עמוד Steam) כדי לפתוח את כל ההגדרות.',
    ru: 'Нажмите плавающий значок «SE» (внизу справа на любой странице Steam), чтобы открыть все настройки.',
    de: 'Klicke jederzeit auf das schwebende „SE“-Abzeichen (unten rechts auf jeder Steam-Seite), um alle Einstellungen zu öffnen.',
    ptBR: 'Clique no selo flutuante "SE" (canto inferior direito de qualquer página da Steam) para abrir todas as configurações.'
  }
};

function build(lang) {
  const out = {};
  for (const [key, vals] of Object.entries(T)) {
    const msg = vals[lang] ?? vals.en;
    out[key] = { message: msg };
  }
  return out;
}

const langs = { en: 'en', he: 'he', ru: 'ru', de: 'de', ptBR: 'pt_BR' };
const root = path.join(__dirname, '..', '_locales');
for (const [key, dir] of Object.entries(langs)) {
  const outDir = path.join(root, dir);
  fs.mkdirSync(outDir, { recursive: true });
  const json = JSON.stringify(build(key), null, 2) + '\n';
  fs.writeFileSync(path.join(outDir, 'messages.json'), json, 'utf8');
  console.log(`wrote ${dir}/messages.json (${Object.keys(T).length} keys)`);
}
