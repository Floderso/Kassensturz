// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Haushaltsebene: zu versteuerndes Einkommen, Splitting, Solidaritätszuschlag,
// Abgeltungsteuer und Äquivalenzgewichtung (Prüfbericht F-002, F-021, F-036)
// Eine Modellgruppe ist eine Mischung aus Paaren (Anteil paar_anteil, Splitting) und Alleinveranlagten.
// ═══════════════════════════════════════════════════════
import { estTarif, grenzsteuersatz } from './einkommensteuer.js';

const AN_PAUSCHBETRAG      = 1230;   // § 9a Satz 1 Nr. 1 Buchst. a EStG (je Arbeitnehmer)
const SPARER_PAUSCHBETRAG  = 1000;   // § 20 Abs. 9 EStG (je Person; Paare 2.000 €)
const SOLI_SATZ            = 0.055;  // § 4 SolZG 1995
const SOLI_MILDERUNG       = 0.119;  // § 4 Satz 2 SolZG 1995 (Milderungszone)
const SOLI_FREIGRENZE_2026 = 20350;  // § 3 Abs. 3 SolZG 1995, VZ 2026 (Zusammenveranlagung: 40.700 €)

const FORMEL_QUELLEN_HAUSHALT = {
  zvE: {
    formel: 'zvE = Arbeitseinkommen − 1.230 € × Erwerbstätige − SV-Arbeitnehmeranteil',
    ref:    '§ 2 Abs. 5, § 9a Nr. 1a, § 10 Abs. 1 Nr. 2, 3, 3a EStG',
    note:   'Vorsorgeaufwendungen vereinfacht als voller AN-Anteil zur Sozialversicherung (ohne Höchstbeträge nach § 10 Abs. 3, 4); weitere Werbungskosten, Sonderausgaben und Kinderfreibeträge nicht abgebildet',
    refs:   ['G01']
  },
  splitting: {
    formel: 'ESt = a · 2·T(zvE/2) + (1 − a) · T(zvE),  a = Paaranteil der Gruppe',
    ref:    '§ 32a Abs. 5 EStG (Splittingverfahren)',
    note:   'Paaranteil je Gruppe ist eine gekennzeichnete Annahme (HH_STRUKTUR in data.js)',
    refs:   ['G01']
  },
  soli: {
    formel: 'SolZ = min(5,5 % · ESt; 11,9 % · (ESt − Freigrenze)), Freigrenze 20.350 € / 40.700 €',
    ref:    '§§ 3, 4 SolZG 1995, VZ 2026',
    note:   'Auf Kapitalerträge unter Abgeltungsteuer gilt keine Freigrenze (5,5 % auf die Abgeltungsteuer)'
  },
  aequivalenz: {
    formel: 'Gewicht = 1 + 0,5 · (Erwachsene − 1) + 0,3 · Kinder  (neue OECD-Skala)',
    ref:    'Eurostat, EU-SILC-Methodik (modifizierte OECD-Skala)',
    note:   'Verteilungsmaße werden auf Äquivalenzeinkommen je Person berechnet, gewichtet mit der Personenzahl'
  }
};

function zvE(arbeit, sv_an, erwerbstaetige) {
  return Math.max(0, arbeit - AN_PAUSCHBETRAG * erwerbstaetige - sv_an);
}

function soli(est, paar) {
  const fg = SOLI_FREIGRENZE_2026 * (paar ? 2 : 1);
  return est <= fg ? 0 : Math.min(SOLI_SATZ * est, SOLI_MILDERUNG * (est - fg));
}

// Einkommensteuer + Soli einer Gruppe (Mischung aus Paaren und Alleinveranlagten).
// Liefert { est, soli } je Haushalt.
function estHaushalt(zve, paar_anteil, p) {
  const split = 2 * estTarif(zve / 2, p);
  const grund = estTarif(zve, p);
  return {
    est:  paar_anteil * split + (1 - paar_anteil) * grund,
    soli: paar_anteil * soli(split, true) + (1 - paar_anteil) * soli(grund, false),
  };
}

// Grenzsteuersatz der Gruppe bezogen auf das zvE (ohne Soli)
function grenzsatzHaushalt(zve, paar_anteil, p) {
  return paar_anteil * grenzsteuersatz(zve / 2, p) + (1 - paar_anteil) * grenzsteuersatz(zve, p);
}

// Abgeltungsteuer inkl. Soli nach Sparerpauschbetrag (§ 32d Abs. 1, § 20 Abs. 9 EStG)
function abgeltungHaushalt(kapital, erwachsene, satz) {
  return Math.max(0, kapital - SPARER_PAUSCHBETRAG * erwachsene) * satz / 100 * (1 + SOLI_SATZ);
}

function aequivalenzgewicht(erwachsene, kinder) {
  return 1 + 0.5 * (erwachsene - 1) + 0.3 * kinder;
}

export {
  zvE, soli, estHaushalt, grenzsatzHaushalt, abgeltungHaushalt, aequivalenzgewicht,
  AN_PAUSCHBETRAG, SPARER_PAUSCHBETRAG, SOLI_SATZ, SOLI_FREIGRENZE_2026, FORMEL_QUELLEN_HAUSHALT,
};
