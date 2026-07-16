// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Multi-Perioden-Simulation — Übergangsfunktionen
// ═══════════════════════════════════════════════════════
//
// berechneTransition(prevState, prevResult, nextStartJahr, n) → PeriodState
//   Leitet den Anfangszustand der nächsten Periode (n Jahre) ab.
//   Enthält DICE-Klimaschaden (Nordhaus 2023) und HANK-Multiplikator
//   (Kaplan/Moll/Violante 2018).
//
// simulierePfad(perioden_params, kursKonfig?) → ErgebnisPfad[]
//   Iteriert alle Perioden, gibt Zeitreihe zurück.
//   kursKonfig optional — Default: KURS_KONFIG_DEFAULT (n=4, 5 Perioden).
//   Backward-kompatibel: simulierePfad(perioden_params) funktioniert unverändert.
//
// Quellen:
//   BIP-Wachstum:       Bundesbank Winterprognose 2024 (1,5 % nominal)
//   Fiskalmultiplikator: Gechert/Heimberger (2022) NIER · ECB WP 1267
//   HANK-Multiplikator: Kaplan/Moll/Violante (2018) AER · McKay/Nakamura/Steinsson (2016)
//   DICE-Klimaschaden:  Nordhaus (2023) PNAS · d₂ = 0,00267 (kalibriert IPCC AR6)
//   Zinssatz:           Bundesbank DP 28/2018 · BMF Finanzplan 2025–2029
//   Demografie:         Destatis 14. Bev.-Vorausberechnung 2021 · DEMOGRAFIE_KURVE in data.js

import { DEZILE, MPC_DEZIL, DEMOGRAFIE_KURVE, PERIOD_STATE_0 } from '../data.js';

// Minimales Default — nur für backward-compat von simulierePfad(perioden_params)
const KURS_KONFIG_DEFAULT = { perioden_anzahl: 5, perioden_laenge_jahre: 4, schocks: [] };
import { berechne } from './berechne.js';

const BIP_WACHSTUM_NOMINAL = 0.015;  // Ø nominales BIP-Wachstum je Jahr (Bundesbank)
const ZINS_SCHULDEN        = 0.025;  // Ø Effektivzins auf Bestandsschulden (Rollover-Effekt)
const INVEST_MULTIPLIKATOR = 1.2;    // Fiskalmultiplikator öffentl. Investitionen (Gechert/Heimberger)
const DICE_D2              = 0.00267; // DICE-Schadensparameter d₂ (Nordhaus 2023; kalibriert AR6)
const T_BASELINE           = 1.2;   // Globale Erwärmung 2025 vs. vorindustriell (IPCC AR6 SPM)
const KLIMA_SENS_PER_MT    = 5e-4;  // °C je Mt kumulierter CO₂-Zusatz-Emissionen (vereinfacht)

// Bevölkerungsgewichteter Referenz-MPC (Nenner des HANK-Multiplikators).
// Ist die durchschnittliche MPC, wenn ein Impuls proportional zur Bevölkerung verteilt würde —
// dadurch ergibt sich mu_eff/HANK_MPC_BENCHMARK = 1 im neutralen (nicht-progressiven/regressiven) Fall.
// Wird aus MPC_DEZIL berechnet statt hartkodiert, um Inkonsistenzen bei Änderungen an MPC_DEZIL auszuschließen.
const HANK_MPC_BENCHMARK = DEZILE.reduce((a, d, i) => a + d.anzahl * MPC_DEZIL[i], 0)
                          / DEZILE.reduce((a, d) => a + d.anzahl, 0);

// Lookup DEMOGRAFIE_KURVE nach Startjahr — clamped an Randbereichen
function getDemoForYear(jahr) {
  const idx = Math.min(Math.max(0, jahr - 2025), DEMOGRAFIE_KURVE.length - 1);
  return DEMOGRAFIE_KURVE[idx];
}

// HANK-Multiplikator: MPC-gewichteter Fiskalmultiplikator (Kaplan/Moll/Violante 2018)
// hh_delta.delta ist die Netto-Einkommensabweichung je Dezil ggü. einer fixen Status-Quo-Baseline
// (nicht die Änderung ggü. der Vorperiode) — hier verwendet als Proxy dafür, wie progressiv/regressiv
// die aktuell gewählte Politik gegenüber einer neutralen Referenz ausfällt. Positive Deltas je Dezil
// werden mit MPC_DEZIL (dezil-spezifische marginale Konsumneigung, s. data.js) gewichtet.
// Effekt: Ein Impuls, der stärker bei unteren Dezilen (hohe MPC) ankommt, erzeugt einen größeren
// Multiplikator als einer, der bei oberen Dezilen (niedrige MPC) ankommt.
function hankMultiplikator(hh_delta) {
  if (!hh_delta?.delta) return INVEST_MULTIPLIKATOR;
  const positiv = hh_delta.delta.map((d, i) => ({
    dv:  Math.max(0, d * DEZILE[i].anzahl),
    mpc: MPC_DEZIL[i],
  }));
  const total = positiv.reduce((a, p) => a + p.dv, 0);
  if (total < 1e-6) return INVEST_MULTIPLIKATOR;
  const mpc_eff = positiv.reduce((a, p) => a + (p.dv / total) * p.mpc, 0);
  return INVEST_MULTIPLIKATOR * (mpc_eff / HANK_MPC_BENCHMARK);
}

// DICE-Klimaschaden (Nordhaus 2023, d₂ = 0,00267)
// Gibt den relativen BIP-Faktor zurück (<1 wenn Erwärmung über Baseline).
// Ref: Nordhaus (2023) PNAS "An Optimal Transition Path" · IPCC AR6 WG3 Ch.3
function diceKlimaMalus(co2_kumulat) {
  const delta_T  = co2_kumulat * KLIMA_SENS_PER_MT;
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

  // ── HANK-Multiplikator ────────────────────────────────────────────────
  const mu_g = hankMultiplikator(prevResult.hh_delta);

  // ── DICE-Klimaschaden ─────────────────────────────────────────────────
  const klima_malus = diceKlimaMalus(prevState.co2_kumulat);

  // ── BIP ──────────────────────────────────────────────────────────────
  const wachstum_basis      = Math.pow(1 + BIP_WACHSTUM_NOMINAL, n);
  const invest_privat_bonus = 1 + (prevResult.investment_factor - 1) * 0.15;
  const labor_bonus         = 1 + (prevResult.avg_labor - 1) * 0.10;
  const invest_impuls       = prevResult.invest_impuls ?? 0;
  const invest_impuls_bonus = 1 + (invest_impuls * n * mu_g) / prevState.bip;
  const bip_next = prevState.bip * wachstum_basis * invest_privat_bonus
                   * labor_bonus * invest_impuls_bonus * klima_malus;

  // ── SCHULDENQUOTE ─────────────────────────────────────────────────────
  const zins = ZINS_SCHULDEN + (prevState._zins_bonus || 0);
  const schuld_curr = prevState.schuldenquote / 100 * prevState.bip;
  const schuld_next = schuld_curr * Math.pow(1 + zins, n) - prevResult.saldo * n;
  const schuldenquote_next = Math.max(0, schuld_next / bip_next * 100);

  // ── CO₂-KUMULAT ──────────────────────────────────────────────────────
  const co2_kumulat_next = prevState.co2_kumulat + prevResult.emissionen * n;

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

export { berechneTransition, simulierePfad, getDemoForYear, diceKlimaMalus, hankMultiplikator, ZINS_SCHULDEN, BIP_WACHSTUM_NOMINAL };
