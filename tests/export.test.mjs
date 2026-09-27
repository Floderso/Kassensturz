// data.json und llms.txt (Block 9: V-15b, V-24, F-050): aus dem Quellcode erzeugt und aktuell; Bezeichner
// korrekt; Einkommen der Gruppen monoton. Ausführen: node tests/export.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { erzeugeDateien } from '../tools/export.mjs';
import { BASIS_AUFKOMMEN } from '../js/data.js';

const soll = erzeugeDateien();
for (const [name, inhalt] of Object.entries(soll))
  assert.equal(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'), inhalt, `${name} veraltet — node tools/export.mjs ausführen`);

const D = JSON.parse(soll['data.json']);
assert.ok(!('grunderwerbsteuer' in D.steueraufkommen_mrd_eur), 'kein falscher Bezeichner Grunderwerbsteuer');
assert.equal(D.steueraufkommen_mrd_eur.grundsteuer, BASIS_AUFKOMMEN.grundst, 'Grundsteuer aus data.js');
D.dezile.forEach(d => assert.ok(!Object.keys(d).some(k => k.startsWith('vermoegen')), `${d.gruppe}: ungeklärtes Vermögen nicht exportiert`));
D.dezile.slice(1).forEach((d, i) => assert.ok(d.brutto_jahr_eur > D.dezile[i].brutto_jahr_eur, `Einkommen steigt von ${D.dezile[i].gruppe} zu ${d.gruppe}`));
assert.ok(Math.abs(D.modell_status_quo_2026_mrd_eur.saldo - D.gesamtstaat_vgr_2025_mrd_eur.saldo) < 0.05, 'Status quo = VGR-Saldo');
assert.ok(!/1\.888/.test(soll['llms.txt']), 'llms.txt ohne veraltete Ausgabensumme');

console.log('export.test: data.json und llms.txt aktuell und plausibel');
