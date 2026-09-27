// Pareto-Rand der Top-1-%-Gruppe und Laffer-Kurve (Block 7.1: F-022, F-048, F-071).
// Ausführen: node tests/laffer.test.mjs
import assert from 'node:assert/strict';
import { berechne } from '../js/rechner/berechne.js';
import { estPareto, grenzsatzPareto } from '../js/rechner/haushalt.js';
import { estTarif, grenzsteuersatz } from '../js/rechner/einkommensteuer.js';
import { lafferPunkte, lafferAussage, tauStern } from '../js/render/laffer.js';
import { PRESETS, TOP_PARETO, ELAST } from '../js/data.js';
import { QUELLEN_NACH_ID } from '../js/quellen.js';

const sq = PRESETS.status_quo;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} statt ${b}`);

// 1) Erwartete Steuer und einkommensgewichteter Grenzsatz stimmen mit einer Quantil-Rechnung überein
for (const mean of [150000, 365000]) {
  const a = TOP_PARETO.a, zmin = mean * (a - 1) / a, N = 400000;
  let sT = 0, sZR = 0, sZ = 0;
  for (let i = 0; i < N; i++) {
    const z = zmin * Math.pow(1 - (i + 0.5) / N, -1 / a);
    sT += estTarif(z, sq); sZR += z * grenzsteuersatz(z, sq); sZ += z;
  }
  // Quantil-Rechnung schneidet den Rand ab und liegt daher leicht darunter
  near(estPareto(mean, a, sq) / (sT / N), 1, 0.01, `E[T] bei Mittel ${mean}`);
  near(grenzsatzPareto(mean, a, sq), sZR / sZ, 0.005, `Grenzsatz bei Mittel ${mean}`);
  assert.ok(estPareto(mean, a, sq) >= estTarif(mean, sq), 'Jensen: E[T(z)] ≥ T(E[z]) bei konvexem Tarif');
}

// 2) Status quo unverändert kalibriert
const r0 = berechne(sq);
near(r0.rev.est, 357, 0.05, 'ESt im Status quo');
near(r0.saldo, -119.1, 0.05, 'Saldo im Status quo');
assert.ok(r0.kalibrierung.est > 0.85 && r0.kalibrierung.est < 1.15, 'ESt-Restfaktor im Akzeptanzbereich');

// 3) Der Spitzensatz hat eine Bemessungsgrundlage: mechanische Mehreinnahme je Prozentpunkt deutlich > 0
const ohneVerhalten = { ...ELAST };
Object.assign(ELAST, { labor_supply: 0, d10c_labor: 0, d10c_avoidance: 0, d10c_wegzug: 0 });
const mech = (berechne({ ...sq, spitze: 46 }).rev.est - berechne({ ...sq, spitze: 45 }).rev.est);
Object.assign(ELAST, ohneVerhalten);
assert.ok(mech > 0.2 && mech < 1.0, `mechanische ESt-Mehreinnahme je Prozentpunkt ${mech.toFixed(2)} Mrd. €`);

// 4) Laffer-Aussage entspricht dem berechneten Verlauf
const pts = lafferPunkte(sq);
const { peak, innen, text } = lafferAussage(pts);
assert.ok(innen, 'Im Status quo liegt ein inneres Maximum vor');
pts.forEach(x => assert.ok(x.rev <= peak.rev, 'Kein Punkt über dem Maximum'));
assert.ok(text.includes(`${peak.s} %`), 'Text nennt das berechnete Maximum');
assert.ok(peak.s > 45 && peak.s < 70, `Maximum ${peak.s} % in plausiblem Bereich`);
// Randmaximum → keine Behauptung eines Maximums
const rand = lafferAussage(pts.map(x => ({ ...x, rev: x.s })));
assert.ok(!rand.innen && /kein inneres/.test(rand.text), 'Randmaximum wird nicht als Maximum ausgegeben');
near(tauStern(), 1 / (1 + TOP_PARETO.a * ELAST.d10c_labor), 1e-12, 'τ* nach Diamond/Saez');

// 5) Belege
assert.ok(!QUELLEN_NACH_ID.A15, 'A15 (Doerrenberg/Peichl) nicht mehr als Laffer-Beleg');
TOP_PARETO.refs.forEach(id => assert.ok(QUELLEN_NACH_ID[id], `Quelle ${id} vorhanden`));

console.log('laffer.test: alle Prüfungen bestanden');
