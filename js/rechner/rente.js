// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
import { BASIS_MAKRO, PRESETS } from '../data.js';

// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Rentenreform & GKV-Strukturreformen
// Abhängigkeiten: BASIS_MAKRO (aus data.js)
// ═══════════════════════════════════════════════════════

// Quellenmetadaten — parallel zu den Berechnungsfunktionen
const INFLATION_ANNAHME = 0.02;   // EZB-Inflationsziel, für die reale Fondsrendite

// PKV (F-043): Vollversicherte 2024 laut PKV-Verband; Nettoeffekt einer Einbeziehung in die GKV laut
// IGES/Bertelsmann Stiftung (2020), Mittelwert der Spanne 2,4–4,3 Mrd. € bei unveränderten Arzthonoraren
const PKV = { vollversicherte_mio: 8.74, nettoeffekt_gkv_mrd: (2.4 + 4.3) / 2 };

const FORMEL_QUELLEN_RENTE = {
  generationenkapital: {
    formel: 'bis 2025: K_t = (K_{t−1} + Einzahlung) × (1 + r_real); ab 2025: Entlastung_t = K_t × r_real / Lohnsumme, K_{t+1} = K_t + Einzahlung',
    ref:    'Norges Bank NBIM Annual Report 2024 · Rentenpaket II: BT-Drs. 20/11898 (Entwurf, nicht verabschiedet) · KfW-Research 2025',
    refs:   ['B32'],
    note:   'Real in Preisen von 2025 (r_real = (1 + r)/(1 + 2 %) − 1); ab 2025 wird der reale Ertrag vollständig ausgeschüttet, sodass kein Ertrag doppelt zählt (F-016)'
  },
  beitragspfad: {
    formel: 'Beitrag_t = Beitrag_SQ + (Pfad_t − 18,6)  (Pfad: Rentenversicherungsbericht 2025, mittlere Variante)',
    ref:    'BMAS Rentenversicherungsbericht 2025',
    refs:   ['B36'],
    note:   '18,6 % bis 2027, 19,8 % (2028), 20,0 % (2029), 20,1 % (2030), 21,2 % (2039); 2040–2045 mit dem Anstieg 2030–2039 fortgeschrieben [ANNAHME]. Projektion mit Fonds: Beitrag − Entlastung_t'
  },
  pkv_abschaffung: {
    formel: 'Nettoeffekt GKV = Mittelwert der IGES-Spanne (2,4–4,3 Mrd. €/Jahr)',
    ref:    'IGES/Bertelsmann Stiftung (2020) Duales System der Krankenversicherung · PKV-Verband 2025 (8,74 Mio. Vollversicherte 2024)',
    note:   'Szenario mit unveränderten Arzthonoraren; bei Angleichung der Honorare bis ~9 Mrd. €. Stand 2020, nicht fortgeschrieben'
  },
  kassenfusion: {
    formel: 'Ersparnis = Admin_SQ × (1 − Kassen/95) × 0,45',
    ref:    'Modellannahme (Fixkostenanteil 45 %) · GKV-SV Jahresbericht 2025 (Zahl der Kassen)',
    note:   '[ANNAHME] 45 % der Verwaltungskosten skalieren mit der Zahl der Kassen; keine Primärquelle zu Verwaltungskosten nach Kassengröße geprüft. Admin_SQ = 12 Mrd. €/Jahr (95 Kassen 2025)'
  },
  praevention: {
    formel: 'Nettoersparnis = Investition × (ROI − 1)',
    ref:    'Masters/Anwar/Collins/Cookson/Capewell (2017) J Epidemiol Community Health 71(8) · GKV-SV Präventionsbericht 2024',
    refs:   ['A41'],
    note:   '[ANNAHME] ROI 1,5× (Nettonutzen 0,5×), bewusst vorsichtig: Die Übersichtsarbeit findet über 52 Studien in Hocheinkommensländern einen Median-ROI von 14,3 bei sehr großer Streuung'
  }
};



// Beitragssatz der gesetzlichen Rentenversicherung, Rentenversicherungsbericht 2025 (mittlere Variante)
const RV_PFAD_2025 = [[2025, 18.6], [2027, 18.6], [2028, 19.8], [2029, 20.0], [2030, 20.1], [2039, 21.2]];
function rvBeitragPfad(jahr) {
  const P = RV_PFAD_2025;
  if (jahr <= P[0][0]) return P[0][1];
  for (let k = 1; k < P.length; k++)
    if (jahr <= P[k][0]) return P[k - 1][1] + (P[k][1] - P[k - 1][1]) * (jahr - P[k - 1][0]) / (P[k][0] - P[k - 1][0]);
  const [a, b] = [P[P.length - 2], P[P.length - 1]];   // Fortschreibung mit dem Anstieg 2030–2039 [ANNAHME]
  return b[1] + (b[1] - a[1]) / (b[0] - a[0]) * (jahr - b[0]);
}

function berechneRente(params, rv_aufkommen_aktuell) {
  const lohnsumme_sv = BASIS_MAKRO.lohnsumme_sv; // Mrd. Beitragsbasis

  // --- Generationenkapital: historisches Was-wäre-wenn ---
  // Jedes Jahr wird Fondsquote % des RV-Aufkommens investiert
  // Alles in Preisen von 2025 (F-016): reale Rendite = (1 + nominal) / (1 + Inflation) − 1,
  // Einzahlungen und Lohnsumme real konstant.
  const r_real = (1 + params.rendite_fonds / 100) / (1 + INFLATION_ANNAHME) - 1;
  const years_history = Math.max(0, 2025 - params.startjahr);
  const annual_inv = rv_aufkommen_aktuell * params.kapitalquote / 100; // Mrd. / Jahr
  let kapitalstock = 0;
  const ks_history = []; // für Chart
  for (let y = 0; y < years_history; y++) {
    kapitalstock = (kapitalstock + annual_inv) * (1 + r_real);   // bis 2025 thesaurierend
    ks_history.push({ jahr: params.startjahr + y + 1, ks: kapitalstock });
  }
  const jahresertrag = kapitalstock * r_real; // Mrd. / Jahr, real
  const beitragsentlastung = (jahresertrag / lohnsumme_sv) * 100; // Prozentpunkte

  // --- Beitragssatz-Projektion 2025–2045 ---
  // Beitragssatzpfad ohne Fonds: Rentenversicherungsbericht 2025 (F-044), ab 2040 fortgeschrieben [ANNAHME]
  const sq_beitrag = PRESETS.status_quo.rv;
  const proj_ohne = [];
  const proj_mit = [];
  let ks_proj = kapitalstock;
  for (let y = 0; y <= 20; y++) {
    const beitrag_ohne = sq_beitrag + (rvBeitragPfad(2025 + y) - RV_PFAD_2025[0][1]);
    // Ab 2025: realer Ertrag wird vollständig zur Beitragssenkung entnommen (Ausschüttung), der
    // Kapitalstock wächst nur noch um neue Einzahlungen — jeder Ertrags-Euro wird genau einmal verwendet
    const ertrag_y = ks_proj * r_real;
    const entlastung_y = (ertrag_y / lohnsumme_sv) * 100;
    ks_proj = ks_proj + annual_inv;
    proj_ohne.push({ jahr: 2025 + y, beitrag: beitrag_ohne });
    proj_mit.push({ jahr: 2025 + y, beitrag: Math.max(12, beitrag_ohne - entlastung_y) });
  }

  // --- GKV Reformen ---
  // PKV-Abschaffung (F-017, F-043): Nettoeffekt für die GKV laut IGES/Bertelsmann (2020), Szenario mit
  // unveränderten Arzthonoraren: +2,4 bis +4,3 Mrd. €/Jahr → Mittelwert. Stand 2020, nicht fortgeschrieben.
  const pkv_netto_effekt = params.pkv_abschaffen ? PKV.nettoeffekt_gkv_mrd : 0;

  // Kassenfusion: GKV-Verwaltungskosten ~12 Mrd.; proportionaler Fixkostenabbau
  const kv_admin_sq = 12;
  const kassen_ersparnis = params.anzahl_kv < 95
    ? kv_admin_sq * (1 - params.anzahl_kv / 95) * 0.45
    : 0;

  // Prävention: ROI 1,5× als vorsichtige Annahme (Masters et al. 2017, Median-ROI 14,3 bei großer Streuung)
  const praevention_ersparnis = params.praevention * 1.5 - params.praevention; // Nettoersparnis

  const gkv_gesamt_effekt = pkv_netto_effekt + kassen_ersparnis + praevention_ersparnis;

  return {
    kapitalstock, jahresertrag, beitragsentlastung, annual_inv, ks_history,
    proj_ohne, proj_mit,
    pkv_netto_effekt, kassen_ersparnis, praevention_ersparnis, gkv_gesamt_effekt
  };
}

export { berechneRente, FORMEL_QUELLEN_RENTE };
