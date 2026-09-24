// Prüft, dass jedes Preset in den Reglern von index.html exakt darstellbar ist (F-007)
// und dass die Startwerte im HTML dem Status quo entsprechen (F-053).
// Ausführen: node tests/presets.test.mjs   (Node ≥ 22, keine Abhängigkeiten)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRESETS } from '../js/data.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const regler = {};
for (const [tag] of html.matchAll(/<input[^>]*type="range"[^>]*>/g)) {
  const attr = k => (tag.match(new RegExp(`\\b${k}="([^"]+)"`)) || [])[1];
  regler[attr('id')] = { min: +attr('min'), max: +attr('max'), step: attr('step') ? +attr('step') : 1, value: +attr('value') };
}

const fehler = [];
const aufRaster = (v, { min, step }) => Math.abs((v - min) / step - Math.round((v - min) / step)) < 1e-9;
for (const [name, preset] of Object.entries(PRESETS)) {
  for (const [k, v] of Object.entries(preset)) {
    const r = regler[k];
    if (!r || typeof v !== 'number') continue;
    if (v < r.min || v > r.max) fehler.push(`${name}.${k} = ${v} außerhalb [${r.min}, ${r.max}]`);
    else if (!aufRaster(v, r)) fehler.push(`${name}.${k} = ${v} nicht auf Raster (min ${r.min}, step ${r.step})`);
  }
}
for (const [k, v] of Object.entries(PRESETS.status_quo)) {
  const r = regler[k];
  if (r && typeof v === 'number' && r.value !== v) fehler.push(`index.html #${k} value="${r.value}" ≠ Status quo ${v}`);
}
// Checkboxen: Startzustand im HTML = Status quo
for (const [tag] of html.matchAll(/<input[^>]*type="checkbox"[^>]*>/g)) {
  const id = (tag.match(/\bid="([^"]+)"/) || [])[1];
  const sq = PRESETS.status_quo[id];
  if (typeof sq === 'boolean' && /\bchecked\b/.test(tag) !== sq) fehler.push(`index.html #${id} checked=${!sq} ≠ Status quo ${sq}`);
}
assert.deepEqual(fehler, [], '\n' + fehler.join('\n'));
console.log('Presets: alle Werte exakt darstellbar, HTML-Startwerte = Status quo');
