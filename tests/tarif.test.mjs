// Einkommensteuertarif (F-009): Mit den Status-quo-Reglern muss estTarif den gesetzlichen Tarif
// nach § 32a Abs. 1 EStG 2026 reproduzieren. Ausführen: node tests/tarif.test.mjs (Node ≥ 22)
import assert from 'node:assert/strict';
import { estTarif, grenzsteuersatz } from '../js/rechner/einkommensteuer.js';
import { PRESETS } from '../js/data.js';

// § 32a Abs. 1 EStG i.d.F. Steuerfortentwicklungsgesetz, VZ 2026 (Formel wörtlich)
function gesetz2026(x) {
  x = Math.floor(x);
  if (x <= 12348) return 0;
  if (x <= 17799) { const y = (x - 12348) / 1e4; return Math.floor((914.51 * y + 1400) * y); }
  if (x <= 69878) { const z = (x - 17799) / 1e4; return Math.floor((173.10 * z + 2397) * z + 1034.87); }
  if (x <= 277825) return Math.floor(0.42 * x - 11135.63);
  return Math.floor(0.45 * x - 19470.38);
}

const sq = PRESETS.status_quo;
let maxAbw = 0, beiX = 0;
for (let x = 0; x <= 1_000_000; x += 7) {
  const d = Math.abs(Math.floor(estTarif(x, sq)) - gesetz2026(x));
  if (d > maxAbw) { maxAbw = d; beiX = x; }
}
assert.ok(maxAbw <= 1, `Abweichung zum Gesetz ${maxAbw} € bei zvE ${beiX} €`);

// Grenzsteuersätze an den gesetzlichen Eckwerten
const gs = x => grenzsteuersatz(x, sq) * 100;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} statt ${b}`);
near(gs(12349), 14, 0.01, 'Eingangssatz');
near(gs(17799), 23.97, 0.01, 'Grenzsatz Ende Zone 2');
near(gs(69878), 42, 0.01, 'Grenzsatz Ende Zone 3');
near(gs(100000), 42, 1e-9, 'Proportionalzone');
near(gs(300000), 45, 1e-9, 'Spitzensatz');

// Spitzensatz wirkt nur in Zone 5 (F-022): Änderung lässt Steuer bis zur Grenze unverändert
const hoch = { ...sq, spitze: 60 };
for (const x of [20000, 69878, 150000, 277826]) near(estTarif(x, hoch), estTarif(x, sq), 1e-6, `Spitzensatz-Regler ändert Steuer bei ${x} €`);
assert.ok(estTarif(400000, hoch) > estTarif(400000, sq), 'Spitzensatz wirkt oberhalb der Grenze');

// Stetigkeit: keine Sprünge an Zonengrenzen, auch bei Reformparametern
for (const p of Object.values(PRESETS)) {
  for (let x = 1000; x < 600000; x += 97) {
    const sprung = estTarif(x + 1, p) - estTarif(x, p);
    assert.ok(sprung >= -1e-9 && sprung <= 1, `Tarif unstetig/fallend bei ${x} € (Preset mit spitze ${p.spitze})`);
  }
}
console.log(`Tarif: § 32a EStG 2026 reproduziert (max. Abweichung ${maxAbw} €), Spitzensatz nur in Zone 5, stetig`);
