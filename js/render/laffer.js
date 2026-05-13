import { berechne } from '../rechner/berechne.js';

// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Laffer-Kurve — Render
// Abhängigkeiten: berechne() (rechner/berechne.js)
// ═══════════════════════════════════════════════════════

let _lafferTimer = null;
let _lafferPCache = null;
let _lafferPts = null;

function renderLaffer(p) {
  const el = document.getElementById('laffer_chart');
  if (!el) return;

  // Debounce: compute only 200ms after last change
  clearTimeout(_lafferTimer);
  _lafferTimer = setTimeout(() => _renderLafferNow(p), 200);
}

function _renderLafferNow(p) {
  const el = document.getElementById('laffer_chart');
  if (!el) return;

  // Cache: skip recompute if only spitze changed (curve shape is driven by other params)
  const cacheKey = JSON.stringify({...p, spitze: 0});
  if (_lafferPCache !== cacheKey) {
    _lafferPts = [];
    for (let s = 5; s <= 75; s += 2.5) {
      const rr = berechne({ ...p, spitze: s });
      _lafferPts.push({ s, est: rr.rev.est });
    }
    _lafferPCache = cacheKey;
  }
  const pts = _lafferPts;

  const maxEst = Math.max(...pts.map(x => x.est));
  const peakPt = pts.reduce((a, b) => b.est > a.est ? b : a);
  const curPt = pts.reduce((a, b) => Math.abs(b.s - p.spitze) < Math.abs(a.s - p.spitze) ? b : a);

  const W = 640, H = 180, pl = 52, pr = 20, pt2 = 16, pb = 30;
  const iW = W - pl - pr, iH = H - pt2 - pb;
  const minEst = Math.min(...pts.map(x => x.est)) * 0.97;
  const xOf = s  => pl + ((s - 5) / 70) * iW;
  const yOf = v  => pt2 + iH - ((v - minEst) / (maxEst * 1.05 - minEst)) * iH;

  const line = pts.map(x => xOf(x.s) + ',' + yOf(x.est)).join(' ');
  const area = `${xOf(pts[0].s)},${pt2+iH} ` + line + ` ${xOf(pts[pts.length-1].s)},${pt2+iH}`;

  // Y-axis: deduplicated labels
  const yTickSet = new Set([Math.round(minEst/50)*50, Math.round((minEst+maxEst)/2/50)*50, Math.round(maxEst/50)*50]);
  const yVals = [...yTickSet].filter(v => v >= minEst && v <= maxEst*1.1).map(v => {
    const y = yOf(v);
    return `<line x1="${pl}" y1="${y}" x2="${pl+iW}" y2="${y}" stroke="rgba(42,39,32,0.08)" stroke-width="1"/>
            <text x="${pl-5}" y="${y+4}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${Math.round(v)}</text>`;
  }).join('');

  const xVals = [10,20,30,40,50,60,70].map(s => {
    const x = xOf(s);
    return `<line x1="${x}" y1="${pt2}" x2="${x}" y2="${pt2+iH}" stroke="rgba(42,39,32,0.08)" stroke-width="1"/>
            <text x="${x}" y="${pt2+iH+16}" text-anchor="middle" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${s}%</text>`;
  }).join('');

  // Peak-Markierung — text-anchor rechts wenn zu nah am Rand
  const px = xOf(peakPt.s), py = yOf(peakPt.est);
  const peakNearRight = px > pl + iW * 0.6;
  const peakMark = `
    <line x1="${px}" y1="${pt2}" x2="${px}" y2="${pt2+iH}" stroke="var(--good)" stroke-width="1" stroke-dasharray="4,3" opacity="0.7"/>
    <circle cx="${px}" cy="${py}" r="5" fill="var(--good)" opacity="0.9"/>
    <text x="${peakNearRight ? px-8 : px+8}" y="${py-8}" text-anchor="${peakNearRight ? 'end' : 'start'}" font-size="11" font-family="DM Mono,monospace" font-weight="600" fill="var(--good)">Max: ${peakPt.s}% → ${Math.round(peakPt.est)} Mrd.</text>`;

  // Aktuelle Position
  const cx = xOf(p.spitze), cy = yOf(curPt.est);
  const curNearRight = cx > pl + iW * 0.75;
  const curMark = `
    <line x1="${cx}" y1="${pt2}" x2="${cx}" y2="${pt2+iH}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="3,2"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="var(--accent)"/>
    <text x="${curNearRight ? cx-8 : cx+8}" y="${cy-6}" text-anchor="${curNearRight ? 'end' : 'start'}" font-size="11" font-family="DM Mono,monospace" fill="var(--accent)">${p.spitze}%</text>`;

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H+4}" style="width:100%;overflow:visible">
    ${yVals}${xVals}
    <line x1="${pl}" y1="${pt2}" x2="${pl}" y2="${pt2+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <line x1="${pl}" y1="${pt2+iH}" x2="${pl+iW}" y2="${pt2+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <polygon points="${area}" fill="var(--accent)" opacity="0.07"/>
    <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>
    ${peakMark}${curMark}
    <text x="${pl+8}" y="${pt2+14}" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">ESt-Aufkommen (Mrd. €)</text>
  </svg>`;
}

export { renderLaffer, _renderLafferNow };
