(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  SE.onReady(() => init());

  let keyNoticeShown = false;

  async function init() {
    if (!/\/wishlist\//.test(location.pathname)) return;
    SE.safe('wl:toolbar', insertToolbar);
    if (SE.once('wl:rows')) SE.safe('wl:rows', decorateRowsLoop);
  }

  function insertToolbar() {
    if (SE.$('#se-wishlist-toolbar')) return;
    const anchor = SE.$('#wishlist_ctn') || SE.$('.wishlist_content') || document.body;
    const bar = SE.el('div', { id: 'se-wishlist-toolbar', class: 'se-toolbar' },
      SE.el('button', { class: 'se-btn', onclick: exportCSV }, SE.t('exportCsv')),
      SE.el('button', { class: 'se-btn', onclick: exportJSON }, SE.t('exportJson')),
      SE.el('button', { class: 'se-btn', onclick: exportText }, SE.t('copyAsText')),
      SE.el('button', { class: 'se-btn', onclick: openAllOnITAD }, SE.t('openOnItad')),
      SE.el('button', { class: 'se-btn', onclick: sortByDealVsLow }, SE.t('sortByDeal')),
      SE.el('button', { class: 'se-btn', onclick: sortByPrice }, SE.t('sortByPrice')),
      SE.el('span', { id: 'se-wishlist-count', class: 'se-muted' }, '')
    );
    anchor.parentElement?.insertBefore(bar, anchor);
    new MutationObserver(SE.throttle(refreshCount, 250)).observe(document.body, { childList: true, subtree: true });
    refreshCount();
  }

  const rows = () => SE.$$('.wishlist_row');
  function refreshCount() {
    const el = SE.$('#se-wishlist-count');
    if (el) el.textContent = `${rows().length} ${SE.t('visibleWord')}`;
  }

  function collect() {
    return rows().map((r) => {
      const appid = r.getAttribute('data-app-key') || r.id?.replace(/[^\d]/g, '');
      const title = r.querySelector('.title')?.textContent?.trim() || '';
      const price = r.querySelector('.discount_final_price, .price')?.textContent?.trim() || '';
      const discount = r.querySelector('.discount_pct')?.textContent?.trim() || '';
      const added = r.querySelector('.added_on')?.textContent?.trim().replace(/^Added on\s*/i, '') || '';
      return { appid, title, price, discount, added };
    });
  }

  function download(name, content, mime = 'text/plain') {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportCSV() {
    const rs = collect();
    const csv = 'appid,title,price,discount,added\n' + rs.map(r =>
      [r.appid, JSON.stringify(r.title), JSON.stringify(r.price), JSON.stringify(r.discount), JSON.stringify(r.added)].join(',')
    ).join('\n');
    download('steam-wishlist.csv', csv, 'text/csv');
  }
  function exportJSON() { download('steam-wishlist.json', JSON.stringify(collect(), null, 2), 'application/json'); }
  function exportText() {
    navigator.clipboard.writeText(collect().map(r => `- ${r.title} (${r.price})`).join('\n'))
      .then(() => alert(SE.t('copiedToClipboard')));
  }
  function openAllOnITAD() {
    const ids = collect().map(r => r.appid).filter(Boolean).slice(0, 30);
    if (!ids.length) return alert(SE.t('nothingToOpen'));
    window.open(`https://isthereanydeal.com/search/?q=${encodeURIComponent(ids.join(','))}`, '_blank');
  }

  async function decorateRowsLoop() {
    const observer = new MutationObserver(SE.throttle(decorate, 200));
    observer.observe(document.body, { childList: true, subtree: true });
    decorate();
  }

  // Batched: one ITAD prices call + one storelow call for every not-yet-decorated
  // row, instead of one pair of calls per row.
  async function decorate() {
    const { settings } = SE.ctx;
    const country = settings.country || 'us';
    const pending = rows().filter((r) => !r.dataset.seDone);
    if (!pending.length) return;
    pending.forEach((r) => { r.dataset.seDone = '1'; });

    const withAppid = pending.map((r) => ({ row: r, appid: r.getAttribute('data-app-key') })).filter((x) => x.appid);
    const summaries = await SE.priceSummaryBatch(withAppid.map((x) => x.appid), country);
    const noKey = summaries === 'needsItadKey';
    if (noKey && !keyNoticeShown) { keyNoticeShown = true; showKeyNotice(); }

    const targets = await getTargets();

    for (const r of pending) {
      const appid = r.getAttribute('data-app-key');
      const priceEl = r.querySelector('.discount_final_price, .price');
      const cur = priceEl ? SE.parsePrice(priceEl.textContent) : null;
      const sum = !noKey && appid ? summaries.get(appid) : null;
      const low = sum?.historicalLow?.price;
      const diff = (cur != null && low != null) ? Math.round(((cur - low) / Math.max(low, 0.01)) * 100) : null;

      if (!noKey) {
        const tag = SE.el('div', { class: 'se-row-tag' },
          low != null ? `${SE.t('lowWord')}: ${low.toFixed(2)}${diff != null ? ` · ${diff >= 0 ? '+' : ''}${diff}% ${SE.t('vsLow')}` : ''}` : '—'
        );
        if (diff != null && diff <= 5) tag.classList.add('se-row-tag-match');
        (r.querySelector('.discount_block, .price') || r).appendChild(tag);
      }
      r.dataset.seDiff = diff != null ? String(diff) : '9999';
      r.dataset.sePrice = cur != null ? String(cur) : '9999';

      if (!appid) continue;

      // Per-app price-target input.
      const tgt = targets[appid];
      const input = SE.el('input', {
        type: 'number', step: '0.01', min: '0', placeholder: SE.t('alertMeAtPlaceholder'),
        class: 'se-input', style: { width: '90px' }
      });
      input.value = tgt != null ? String(tgt) : '';
      input.addEventListener('change', () => {
        const v = parseFloat(input.value);
        setTarget(appid, isFinite(v) && v > 0 ? v : null);
      });
      const wrap = SE.el('div', { class: 'se-row-tag' }, `${SE.t('targetWord')}: `, input);
      (r.querySelector('.discount_block, .price') || r).appendChild(wrap);

      if (tgt != null && cur != null && cur <= tgt) {
        r.style.outline = '2px solid #a4d007';
        r.appendChild(SE.tag(SE.t('atTarget'), 'good'));
      }
    }
  }

  function showKeyNotice() {
    const anchor = SE.$('#se-wishlist-toolbar');
    if (!anchor || SE.$('#se-itad-key-notice')) return;
    anchor.parentElement?.insertBefore(SE.el('div', { id: 'se-itad-key-notice', class: 'se-toolbar' },
      SE.el('span', { class: 'se-muted' }, SE.t('needsItadKeyMsg') + ' '),
      SE.el('a', {
        href: 'javascript:void 0', class: 'se-link',
        onclick: (e) => { e.preventDefault(); SE.bg({ type: 'openOptions' }); }
      }, SE.t('openOptionsLink'))
    ), anchor.nextSibling);
  }

  async function getTargets() {
    return new Promise((r) => chrome.storage.local.get(['se_wishlist_targets'], (d) => r(d.se_wishlist_targets || {})));
  }
  async function setTarget(appid, v) {
    const cur = await getTargets();
    if (v == null) delete cur[appid]; else cur[appid] = v;
    chrome.storage.local.set({ se_wishlist_targets: cur });
  }

  function sortByDealVsLow() {
    const container = SE.$('#wishlist_ctn');
    if (!container) return;
    const sorted = rows().sort((a, b) => (+a.dataset.seDiff || 9999) - (+b.dataset.seDiff || 9999));
    sorted.forEach(r => container.appendChild(r));
  }
  function sortByPrice() {
    const container = SE.$('#wishlist_ctn');
    if (!container) return;
    const sorted = rows().sort((a, b) => (+a.dataset.sePrice || 9999) - (+b.dataset.sePrice || 9999));
    sorted.forEach(r => container.appendChild(r));
  }
})();
