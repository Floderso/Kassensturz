// Zukunftssimulation: Budgetidentität (F-006) und Größenordnung des Klimamoduls (F-005).
// Ausführen: node tests/transition.test.mjs   (Node ≥ 22, keine Abhängigkeiten)
import assert from 'node:assert/strict';
import { berechneTransition, diceKlimaMalus } from '../js/rechner/transition.js';
import { berechne } from '../js/rechner/berechne.js';
import { PRESETS, PERIOD_STATE_0, BASIS_MAKRO } from '../js/data.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} statt ${b}`);

// 1) Saldo = 0 ⇒ Schuldenstand in Mrd. € unverändert (Zinsen stecken bereits im Saldo)
const state = { ...PERIOD_STATE_0, renten_faktor: 1 };
const res = berechne(PRESETS.status_quo, state);
const next = berechneTransition(state, { ...res, saldo: 0 }, 2030, 4);
near(next.schuldenquote / 100 * next.bip, state.schuldenquote / 100 * state.bip, 1e-6, 'Schuldenstand bei Saldo 0');

// 2) Saldo −100 Mrd./Jahr über 4 Jahre ⇒ Schuld +400 Mrd. (keine zusätzliche Aufzinsung)
const next2 = berechneTransition(state, { ...res, saldo: -100 }, 2030, 4);
near(next2.schuldenquote / 100 * next2.bip - state.schuldenquote / 100 * state.bip, 400, 1e-6, 'Schuldenzuwachs = −Saldo × n');

// 3) Zinsausgaben reagieren auf den Schuldenstand (einzige Zinsbuchung in berechne)
const hoch = berechne(PRESETS.status_quo, { ...state, schuldenquote: state.schuldenquote * 2 });
near(hoch.zinsen_dyn, 2 * berechne(PRESETS.status_quo, state).zinsen_dyn, 1e-9, 'Zinsen proportional zur Schuld');

// 4) Klimamodul: Status-quo-Emissionen erzeugen keinen Schaden; 1.000 Mt Mehremissionen < 0,001 % BIP
const sqNext = berechneTransition(state, res, 2030, 4);
near(sqNext.co2_kumulat, (res.emissionen - BASIS_MAKRO.emissions) * 4, 1e-9, 'CO₂-Kumulat = Abweichung vom SQ-Pfad');
near(diceKlimaMalus(0), 1, 1e-15, 'kein Schaden ohne Mehremissionen');
assert.ok(1 - diceKlimaMalus(1000) < 1e-5, `1.000 Mt: BIP-Effekt ${1 - diceKlimaMalus(1000)}`);
assert.ok(diceKlimaMalus(-1000) > 1, 'Minderemissionen wirken leicht positiv');
console.log('Transition: Budgetidentität und Klimamodul plausibel');
