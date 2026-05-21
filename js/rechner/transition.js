// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Multi-Perioden-Simulation — Übergangsfunktionen
// ═══════════════════════════════════════════════════════
//
// berechneTransition(prevState, prevResult, nextIdx) → PeriodState
//   Leitet den Anfangszustand der nächsten 4-Jahres-Periode ab.
//
// simulierePfad(perioden_params[5]) → ErgebnisPfad[5]
//   Iteriert alle 5 Perioden, gibt Zeitreihe mit Zustand + Ergebnis zurück.
//
// Quellen:
//   BIP-Wachstum:    Bundesbank Winterprognose 2024 (1,5 % nominal)
//   Fiskalmultiplikator: Gechert/Heimberger (2022) NIER · ECB WP 1267
//   Zinssatz:        Bundesbank DP 28/2018 · BMF Finanzplan 2025–2029
//   Demografie:      Destatis 14. Bev.-Vorausberechnung 2021 · DEMOGRAFIE_KURVE in data.js

import { DEMOGRAFIE_KURVE, PERIOD_STATE_0 } from '../data.js';
import { berechne } from './berechne.js';

const BIP_WACHSTUM_NOMINAL   = 0.015;  // Ø nominales BIP-Wachstum je Jahr (Bundesbank)
const ZINS_SCHULDEN          = 0.025;  // Ø Effektivzins auf Bestandsschulden (Rollover-Effekt)
const INVEST_MULTIPLIKATOR   = 1.2;    // Fiskalmultiplikator öffentl. Investitionen (Gechert/Heimberger)
const PERIODEN_JAHRE         = 4;      // Länge einer Periode in Jahren

function berechneTransition(prevState, prevResult, nextPeriodeIdx) {
  const demo = DEMOGRAFIE_KURVE[nextPeriodeIdx];

  // ── BIP ──────────────────────────────────────────────────────────────
  // Basis: nominales Wachstum über 4 Jahre
  const wachstum_basis = Math.pow(1 + BIP_WACHSTUM_NOMINAL, PERIODEN_JAHRE);
  // Privatwirtschaftlicher Investitionskanal (KSt → investment_factor)
  const invest_privat_bonus = 1 + (prevResult.investment_factor - 1) * 0.15;
  // Arbeitsangebotskanal (labor_factor → Produktivität)
  const labor_bonus = 1 + (prevResult.avg_labor - 1) * 0.10;
  // Öffentlicher Investitionsimpuls (invest_impuls Mrd./Jahr × 4 Jahre × Multiplikator)
  const invest_impuls_bonus = 1 + (prevResult.invest_impuls * PERIODEN_JAHRE * INVEST_MULTIPLIKATOR)
                                  / prevState.bip;
  const bip_next = prevState.bip * wachstum_basis * invest_privat_bonus * labor_bonus * invest_impuls_bonus;

  // ── SCHULDENQUOTE ─────────────────────────────────────────────────────
  // Schuldenstock (Mrd. €): Zinseszins auf Bestand, minus Primärsalden der 4 Jahre
  const schuld_curr = prevState.schuldenquote / 100 * prevState.bip;
  const schuld_next = schuld_curr * Math.pow(1 + ZINS_SCHULDEN, PERIODEN_JAHRE)
                      - prevResult.saldo * PERIODEN_JAHRE;
  const schuldenquote_next = Math.max(0, schuld_next / bip_next * 100);

  // ── CO₂-KUMULAT ──────────────────────────────────────────────────────
  // Kumulierte Jahresemissionen über die Periode
  const co2_kumulat_next = prevState.co2_kumulat + prevResult.emissionen * PERIODEN_JAHRE;

  // ── ARBEITSMARKT-ZUSTANDSINDEX ────────────────────────────────────────
  // 85 % Mean-Reversion, 15 % Carry-over aus avg_labor der Vorperiode
  const lohnbasis_next = prevState.lohnbasis_faktor * (0.85 + 0.15 * prevResult.avg_labor);

  return {
    bip:              bip_next,
    schuldenquote:    schuldenquote_next,
    co2_kumulat:      co2_kumulat_next,
    lohnbasis_faktor: Math.max(0.70, Math.min(1.30, lohnbasis_next)),
    renten_faktor:    demo.renten_faktor,
  };
}

function simulierePfad(perioden_params) {
  let zustand = { ...PERIOD_STATE_0, renten_faktor: DEMOGRAFIE_KURVE[0].renten_faktor };
  const ergebnisse = [];

  for (let i = 0; i < perioden_params.length; i++) {
    const result = berechne(perioden_params[i], zustand);
    ergebnisse.push({
      periode:  i,
      jahr:     DEMOGRAFIE_KURVE[i].jahr,
      label:    DEMOGRAFIE_KURVE[i].label,
      zustand:  { ...zustand },
      result,
    });
    if (i < perioden_params.length - 1) {
      zustand = berechneTransition(zustand, result, i + 1);
    }
  }

  return ergebnisse;
}

export { berechneTransition, simulierePfad };
