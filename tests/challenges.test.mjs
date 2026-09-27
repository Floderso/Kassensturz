// Challenges (Block 7.2: F-056): ID, Beschreibung und Prüfung aus derselben Schwelle; jede Challenge ist
// erreichbar und im Status quo noch nicht erfüllt. Ausführen: node tests/challenges.test.mjs
import assert from 'node:assert/strict';
import { berechne, stabilisierung } from '../js/rechner/berechne.js';
import { PRESETS, CHALLENGES, CHALLENGE_BEISPIELE } from '../js/data.js';

const sq = PRESETS.status_quo;
const ref = berechne(sq);
const konfigs = [
  ...Object.entries(PRESETS).map(([k, p]) => [k, berechne(p)]),
  ...Object.entries(CHALLENGE_BEISPIELE).map(([k, t]) => [`Beispiel ${k}`, berechne({ ...sq, ...t })]),
];

const ids = new Set();
for (const c of CHALLENGES) {
  assert.ok(!ids.has(c.id), `ID ${c.id} eindeutig`); ids.add(c.id);
  // ID und Beschreibung enthalten die geprüfte Schwelle
  c.subs.forEach(s => {
    assert.ok(c.id.includes(String(s.tgt).replace('-', 'm').replace('.', '_')), `${c.id}: Schwelle ${s.tgt} in der ID`);
    assert.ok(c.desc.includes(s.fmt(s.tgt)), `${c.id}: Schwelle in der Beschreibung`);
  });
  assert.ok(!c.subs.every(s => s.check(ref)), `${c.id}: im Status quo schon erfüllt`);
  const erreicht = konfigs.filter(([, r]) => c.subs.every(s => s.check(r))).map(([k]) => k);
  assert.ok(erreicht.length > 0, `${c.id}: von keinem Preset und keinem Beispiel erreicht`);
}
for (const d of ['daily', 'weekly', 'monthly']) assert.ok(CHALLENGES.some(c => c.diff === d), `Pool ${d} nicht leer`);

// Stabilisierungskoeffizient (F-058): Dolls/Fuest/Peichl-Definition, progressiver Tarif stabilisiert stärker
const tSQ = stabilisierung(sq);
assert.ok(tSQ > 0.25 && tSQ < 0.6, `Koeffizient im Status quo ${tSQ}`);
assert.ok(stabilisierung(PRESETS.kirchhof) < tSQ, 'Flat Tax stabilisiert schwächer');
assert.ok(stabilisierung(PRESETS.radikal) > tSQ, 'Progressiverer Tarif stabilisiert stärker');

console.log(`challenges.test: ${CHALLENGES.length} Challenges erreichbar, keine im Status quo erfüllt`);
