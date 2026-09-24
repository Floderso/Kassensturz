// Zukunftssimulation (Block 6: F-008, F-018, F-019): nominale Konsistenz, nicht kumulierende
// Niveaueffekte, abklingende Wirkung öffentlicher Investitionen. Ausführen: node tests/zukunft.test.mjs
import assert from 'node:assert/strict';
import { berechne } from '../js/rechner/berechne.js';
import { simulierePfad, berechneTransition } from '../js/rechner/transition.js';
import { PRESETS, PERIOD_STATE_0, FISKAL } from '../js/data.js';

const sq = PRESETS.status_quo;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} statt ${b}`);

// 1) Nominale Skalierung: doppeltes BIP → alle Posten außer Zinsen doppelt
const z1 = { ...PERIOD_STATE_0, renten_faktor: 1 };
const z2 = { ...z1, bip: z1.bip * 2, schuldenquote: z1.schuldenquote / 2 };   // gleicher Schuldenstand
const a = berechne(sq, z1), b = berechne(sq, z2);
near(b.einnahmen_total, 2 * a.einnahmen_total, 1e-6, 'Einnahmen skalieren nominal');
near(b.ausgaben_total - b.zinsen_dyn, 2 * (a.ausgaben_total - a.zinsen_dyn), 1e-6, 'Ausgaben ohne Zinsen skalieren nominal');
near(b.zinsen_dyn, a.zinsen_dyn, 1e-9, 'Zinsen hängen am Schuldenstand, nicht am BIP');

// 2) Saldo 0 und keine Politikeffekte → Schuldenquote sinkt genau mit 1/(1+g)^n
const next = berechneTransition(z1, { ...a, saldo: 0, investment_factor: 1, avg_labor: 1, emissionen: a.emissionen, invest_impuls: 0 }, 2030, 4);
near(next.schuldenquote, z1.schuldenquote / Math.pow(1 + FISKAL.wachstum_nominal, 4), 1e-9, 'Schuldenquote bei Saldo 0');

// 3) Niveaueffekte kumulieren nicht: gleiche Politik in allen Perioden → BIP = Trend × konstanter Faktor
const pfad = simulierePfad(Array.from({ length: 5 }, () => ({ ...sq, kst: 10 })));
const faktoren = pfad.slice(1).map(e => e.zustand.bip / e.zustand.bip_trend);
faktoren.forEach(f => near(f, faktoren[0], 1e-9, 'Niveaueffekt je Periode gleich'));

// 4) Investitionen: Wirkung über den Kapitalstock, klingt nach Ende ab und bleibt in plausibler Größe
const inv = simulierePfad([60, 60, 30, 0, 0].map(invest_impuls => ({ ...sq, invest_impuls })));
const basis = simulierePfad(Array.from({ length: 5 }, () => ({ ...sq })));
const effekt = inv.map((e, i) => e.zustand.bip / basis[i].zustand.bip - 1);
assert.ok(effekt[3] > 0 && effekt[4] < effekt[3], `Effekt klingt ab: ${effekt.map(x => (x * 100).toFixed(2)).join(' / ')} %`);
assert.ok(Math.max(...effekt) < 0.05, `BIP-Effekt < 5 % (${(Math.max(...effekt) * 100).toFixed(2)} %)`);
console.log(`Zukunft: nominal konsistent, Niveaueffekte ohne Kumulation, Investitionseffekt max. ${(Math.max(...effekt) * 100).toFixed(2)} % BIP`);
