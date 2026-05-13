// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Verteilungsmetriken & Dezilberechnung
// Abhängigkeiten: DEZILE, ELAST (aus data.js), estTarif, grenzsteuersatz (aus einkommensteuer.js)
// ═══════════════════════════════════════════════════════

// Quellenmetadaten — parallel zu den Berechnungsfunktionen
const FORMEL_QUELLEN_VERT = {
  berechneGini: {
    formel: 'G = 1 − 2·∫Lorenz(x)dx  (Trapezregel, gewichtet nach Haushaltszahl)',
    ref:    'Sen (1973) On Economic Inequality · Cowell (2011) Measuring Inequality · Destatis Methodik Gini-Koeffizient',
    note:   'Gewichtet nach DEZILE[i].anzahl; D10a/b/c (2,05 / 1,64 / 0,41 Mio. HH) werden korrekt gewichtet'
  },
  berechnePalma: {
    formel: 'Palma = Ø(Top 10%) / Ø(Bottom 40%)',
    ref:    'Palma (2011) Homogeneous Middles vs. Heterogeneous Tails · UNDP HDR 2013',
    note:   'Robuster gegenüber Mittelstand-Verzerrung als Gini; international gut vergleichbar'
  },
  berechneMedianGewichtet: {
    formel: 'Gewichteter Median: kumulierte Haushaltsanteile bis 50 %',
    ref:    'Destatis Mikrozensus 2024 · SOEP v40',
    note:   'Basis für Armutsgrenze: 60 % des gewichteten Medians (EU-SILC-Konvention, Art. 7 VO 2019/1700)'
  },
  armutsrisiko: {
    formel: 'pov_i = pov_sq_i × (y_i/y_sq_i ÷ PL/PL_sq)^(−1,5)',
    ref:    'Bourguignon (2003) JPubEc · EU-SILC DE 2023 (14,8 % Kalibrierung) · SOEP v40 · IAB Kurzbericht 2024',
    note:   'Elastizität −1,5: +1 % Einkommen → −1,5 % Armutsanteil. Intra-Dezil: D1 90 %, D2 62 %, D3 5 % (SOEP)'
  },
  berechneNettoSQ: {
    formel: 'Netto_SQ = Brutto − ESt(SQ) − SV(SQ) − MwSt(SQ) − CO₂(SQ) + Klimageld(SQ) + Transfers(SQ)',
    ref:    'PRESETS.status_quo (data.js) · § 32a EStG 2025 · § 158 SGB VI · § 241 SGB V',
    note:   'Referenzpunkt für alle Δ-Berechnungen; Parameter: freibetrag 12.084, eingang 14 %, spitze 45 %'
  },
  berechneDezilDelta: {
    formel: 'Δ_i = Netto_neu_i − Netto_SQ_i',
    ref:    'SOEP v40 · Destatis Mikrozensus 2024 · BMF Steuerschätzung 2025',
    note:   'Dezil-Gewichte: bg_quote [0,60..0], kg_quote [0,80..0,20] aus Mikrozensus 2024'
  }
};


function berechneGini(werte, dezile) {
  const pairs = werte.map((v, i) => ({ v, w: dezile[i].anzahl })).sort((a, b) => a.v - b.v);
  const W = pairs.reduce((s, p) => s + p.w, 0);
  const S = pairs.reduce((s, p) => s + p.w * p.v, 0);
  if (S <= 0 || W <= 0) return 0;
  let cumW = 0, cumS = 0, area = 0;
  for (const p of pairs) {
    const x0 = cumW / W, y0 = cumS / S;
    cumW += p.w;
    cumS += p.w * p.v;
    area += (cumW / W - x0) * (cumS / S + y0) / 2; // Trapezregel
  }
  return Math.max(0, Math.min(1, 1 - 2 * area));
}

function berechneMedianGewichtet(werte, dez) {
  // Gewichteter Median: Hälfte der Haushalte liegt darunter
  const pairs = werte.map((v,i) => ({v, n: dez[i].anzahl})).sort((a,b)=>a.v-b.v);
  const half = pairs.reduce((a,p)=>a+p.n,0) / 2;
  let cum = 0;
  for (const p of pairs) { cum += p.n; if (cum >= half) return p.v; }
  return pairs[pairs.length-1].v;
}

function berechnePalma(werte) {
  // Palma-Ratio: Durchschnittseinkommen Top-10% / Durchschnitt Bottom-40%
  const pairs = werte.map((v,i) => ({v, n: DEZILE[i].anzahl})).sort((a,b)=>a.v-b.v);
  const total_n = pairs.reduce((a,p)=>a+p.n,0);
  const bot_limit = total_n * 0.40;
  const top_limit = total_n * 0.10;
  let bot_sum=0, bot_n=0, top_sum=0, top_n=0, cum_bot=0, cum_top=0;
  for (const p of pairs) {
    if (cum_bot + p.n <= bot_limit + 1e-9) { bot_sum+=p.v*p.n; bot_n+=p.n; cum_bot+=p.n; }
  }
  for (let j=pairs.length-1; j>=0; j--) {
    if (cum_top + pairs[j].n <= top_limit + 1e-9) { top_sum+=pairs[j].v*pairs[j].n; top_n+=pairs[j].n; cum_top+=pairs[j].n; }
  }
  return (bot_n>0&&top_n>0) ? (top_sum/top_n)/(bot_sum/bot_n) : 0;
}

function berechneDezilDelta(dezile, params, est_dez, klima, bg, kg) {
  // Netto-Einkommen pro Dezil NEU
  const netto = [];
  const delta = [];
  const belastung_pct = [];
  for (let i = 0; i < dezile.length; i++) {
    const d = dezile[i];
    const est = est_dez[i].est;
    const brutto = d.brutto_adj;
    // K3: SV nur auf Arbeitseinkommen (nicht Kapital); KV-BBG (62.100 €) < RV/AL-BBG
    const arbeit_dez = brutto * (1 - d.kapital);
    const bbg_rv_dez = params.bbg ?? 90000;
    // kv_bbg_frei: kein KV-Beitragsdeckel → gesamtes Arbeitseinkommen KV-pflichtig
    const bbg_kv_dez = params.kv_bbg_frei ? Infinity : Math.round(bbg_rv_dez * (62100 / 90000));
    const sv_lohn = Math.min(arbeit_dez, bbg_rv_dez) * (params.rv + params.alpf * 0.42) / 100 * 0.5
                  + Math.min(arbeit_dez, bbg_kv_dez) * (params.kv + params.alpf * 0.58) / 100 * 0.5;
    // kv_kapital: Kapitalerträge von GKV-Mitgliedern werden KV-pflichtig (Mieteinnahmen, Zinsen, Dividenden)
    // GKV-Quote sinkt in den oberen Dezilen (mehr PKV)
    const GKV_QUOTE = [0.95, 0.95, 0.95, 0.93, 0.90, 0.85, 0.80, 0.75, 0.70, 0.55, 0.30, 0.08];
    const sv_kapital = params.kv_kapital ? brutto * d.kapital * params.kv / 100 * 0.5 * GKV_QUOTE[i] : 0;
    const sv = sv_lohn + sv_kapital;
    // MwSt auf Konsum
    const vornetto = brutto - est - sv;
    const konsum = vornetto * d.konsum;
    const mwst = konsum * (0.7 * params.mwst / (100 + params.mwst) + 0.3 * params.mwst_erm / (100 + params.mwst_erm));
    // CO2-Last (untere Dezile höherer Anteil am Einkommen)
    // CO₂-Last: Dezil-Anteil am Einkommen × CO₂-Preis × Emissionsreaktion
    // D10a/b/c: sinkender CO2-Anteil am Einkommen, aber absolut höher
    const co2_share = [0.040, 0.038, 0.036, 0.034, 0.032, 0.030, 0.028, 0.025, 0.022, 0.018, 0.015, 0.010];
    const co2_factor_dez = Math.max(0.4, Math.min(1.1, 1 + ELAST.co2 * (params.co2 - 55) / 100));
    const co2_last = brutto * co2_share[i] * (params.co2 / 55) * co2_factor_dez;
    // Klimageld zurück (gleichverteilt pro Kopf)
    const total_hh = DEZILE.reduce((a,d)=>a+d.anzahl,0);
    const klimageld_per_hh = klima * 1000 / total_hh;
    // Transfers erhalten
    // Bürgergeld: D1–D3/D4, D10a/b/c = 0
    const bg_quote = [0.60, 0.25, 0.08, 0.02, 0, 0, 0, 0, 0, 0, 0, 0];
    // Kindergeld: Mikrozensus 2024; D10a/b/c: 0,45/0,35/0,20 Kinder im Schnitt
    const kg_quote = [0.80, 1.10, 1.20, 1.15, 1.05, 0.95, 0.85, 0.75, 0.65, 0.50, 0.35, 0.20];
    const bge_p = params.bge || 0;
    // Bürgergeld effektiv: 0 wenn BGE >= BG-Niveau (BGE ersetzt es, RWI 2024)
    const bg_effektiv_hh = bge_p >= params.bg ? 0 : params.bg;
    let transfers = 0;
    transfers += bg_effektiv_hh * 12 * bg_quote[i];
    transfers += params.kg * 12 * kg_quote[i];
    transfers += bge_p * 12; // BGE: jeder Erwachsene erhält vollen Betrag (bedingungslos)
    if (params.neg_est && i < 3) transfers += 3000;

    const netto_final = brutto - est - sv - mwst - co2_last + klimageld_per_hh + transfers;

    // STATUS-QUO-Vergleich (hart codiert auf Basisparameter gerechnet)
    const netto_sq = berechneNettoSQ(d);
    netto.push(netto_final);
    delta.push(netto_final - netto_sq);
    belastung_pct.push(100 * (est + sv + mwst + co2_last - transfers) / brutto);
  }
  return { netto, delta, belastung_pct };
}

function berechneNettoSQ(d) {
  const sq = PRESETS.status_quo;
  const brutto = d.brutto;
  const arbeit_sq = brutto * (1 - d.kapital);
  const kapital_sq = brutto * d.kapital;
  const bbg_rv = sq.bbg;
  const bbg_kv = Math.round(bbg_rv * (BASIS_MAKRO.kv_bbg_kv_sq / 90000));
  const est = estTarif(arbeit_sq, sq.freibetrag, sq.eingang, sq.spitze, sq.grenze)
            + kapital_sq * sq.abgeltung / 100;
  const sv = Math.min(arbeit_sq, bbg_rv) * (sq.rv + sq.alpf * 0.42) / 100 * 0.5
           + Math.min(arbeit_sq, bbg_kv) * (sq.kv + sq.alpf * 0.58) / 100 * 0.5;
  const vornetto = brutto - est - sv;
  const konsum = vornetto * d.konsum;
  const mwst = konsum * (0.7 * sq.mwst / (100 + sq.mwst) + 0.3 * sq.mwst_erm / (100 + sq.mwst_erm));
  const co2_share = [0.040, 0.038, 0.036, 0.034, 0.032, 0.030, 0.028, 0.025, 0.022, 0.018, 0.015, 0.010];
  const co2_last = brutto * co2_share[d.idx];
  const sq_co2_auf = 500 * sq.co2 / 1000;
  const total_hh_sq = DEZILE.reduce((a,x)=>a+x.anzahl,0);
  const klimageld_per_hh = sq_co2_auf * 0.7 * 1000 / total_hh_sq;
  let transfers = 0;
  const bg_quote_sq = [0.60, 0.25, 0.08, 0.02, 0, 0, 0, 0, 0, 0, 0, 0];
  const kg_quote_sq = [0.80, 1.10, 1.20, 1.15, 1.05, 0.95, 0.85, 0.75, 0.65, 0.50, 0.35, 0.20];
  transfers += sq.bg * 12 * bg_quote_sq[d.idx];
  transfers += sq.kg * 12 * kg_quote_sq[d.idx];
  return brutto - est - sv - mwst - co2_last + klimageld_per_hh + transfers;
}
