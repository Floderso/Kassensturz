// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
import { berechne } from '../rechner/berechne.js';
import { TOP_PARETO, ELAST } from '../data.js';

// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Laffer-Kurve — Render
// Abhängigkeiten: berechne() (rechner/berechne.js)
// ═══════════════════════════════════════════════════════

let _lafferTimer = null;
let _lafferPCache = null;
let _lafferPts = null;

const LAFFER_VON = 20, LAFFER_BIS = 80, LAFFER_SCHRITT = 1;

function renderLaffer(p) {
  const el = document.getElementById('laffer_chart');
  if (!el) return;

  // Debounce: compute only 200ms after last change
  clearTimeout(_lafferTimer);
  _lafferTimer = setTimeout(() => _renderLafferNow(p), 200);
}

// Kurvenpunkte: nur der Spitzensatz (Zone 5) variiert, alle anderen Parameter wie eingestellt (F-022).
// Dargestellt wird das Gesamtaufkommen, weil Verhaltensreaktionen auch Soli, MwSt und SV verändern.
function lafferPunkte(p) {
  const pts = [];
  for (let s = LAFFER_VON; s <= LAFFER_BIS; s += LAFFER_SCHRITT) {
    const rr = berechne({ ...p, spitze: s });
    pts.push({ s, rev: rr.einnahmen_total, est: rr.rev.est });
  }
  return pts;
}

// Aussage aus dem Modell: Maximum nur, wenn es im Inneren des Bereichs liegt
function lafferAussage(pts) {
  const peak = pts.reduce((a, b) => (b.rev > a.rev ? b : a));
  const innen = peak.s > pts[0].s && peak.s < pts[pts.length - 1].s;
  return { peak, innen, text: innen
    ? `Aufkommensmaximum im Modell bei ${peak.s} % Spitzensatz`
    : `Im Bereich ${pts[0].s}–${pts[pts.length - 1].s} % kein inneres Aufkommensmaximum` };
}

// Theoretischer Vergleichswert τ* = 1/(1 + a·e) (Diamond/Saez 2011) mit den Modellparametern
function tauStern() {
  return 1 / (1 + TOP_PARETO.a * ELAST.d10c_labor);
}

function _renderLafferNow(p) {
  const el = document.getElementById('laffer_chart');
  if (!el) return;

  const cacheKey = JSON.stringify({ ...p, spitze: 0 });
  if (_lafferPCache !== cacheKey) {
    _lafferPts = lafferPunkte(p);
    _lafferPCache = cacheKey;
  }
  const pts = _lafferPts;
  const { peak: peakPt, innen, text: aussage } = lafferAussage(pts);
  const curPt = pts.reduce((a, b) => Math.abs(b.s - p.spitze) < Math.abs(a.s - p.spitze) ? b : a);

  // Darstellung als Abweichung vom Aufkommen bei 45 % (Status-quo-Satz), sonst ist die Kurve bei
  // ~2.100 Mrd. € Gesamtaufkommen nicht lesbar
  const bezug = pts.reduce((a, b) => Math.abs(b.s - 45) < Math.abs(a.s - 45) ? b : a).rev;
  const dv = x => x.rev - bezug;
  const maxV = Math.max(...pts.map(dv)), minV = Math.min(...pts.map(dv));
  const spanne = Math.max(1, maxV - minV);

  const W = 640, H = 180, pl = 52, pr = 20, pt2 = 16, pb = 30;
  const iW = W - pl - pr, iH = H - pt2 - pb;
  const xOf = s => pl + ((s - LAFFER_VON) / (LAFFER_BIS - LAFFER_VON)) * iW;
  const yOf = v => pt2 + iH - ((v - minV) / (spanne * 1.1)) * iH;

  const line = pts.map(x => xOf(x.s) + ',' + yOf(dv(x))).join(' ');
  const area = `${xOf(pts[0].s)},${pt2+iH} ` + line + ` ${xOf(pts[pts.length-1].s)},${pt2+iH}`;

  const fmt = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1).replace('.', ',');
  const yVals = [minV, 0, maxV].filter((v, i, a) => a.findIndex(w => Math.abs(w - v) < spanne * 0.08) === i).map(v => {
    const y = yOf(v);
    return `<line x1="${pl}" y1="${y}" x2="${pl+iW}" y2="${y}" stroke="rgba(42,39,32,0.08)" stroke-width="1"/>
            <text x="${pl-5}" y="${y+4}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${fmt(v)}</text>`;
  }).join('');

  const xVals = [20,30,40,50,60,70,80].map(s => {
    const x = xOf(s);
    return `<line x1="${x}" y1="${pt2}" x2="${x}" y2="${pt2+iH}" stroke="rgba(42,39,32,0.08)" stroke-width="1"/>
            <text x="${x}" y="${pt2+iH+16}" text-anchor="middle" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${s}%</text>`;
  }).join('');

  // Maximum nur markieren, wenn es im Inneren liegt
  let peakMark = '';
  if (innen) {
    const px = xOf(peakPt.s), py = yOf(dv(peakPt));
    const rechts = px > pl + iW * 0.6;
    peakMark = `
    <line x1="${px}" y1="${pt2}" x2="${px}" y2="${pt2+iH}" stroke="var(--good)" stroke-width="1" stroke-dasharray="4,3" opacity="0.7"/>
    <circle cx="${px}" cy="${py}" r="5" fill="var(--good)" opacity="0.9"/>
    <text x="${rechts ? px-8 : px+8}" y="${py-8}" text-anchor="${rechts ? 'end' : 'start'}" font-size="11" font-family="DM Mono,monospace" font-weight="600" fill="var(--good)">Max: ${peakPt.s} %</text>`;
  }

  const cx = xOf(Math.min(LAFFER_BIS, Math.max(LAFFER_VON, p.spitze))), cy = yOf(dv(curPt));
  const curRechts = cx > pl + iW * 0.75;
  const curMark = `
    <line x1="${cx}" y1="${pt2}" x2="${cx}" y2="${pt2+iH}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="3,2"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="var(--accent)"/>
    <text x="${curRechts ? cx-8 : cx+8}" y="${cy+16}" text-anchor="${curRechts ? 'end' : 'start'}" font-size="11" font-family="DM Mono,monospace" fill="var(--accent)">${p.spitze} %</text>`;

  const ts = Math.round(tauStern() * 100);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H+4}" style="width:100%;overflow:visible" role="img"><title>Laffer-Kurve: Gesamtaufkommen in Abhängigkeit vom Spitzensteuersatz</title>
    ${yVals}${xVals}
    <line x1="${pl}" y1="${pt2}" x2="${pl}" y2="${pt2+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <line x1="${pl}" y1="${pt2+iH}" x2="${pl+iW}" y2="${pt2+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <polygon points="${area}" fill="var(--accent)" opacity="0.07"/>
    <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>
    ${peakMark}${curMark}
    <text x="${pl+8}" y="${pt2+14}" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">Gesamteinnahmen, Mrd. € ggü. 45 %</text>
  </svg>
  <p id="laffer_aussage" style="font-size:12px;margin-top:8px;">${aussage}. Theoretischer Vergleichswert τ* = 1/(1 + a·e) = 1/(1 + ${String(TOP_PARETO.a).replace('.', ',')} · ${String(ELAST.d10c_labor).replace('.', ',')}) ≈ ${ts} % (ohne den Vermeidungs- und Wegzugsterm des Modells, der das Maximum senkt).</p>`;
}

export { renderLaffer, _renderLafferNow, lafferPunkte, lafferAussage, tauStern };
