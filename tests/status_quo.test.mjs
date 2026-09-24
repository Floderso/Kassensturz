// Status quo als Fixpunkt (F-004, F-010, F-011, F-012): Mit PRESETS.status_quo darf das Modell
// keine Veränderung gegenüber sich selbst ausweisen.
// Ausführen: node tests/status_quo.test.mjs   (Node ≥ 22, keine Abhängigkeiten)
import assert from 'node:assert/strict';
import { berechne } from '../js/rechner/berechne.js';
import { PRESETS, BASIS_AUFKOMMEN, KALIBRIERUNG_ZIELE, DEZILE } from '../js/data.js';

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

// Kalibrierung (Block 4c): Aufkommen im Status quo = Ist-Werte, Faktoren im Akzeptanzbereich
const Z = KALIBRIERUNG_ZIELE, k = r.kalibrierung;
near(r.rev.est, Z.est, 0.5, 'ESt+Soli = Kassenstatistik');
near(r.rev.mwst, BASIS_AUFKOMMEN.mwst, 0.5, 'MwSt = Kassenstatistik');
near(r.rev.kst, BASIS_AUFKOMMEN.kst, 1e-9, 'KSt'); near(r.rev.gewst, BASIS_AUFKOMMEN.gewst, 1e-9, 'GewSt');
near(r.rev.erbschaft, BASIS_AUFKOMMEN.erbschaft, 1e-9, 'Erbschaft- und Schenkungsteuer');
near(r.armutsrisiko, Z.armutsquote, 0.05, 'Armutsgefährdungsquote');
assert.ok(k.est >= 0.85 && k.est <= 1.15, `ESt-Restfaktor ${k.est} außerhalb 0,85–1,15 → Strukturfehler`);
// Sparquote: 1 − Konsum/verfügbares Einkommen
const vn = DEZILE.reduce((a, d, i) => a + Math.max(0, r.hh_delta.verfuegbar[i]) * d.anzahl, 0);
const kn = DEZILE.reduce((a, d, i) => a + Math.max(0, r.hh_delta.verfuegbar[i]) * (1 - (1 - d.konsum) * k.konsum_k) * d.anzahl, 0);
near(1 - kn / vn, Z.sparquote, 1e-6, 'Sparquote');
// MwSt-Restgröße (F-070) bleibt sichtbar und begrenzt — Warnsignal, falls sie wächst
assert.ok(k.mwst_rest_anteil > 0 && k.mwst_rest_anteil < 0.5, `MwSt-Restanteil ${k.mwst_rest_anteil}`);

// Deterministisch: zweiter Aufruf liefert dasselbe (Referenz-Cache darf nichts verändern)
assert.deepEqual(berechne(sq).hh_delta.netto, r.hh_delta.netto);
console.log('Status quo: Fixpunkt-Invarianten erfüllt');
