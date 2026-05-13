// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
import { BASIS_MAKRO } from '../data.js';

// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Rentenreform & GKV-Strukturreformen
// Abhängigkeiten: BASIS_MAKRO (aus data.js)
// ═══════════════════════════════════════════════════════

// Quellenmetadaten — parallel zu den Berechnungsfunktionen
const FORMEL_QUELLEN_RENTE = {
  generationenkapital: {
    formel: 'Kapitalstock_t = (Kapitalstock_{t−1} + Jahresinvestition) × (1 + r)',
    ref:    'Norges Bank NBIM Annual Report 2024 · Rentenpaket II BT-Drs. 20/10749 · KfW-Research 2025',
    note:   'r = nominelle Rendite; Inflationsabzug für Realrendite nötig. MSCI World historisch ~7 % nominal, ~5 % real'
  },
  beitragspfad: {
    formel: 'Beitrag_t = Beitrag_0 + t × 0,3 PP  (Demografiedruck ohne Reform)',
    ref:    'SVR Jahresgutachten 2023/24 · DRV Rentenversicherungsbericht 2024',
    note:   '+0,3 PP/Jahr bis 2045 ohne Reform (konservativer SVR-Wert). Projektion mit Fonds: Beitrag − Entlastung_t'
  },
  pkv_abschaffung: {
    formel: 'Nettoeffekt = Zusatz_Einnahmen − Zusatz_Ausgaben',
    ref:    'PKV-Verband 2025 · IGES Institut 2021 · GKV-SV Jahresbericht 2025 · Lauterbach et al. 2005',
    note:   '11 Mio. PKV → GKV: Einnahmen +~8 Mrd., Ausgaben +~8,5 Mrd. Nettoeffekt leicht negativ'
  },
  kassenfusion: {
    formel: 'Ersparnis = Admin_SQ × (1 − Kassen/95) × 0,45',
    ref:    'GKV-SV Jahresbericht 2025 · Reinhardt et al. Health Affairs 2004',
    note:   '45 % Fixkostendegression bei Kassenzusammenlegung; Admin_SQ = 12 Mrd. €/Jahr (95 Kassen 2025)'
  },
  praevention: {
    formel: 'Nettoersparnis = Investition × (ROI − 1)',
    ref:    'WHO (2017) Return on Investment of Public Health Interventions · GKV-SV Präventionsbericht 2024',
    note:   'ROI vereinfacht 1,5× (Nettonutzen 0,5×); langfristig: 3–5× laut WHO über 20 Jahre'
  }
};


function berechneRente(params, rv_aufkommen_aktuell) {
  const lohnsumme_sv = BASIS_MAKRO.lohnsumme_sv; // Mrd. Beitragsbasis

  // --- Generationenkapital: historisches Was-wäre-wenn ---
  // Jedes Jahr wird Fondsquote % des RV-Aufkommens investiert
  const years_history = Math.max(0, 2025 - params.startjahr);
  const annual_inv = rv_aufkommen_aktuell * params.kapitalquote / 100; // Mrd. / Jahr
  let kapitalstock = 0;
  const ks_history = []; // für Chart
  for (let y = 0; y < years_history; y++) {
    kapitalstock = (kapitalstock + annual_inv) * (1 + params.rendite_fonds / 100);
    ks_history.push({ jahr: params.startjahr + y + 1, ks: kapitalstock });
  }
  const jahresertrag = kapitalstock * params.rendite_fonds / 100; // Mrd. / Jahr
  const beitragsentlastung = (jahresertrag / lohnsumme_sv) * 100; // Prozentpunkte

  // --- Beitragssatz-Projektion 2025–2045 ---
  // Demografiedruck: ohne Reform +0,3 PP/Jahr (SVR-Schätzung)
  const demo_anstieg = 0.30;
  const sq_beitrag = 18.6;
  const proj_ohne = [];
  const proj_mit = [];
  let ks_proj = kapitalstock;
  for (let y = 0; y <= 20; y++) {
    const beitrag_ohne = sq_beitrag + y * demo_anstieg;
    // Fonds wächst weiter: jedes Projektionsjahr investiert man weiter + Zinseszins
    if (params.kapitalquote > 0) {
      ks_proj = (ks_proj + annual_inv) * (1 + params.rendite_fonds / 100);
    }
    const ertrag_y = ks_proj * params.rendite_fonds / 100;
    const entlastung_y = (ertrag_y / lohnsumme_sv) * 100;
    proj_ohne.push({ jahr: 2025 + y, beitrag: beitrag_ohne });
    proj_mit.push({ jahr: 2025 + y, beitrag: Math.max(12, beitrag_ohne - entlastung_y) });
  }

  // --- GKV Reformen ---
  // PKV-Abschaffung: ~11 Mio. Privatversicherte; GKV-Kosten höher als PKV-Einsparung
  const pkv_versicherte = 11; // Mio.
  // GKV-Beitrag bei aktueller Quote für diese Einkommensgruppe ~600€/M, PKV heute ~450€/M
  // PKV-Abschaffung: mehr Einnahmen durch breitere Basis, aber auch höhere Leistungsausgaben
  const pkv_zusatz_einnahmen = params.pkv_abschaffen ? pkv_versicherte * 0.60 * 12 / 1000 : 0; // Mrd.
  const pkv_zusatz_ausgaben  = params.pkv_abschaffen ? pkv_versicherte * 0.65 * 12 / 1000 : 0; // etwas mehr wegen GKV-Standard
  const pkv_netto_effekt = pkv_zusatz_einnahmen - pkv_zusatz_ausgaben;

  // Kassenfusion: GKV-Verwaltungskosten ~12 Mrd.; proportionaler Fixkostenabbau
  const kv_admin_sq = 12;
  const kassen_ersparnis = params.anzahl_kv < 95
    ? kv_admin_sq * (1 - params.anzahl_kv / 95) * 0.45
    : 0;

  // Prävention: langfristiger ROI 1,5× (Vereinfachung; EU-Studie: 1€ → 3€ über 20J.)
  const praevention_ersparnis = params.praevention * 1.5 - params.praevention; // Nettoersparnis

  const gkv_gesamt_effekt = pkv_netto_effekt + kassen_ersparnis + praevention_ersparnis;

  return {
    kapitalstock, jahresertrag, beitragsentlastung, annual_inv, ks_history,
    proj_ohne, proj_mit,
    pkv_netto_effekt, kassen_ersparnis, praevention_ersparnis, gkv_gesamt_effekt
  };
}

export { berechneRente, FORMEL_QUELLEN_RENTE };
