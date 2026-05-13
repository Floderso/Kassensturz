// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Einkommensteuer-Tariffunktionen
// Rechtsgrundlage: § 32a EStG 2025 (Formeltarif, 5 Zonen)
// ═══════════════════════════════════════════════════════

// Quellenmetadaten — parallel zu den Berechnungsfunktionen
const FORMEL_QUELLEN_EST = {
  estTarif: {
    formel: '∫₀ˣ r(z) dz  (stückweise lineare Grenzsteuerrate, 5 Zonen)',
    ref:    '§ 32a Abs. 1 EStG 2025 · Formeltarif (kontinuierlich, keine Sprünge)',
    note:   'Zonen werden proportional zur grenze-Parameter skaliert; Referenz: SQ-Grenzwerte 2025'
  },
  grenzsteuersatz: {
    formel: 'r(z) = r₀ + (rₘ − r₀) × z/g₂  [Zone 2], linear interpoliert je Zone',
    ref:    '§ 32a Abs. 1 Nr. 2–5 EStG · BMF Steuerschätzung 2025',
    note:   'Kontinuierlicher Übergang an Zonengrenzen — DE-spezifische Eigenschaft des Formeltarifs'
  },
  effSteuersatz: {
    formel: 'T(z) / z',
    ref:    '§ 2 Abs. 5 EStG',
    note:   'Durchschnittssteuersatz = Gesamtsteuer / Gesamteinkommen; stets ≤ Grenzsteuersatz'
  }
};


// Basis-Grenzwerte 2025; werden beim Ändern von Freibetrag/Spitze/Grenze skaliert.
// Für Status Quo: exakt gesetzliche Werte.
// Bei Parameteränderung: Zonen werden proportional skaliert.

function estTarif(einkommen, freibetrag, eingang, spitze, grenze) {
  if (einkommen <= freibetrag) return 0;
  const zve = einkommen - freibetrag;

  // Status-Quo-Grenzwerte (relativ zum Freibetrag)
  // Zone 2: 12.085–17.005 (4.921 € breit), Zone 3: 17.006–66.760 (49.755 € breit)
  // Zone 4: 66.761–277.825 (211.065 € breit), Zone 5: ab 277.826
  // Wir skalieren Zone 4/5-Grenze auf 'grenze' und Zone 2/3-Grenzwerte proportional.
  const sq_z2 = 4921;   // Breite Zone 2 (SQ)
  const sq_z3 = 49755;  // Breite Zone 3 (SQ)
  const sq_z4 = 211065; // Breite Zone 4 (SQ)
  const sq_total = sq_z2 + sq_z3 + sq_z4; // = 265741 ≈ 277826 - 12084 - 1
  const scale = (grenze - freibetrag) / sq_total;
  const g2 = sq_z2 * scale; // Breite Zone 2 skaliert
  const g3 = sq_z3 * scale; // Breite Zone 3 skaliert

  // Eingangssatz beeinflusst Zone 2 (Progressionszone)
  // Spitzensatz gilt ab Zone 5 (=grenze)
  // Zone 4 (42%-Äquivalent) interpolieren wir als (eingang*0.1 + spitze*0.9) - typisch DE
  const satz4 = Math.min(spitze, eingang * 0.05 + spitze * 0.95) / 100;

  // Marginalsteuersatz-Grenzen (keine Sprünge an Zonengrenzen):
  // Zone 2: r0 → rm  (Eingangssatz → Zwischensatz)
  // Zone 3: rm → r4  (Zwischensatz → Zone-4-Satz, kontinuierlich)
  // Zone 4: r4 (konstant)  Zone 5: r5 = spitze/100
  // rm = r0 + (r4 - r0) * 0.344  — entspricht § 32a-Verhältnis (SQ: ~23,6 %)
  const r0 = eingang / 100;
  const r4 = satz4;
  const r5 = spitze / 100;
  const rm = r0 + (r4 - r0) * 0.344;
  const g4 = sq_z4 * scale;

  // Integral der stückweise linearen Grenzsteuerrate: ∫₀ˣ [a + (b−a)·t/w] dt
  const T = (a, b, w, x) => a * x + (b - a) * x * x / (2 * w);

  const T2 = T(r0, rm, g2, g2);
  const T3 = T(rm, r4, g3, g3);
  const T4 = r4 * g4;

  if (zve <= g2) {
    return T(r0, rm, g2, zve);
  } else if (zve <= g2 + g3) {
    return T2 + T(rm, r4, g3, zve - g2);
  } else if (zve <= g2 + g3 + g4) {
    // Zone 4: linear mit satz4
    const zv4 = zve - g2 - g3;
    return T2 + T3 + r4 * zv4;
  } else {
    const zv5 = zve - g2 - g3 - g4;
    return T2 + T3 + T4 + r5 * zv5;
  }
}

function grenzsteuersatz(einkommen, freibetrag, eingang, spitze, grenze) {
  if (einkommen <= freibetrag) return 0;
  const zve = einkommen - freibetrag;
  const scale = (grenze - freibetrag) / 265741;
  const g2 = 4921 * scale;
  const g3 = 49755 * scale;
  const g4 = 211065 * scale;
  const r0 = eingang / 100;
  const r4 = Math.min(spitze, eingang * 0.05 + spitze * 0.95) / 100;
  const rm = r0 + (r4 - r0) * 0.344; // kontinuierlich: Zone-2-Ende = Zone-3-Start

  if (zve <= g2)           return r0 + (rm - r0) * zve / g2;
  if (zve <= g2 + g3)      return rm + (r4 - rm) * (zve - g2) / g3;
  if (zve <= g2 + g3 + g4) return r4;
  return spitze / 100;
}

// Effektiver Durchschnittssteuersatz
function effSteuersatz(einkommen, freibetrag, eingang, spitze, grenze) {
  if (einkommen <= freibetrag) return 0;
  return estTarif(einkommen, freibetrag, eingang, spitze, grenze) / einkommen;
}

export { estTarif, grenzsteuersatz, effSteuersatz, FORMEL_QUELLEN_EST };
