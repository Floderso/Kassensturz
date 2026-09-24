// Haushaltsebene (F-002, F-021, F-036, F-068, F-069): zvE, Splitting, Soli, Abgeltung,
// Äquivalenzskala und Verteilungsmaße. Ausführen: node tests/haushalt.test.mjs (Node ≥ 22)
import assert from 'node:assert/strict';
import { zvE, soli, estHaushalt, abgeltungHaushalt, aequivalenzgewicht } from '../js/rechner/haushalt.js';
import { estTarif } from '../js/rechner/einkommensteuer.js';
import { berechneGini, berechnePalma, berechneS80S20, berechneMedianGewichtet } from '../js/rechner/verteilung.js';
import { berechne } from '../js/rechner/berechne.js';
import { PRESETS, DEZILE, BASIS_AUFKOMMEN } from '../js/data.js';

const sq = PRESETS.status_quo;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} statt ${b}`);

// zvE und Splitting
near(zvE(50000, 10000, 1), 50000 - 1230 - 10000, 0, 'zvE mit Pauschbetrag und SV');
near(zvE(1000, 200, 1), 0, 0, 'zvE nicht negativ');
near(estHaushalt(80000, 1, sq).est, 2 * estTarif(40000, sq), 1e-9, 'Splitting = 2 × T(zvE/2)');
near(estHaushalt(80000, 0, sq).est, estTarif(80000, sq), 1e-9, 'Grundtarif');
assert.ok(estHaushalt(80000, 1, sq).est < estHaushalt(80000, 0, sq).est, 'Splittingvorteil');

// Soli: Freigrenze, Milderungszone stetig, voller Satz oben
near(soli(20350, false), 0, 0, 'Soli bis Freigrenze 0');
near(soli(40700, true), 0, 0, 'Soli Paare bis 40.700 € 0');
assert.ok(soli(20351, false) < 1, 'Milderungszone ohne Sprung');
near(soli(200000, false), 0.055 * 200000, 1e-9, 'voller Soli-Satz');

// Abgeltung: Sparerpauschbetrag je Erwachsenem, Soli ohne Freigrenze
near(abgeltungHaushalt(3000, 2, 25), 1000 * 0.25 * 1.055, 1e-9, 'Abgeltung nach 2.000 € Pauschbetrag inkl. Soli');

// Äquivalenzskala (neue OECD-Skala)
near(aequivalenzgewicht(1, 0), 1, 0, 'Alleinlebend'); near(aequivalenzgewicht(2, 2), 2.1, 1e-12, 'Paar mit 2 Kindern');

// Verteilungsmaße: Gleichverteilung der Äquivalenzeinkommen → Gini 0, Palma 0,25/... Quotienten 1
const gleich = DEZILE.map(d => 20000 * aequivalenzgewicht(d.erwachsene, d.kinder));
near(berechneGini(gleich, DEZILE), 0, 1e-9, 'Gini bei Gleichverteilung');
near(berechneS80S20(gleich, DEZILE), 1, 1e-9, 'S80/S20 bei Gleichverteilung');
near(berechnePalma(gleich, DEZILE), 0.25, 1e-9, 'Palma bei Gleichverteilung (10 % / 40 %)');
near(berechneMedianGewichtet(gleich, DEZILE), 20000, 1e-9, 'Median bei Gleichverteilung');

// Haushaltsstruktur konsistent mit Aggregaten
near(DEZILE.reduce((a, d) => a + d.anzahl * d.kinder, 0), 17, 0.1, 'Kinder gesamt = Kindergeldkinder (F-068)');
near(DEZILE.reduce((a, d) => a + d.anzahl * d.erwachsene, 0) / DEZILE.reduce((a, d) => a + d.anzahl, 0), 1.71, 0.02, 'Ø Erwachsene je Haushalt');

// Modell: D10a/b/c eigene Steuer (F-069), ESt-Aufkommen strukturell in der Größenordnung der Kassenstatistik
const r = berechne(sq);
const [a, b, c] = r.est_pro_dezil.slice(9);
assert.ok(a.est < b.est && b.est < c.est, 'D10a/b/c mit eigener Steuer');
const ist = BASIS_AUFKOMMEN.lohnsteuer + BASIS_AUFKOMMEN.estveranlagt + BASIS_AUFKOMMEN.solz_abgelt;
assert.ok(Math.abs(r.rev.est / ist - 1) < 0.15, `ESt+Soli ${r.rev.est.toFixed(1)} Mrd. vs. Ist ${ist} Mrd. (Toleranz 15 %, Kalibrierung folgt in 4c)`);
console.log(`Haushalt: zvE, Splitting, Soli, Äquivalenz ok; ESt+Soli ${r.rev.est.toFixed(1)} Mrd. vs. Ist ${ist} Mrd.`);
