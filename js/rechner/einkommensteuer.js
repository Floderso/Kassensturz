// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Einkommensteuer-Tariffunktionen
// Rechtsgrundlage: § 32a Abs. 1 EStG, VZ 2026, i.d.F. des Steuerfortentwicklungsgesetzes
// (BGBl. 2024 I Nr. 449) — Formeltarif mit 5 Zonen, Eckwerte in TARIF_2026 (data.js)
// ═══════════════════════════════════════════════════════
import { TARIF_2026 } from '../data.js';

// Quellenmetadaten — parallel zu den Berechnungsfunktionen
const FORMEL_QUELLEN_EST = {
  estTarif: {
    formel: '∫ r(z) dz  (Grenzsteuersatz stückweise linear in Zone 2 und 3, konstant in Zone 4 und 5)',
    ref:    '§ 32a Abs. 1 EStG i.d.F. Steuerfortentwicklungsgesetz · VZ 2026',
    note:   'Im Status quo exakt der gesetzliche Tarif (Abweichung ≤ 1 € durch Rundung, § 32a Abs. 1 Satz 6). Bei Reformen werden Zone 2 und 3 proportional zwischen Grundfreibetrag und Spitzensatz-Grenze gestreckt.',
    refs:   ['G01', 'G17']
  },
  grenzsteuersatz: {
    formel: 'r(z): r₀ → rₘ (Zone 2), rₘ → r₄ (Zone 3), r₄ (Zone 4), r₅ (Zone 5); rₘ im gesetzlichen Verhältnis (23,97 − 14)/(42 − 14)',
    ref:    '§ 32a Abs. 1 Nr. 2–5 EStG',
    note:   'Kontinuierlicher Übergang an allen Zonengrenzen; Status quo: 14 % → 23,97 % → 42 % → 45 %',
    refs:   ['G01']
  },
  effSteuersatz: {
    formel: 'T(z) / z',
    ref:    '§ 2 Abs. 5 EStG',
    note:   'Durchschnittssteuersatz = Gesamtsteuer / Gesamteinkommen; stets ≤ Grenzsteuersatz'
  }
};

// Zonengrenzen und Grenzsteuersätze aus den Reglerwerten.
// p.freibetrag → Ende Zone 1, p.grenze → Beginn Zone 5, p.eingang → Satz am Beginn Zone 2,
// p.satz_z4 → Satz der Proportionalzone (Zone 4), p.spitze → Satz Zone 5.
// Zone 2 und 3 werden proportional zwischen Freibetrag und Grenze gestreckt; der Satz am Übergang
// Zone 2/3 steht zu Eingangs- und Proportionalsatz im gesetzlichen Verhältnis.
function tarifAusParams(p) {
  const T = TARIF_2026;
  const skala = (p.grenze - p.freibetrag) / (T.e4 - T.gfb);
  const r0 = p.eingang / 100;
  const r4 = (p.satz_z4 ?? T.r4 * 100) / 100;
  const r5 = p.spitze / 100;
  const rm = r0 + (r4 - r0) * (T.rm - T.r0) / (T.r4 - T.r0);
  return {
    gfb: p.freibetrag,
    e2:  p.freibetrag + (T.e2 - T.gfb) * skala,
    e3:  p.freibetrag + (T.e3 - T.gfb) * skala,
    e4:  p.grenze,
    r0, rm, r4, r5,
  };
}

// Integral eines linear von a nach b (über Breite w) steigenden Grenzsteuersatzes bis u
const integral = (a, b, w, u) => a * u + (b - a) * u * u / (2 * w);

function estTarif(einkommen, p) {
  const t = tarifAusParams(p);
  if (einkommen <= t.gfb) return 0;
  const w2 = t.e2 - t.gfb, w3 = t.e3 - t.e2;
  const T2 = integral(t.r0, t.rm, w2, w2);
  const T3 = integral(t.rm, t.r4, w3, w3);
  if (einkommen <= t.e2) return integral(t.r0, t.rm, w2, einkommen - t.gfb);
  if (einkommen <= t.e3) return T2 + integral(t.rm, t.r4, w3, einkommen - t.e2);
  if (einkommen <= t.e4) return T2 + T3 + t.r4 * (einkommen - t.e3);
  return T2 + T3 + t.r4 * (t.e4 - t.e3) + t.r5 * (einkommen - t.e4);
}

function grenzsteuersatz(einkommen, p) {
  const t = tarifAusParams(p);
  if (einkommen <= t.gfb) return 0;
  if (einkommen <= t.e2) return t.r0 + (t.rm - t.r0) * (einkommen - t.gfb) / (t.e2 - t.gfb);
  if (einkommen <= t.e3) return t.rm + (t.r4 - t.rm) * (einkommen - t.e2) / (t.e3 - t.e2);
  if (einkommen <= t.e4) return t.r4;
  return t.r5;
}

// Effektiver Durchschnittssteuersatz
function effSteuersatz(einkommen, p) {
  if (einkommen <= 0) return 0;
  return estTarif(einkommen, p) / einkommen;
}

export { estTarif, grenzsteuersatz, effSteuersatz, tarifAusParams, FORMEL_QUELLEN_EST };
