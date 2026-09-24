// Ausgabenrahmen und Sozialversicherung (Block 5: F-013–F-017, F-020, F-028).
// Ausführen: node tests/ausgaben.test.mjs (Node ≥ 22)
import assert from 'node:assert/strict';
import { berechne } from '../js/rechner/berechne.js';
import { berechneRente } from '../js/rechner/rente.js';
import { PRESETS, VGR_2025, STAATSAUSGABEN, BUERGERGELD_2025 } from '../js/data.js';

const sq = PRESETS.status_quo;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} statt ${b}`);
const r = berechne(sq);

// Status quo = VGR 2025
near(r.einnahmen_total, VGR_2025.einnahmen, 1e-6, 'Einnahmen = VGR');
near(r.ausgaben_total, VGR_2025.ausgaben, 1e-6, 'Ausgaben = VGR');
near(r.saldo, VGR_2025.saldo, 1e-6, 'Saldo = VGR');
// Jeder Posten genau einmal: Summe der Posten = Gesamtausgaben
near(Object.values(r.ausgaben_posten).reduce((a, b) => a + b, 0), r.ausgaben_total, 1e-9, 'Summe der Posten');
near(Object.values(r.rev).reduce((a, b) => a + b, 0), r.einnahmen_total, 1e-9, 'Summe der Einnahmen');
// Erhebungskosten nur als Differenz: Verwaltungsposten im Status quo = fester Wert
near(r.ausgaben_posten.verwaltung, STAATSAUSGABEN.verwaltung, 1e-9, 'Verwaltung im SQ unverändert');
// Bürgergeld aus BA-Summen
near(r.ausgaben_posten.buergergeld, BUERGERGELD_2025.regelleistungen + BUERGERGELD_2025.kdu_bund, 1e-9, 'Bürgergeld SQ');
near(berechne({ ...sq, bg: sq.bg * 1.1 }).ausgaben_posten.buergergeld, BUERGERGELD_2025.regelleistungen * 1.1 + BUERGERGELD_2025.kdu_bund, 1e-9, 'Regelsatz +10 %');
// Kindergeld = Kinder der Haushaltsstruktur × Satz
near(r.ausgaben_posten.kindergeld, 17 * sq.kg * 12 / 1000, 0.3, 'Kindergeld');

// BGE: Renteneinsparung höchstens der Rentenposten (F-014)
const bge = berechne(PRESETS.bge);
assert.ok(bge.rv_einsparung <= STAATSAUSGABEN.rente + 1e-9 && bge.ausgaben_posten.rente >= 0, `BGE-Renteneinsparung ${bge.rv_einsparung}`);

// Maastricht statt Schuldenbremse (F-020)
assert.ok(r.maastricht_ok, 'SQ-Defizit < 3 % BIP'); assert.equal(r.schuldenbremse_ok, undefined);

// Rentenfonds (F-016): ohne neue Einzahlungen bleibt der Kapitalstock nach 2025 real konstant,
// die Entlastung ist der reale Ertrag — kein Ertrag doppelt
const f0 = berechneRente({ ...sq, kapitalquote: 10, startjahr: 2010, rendite_fonds: 7 }, 325);
assert.ok(f0.proj_mit[20].beitrag > 12, `Beitrag 2045 nicht am Boden (${f0.proj_mit[20].beitrag})`);
near(f0.proj_ohne[0].beitrag - f0.proj_mit[0].beitrag, f0.beitragsentlastung, 1e-9, 'Entlastung 2025 = realer Ertrag');
// PKV (F-017): Nettoeffekt in Mrd. € in der Größenordnung der IGES-Spanne
const pkv = berechneRente({ ...sq, pkv_abschaffen: true }, 325).pkv_netto_effekt;
assert.ok(pkv >= 2.4 && pkv <= 4.3, `PKV-Nettoeffekt ${pkv} Mrd.`);
console.log(`Ausgaben: Status quo = VGR 2025 (Saldo ${r.saldo.toFixed(1)}), Posten einzeln, BGE begrenzt, Rentenfonds real, PKV ${pkv.toFixed(2)} Mrd.`);
