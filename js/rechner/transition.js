// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Multi-Perioden-Simulation — Übergangsfunktionen
// ═══════════════════════════════════════════════════════
//
// berechneTransition(prevState, prevResult, nextStartJahr, n) → PeriodState
//   Leitet den Anfangszustand der nächsten Periode (n Jahre) ab.
//   Enthält DICE-Klimaschaden (DICE-2023, Barrage & Nordhaus 2024) und die Angebotswirkung
//   öffentlicher Investitionen über den Kapitalstock (Bom & Ligthart 2014).
//
// simulierePfad(perioden_params, kursKonfig?) → ErgebnisPfad[]
//   Iteriert alle Perioden, gibt Zeitreihe zurück.
//   kursKonfig optional — Default: KURS_KONFIG_DEFAULT (n=4, 5 Perioden).
//   Backward-kompatibel: simulierePfad(perioden_params) funktioniert unverändert.
//
// Quellen:
//   BIP-Wachstum:       3 % nominal (Frühjahrsprojektion 2026, s. FISKAL in data.js)
//   Multiplikatoren:    Gechert (2015) Oxford Economic Papers 67(3)
//   Öffentl. Kapital:   Bom & Ligthart (2014) J. Econ. Surveys 28(5)
//   DICE-Klimaschaden:  Barrage & Nordhaus (2024) PNAS · γ = 0,003467 (DICE-2023) · TCRE: IPCC AR6 WG1 SPM D.1.1
//   Zinsen:             Effektivzins aus STAATSAUSGABEN.zinsen / Schuldenstand (berechne.js), einzige Zinsbuchung
//   Demografie:         Destatis 14. Bev.-Vorausberechnung 2021 · DEMOGRAFIE_KURVE in data.js

import { DEMOGRAFIE_KURVE, PERIOD_STATE_0, BASIS_MAKRO, FISKAL } from '../data.js';

// Minimales Default — nur für backward-compat von simulierePfad(perioden_params)
const KURS_KONFIG_DEFAULT = { perioden_anzahl: 5, perioden_laenge_jahre: 4, schocks: [] };
import { berechne } from './berechne.js';

const BIP_WACHSTUM_NOMINAL = FISKAL.wachstum_nominal;  // 3 % nominal (Frühjahrsprojektion 2026, s. data.js)
// DICE-2023: Schadensfunktion Ω = γ·T², γ = 0,003467 (Barrage & Nordhaus 2024, PNAS 121(13), e2312030121)
const DICE_D2              = 0.003467;
const T_BASELINE           = 1.2;   // Globale Erwärmung 2025 vs. vorindustriell (IPCC AR6 SPM)
// TCRE: 0,45 °C je 1.000 Gt CO₂ (IPCC AR6 WG1 SPM D.1.1) = 0,45 / 1.000.000 °C je Mt (F-005)
const TCRE_GRAD_PRO_MT     = 0.45 / 1e6;

// Lookup DEMOGRAFIE_KURVE nach Startjahr — clamped an Randbereichen
function getDemoForYear(jahr) {
  const idx = Math.min(Math.max(0, jahr - 2025), DEMOGRAFIE_KURVE.length - 1);
  return DEMOGRAFIE_KURVE[idx];
}

// Angebotswirkung öffentlicher Investitionen (F-018): Niveau des BIP relativ zum Trend über den
// zusätzlichen öffentlichen Kapitalstock, Y ∝ K^θ (Bom & Ligthart 2014). Der Kapitalzuwachs schreibt ab,
// die Wirkung klingt nach Ende der Investitionen also wieder ab. Die kurzfristige Nachfragewirkung
// (Multiplikator) ist ein Flusseffekt der Ausgabeperiode und wird nur ausgewiesen, nicht kumuliert.
function kapitalNiveau(zusatz_kapital) {
  return Math.pow(1 + zusatz_kapital / FISKAL.kapitalstock_oeff, FISKAL.elast_oeff_kapital);
}

// DICE-Klimaschaden (DICE-2023, γ = 0,003467)
// Gibt den relativen BIP-Faktor zurück (<1 bei Mehremissionen, >1 bei Minderemissionen ggü. Status quo).
// co2_kumulat = kumulierte Abweichung der deutschen Emissionen vom Status-quo-Pfad (Mt CO₂).
// Größenordnung: 1.000 Mt Mehremissionen ≈ +0,00045 °C → BIP-Effekt im Bereich 10⁻⁶. Klimaschäden
// hängen von globalen Emissionen ab; der Nutzen nationaler Klimapolitik wird hier nicht abgebildet.
function diceKlimaMalus(co2_kumulat) {
  const delta_T  = co2_kumulat * TCRE_GRAD_PRO_MT;
  const T_total  = T_BASELINE + delta_T;
  const damage_now  = DICE_D2 * T_total ** 2;
  const damage_base = DICE_D2 * T_BASELINE ** 2;
  return (1 - damage_now) / (1 - damage_base);
}

// Wendet einen Schock auf eine Kopie von zustand an (nicht-destruktiv)
function applySchock(zustand, schock) {
  if (!schock) return zustand;
  const s = { ...zustand };
  const eff = schock.effekte || {};
  if (eff.bip_malus)    s.bip             = s.bip * (1 - eff.bip_malus);
  if (eff.schuld_bonus) s.schuldenquote   = s.schuldenquote + eff.schuld_bonus;
  if (eff.zins_bonus)   s._zins_bonus     = (s._zins_bonus || 0) + eff.zins_bonus;
  return s;
}

function berechneTransition(prevState, prevResult, nextStartJahr, n) {
  const demo = getDemoForYear(nextStartJahr);

  // ── DICE-Klimaschaden ─────────────────────────────────────────────────
  const klima_malus = diceKlimaMalus(prevState.co2_kumulat);

  // ── BIP ──────────────────────────────────────────────────────────────
  // BIP = Trend × Niveaueffekte der aktuellen Politik. Die Niveaueffekte (private Investitionen,
  // Arbeitsangebot, öffentlicher Kapitalstock, Klima) werden nicht von Periode zu Periode aufmultipliziert.
  const bip_trend_next      = (prevState.bip_trend ?? prevState.bip) * Math.pow(1 + BIP_WACHSTUM_NOMINAL, n);
  const invest_privat_level = 1 + (prevResult.investment_factor - 1) * 0.15;
  const labor_level         = 1 + (prevResult.avg_labor - 1) * 0.10;
  const invest_impuls       = prevResult.invest_impuls ?? 0;
  // zusätzlicher öffentlicher Kapitalstock: Bestand schreibt ab, neue Investitionen der Periode kommen hinzu
  const zusatz_kapital_next = (prevState.zusatz_kapital ?? 0) * Math.pow(1 - FISKAL.abschreibung_oeff, n)
                            + invest_impuls * n;
  const bip_next = bip_trend_next * invest_privat_level * labor_level
                   * kapitalNiveau(zusatz_kapital_next) * klima_malus;

  // ── SCHULDENQUOTE ─────────────────────────────────────────────────────
  // Budgetidentität: ΔSchuld = −Saldo. Die Zinsen sind bereits als zinsen_dyn im Saldo enthalten (F-006).
  const schuld_curr = prevState.schuldenquote / 100 * prevState.bip;
  const schuld_next = schuld_curr - prevResult.saldo * n;
  const schuldenquote_next = Math.max(0, schuld_next / bip_next * 100);

  // ── CO₂-KUMULAT ──────────────────────────────────────────────────────
  // Nur die Abweichung vom Status-quo-Emissionspfad (Mehr- bzw. Minderemissionen der gewählten Politik)
  const co2_kumulat_next = prevState.co2_kumulat + (prevResult.emissionen - BASIS_MAKRO.emissions) * n;

  // ── ARBEITSMARKT-ZUSTANDSINDEX ────────────────────────────────────────
  // Mean-Reversion-Speed α skaliert mit Periodenlänge: länger → stärker
  const alpha_n = Math.min(0.30, 0.15 * n / 4);
  const lohnbasis_next = prevState.lohnbasis_faktor * (1 - alpha_n + alpha_n * prevResult.avg_labor);

  return {
    bip:              bip_next,
    schuldenquote:    schuldenquote_next,
    co2_kumulat:      co2_kumulat_next,
    lohnbasis_faktor: Math.max(0.70, Math.min(1.30, lohnbasis_next)),
    renten_faktor:    demo.renten_faktor,
    bip_trend:        bip_trend_next,
    zusatz_kapital:   zusatz_kapital_next,
  };
}

function simulierePfad(perioden_params, kursKonfig = KURS_KONFIG_DEFAULT) {
  const n       = kursKonfig.perioden_laenge_jahre ?? 4;
  const schocks = kursKonfig.schocks ?? [];

  let zustand = { ...PERIOD_STATE_0, renten_faktor: getDemoForYear(2026).renten_faktor };
  const ergebnisse = [];

  for (let i = 0; i < perioden_params.length; i++) {
    const startJahr = 2026 + i * n;
    zustand.renten_faktor = getDemoForYear(startJahr).renten_faktor;

    // Schock für diese Periode anwenden (falls vorhanden)
    const schock_i = schocks.find(s => s.periode === i) ?? null;
    const zustand_eff = applySchock(zustand, schock_i);

    const result = berechne(perioden_params[i], zustand_eff);
    ergebnisse.push({
      periode:  i,
      jahr:     startJahr,
      label:    n === 1 ? `${startJahr}` : `${startJahr}–${startJahr + n - 1}`,
      schock:   schock_i,
      zustand:  { ...zustand },
      result,
    });

    if (i < perioden_params.length - 1) {
      zustand = berechneTransition(zustand_eff, result, startJahr + n, n);
    }
  }

  return ergebnisse;
}

export { berechneTransition, simulierePfad, getDemoForYear, diceKlimaMalus, kapitalNiveau, BIP_WACHSTUM_NOMINAL };
