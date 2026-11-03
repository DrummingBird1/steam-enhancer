// Interactive price chart: step line (prices hold until they change), hover
// crosshair with date + price, range buttons, and a dashed line at the lowest
// price in view. Shared by the store page, market and inventory panels.
//
// SE.chartModel / SE.chartPointAt / SE.chartSince are pure (unit-tested);
// SE.priceChart builds the DOM.
(function (global) {
  'use strict';
  const SE = global.SteamEnhancer || (global.SteamEnhancer = {});
  const NS = 'http://www.w3.org/2000/svg';
  const DAY = 24 * 3600_000;

  // points: [{ t: ms, v: number }] in any order. Returns null with < 2 points.
  SE.chartModel = (points, opts = {}) => {
    const { w = 340, h = 130, padL = 46, padR = 10, padT = 10, padB = 20, step = true } = opts;
    const pts = (points || [])
      .filter((p) => p && Number.isFinite(p.t) && Number.isFinite(p.v))
      .sort((a, b) => a.t - b.t);
    if (pts.length < 2) return null;
    const minT = pts[0].t, maxT = pts[pts.length - 1].t;
    let minV = Math.min(...pts.map((p) => p.v)), maxV = Math.max(...pts.map((p) => p.v));
    if (maxV === minV) { minV = minV * 0.9; maxV = maxV * 1.1 || 1; }
    const x = (t) => padL + (w - padL - padR) * (t - minT) / Math.max(1, maxT - minT);
    const y = (v) => padT + (h - padT - padB) * (1 - (v - minV) / (maxV - minV));
    let d = `M${x(pts[0].t).toFixed(1)},${y(pts[0].v).toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const X = x(pts[i].t).toFixed(1), Y = y(pts[i].v).toFixed(1);
      d += step ? ` H${X} V${Y}` : ` L${X},${Y}`;
    }
    const low = pts.reduce((a, p) => (p.v < a.v ? p : a));
    return { pts, d, x, y, minV, maxV, minT, maxT, low, w, h, padL, padR, padT, padB };
  };

  // The value in effect at time t (the last point at or before it).
  SE.chartPointAt = (pts, t) => {
    let lo = 0, hi = pts.length - 1, best = pts[0];
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].t <= t) { best = pts[mid]; lo = mid + 1; } else hi = mid - 1;
    }
    return best;
  };

  // Points from `since` on, starting with the price that was already in
  // effect at `since` so the line doesn't begin mid-air.
  SE.chartSince = (pts, since) => {
    const sorted = [...pts].sort((a, b) => a.t - b.t);
    const after = sorted.filter((p) => p.t >= since);
    const before = sorted.filter((p) => p.t < since);
    if (before.length) after.unshift({ ...before[before.length - 1], t: since });
    return after;
  };

  const svgEl = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    return n;
  };
  const fmtDate = (t) => new Date(t).toISOString().slice(0, 10);

  // points: [{ t, v }]. opts: { currency, ranges: true, w, h, step, note }.
  SE.priceChart = (points, opts = {}) => {
    const money = (v) => (opts.currency ? SE.formatMoney(v, opts.currency) : v.toFixed(2));
    const all = (points || []).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v)).sort((a, b) => a.t - b.t);
    const wrap = SE.el('div', { class: 'se-chart' });
    if (all.length < 2) return wrap;

    const span = all[all.length - 1].t - all[0].t;
    const ranges = [['3M', 90], ['1Y', 365], ['ALL', 0]]
      .filter(([, days]) => !days || span > days * DAY);
    const bar = SE.el('div', { class: 'se-chart-ranges' });
    const plot = SE.el('div', { class: 'se-chart-plot' });
    const tip = SE.el('div', { class: 'se-chart-tip' });
    wrap.append(bar, plot, tip);
    if (opts.note) wrap.appendChild(SE.el('div', { class: 'se-muted se-chart-note' }, opts.note));

    const draw = (days) => {
      const end = all[all.length - 1].t;
      const pts = days ? SE.chartSince(all, end - days * DAY) : all;
      const m = SE.chartModel(pts, opts);
      plot.textContent = '';
      tip.style.display = 'none';
      if (!m) return;
      const svg = svgEl('svg', { viewBox: `0 0 ${m.w} ${m.h}`, class: 'se-chart-svg', role: 'img' });
      // Axis labels: top/bottom price, first/last date.
      const label = (x, y, text, anchor) => {
        const n = svgEl('text', { x, y, 'text-anchor': anchor, class: 'se-chart-axis' });
        n.textContent = text;
        svg.appendChild(n);
      };
      label(m.padL - 4, m.padT + 4, money(m.maxV), 'end');
      label(m.padL - 4, m.h - m.padB, money(m.minV), 'end');
      label(m.padL, m.h - 4, fmtDate(m.minT), 'start');
      label(m.w - m.padR, m.h - 4, fmtDate(m.maxT), 'end');
      // Lowest price in view.
      const ly = m.y(m.low.v).toFixed(1);
      svg.appendChild(svgEl('line', { x1: m.padL, x2: m.w - m.padR, y1: ly, y2: ly, class: 'se-chart-low' }));
      svg.appendChild(svgEl('path', { d: m.d, class: 'se-chart-line' }));
      // Hover crosshair.
      const cross = svgEl('line', { y1: m.padT, y2: m.h - m.padB, class: 'se-chart-cross', visibility: 'hidden' });
      const dot = svgEl('circle', { r: 3, class: 'se-chart-dot', visibility: 'hidden' });
      const hit = svgEl('rect', { x: m.padL, y: 0, width: m.w - m.padL - m.padR, height: m.h, fill: 'transparent' });
      svg.append(cross, dot, hit);
      const move = (ev) => {
        const box = svg.getBoundingClientRect();
        const px = ((ev.clientX - box.left) / box.width) * m.w;
        const t = m.minT + (Math.min(Math.max(px, m.padL), m.w - m.padR) - m.padL) / (m.w - m.padL - m.padR) * (m.maxT - m.minT);
        const p = SE.chartPointAt(m.pts, t);
        const X = m.x(t), Y = m.y(p.v);
        cross.setAttribute('x1', X); cross.setAttribute('x2', X);
        dot.setAttribute('cx', X); dot.setAttribute('cy', Y);
        cross.setAttribute('visibility', 'visible'); dot.setAttribute('visibility', 'visible');
        tip.textContent = `${fmtDate(t)} · ${money(p.v)}${p.shop ? ` · ${p.shop}` : ''}`;
        tip.style.display = '';
      };
      hit.addEventListener('mousemove', move);
      hit.addEventListener('mouseleave', () => {
        cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden');
        tip.textContent = `${SE.t('lowWord')}: ${money(m.low.v)} · ${fmtDate(m.low.t)}`;
      });
      plot.appendChild(svg);
      tip.textContent = `${SE.t('lowWord')}: ${money(m.low.v)} · ${fmtDate(m.low.t)}`;
      tip.style.display = '';
    };

    if (ranges.length > 1) {
      for (const [name, days] of ranges) {
        const b = SE.el('button', { class: 'se-btn se-chart-range' }, SE.t(`range${name}`));
        b.addEventListener('click', () => {
          bar.querySelectorAll('.se-chart-range').forEach((x) => x.classList.remove('se-active'));
          b.classList.add('se-active');
          draw(days);
        });
        bar.appendChild(b);
      }
      // Default to a year when there's more than that, else everything.
      const def = ranges.find(([n]) => n === '1Y') || ranges[ranges.length - 1];
      bar.children[ranges.indexOf(def)].classList.add('se-active');
      draw(def[1]);
    } else {
      draw(0);
    }
    return wrap;
  };
})(globalThis);
