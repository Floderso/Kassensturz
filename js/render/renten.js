// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
import { berechneRente } from '../rechner/rente.js';

// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Rentenreform & GKV — Render
// Abhängigkeiten: berechneRente() (rechner/rente.js), DEZILE (data.js)
// ═══════════════════════════════════════════════════════

function renderRenten(p, r) {
  if (!p.kapitalquote && !p.pkv_abschaffen && p.anzahl_kv >= 95 && !p.praevention && !p.kv_kapital && !p.kv_bbg_frei) {
    document.getElementById('renten-panel').style.display = 'none';
    return;
  }
  document.getElementById('renten-panel').style.display = '';

  const rente = berechneRente(p, r.rev.rv);
  const f1 = n => n.toFixed(1).replace('.', ',');

  // KPIs
  const kpis = [
    { label: 'Kapitalstock 2025', value: rente.kapitalstock.toFixed(0) + ' Mrd. €',
      delta: p.kapitalquote > 0 ? `${p.kapitalquote}% Fondsquote seit ${p.startjahr}` : 'Kein Fonds aktiv', cls: p.kapitalquote > 0 ? 'good' : 'neutral' },
    { label: 'Jahresertrag Fonds', value: rente.jahresertrag.toFixed(1) + ' Mrd. €',
      delta: rente.beitragsentlastung > 0 ? '−' + f1(rente.beitragsentlastung) + ' PP Beitragssatz' : '—', cls: rente.beitragsentlastung > 0 ? 'good' : 'neutral' },
    { label: 'RV-Entlastung 2045', value: (() => { const ohne = 18.6 + 20*0.3; const mit = document.getElementById('renten-panel') ? rente.proj_mit[20]?.beitrag : ohne; return f1(ohne - (mit||ohne)) + ' PP'; })(),
      delta: 'gegenüber ohne Reform', cls: rente.beitragsentlastung > 0 ? 'good' : 'neutral' },
    { label: 'GKV-Struktureffekt', value: (rente.gkv_gesamt_effekt >= 0 ? '+' : '') + f1(rente.gkv_gesamt_effekt) + ' Mrd. €',
      delta: rente.kassen_ersparnis > 0 ? `Kassenfusion: +${f1(rente.kassen_ersparnis)} Mrd.` : 'Nur strukturelle Effekte', cls: rente.gkv_gesamt_effekt > 0 ? 'good' : rente.gkv_gesamt_effekt < -1 ? 'bad' : 'neutral' }
  ];
  document.getElementById('renten_kpis').innerHTML = kpis.map(k => `
    <div class="kpi" style="background:var(--paper);border:1px solid var(--rule);padding:14px 16px;">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value" style="font-size:22px">${k.value}</div>
      <div class="kpi-delta ${k.cls}">${k.delta}</div>
    </div>`).join('');

  // Kapitalstock Chart
  renderKapitalstockSVG(rente, p);

  // Beitragssatz Projektion
  renderBeitragProjSVG(rente, p);

  // GKV Panel
  const gkvItems = [
    { label: 'PKV-Abschaffung (Netto)', v: rente.pkv_netto_effekt, aktiv: p.pkv_abschaffen,
      note: p.pkv_abschaffen ? '11 Mio. PKV → GKV; Mehrausgaben überwiegen leicht' : 'inaktiv' },
    { label: 'Kassenfusion (Verwalt.)', v: rente.kassen_ersparnis, aktiv: p.anzahl_kv < 95,
      note: p.anzahl_kv < 95 ? `${p.anzahl_kv} statt 95 Kassen; Fixkostenabbau 45%` : 'inaktiv' },
    { label: 'Prävention (Nettonutzen)', v: rente.praevention_ersparnis, aktiv: p.praevention > 0,
      note: p.praevention > 0 ? `${p.praevention} Mrd. Invest × 1,5 ROI (vereinf.)` : 'inaktiv' },
    { label: 'Kapitalerträge KV-pflichtig', v: r.kv_kapital_bonus, aktiv: p.kv_kapital,
      note: p.kv_kapital ? `+${r.kv_kapital_bonus.toFixed(1)} Mrd. bei ${p.kv}% KV-Satz (ifo FB 159/2025)` : 'inaktiv' },
    { label: 'KV-BBG abschaffen', v: r.kv_bbg_frei_bonus, aktiv: p.kv_bbg_frei,
      note: p.kv_bbg_frei ? `+${r.kv_bbg_frei_bonus.toFixed(1)} Mrd. bei ${p.kv}% KV-Satz (DIW Wochenbericht 2025)` : 'inaktiv' }
  ].filter(x => x.aktiv);

  if (gkvItems.length === 0) {
    document.getElementById('gkv_panel').innerHTML = '';
    return;
  }

  const maxAbs = Math.max(1, ...gkvItems.map(x => Math.abs(x.v)));
  document.getElementById('gkv_panel').innerHTML = `
    <div style="font-family:'DM Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:12px;">GKV-Struktureffekte (Mrd. € / Jahr)</div>
    <div style="display:flex;flex-direction:column;gap:14px;">
    ${gkvItems.map(item => {
      const pct = Math.max(2, Math.abs(item.v) / maxAbs * 100);
      const cls = item.v >= 0 ? 'pos' : 'neg';
      return `<div>
        <div style="display:grid;grid-template-columns:180px 1fr 72px;align-items:center;gap:10px;margin-bottom:4px;">
          <div style="font-family:'DM Mono',monospace;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${item.label}">${item.label}</div>
          <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>
          <div style="font-family:'DM Mono',monospace;font-size:11px;text-align:right;white-space:nowrap;">${item.v >= 0 ? '+' : ''}${f1(item.v)} Mrd.</div>
        </div>
        <div style="font-size:11px;color:var(--muted);font-style:italic;padding-left:4px;">${item.note}</div>
      </div>`;
    }).join('')}
    </div>
    <p style="font-size:11px;color:var(--muted);margin-top:14px;font-style:italic;">Quelle: GKV-SV Jahresbericht 2025, PKV-Verband, WHO Prevention ROI Report 2017, BMG.</p>`;
}

function renderKapitalstockSVG(rente, p) {
  const el = document.getElementById('kapitalstock_chart');
  if (!el) return;
  if (p.kapitalquote === 0 || rente.ks_history.length === 0) {
    el.innerHTML = '<p style="color:var(--muted);font-style:italic;font-size:13px;padding:12px 0;">Fondsquote = 0 % — kein Kapitalstock aufgebaut.<br>Setze Fondsquote > 0 und ein Startjahr um die historische Simulation zu sehen.</p>';
    return;
  }
  const W = 580, H = 160, pl = 52, pr = 16, pt = 12, pb = 28;
  const iW = W - pl - pr, iH = H - pt - pb;
  const data = rente.ks_history;
  const maxKS = Math.max(1, ...data.map(d => d.ks));
  const minJahr = data[0].jahr, maxJahr = data[data.length-1].jahr;
  const xOf = j => pl + ((j - minJahr) / Math.max(1, maxJahr - minJahr)) * iW;
  const yOf = v => pt + iH - (v / maxKS) * iH;

  const pts = data.map(d => xOf(d.jahr) + ',' + yOf(d.ks)).join(' ');
  const area = `${pl},${pt+iH} ` + pts + ` ${xOf(maxJahr)},${pt+iH}`;

  const yVals = [0, 0.25, 0.5, 0.75, 1.0].map(f => {
    const v = f * maxKS;
    const y = yOf(v);
    const label = v >= 1000 ? (v/1000).toFixed(1).replace('.',',') + 'k' : Math.round(v);
    return `<line x1="${pl}" y1="${y}" x2="${pl+iW}" y2="${y}" stroke="rgba(42,39,32,0.08)" stroke-width="1"/>
            <text x="${pl-5}" y="${y+4}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${label}</text>`;
  }).join('');

  const xLabels = [];
  for (let j = minJahr; j <= maxJahr; j += Math.max(1, Math.ceil((maxJahr - minJahr) / 5))) {
    xLabels.push(`<text x="${xOf(j)}" y="${pt+iH+16}" text-anchor="middle" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${j}</text>`);
  }

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H+4}" style="width:100%;overflow:visible">
    ${yVals}${xLabels.join('')}
    <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <line x1="${pl}" y1="${pt+iH}" x2="${pl+iW}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <polygon points="${area}" fill="var(--good)" opacity="0.15"/>
    <polyline points="${pts}" fill="none" stroke="var(--good)" stroke-width="2.5"/>
    <text x="${xOf(maxJahr)-4}" y="${yOf(data[data.length-1].ks)-8}" text-anchor="end" font-size="11" font-family="DM Mono,monospace" font-weight="600" fill="var(--good)">${Math.round(rente.kapitalstock)} Mrd. €</text>
  </svg>`;
}

function renderBeitragProjSVG(rente, p) {
  const el = document.getElementById('beitrag_proj_chart');
  if (!el) return;
  const W = 580, H = 160, pl = 48, pr = 16, pt = 12, pb = 28;
  const iW = W - pl - pr, iH = H - pt - pb;

  const allVals = [...rente.proj_ohne.map(d => d.beitrag), ...rente.proj_mit.map(d => d.beitrag)];
  const minV = Math.min(15, ...allVals), maxV = Math.max(25, ...allVals);
  const xOf = j => pl + ((j - 2025) / 20) * iW;
  const yOf = v => pt + iH - ((v - minV) / (maxV - minV)) * iH;

  const pts_ohne = rente.proj_ohne.map(d => xOf(d.jahr) + ',' + yOf(d.beitrag)).join(' ');
  const pts_mit  = rente.proj_mit.map(d => xOf(d.jahr) + ',' + yOf(d.beitrag)).join(' ');

  const yVals = [Math.ceil(minV), Math.round((minV+maxV)/2), Math.floor(maxV)].map(v => {
    const y = yOf(v);
    return `<line x1="${pl}" y1="${y}" x2="${pl+iW}" y2="${y}" stroke="rgba(42,39,32,0.08)" stroke-width="1"/>
            <text x="${pl-5}" y="${y+4}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${v}%</text>`;
  }).join('');

  const xLabels = [2025,2030,2035,2040,2045].map(j =>
    `<text x="${xOf(j)}" y="${pt+iH+16}" text-anchor="middle" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${j}</text>`
  ).join('');

  const legend = p.kapitalquote > 0
    ? `<line x1="${pl+8}" y1="${pt+8}" x2="${pl+26}" y2="${pt+8}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4,2"/>
       <text x="${pl+30}" y="${pt+12}" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">ohne Reform</text>
       <line x1="${pl+130}" y1="${pt+8}" x2="${pl+148}" y2="${pt+8}" stroke="var(--good)" stroke-width="2.5"/>
       <text x="${pl+152}" y="${pt+12}" font-size="10" font-family="DM Mono,monospace" fill="var(--good)">mit Reform</text>`
    : `<text x="${pl+8}" y="${pt+14}" font-size="11" font-family="DM Mono,monospace" fill="var(--muted)" font-style="italic">Fondsquote = 0 — kein Unterschied sichtbar</text>`;

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H+4}" style="width:100%;overflow:visible">
    ${yVals}${xLabels}
    <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <line x1="${pl}" y1="${pt+iH}" x2="${pl+iW}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <polyline points="${pts_ohne}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4,2" opacity="0.7"/>
    <polyline points="${pts_mit}"  fill="none" stroke="var(--good)" stroke-width="2.5"/>
    ${legend}
  </svg>`;
}

export { renderRenten, renderKapitalstockSVG, renderBeitragProjSVG };
