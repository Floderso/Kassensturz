// Quellenverzeichnis als einzige Quelle (V-15a): Vollständigkeit der Einträge, gültige DOIs,
// alle refs-Verweise im Code existieren, und bereits korrigierte Falschangaben kehren nicht zurück
// (F-023 bis F-026). Ausführen: node tests/quellen.test.mjs   (Node ≥ 22, keine Abhängigkeiten)
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { QUELLEN, QUELLEN_NACH_ID } from '../js/quellen.js';
import { TOOLTIPS, ELAST_QUELLEN } from '../js/data.js';
import { FORMEL_QUELLEN_BERECHNE } from '../js/rechner/berechne.js';
import { FORMEL_QUELLEN_VERT } from '../js/rechner/verteilung.js';
import { FORMEL_QUELLEN_RENTE } from '../js/rechner/rente.js';
import { FORMEL_QUELLEN_EST } from '../js/rechner/einkommensteuer.js';

const fehler = [];

// 1) Einträge
const ids = QUELLEN.map(q => q.id);
assert.equal(new Set(ids).size, ids.length, 'doppelte Quellen-IDs');
const PRAEFIX = { akademisch: 'A', bericht: 'B', statistik: 'C', recht: 'G' };
for (const q of QUELLEN) {
  if (!PRAEFIX[q.typ]) fehler.push(`${q.id}: unbekannter typ ${q.typ}`);
  else if (!q.id.startsWith(PRAEFIX[q.typ])) fehler.push(`${q.id}: Präfix passt nicht zu typ ${q.typ}`);
  for (const f of ['titel', 'quelle', 'jahr', 'verwendet']) if (!q[f]) fehler.push(`${q.id}: Feld ${f} fehlt`);
  if (q.doi && !/^10\.\d{4,9}\/\S+$/.test(q.doi)) fehler.push(`${q.id}: DOI ungültig: ${q.doi}`);
}

// 2) refs-Verweise im Code
const sammlungen = { TOOLTIPS, ELAST_QUELLEN, FORMEL_QUELLEN_BERECHNE, FORMEL_QUELLEN_VERT, FORMEL_QUELLEN_RENTE, FORMEL_QUELLEN_EST };
let anzahlRefs = 0;
for (const [name, obj] of Object.entries(sammlungen)) {
  for (const [k, v] of Object.entries(obj)) {
    for (const id of v.refs || []) {
      anzahlRefs++;
      if (!QUELLEN_NACH_ID[id]) fehler.push(`${name}.${k}: Verweis auf unbekannte Quelle ${id}`);
    }
  }
}
assert.ok(anzahlRefs > 0, 'keine refs-Verweise gefunden');

// 3) Korrigierte Falschangaben dürfen nicht zurückkehren (Prüfbericht F-023 bis F-026)
const VERBOTEN = [
  [/Kolsrud/, 'F-025: falscher Koautor'],
  [/pol\.20180598/, 'F-024: falsche DOI'],
  [/Brülhart[^\n]{0,40}2019/, 'F-024: falsches Jahr'],
  [/BT-Drs\.\s*20\/10749/, 'F-023: falsche Drucksache'],
  [/Rentenpaket II[^\n]{0,60}beschlossen/, 'F-023: Rentenpaket II ist nicht verabschiedet'],
  [/Bundesgesetzblatt 2024/, 'F-023: Rentenpaket II nicht verkündet'],
  [/Grundfreibetrag 12\.084/, 'F-026: Grundfreibetrag 2025 = 12.096 €'],
  [/Steueränderungsgesetz Okt/, 'F-026: Rechtsgrundlage ist das Steuerfortentwicklungsgesetz'],
  [/Ab 2025: 259/, 'F-026: Kindergeld 259 € erst ab 2026'],
  // Block 9 (F-041 bis F-052, F-063)
  [/Reinhardt/, 'F-041: belegt keine Fixkostendegression'],
  [/WHO[^\n]{0,10}\(?2017/, 'F-041: Übersicht ist Masters et al. (2017), keine WHO-Publikation'],
  [/14\. Bev/, 'F-042: veraltete Bevölkerungsvorausberechnung'],
  [/konservativer SVR-Wert/, 'F-044: unbelegter Beitragspfad'],
  [/(Kleven\/Schultz|Lewbel\/Pendakur) \(20(14|09)\) JPubEc/, 'F-045: falsche Zeitschrift'],
  [/Saez\/Chetty/, 'F-046: kein Beleg für die Arbeitsangebotselastizität'],
  [/66\.150/, 'F-051: KV-BBG 2026 = 69.750 €'],
  [/immer noch 110–125/, 'F-052: widersprüchlicher Vermögensteuer-Satz'],
  [/Restaurants[^\n]{0,10}−2,3/, 'F-063: Andreyeva et al. nennen −0,81'],
  [/grunderwerbsteuer/, 'F-050: Wert ist die Grundsteuer'],
  [/Kirchner et al\. 2010\)[^\n]{0,40}ECB Bulletin 2020|ECB Bulletin 2020/, 'F-058: Dolls/Fuest/Peichl 2012, J Public Econ'],
];
const wurzel = new URL('..', import.meta.url).pathname;
function dateien(dir) {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    if (['.git', 'docs', 'tests', 'node_modules', 'fonts'].includes(n)) return [];
    return statSync(p).isDirectory() ? dateien(p) : /\.(js|html|md|txt|json)$/.test(n) ? [p] : [];
  });
}
for (const f of dateien(wurzel)) {
  const text = readFileSync(f, 'utf8');
  for (const [re, grund] of VERBOTEN) if (re.test(text)) fehler.push(`${f.slice(wurzel.length)}: ${grund}`);
}

assert.deepEqual(fehler, [], '\n' + fehler.join('\n'));
console.log(`Quellen: ${QUELLEN.length} Einträge gültig, ${anzahlRefs} Verweise aufgelöst, keine korrigierten Falschangaben`);
