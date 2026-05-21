// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
import { grenzsteuersatz, effSteuersatz } from '../rechner/einkommensteuer.js';
import { DEZILE } from '../data.js';

// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Diagramme — ESt-Kurve, Einkommensverteilung, Schuldenquotenpfad
// Abhängigkeiten: grenzsteuersatz, effSteuersatz (rechner/einkommensteuer.js),
//                 DEZILE (data.js), REF (haushaltsspiel.js)
// ═══════════════════════════════════════════════════════

function renderEstKurve(p) {
  const el = document.getElementById('est_kurve');
  if (!el) return;
  const W = 640, H = 200, pl = 48, pr = 16, pt = 12, pb = 32;
  const iW = W - pl - pr, iH = H - pt - pb;
  const maxInc = 350000, maxRate = 55;

  const pts_grenz = [], pts_eff = [];
  for (let i = 0; i <= 280; i++) {
    const inc = (i / 280) * maxInc;
    const gs = grenzsteuersatz(inc, p.freibetrag, p.eingang, p.spitze, p.grenze) * 100;
    const es = effSteuersatz(inc, p.freibetrag, p.eingang, p.spitze, p.grenze) * 100;
    const x = pl + (inc / maxInc) * iW;
    const yg = pt + iH - Math.min(iH, (gs / maxRate) * iH);
    const ye = pt + iH - Math.min(iH, (es / maxRate) * iH);
    pts_grenz.push(x + ',' + yg);
    pts_eff.push(x + ',' + ye);
  }

  const yGrid = [0,10,20,30,40,50].map(v => {
    const y = pt + iH - (v / maxRate) * iH;
    return `<line x1="${pl}" y1="${y}" x2="${pl+iW}" y2="${y}" stroke="rgba(42,39,32,0.1)" stroke-width="1"/>
            <text x="${pl-5}" y="${y+4}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${v}%</text>`;
  }).join('');
  const xGrid = [50,100,150,200,250,300,350].map(v => {
    const x = pl + (v*1000 / maxInc) * iW;
    return `<line x1="${x}" y1="${pt}" x2="${x}" y2="${pt+iH}" stroke="rgba(42,39,32,0.1)" stroke-width="1"/>
            <text x="${x}" y="${pt+iH+18}" text-anchor="middle" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${v}k</text>`;
  }).join('');

  // Dezil-Markierungen
  const dezilMarks = DEZILE.map(d => {
    const x = pl + (Math.min(d.brutto, maxInc) / maxInc) * iW;
    const gs = grenzsteuersatz(d.brutto*(1-d.kapital), p.freibetrag, p.eingang, p.spitze, p.grenze)*100;
    const y = pt + iH - Math.min(iH, (gs / maxRate) * iH);
    return `<circle cx="${x}" cy="${y}" r="3" fill="var(--accent)" opacity="0.7"/>
            <text x="${x}" y="${pt+iH+28}" text-anchor="middle" font-size="9" font-family="DM Mono,monospace" fill="var(--muted)">${d.label}</text>`;
  }).join('');

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H+10}" style="width:100%;overflow:visible">
    ${yGrid}${xGrid}
    <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <line x1="${pl}" y1="${pt+iH}" x2="${pl+iW}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <polyline points="${pts_eff.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5,3" opacity="0.8"/>
    <polyline points="${pts_grenz.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>
    ${dezilMarks}
    <g transform="translate(${pl+8},${pt+10})">
      <line x1="0" y1="0" x2="18" y2="0" stroke="var(--accent)" stroke-width="2.5"/>
      <text x="22" y="4" font-size="11" font-family="DM Mono,monospace" fill="var(--ink)">Grenzsteuersatz</text>
      <line x1="0" y1="16" x2="18" y2="16" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5,3"/>
      <text x="22" y="20" font-size="11" font-family="DM Mono,monospace" fill="var(--ink)">Effektivsteuersatz</text>
    </g>
  </svg>`;
}

function renderIncomeDist(r, p) {
  const el = document.getElementById('income_dist_chart');
  if (!el) return;
  const W = 640, H = 180, pl = 48, pr = 16, pt = 12, pb = 32;
  const iW = W - pl - pr, iH = H - pt - pb;
  const maxNetto = Math.max(...r.hh_delta.netto) * 1.05;

  const nBars = r.hh_delta.netto.length;
  const bars = r.hh_delta.netto.map((n, i) => {
    const barW = Math.max(2, (iW / nBars) - 3);
    const x = pl + i * (iW / nBars) + 1.5;
    const barH = Math.max(2, (n / maxNetto) * iH);
    const y = pt + iH - barH;
    const isPoor = n < r.poverty_line;
    const fill = isPoor ? 'var(--bad)' : (r.hh_delta.delta[i] > 100 ? 'var(--good)' : 'var(--ink)');
    const nStr = n >= 1000 ? Math.round(n/1000) + 'k' : Math.round(n);
    const lbl = DEZILE[i].label;
    const fontSize = nBars > 10 ? '8' : '9';
    return `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${fill}" opacity="${isPoor?'1':'0.75'}"/>
            <text x="${x+barW/2}" y="${y-4}" text-anchor="middle" font-size="${fontSize}" font-family="DM Mono,monospace" fill="var(--muted)">${nStr}</text>
            <text x="${x+barW/2}" y="${pt+iH+18}" text-anchor="middle" font-size="${fontSize}" font-family="DM Mono,monospace" fill="var(--muted)">${lbl}</text>`;
  }).join('');

  // Armutsgrenze
  const povertyY = pt + iH - (r.poverty_line / maxNetto) * iH;
  const povertyLine = r.poverty_line > 0 ?
    `<line x1="${pl}" y1="${povertyY}" x2="${pl+iW}" y2="${povertyY}" stroke="var(--bad)" stroke-width="1.5" stroke-dasharray="6,3"/>
     <text x="${pl+iW-4}" y="${povertyY-5}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="var(--bad)">Armutsgrenze ${Math.round(r.poverty_line/1000)}k €</text>` : '';

  const yLabels = [0, 0.25, 0.5, 0.75, 1.0].map(f => {
    const v = Math.round(f * maxNetto / 1000);
    const y = pt + iH - f * iH;
    return `<line x1="${pl}" y1="${y}" x2="${pl+iW}" y2="${y}" stroke="rgba(42,39,32,0.08)" stroke-width="1"/>
            <text x="${pl-5}" y="${y+4}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${v}k</text>`;
  }).join('');

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H+10}" style="width:100%;overflow:visible">
    ${yLabels}
    <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <line x1="${pl}" y1="${pt+iH}" x2="${pl+iW}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    ${bars}${povertyLine}
  </svg>`;
}

function exportCSV(p, r, ref) {
  const rows = [];
  const sep = ';';

  rows.push(['Haushaltsspiel Deutschland — Export', new Date().toLocaleDateString('de-DE')].join(sep));
  rows.push([]);

  rows.push(['=== PARAMETER ===']);
  rows.push(['Grundfreibetrag', p.freibetrag + ' €']);
  rows.push(['Eingangssteuersatz', p.eingang + ' %']);
  rows.push(['Spitzensteuersatz', p.spitze + ' %']);
  rows.push(['Einkommen ab Spitzensatz', p.grenze + ' €']);
  rows.push(['Kapital synthetisch', p.synthetisch ? 'Ja' : 'Nein']);
  rows.push(['Abgeltungsteuer', p.abgeltung + ' %']);
  rows.push(['Körperschaftsteuer', p.kst + ' %']);
  rows.push(['Gewerbesteuer', p.gewst_aus ? 'abgeschafft' : p.gewst + ' %']);
  rows.push(['MwSt Regelsatz', p.mwst + ' %']);
  rows.push(['MwSt ermäßigt', p.mwst_erm + ' %']);
  rows.push(['CO₂-Preis', p.co2 + ' €/t']);
  rows.push(['Klimageld', p.klimageld ? 'Ja' : 'Nein']);
  rows.push(['Erbschaftsteuer Spitze', p.erb + ' %']);
  rows.push(['Bodenwertsteuer', p.boden + ' %']);
  rows.push(['Vermögensteuer', p.verm + ' %']);
  rows.push(['Rentenversicherung', p.rv + ' %']);
  rows.push(['Krankenversicherung', p.kv + ' %']);
  rows.push(['AL+Pflege', p.alpf + ' %']);
  rows.push(['Bürgerversicherung', p.buergerv ? 'Ja' : 'Nein']);
  rows.push(['Bürgergeld-Regelsatz', p.bg + ' €/Monat']);
  rows.push(['Kindergeld', p.kg + ' €/Monat']);
  rows.push([]);

  rows.push(['=== FISKAL-KENNZAHLEN (Mrd. €) ===']);
  rows.push(['Einnahmen gesamt', r.einnahmen_total.toFixed(1)]);
  rows.push(['Ausgaben gesamt', r.ausgaben_total.toFixed(1)]);
  rows.push(['Saldo', r.saldo.toFixed(1)]);
  rows.push(['Verwaltungskosten', r.admin_kosten.toFixed(1)]);
  rows.push([]);

  rows.push(['=== EINNAHMEN NACH STEUERART (Mrd. €) ===']);
  const rLabels = {est:'Einkommensteuer',kst:'Körperschaftsteuer',gewst:'Gewerbesteuer',mwst:'Mehrwertsteuer',co2:'CO₂ (netto)',erbschaft:'Erbschaftsteuer',boden:'Bodenwertsteuer',vermoegen:'Vermögensteuer',rv:'Rentenversicherung',kv:'Krankenversicherung',al:'AL+Pflege',klein:'Kleine Verbrauchsteuern'};
  Object.entries(r.rev).forEach(([k,v]) => rows.push([rLabels[k]||k, v.toFixed(1)]));
  rows.push([]);

  rows.push(['=== VERTEILUNG NACH DEZIL ===']);
  rows.push(['Dezil', 'Netto-Einkommen (€)', 'Δ vs. Status Quo (€)', 'Steuerbelastung (%)']);
  r.hh_delta.netto.forEach((n, i) => rows.push([
    'D' + (i+1), Math.round(n), Math.round(r.hh_delta.delta[i]), r.hh_delta.belastung_pct[i].toFixed(1)
  ]));
  rows.push([]);

  rows.push(['=== VERTEILUNGS- & VERHALTENSKENNZAHLEN ===']);
  rows.push(['Gini-Koeffizient (neu)', r.gini.toFixed(4)]);
  rows.push(['Gini-Koeffizient (Basis)', ref.gini.toFixed(4)]);
  rows.push(['Palma-Ratio', r.palma.toFixed(3)]);
  rows.push(['Arbeitsangebot Index', r.behavior.labor.toFixed(1)]);
  rows.push(['Konsum Index', r.behavior.konsum.toFixed(1)]);
  rows.push(['Investitionen Index', r.behavior.invest.toFixed(1)]);
  rows.push(['CO₂-Emissionen Index', r.behavior.co2.toFixed(1)]);

  const csvStr = rows.map(r => Array.isArray(r) ? r.join(sep) : r).join('\n');
  const blob = new Blob(['﻿' + csvStr], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'haushaltsspiel_export_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function berechneSchuldenpfad(saldo_neu, saldo_sq) {
  const bip_g = 0.015; // nominal 1,5 % BIP-Wachstum
  const zins  = 0.025; // Ø-Zins auf Bestandsschulden (Rollover-Effekt ~2,5 %)
  let bip     = 4200;
  let schuld_neu = 64.0 / 100 * bip;  // Startpunkt: 64 % BIP 2025 (IMF Article IV 2025)
  let schuld_sq  = 64.0 / 100 * bip;
  const pfad = [{jahr:2025, neu:64.0, sq:64.0}];

  for (let y = 1; y <= 20; y++) {
    bip *= (1 + bip_g);
    // Zinsdynamik: wenn neue Schulden > SQ-Schulden, fallen Mehrzinsen an
    const extra_zins = (schuld_neu - schuld_sq) * zins;
    schuld_neu -= (saldo_neu - extra_zins);
    schuld_sq  -= saldo_sq;
    pfad.push({ jahr: 2025+y, neu: schuld_neu/bip*100, sq: schuld_sq/bip*100 });
  }
  return pfad;
}

function renderSchuldenpfad(r, ref) {
  const el = document.getElementById('schulden_pfad_chart');
  if (!el) return;
  const pfad = berechneSchuldenpfad(r.saldo, ref.saldo);
  const W=640, H=160, pl=48, pr=16, pt=12, pb=28;
  const iW=W-pl-pr, iH=H-pt-pb;
  const allV = pfad.flatMap(p=>[p.neu,p.sq]);
  const minV = Math.min(30, ...allV), maxV = Math.max(80, ...allV);
  const xOf = j => pl + ((j-2025)/20)*iW;
  const yOf = v => pt + iH - ((v-minV)/(maxV-minV))*iH;

  const pts_neu = pfad.map(p=>xOf(p.jahr)+','+yOf(p.neu)).join(' ');
  const pts_sq  = pfad.map(p=>xOf(p.jahr)+','+yOf(p.sq)).join(' ');

  const yVals = [40,50,60,70,80,90].filter(v=>v>=minV-5&&v<=maxV+5).map(v => {
    const y = yOf(v);
    const isM = v===60, isR = v===90;
    const col = isM ? 'rgba(200,64,31,0.5)' : isR ? 'rgba(200,64,31,0.8)' : 'rgba(42,39,32,0.08)';
    return `<line x1="${pl}" y1="${y}" x2="${pl+iW}" y2="${y}" stroke="${col}" stroke-width="${isM||isR?1.5:1}" stroke-dasharray="${isM||isR?'6,3':''}"/>
            <text x="${pl-5}" y="${y+4}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="${isM||isR?'var(--bad)':'var(--muted)'}">
              ${v}%${isM?' ←Maas.':isR?' ←R/R':''}
            </text>`;
  }).join('');
  const xLabels = [2025,2030,2035,2040,2045].map(j=>
    `<text x="${xOf(j)}" y="${pt+iH+16}" text-anchor="middle" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${j}</text>`
  ).join('');

  const endNeu = pfad[pfad.length-1].neu.toFixed(1);
  const endSQ  = pfad[pfad.length-1].sq.toFixed(1).replace('.',',');
  const sameScenario = Math.abs(r.saldo - ref.saldo) < 0.5;

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H+4}" style="width:100%;overflow:visible">
    ${yVals}${xLabels}
    <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <line x1="${pl}" y1="${pt+iH}" x2="${pl+iW}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    ${!sameScenario?`<polyline points="${pts_sq}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4,2" opacity="0.6"/>`:'' }
    <polyline points="${pts_neu}" fill="none" stroke="${r.saldo>0?'var(--good)':'var(--bad)'}" stroke-width="2.5"/>
    <text x="${xOf(2045)-4}" y="${yOf(pfad[20].neu)-8}" text-anchor="end" font-size="11" font-family="DM Mono,monospace" font-weight="600" fill="${r.saldo>0?'var(--good)':'var(--bad)'}">${(+endNeu).toFixed(1).replace('.',',')} %</text>
    ${!sameScenario?`<text x="${xOf(2045)-4}" y="${yOf(pfad[20].sq)+14}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">SQ: ${endSQ} %</text>`:''}
    <g transform="translate(${pl+8},${pt+8})">
      <line x1="0" y1="0" x2="18" y2="0" stroke="${r.saldo>0?'var(--good)':'var(--bad)'}" stroke-width="2.5"/>
      <text x="22" y="4" font-size="10" font-family="DM Mono,monospace" fill="var(--ink)">Aktuelles Szenario</text>
      ${!sameScenario?`<line x1="0" y1="14" x2="18" y2="14" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4,2"/>
      <text x="22" y="18" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">Status Quo</text>`:''}
    </g>
  </svg>`;
}

// ── ZEITREIHEN-CHART (Multi-Perioden) ──────────────────────────────────

function renderZeitreihe(pfad) {
  const el = document.getElementById('zeitreihe_chart');
  if (!el || !pfad || pfad.length === 0) return;

  const W = 640, H = 280, pad = { t: 12, r: 16, b: 28, l: 52 };
  const iW = W - pad.l - pad.r;
  const rowH = (H - pad.t - pad.b) / 2 - 8;
  const cols = [0, W / 2];
  const rows = [pad.t, pad.t + rowH + 24];

  const labels = pfad.map(p => p.label);
  const n = pfad.length;
  const xOf = (i, col) => cols[col] + pad.l + (i / (n - 1)) * (iW / 2 - pad.l - pad.r / 2);

  function sparkline(data, x0, y0, h, color, domain, refLine = null, labelFn = v => v.toFixed(0)) {
    const [dmin, dmax] = domain;
    const range = dmax - dmin || 1;
    const yOf = v => y0 + h - ((v - dmin) / range) * h;
    const pts = data.map((v, i) => `${x0 + pad.l + (i / (n - 1)) * (iW / 2 - pad.l - 4)},${yOf(v)}`).join(' ');

    let refSvg = '';
    if (refLine !== null) {
      const ry = yOf(refLine);
      if (ry >= y0 && ry <= y0 + h) {
        refSvg = `<line x1="${x0 + pad.l}" y1="${ry}" x2="${x0 + pad.l + iW / 2 - pad.l - 4}" y2="${ry}"
          stroke="var(--bad)" stroke-width="1" stroke-dasharray="4,2" opacity="0.6"/>`;
      }
    }

    const dotLast = data[n - 1];
    const xLast = x0 + pad.l + iW / 2 - pad.l - 4;
    const yLast = yOf(dotLast);

    const yLabels = [dmin, (dmin + dmax) / 2, dmax].map(v => {
      const y = yOf(v);
      return `<text x="${x0 + pad.l - 5}" y="${y + 4}" text-anchor="end"
        font-size="9" font-family="DM Mono,monospace" fill="var(--muted)">${labelFn(v)}</text>`;
    }).join('');

    const xTicks = labels.map((lbl, i) => {
      const x = x0 + pad.l + (i / (n - 1)) * (iW / 2 - pad.l - 4);
      return `<text x="${x}" y="${y0 + h + 14}" text-anchor="middle"
        font-size="9" font-family="DM Mono,monospace" fill="var(--muted)">${lbl.split('–')[0]}</text>`;
    }).join('');

    return `
      <line x1="${x0 + pad.l}" y1="${y0}" x2="${x0 + pad.l}" y2="${y0 + h}" stroke="var(--rule)" stroke-width="1"/>
      <line x1="${x0 + pad.l}" y1="${y0 + h}" x2="${x0 + pad.l + iW / 2 - pad.l - 4}" y2="${y0 + h}" stroke="var(--rule)" stroke-width="1"/>
      ${refSvg}
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="${xLast}" cy="${yLast}" r="3.5" fill="${color}"/>
      <text x="${xLast + 5}" y="${yLast + 4}" font-size="10" font-family="DM Mono,monospace" font-weight="600" fill="${color}">${labelFn(dotLast)}</text>
      ${yLabels}
      ${xTicks}`;
  }

  // KPI-Daten aus Pfad extrahieren
  const saldos     = pfad.map(p => p.result.saldo);
  const schulden   = pfad.map(p => p.zustand.schuldenquote);
  const ginis      = pfad.map(p => p.result.gini * 1000);
  const co2s       = pfad.map(p => p.result.behavior.co2);

  const saldoMin = Math.min(-120, ...saldos) - 10;
  const saldoMax = Math.max(50, ...saldos) + 10;
  const schulMax = Math.max(90, ...schulden) + 5;
  const giniMin  = Math.min(260, ...ginis) - 5;
  const giniMax  = Math.max(320, ...ginis) + 5;

  // Titel-Texte
  function kpiTitle(label, x0, y0) {
    return `<text x="${x0 + pad.l}" y="${y0 - 4}" font-size="10" font-family="DM Mono,monospace"
      font-weight="600" fill="var(--ink)" text-transform="uppercase" letter-spacing=".08em">${label}</text>`;
  }

  const svg = `<svg viewBox="0 0 ${W} ${H + 8}" style="width:100%;overflow:visible">
    ${kpiTitle('Haushaltssaldo (Mrd. €)', cols[0], rows[0])}
    ${sparkline(saldos, cols[0], rows[0], rowH, 'var(--accent)', [saldoMin, saldoMax], 0,
        v => (v >= 0 ? '+' : '') + v.toFixed(0))}
    ${kpiTitle('Schuldenquote (% BIP)', cols[1], rows[0])}
    ${sparkline(schulden, cols[1], rows[0], rowH, 'var(--bad)', [30, schulMax], 60,
        v => v.toFixed(0) + ' %')}
    ${kpiTitle('Gini × 1000', cols[0], rows[1])}
    ${sparkline(ginis, cols[0], rows[1], rowH, 'var(--warn)', [giniMin, giniMax], null,
        v => v.toFixed(0))}
    ${kpiTitle('CO₂-Index (100 = SQ)', cols[1], rows[1])}
    ${sparkline(co2s, cols[1], rows[1], rowH, 'var(--good)', [40, 110], 50,
        v => v.toFixed(0))}
  </svg>`;

  el.innerHTML = svg;
}

// ── STAATSAUSGABEN-DIAGRAMM ────────────────────────────────────────────

function renderStaatsausgaben(r) {
  const el = document.getElementById('staatsausgaben_chart');
  if (!el) return;

  // Ausgaben-Kategorien für die aktive Periode
  const kategorien = [
    { label: 'Sozial / Rente / SV',  wert: 850 + r.demografie_aufschlag + (r.sv_ausgaben_delta ?? 0),    sq: 850,  color: 'var(--accent)' },
    { label: 'Gesundheit',           wert: 320,                                                            sq: 320,  color: 'var(--muted)' },
    { label: 'Bildung',              wert: 180,                                                            sq: 180,  color: 'var(--muted)' },
    { label: 'Transfers (BG/KG)',    wert: 140 + (r.bg_auszahlung ?? 0) + (r.kg_auszahlung ?? 0),         sq: 140,  color: 'var(--warn)' },
    { label: 'Verteidigung',         wert: 90,                                                             sq: 90,   color: 'var(--muted)' },
    { label: 'Infrastruktur',        wert: 120 + (r.invest_impuls ?? 0),                                  sq: 120,  color: 'var(--good)' },
    { label: 'Verwaltung + Admin',   wert: 140 + (r.admin_kosten ?? 0),                                   sq: 140,  color: 'var(--muted)' },
    { label: 'Zinsen',               wert: 30,                                                             sq: 30,   color: 'var(--bad)' },
  ];

  const maxWert = Math.max(...kategorien.map(k => Math.max(k.wert, k.sq))) * 1.08;
  const W = 560, rowH = 22, gap = 4, padL = 156, padR = 56, padT = 6;
  const iW = W - padL - padR;
  const H = kategorien.length * (rowH + gap) + padT + 24;

  const bars = kategorien.map((k, i) => {
    const y = padT + i * (rowH + gap);
    const wNeu = (k.wert / maxWert) * iW;
    const wSQ  = (k.sq  / maxWert) * iW;
    const diff = k.wert - k.sq;
    const diffStr = diff === 0 ? '' : (diff > 0 ? '+' : '') + diff.toFixed(0) + ' Mrd.';
    const diffCol = diff > 0 ? 'var(--bad)' : diff < 0 ? 'var(--good)' : 'var(--muted)';
    return `
      <text x="${padL - 8}" y="${y + rowH * 0.7}" text-anchor="end"
        font-size="10" font-family="DM Mono,monospace" fill="var(--ink)">${k.label}</text>
      <rect x="${padL}" y="${y + 2}" width="${wSQ}" height="${rowH - 4}"
        fill="var(--rule)" rx="2"/>
      <rect x="${padL}" y="${y + 2}" width="${Math.max(2, wNeu)}" height="${rowH - 4}"
        fill="${k.color}" opacity="0.75" rx="2"/>
      <text x="${padL + Math.max(wNeu, wSQ) + 6}" y="${y + rowH * 0.7}"
        font-size="10" font-family="DM Mono,monospace" fill="${diffCol}">${k.wert.toFixed(0)}${diffStr ? ' · ' + diffStr : ''}</text>`;
  }).join('');

  const legende = `
    <rect x="${padL}" y="${H - 18}" width="12" height="8" fill="var(--rule)" rx="1"/>
    <text x="${padL + 16}" y="${H - 11}" font-size="9" font-family="DM Mono,monospace" fill="var(--muted)">Status Quo</text>
    <rect x="${padL + 90}" y="${H - 18}" width="12" height="8" fill="var(--accent)" opacity=".75" rx="1"/>
    <text x="${padL + 106}" y="${H - 11}" font-size="9" font-family="DM Mono,monospace" fill="var(--muted)">Aktuelle Periode</text>`;

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;overflow:visible">
    ${bars}
    ${legende}
  </svg>`;
}

export { renderEstKurve, renderIncomeDist, exportCSV, berechneSchuldenpfad, renderSchuldenpfad, renderZeitreihe, renderStaatsausgaben };
