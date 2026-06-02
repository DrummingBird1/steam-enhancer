(function () {
  'use strict';
  const SE = window.SteamEnhancer;

  document.addEventListener('se-ready', () => init(), { once: true });

  async function init() {
    if (!/\/wishlist\//.test(location.pathname)) return;
    insertToolbar();
    decorateRowsLoop();
  }

  function insertToolbar() {
    if (SE.$('#se-wishlist-toolbar')) return;
    const anchor = SE.$('#wishlist_ctn') || SE.$('.wishlist_content') || document.body;
    const bar = SE.el('div', { id: 'se-wishlist-toolbar', class: 'se-toolbar' },
      SE.el('button', { class: 'se-btn', onclick: exportCSV }, 'Export CSV'),
      SE.el('button', { class: 'se-btn', onclick: exportJSON }, 'Export JSON'),
      SE.el('button', { class: 'se-btn', onclick: exportText }, 'Copy as text'),
      SE.el('button', { class: 'se-btn', onclick: openAllOnITAD }, 'Open on ITAD'),
      SE.el('button', { class: 'se-btn', onclick: sortByDealVsLow }, 'Sort: best deal vs low'),
      SE.el('button', { class: 'se-btn', onclick: sortByPrice }, 'Sort: price ↑'),
      SE.el('span', { id: 'se-wishlist-count', class: 'se-muted' }, '')
    );
    anchor.parentElement?.insertBefore(bar, anchor);
    new MutationObserver(SE.throttle(refreshCount, 250)).observe(document.body, { childList: true, subtree: true });
    refreshCount();
  }

  const rows = () => SE.$$('.wishlist_row');
  function refreshCount() {
    const el = SE.$('#se-wishlist-count');
    if (el) el.textContent = `${rows().length} visible`;
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
      .then(() => alert('Copied wishlist to clipboard.'));
  }
  function openAllOnITAD() {
    const ids = collect().map(r => r.appid).filter(Boolean).slice(0, 30);
    if (!ids.length) return alert('Nothing to open.');
    window.open(`https://isthereanydeal.com/search/?q=${encodeURIComponent(ids.join(','))}`, '_blank');
  }

  async function decorateRowsLoop() {
    // Each row gets a "low: X · diff%" annotation.
    const { settings } = SE.ctx;
    const country = settings.country || 'us';
    const observer = new MutationObserver(SE.throttle(() => decorate(country), 200));
    observer.observe(document.body, { childList: true, subtree: true });
    decorate(country);
  }
  async function decorate(country) {
    for (const r of rows()) {
      if (r.dataset.seDone) continue;
      r.dataset.seDone = '1';
      const appid = r.getAttribute('data-app-key');
      if (!appid) continue;
      const priceEl = r.querySelector('.discount_final_price, .price');
      const cur = priceEl ? SE.parsePrice(priceEl.textContent) : null;
      const sum = await SE.priceSummary(appid, country);
      if (!sum) continue;
      const low = sum.historicalLow?.price;
      const diff = (cur != null && low != null) ? Math.round(((cur - low) / Math.max(low, 0.01)) * 100) : null;
      const tag = SE.el('div', { class: 'se-row-tag' },
        low != null ? `low: ${low.toFixed(2)}${diff != null ? ` · ${diff >= 0 ? '+' : ''}${diff}% vs low` : ''}` : '—'
      );
      if (diff != null && diff <= 5) tag.classList.add('se-row-tag-match');
      (r.querySelector('.discount_block, .price') || r).appendChild(tag);
      // Also stash diff for sorting.
      r.dataset.seDiff = diff != null ? String(diff) : '9999';
      r.dataset.sePrice = cur != null ? String(cur) : '9999';
    }
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
