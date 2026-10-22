// Kleine SVG-Diagramme ohne Bibliothek. Farben kommen aus CSS-Variablen.
import { fmtNum } from './logic.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function niceTicks(min, max, count = 4) {
  // Winzige Unterschiede (Fließkomma) wie Gleichstand behandeln, sonst entsteht Schrittweite 0
  if (Math.abs(max - min) < 1e-6 * Math.max(1, Math.abs(max))) max = min;
  if (min === max) {
    const d = Math.abs(min) * 0.1 || 1;
    min -= d;
    max += d;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2 && ticks.length < 20; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { lo, hi, ticks };
}

const shortDate = (ts) => new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

/**
 * Liniendiagramm mit Verlaufsfläche. points: [{date, value}] (aufsteigend).
 * Der beste Punkt wird hervorgehoben.
 */
export function lineChart(points, { unit = '', color = 'var(--accent)', id = 'g' } = {}) {
  if (!points.length) return `<div class="empty">Noch keine Daten in diesem Zeitraum.</div>`;
  const W = 340, H = 190, L = 40, R = 12, T = 12, B = 26;
  const vals = points.map((p) => p.value);
  const { lo, hi, ticks } = niceTicks(Math.min(...vals), Math.max(...vals));
  const t0 = points[0].date, t1 = points[points.length - 1].date;
  const x = (t) => (t1 === t0 ? L + (W - L - R) / 2 : L + ((t - t0) / (t1 - t0)) * (W - L - R));
  const y = (v) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const pts = points.map((p) => [x(p.date), y(p.value)]);
  const line = pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`).join('');
  const area = `${line}L${pts[pts.length - 1][0].toFixed(1)},${H - B}L${pts[0][0].toFixed(1)},${H - B}Z`;
  const best = vals.indexOf(Math.max(...vals));
  const grid = ticks
    .map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" class="tick" text-anchor="end">${fmtNum(v)}</text>`)
    .join('');
  const labels = [0, Math.floor((points.length - 1) / 2), points.length - 1]
    .filter((v, i, a) => a.indexOf(v) === i)
    .map((i) => `<text x="${pts[i][0]}" y="${H - 8}" class="tick" text-anchor="middle">${shortDate(points[i].date)}</text>`)
    .join('');
  const dots = pts
    .map(([a, b], i) => `<circle cx="${a}" cy="${b}" r="${i === best ? 5 : 3}" fill="${i === best ? 'var(--gold)' : color}" class="dot"><title>${shortDate(points[i].date)}: ${fmtNum(points[i].value)} ${unit}</title></circle>`)
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Verlauf">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${area}" fill="url(#${id})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}${labels}
  </svg>`;
}

/** Horizontale Balken: items [{label, value, color?}] */
export function barList(items, { unit = '' } = {}) {
  if (!items.length) return `<div class="empty">Diese Woche noch keine Sätze.</div>`;
  const max = Math.max(...items.map((i) => i.value), 1);
  return `<div class="bars">${items
    .map(
      (i) => `<div class="bar-row"><span class="bar-label">${esc(i.label)}</span><span class="bar-track"><span class="bar-fill" style="width:${(i.value / max) * 100}%;background:${i.color || 'var(--accent)'}"></span></span><span class="bar-val">${fmtNum(i.value)}${unit}</span></div>`,
    )
    .join('')}</div>`;
}

/** Säulen für Trainings je Woche: items [{week, count}] */
export function columnChart(items) {
  const W = 340, H = 110, B = 20, T = 14;
  const max = Math.max(...items.map((i) => i.count), 1);
  const bw = (W / items.length) * 0.6;
  const cols = items
    .map((it, i) => {
      const cx = (W / items.length) * (i + 0.5);
      const h = (it.count / max) * (H - B - T);
      const last = i === items.length - 1;
      return `<rect x="${cx - bw / 2}" y="${H - B - h}" width="${bw}" height="${Math.max(h, 1)}" rx="4" fill="${last ? 'var(--accent)' : 'var(--accent-soft)'}"/>
        ${it.count ? `<text x="${cx}" y="${H - B - h - 3}" class="tick" text-anchor="middle">${it.count}</text>` : ''}
        <text x="${cx}" y="${H - 5}" class="tick" text-anchor="middle">${shortDate(it.week)}</text>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Trainings pro Woche">${cols}</svg>`;
}

