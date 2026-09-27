// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Haushaltsebene: zu versteuerndes Einkommen, Splitting, Solidaritätszuschlag,
// Abgeltungsteuer und Äquivalenzgewichtung (Prüfbericht F-002, F-021, F-036)
// Eine Modellgruppe ist eine Mischung aus Paaren (Anteil paar_anteil, Splitting) und Alleinveranlagten.
// ═══════════════════════════════════════════════════════
import { estTarif, grenzsteuersatz, tarifAusParams } from './einkommensteuer.js';

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
  pareto: {
    formel: 'E[T(z)] = T(z_min) + ∫_{z_min}^∞ r(x) · (z_min/x)^a dx,  z_min = z̄ · (a − 1)/a',
    ref:    'Saez (2001) RES 68(2) · Diamond/Saez (2011) JEP 25(4) · Bach/Corneo/Steiner (2012) EER 56(6)',
    note:   'Nur Top-1-%-Gruppe (D10c): zvE Pareto-verteilt mit gleichem Mittelwert wie die Gruppe; Paare mit Splitting auf z/2. Pareto-Parameter a ist eine gekennzeichnete Annahme (TOP_PARETO in data.js). SolZ auf die erwartete ESt.',
    refs:   ['A29', 'A36', 'A37']
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

// ── Pareto-Rand der Top-1-%-Gruppe (F-071) ──
// Ein Durchschnittshaushalt kann die Zone 5 nicht abbilden: Bei Splitting liegt das mittlere zvE je Person
// unter der Grenze e4, obwohl ein großer Teil der Einkommen der Gruppe darüber liegt. Daher wird das zvE
// der Gruppe als Pareto-Verteilung mit Parameter a und dem Gruppenmittel z̄ behandelt.
// Integrale über die Zonen 2–4 numerisch (Simpson), Zone 5 geschlossen.
function simpson(f, u, v, n = 32) {
  if (v <= u) return 0;
  const h = (v - u) / n;
  let s = f(u) + f(v);
  for (let i = 1; i < n; i++) s += f(u + i * h) * (i % 2 ? 4 : 2);
  return s * h / 3;
}

// Stützstellen des Grenzsteuersatzes oberhalb von zmin bis e4; darüber konstant r5
function segmente(zmin, t) {
  const pkt = [zmin, ...[t.gfb, t.e2, t.e3, t.e4].filter(x => x > zmin)];
  return pkt;
}

// Erwartete Steuer T(z) bei z ~ Pareto(zmin, a) mit Mittelwert mean
function estPareto(mean, a, p) {
  if (mean <= 0) return 0;
  const t = tarifAusParams(p);
  const zmin = mean * (a - 1) / a;
  const pkt = segmente(zmin, t);
  let summe = estTarif(zmin, p);
  for (let i = 0; i + 1 < pkt.length; i++)
    summe += simpson(x => grenzsteuersatz(x, p) * Math.pow(zmin / x, a), pkt[i], pkt[i + 1]);
  const X = pkt[pkt.length - 1];
  summe += t.r5 * Math.pow(zmin, a) * Math.pow(X, 1 - a) / (a - 1);
  return summe;
}

// Einkommensgewichteter Grenzsteuersatz E[z · r(z)] / E[z] — relevant für die Verhaltensreaktion der Gruppe
function grenzsatzPareto(mean, a, p) {
  if (mean <= 0) return 0;
  const t = tarifAusParams(p);
  const zmin = mean * (a - 1) / a;
  const pkt = segmente(zmin, t);
  const k = a * Math.pow(zmin, a);
  let summe = 0;
  for (let i = 0; i + 1 < pkt.length; i++)
    summe += simpson(x => grenzsteuersatz(x, p) * k * Math.pow(x, -a), pkt[i], pkt[i + 1]);
  const X = pkt[pkt.length - 1];
  summe += t.r5 * k * Math.pow(X, 1 - a) / (a - 1);
  return summe / mean;
}

// Wie estHaushalt, aber mit Pareto-verteiltem zvE (Paare: Splitting auf z/2 mit Mittel z̄/2)
function estHaushaltPareto(zve, paar_anteil, a, p) {
  const split = 2 * estPareto(zve / 2, a, p);
  const grund = estPareto(zve, a, p);
  return {
    est:  paar_anteil * split + (1 - paar_anteil) * grund,
    soli: paar_anteil * soli(split, true) + (1 - paar_anteil) * soli(grund, false),
  };
}

function grenzsatzHaushaltPareto(zve, paar_anteil, a, p) {
  return paar_anteil * grenzsatzPareto(zve / 2, a, p) + (1 - paar_anteil) * grenzsatzPareto(zve, a, p);
}

function aequivalenzgewicht(erwachsene, kinder) {
  return 1 + 0.5 * (erwachsene - 1) + 0.3 * kinder;
}

export {
  zvE, soli, estHaushalt, grenzsatzHaushalt, abgeltungHaushalt, aequivalenzgewicht,
  estPareto, grenzsatzPareto, estHaushaltPareto, grenzsatzHaushaltPareto,
  AN_PAUSCHBETRAG, SPARER_PAUSCHBETRAG, SOLI_SATZ, SOLI_FREIGRENZE_2026, FORMEL_QUELLEN_HAUSHALT,
};
