// Status quo als Fixpunkt (F-004, F-010, F-011, F-012): Mit PRESETS.status_quo darf das Modell
// keine Veränderung gegenüber sich selbst ausweisen.
// Ausführen: node tests/status_quo.test.mjs   (Node ≥ 22, keine Abhängigkeiten)
// Aufkommens-Kalibrierung (F-002, F-003) folgt mit Block 4 und wird dann hier ergänzt.
import assert from 'node:assert/strict';
import { berechne } from '../js/rechner/berechne.js';
import { PRESETS } from '../js/data.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} statt ${b}`);
const sq = PRESETS.status_quo;
const r = berechne(sq);

r.hh_delta.delta.forEach((d, i) => near(d, 0, 1e-6, `Netto-Δ Status quo, Gruppe ${i}`));
near(r.avg_labor, 1, 1e-12, 'Arbeitsangebotsfaktor im Status quo');
near(r.investment_factor, 1, 1e-12, 'Investitionsfaktor im Status quo');
near(r.sv_ausgaben_delta, 0, 1e-9, 'SV-Ausgaben-Δ im Status quo');
assert.equal(sq.klimageld, false, 'Status quo 2026 ohne Klimageld');
near(r.klimageld_auszahlung, 0, 0, 'keine Klimageld-Auszahlung im Status quo');
near(r.rev.co2, 21, 1, 'CO₂-Einnahmen im Status quo netto');

// Deterministisch: zweiter Aufruf liefert dasselbe (Referenz-Cache darf nichts verändern)
assert.deepEqual(berechne(sq).hh_delta.netto, r.hh_delta.netto);
console.log('Status quo: Fixpunkt-Invarianten erfüllt');
