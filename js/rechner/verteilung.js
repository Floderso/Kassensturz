// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
import { PRESETS, ELAST, BASIS_MAKRO } from '../data.js';
import { aequivalenzgewicht } from './haushalt.js';

// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Verteilungsmetriken & Dezilberechnung
// Abhängigkeiten: PRESETS, ELAST, BASIS_MAKRO (aus data.js), aequivalenzgewicht (aus haushalt.js)
// ═══════════════════════════════════════════════════════

// Quellenmetadaten — parallel zu den Berechnungsfunktionen
const FORMEL_QUELLEN_VERT = {
  berechneGini: {
    formel: 'G = 1 − 2·∫Lorenz(x)dx  (Trapezregel über Äquivalenzeinkommen, gewichtet nach Personenzahl)',
    ref:    'Sen (1973) On Economic Inequality · Cowell (2011) Measuring Inequality · Eurostat EU-SILC-Methodik',
    note:   'Modell-Gini aus 12 Gruppen: Ungleichheit innerhalb der Gruppen fehlt, daher niedriger als der amtliche Wert — Veränderungen sind aussagekräftiger als das Niveau'
  },
  berechnePalma: {
    formel: 'Palma = Einkommensanteil oberste 10 % / Anteil unterste 40 % (Personen, Äquivalenzeinkommen)',
    ref:    'Palma (2011) Homogeneous Middles vs. Heterogeneous Tails · UNDP HDR 2013',
    note:   'Robuster gegenüber Mittelstand-Verzerrung als Gini; international gut vergleichbar'
  },
  berechneMedianGewichtet: {
    formel: 'Median des Äquivalenzeinkommens je Person',
    ref:    'Destatis Mikrozensus 2024 · SOEP v40',
    note:   'Basis für Armutsgrenze: 60 % des gewichteten Medians (EU-SILC-Konvention, Art. 7 VO 2019/1700)'
  },
  armutsrisiko: {
    formel: 'Quote = Σ p_i · Φ((ln z − ln y_i) / σ) / Σ p_i,  z = 60 % des Medians der Gesamtverteilung',
    ref:    'Eurostat EU-SILC-Definition · Destatis Armutsgefährdungsquote 2025 (Erstergebnis 16,1 %)',
    note:   'Log-Normalverteilung innerhalb der Gruppen (Median = Gruppen-Äquivalenzeinkommen); gemeinsame Streuung σ im Status quo auf die amtliche Quote kalibriert'
  },
  berechneNettoSQ: {
    formel: 'Netto_SQ = Netto_neu(PRESETS.status_quo) — dieselbe Rechnung wie für jede Reform',
    ref:    'PRESETS.status_quo (data.js) · § 32a EStG 2026 · § 158 SGB VI · § 241 SGB V',
    note:   'Referenzpunkt für alle Δ-Berechnungen; wird einmalig mit berechne(PRESETS.status_quo) erzeugt, daher Δ = 0 im Status quo'
  },
  berechneDezilDelta: {
    formel: 'Δ_i = Netto_neu_i − Netto_SQ_i',
    ref:    'SOEP v40 · Destatis Mikrozensus 2024 · BMF Steuerschätzung 2025',
    note:   'Bürgergeld-Anteile bg_quote [0,60..0]; Kinder und Erwachsene je Gruppe aus HH_STRUKTUR (data.js, gekennzeichnete Annahme)'
  }
};


// ── Verteilungsmaße auf Äquivalenzeinkommen je Person (EU-SILC-Konvention, F-021) ──
// Jede Gruppe i: Äquivalenzeinkommen y_i = Haushaltsnetto / Gewicht (neue OECD-Skala),
// Personenzahl p_i = Haushalte × (Erwachsene + Kinder). Innerhalb einer Gruppe gilt y_i für alle
// Personen — die Ungleichheit innerhalb der Gruppen fehlt, die Maße liegen daher unter amtlichen Werten.
function personenVerteilung(netto, dez) {
  return netto.map((y, i) => {
    const d = dez[i];
    return { v: y / aequivalenzgewicht(d.erwachsene, d.kinder), n: d.anzahl * (d.erwachsene + d.kinder) };
  }).sort((a, b) => a.v - b.v);
}

// Einkommenssumme der Personen im Bevölkerungsanteil [von, bis] (0…1) einer sortierten Verteilung
function summeImIntervall(paare, von, bis) {
  const N = paare.reduce((a, p) => a + p.n, 0);
  let kum = 0, summe = 0;
  for (const p of paare) {
    const lo = kum / N, hi = (kum + p.n) / N;
    const ueberlapp = Math.max(0, Math.min(hi, bis) - Math.max(lo, von));
    summe += ueberlapp * N * p.v;
    kum += p.n;
  }
  return summe;
}

function berechneGini(netto, dez) {
  const pairs = personenVerteilung(netto, dez);
  const total_n = pairs.reduce((a, p) => a + p.n, 0);
  const total_y = pairs.reduce((a, p) => a + p.v * p.n, 0);
  if (total_y <= 0) return 0;
  let cum_n = 0, cum_y = 0, flaeche = 0;
  for (const p of pairs) {
    const prev_n = cum_n, prev_y = cum_y;
    cum_n += p.n / total_n;
    cum_y += p.v * p.n / total_y;
    flaeche += (cum_n - prev_n) * (cum_y + prev_y);
  }
  return Math.max(0, Math.min(1, 1 - flaeche));
}

// Median des Äquivalenzeinkommens je Person (Basis der Armutsgefährdungsschwelle: 60 %)
function berechneMedianGewichtet(netto, dez) {
  const pairs = personenVerteilung(netto, dez);
  const half = pairs.reduce((a, p) => a + p.n, 0) / 2;
  let cum = 0;
  for (const p of pairs) { cum += p.n; if (cum >= half) return p.v; }
  return pairs[pairs.length - 1].v;
}

// Palma: Einkommensanteil der oberen 10 % / Anteil der unteren 40 % (Personen, Äquivalenzeinkommen)
function berechnePalma(netto, dez) {
  const pairs = personenVerteilung(netto, dez);
  const unten = summeImIntervall(pairs, 0, 0.4);
  return unten > 0 ? summeImIntervall(pairs, 0.9, 1) / unten : 0;
}

// S80/S20: Einkommen des obersten / untersten Quintils (Personen, Äquivalenzeinkommen)
function berechneS80S20(netto, dez) {
  const pairs = personenVerteilung(netto, dez);
  const unten = summeImIntervall(pairs, 0, 0.2);
  return unten > 0 ? summeImIntervall(pairs, 0.8, 1) / unten : 0;
}

// Sozialversicherung (Arbeitnehmeranteil) — einzige Stelle für BBG und Beitragssätze.
// RV/AL bis RV-BBG, KV/PV bis KV-BBG; die KV-BBG wird im Verhältnis des Status quo mitgeführt.
// alpf = AL + PV; Aufteilung 2,6 : 3,6 (≈ 0,42 : 0,58), § 341 SGB III · § 55 SGB XI.
function bbgRV(params) { return params.bbg ?? PRESETS.status_quo.bbg; }
function bbgKV(params) {
  if (params.kv_bbg_frei) return Infinity;
  return Math.round(bbgRV(params) * (BASIS_MAKRO.kv_bbg_kv_sq / PRESETS.status_quo.bbg));
}
function svArbeitnehmer(arbeit, params) {
  return Math.min(arbeit, bbgRV(params)) * (params.rv + params.alpf * 0.42) / 100 * 0.5
       + Math.min(arbeit, bbgKV(params)) * (params.kv + params.alpf * 0.58) / 100 * 0.5;
}

// Marginale SV-Belastung (AN-Anteil) je zusätzlichem Euro Arbeitseinkommen
function svGrenzsatz(arbeit, params) {
  return (arbeit < bbgRV(params) ? (params.rv + params.alpf * 0.42) / 100 * 0.5 : 0)
       + (arbeit < bbgKV(params) ? (params.kv + params.alpf * 0.58) / 100 * 0.5 : 0);
}

// MwSt-Satzfaktor: Anteil der MwSt am Brutto-Konsum (70 % Regelsatz, 30 % ermäßigt) inkl. Konsumreaktion
function mwstSatzfaktor(params, cf_reg = 1, cf_erm = 1) {
  return 0.7 * params.mwst / (100 + params.mwst) * cf_reg + 0.3 * params.mwst_erm / (100 + params.mwst_erm) * cf_erm;
}

// Konsumquote der Gruppe: Sparanteil (1 − konsum) wird mit konsum_k skaliert, sodass die aggregierte
// Sparquote im Status quo der amtlichen Sparquote entspricht (Kalibrierung in berechne.js, F-003)
const konsumquote = (d, konsum_k) => 1 - (1 - d.konsum) * konsum_k;

// mw = { cf_reg, cf_erm, konsum_k, steuerfrei } — Konsumreaktion und Kalibrierung (aus berechne.js)
function berechneDezilDelta(dezile, params, est_dez, klima, bg, kg, netto_sq, mw) {
  // Netto-Einkommen pro Dezil NEU
  const netto = [];
  const delta = [];
  const belastung_pct = [];
  const verfuegbar = [];
  const mwst_hh = [];
  const satz = mwstSatzfaktor(params, mw.cf_reg, mw.cf_erm);
  for (let i = 0; i < dezile.length; i++) {
    const d = dezile[i];
    const est = est_dez[i].est;
    const brutto = d.brutto_adj;
    // K3: SV nur auf Arbeitseinkommen (nicht Kapital)
    const sv_lohn = svArbeitnehmer(d.arbeit_adj, params);
    // kv_kapital: Kapitalerträge von GKV-Mitgliedern werden KV-pflichtig (Mieteinnahmen, Zinsen, Dividenden)
    // GKV-Quote sinkt in den oberen Dezilen (mehr PKV)
    const GKV_QUOTE = [0.95, 0.95, 0.95, 0.93, 0.90, 0.85, 0.80, 0.75, 0.70, 0.55, 0.30, 0.08];
    const sv_kapital = params.kv_kapital ? d.kapital_adj * params.kv / 100 * 0.5 * GKV_QUOTE[i] : 0;
    const sv = sv_lohn + sv_kapital;
    // CO2-Last (untere Dezile höherer Anteil am Einkommen)
    // CO₂-Last: Dezil-Anteil am Einkommen × CO₂-Preis × Emissionsreaktion
    // D10a/b/c: sinkender CO2-Anteil am Einkommen, aber absolut höher
    const co2_share = [0.040, 0.038, 0.036, 0.034, 0.032, 0.030, 0.028, 0.025, 0.022, 0.018, 0.015, 0.010];
    const co2_factor_dez = Math.max(0.4, Math.min(1.1, 1 + ELAST.co2 * (params.co2 - 65) / 100));
    const co2_last = brutto * co2_share[i] * (params.co2 / 65) * co2_factor_dez;
    // Klimageld zurück (gleichverteilt pro Kopf: Anteil der Gruppe an allen Personen)
    const personen_gesamt = dezile.reduce((a, x) => a + x.anzahl * (x.erwachsene + x.kinder), 0);
    const klimageld_per_hh = klima * 1000 * (d.erwachsene + d.kinder) / personen_gesamt;
    // Transfers erhalten
    // Bürgergeld: D1–D3/D4, D10a/b/c = 0
    const bg_quote = [0.60, 0.25, 0.08, 0.02, 0, 0, 0, 0, 0, 0, 0, 0];
    const bge_p = params.bge || 0;
    // Bürgergeld effektiv: 0 wenn BGE >= BG-Niveau (BGE ersetzt es, RWI 2024)
    const bg_effektiv_hh = bge_p >= params.bg ? 0 : params.bg;
    let transfers = 0;
    transfers += bg_effektiv_hh * 12 * bg_quote[i];
    // Kindergeld und BGE aus der Haushaltsstruktur (HH_STRUKTUR in data.js; Kinder summieren sich auf
    // 17 Mio. wie die Kindergeld-Ausgaben in berechne.js, F-068)
    transfers += params.kg * 12 * d.kinder;
    transfers += bge_p * 12 * d.erwachsene;
    if (params.neg_est && i < 3) transfers += 3000;

    // Verfügbares Einkommen inkl. Transfers; Konsum daraus (auch aus Bürgergeld, Kindergeld, BGE),
    // MwSt nur auf den steuerpflichtigen Teil des Konsums
    const verfuegbar_i = brutto - est - sv + klimageld_per_hh + transfers;
    const konsum = Math.max(0, verfuegbar_i) * konsumquote(d, mw.konsum_k);
    const mwst = konsum * (1 - mw.steuerfrei) * satz;
    verfuegbar.push(verfuegbar_i);
    mwst_hh.push(mwst);

    const netto_final = verfuegbar_i - mwst - co2_last;

    // Status-quo-Vergleich: netto_sq stammt aus derselben Rechnung mit PRESETS.status_quo
    // (fehlt nur beim Erzeugen der Referenz selbst → Δ = 0)
    netto.push(netto_final);
    delta.push(netto_sq ? netto_final - netto_sq[i] : 0);
    belastung_pct.push(100 * (est + sv + mwst + co2_last - transfers) / brutto);
  }
  return { netto, delta, belastung_pct, verfuegbar, mwst: mwst_hh };
}

// ── Armutsgefährdungsquote (F-035, F-040) ──
// Innerhalb jeder Gruppe log-normal verteiltes Äquivalenzeinkommen mit Median = Gruppenwert und
// gemeinsamer Streuung sigma (kalibriert auf die amtliche Quote im Status quo, berechne.js).
// Armutsgrenze = 60 % des Medians der Gesamtverteilung (Personen), wie in der EU-SILC-Definition.
function erf(x) {                       // Abramowitz/Stegun 7.1.26, Fehler < 1,5·10⁻⁷
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2));

function berechneArmutsquote(netto, dez, sigma) {
  const pairs = personenVerteilung(netto, dez).filter(p => p.v > 0);
  const N = pairs.reduce((a, p) => a + p.n, 0);
  const F = x => pairs.reduce((a, p) => a + p.n * Phi((Math.log(x) - Math.log(p.v)) / sigma), 0) / N;
  let lo = pairs[0].v / 100, hi = pairs[pairs.length - 1].v * 100;
  for (let k = 0; k < 100; k++) { const mid = Math.sqrt(lo * hi); if (F(mid) < 0.5) lo = mid; else hi = mid; }
  const median = Math.sqrt(lo * hi);
  return { quote: F(0.6 * median) * 100, armutsgrenze: 0.6 * median, median };
}

export { FORMEL_QUELLEN_VERT, berechneGini, berechneMedianGewichtet, berechnePalma, berechneS80S20, berechneArmutsquote, mwstSatzfaktor, berechneDezilDelta, svArbeitnehmer, svGrenzsatz, bbgRV, bbgKV };
