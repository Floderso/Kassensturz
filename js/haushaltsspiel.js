// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Haushaltsspiel — Logik & UI
// Statische Daten: js/data.js
// ═══════════════════════════════════════════════════════

/* ============================================================
   DATENBASIS — alle Werte in Mrd. € pro Jahr wo nicht anders angegeben.
   Quellen in den Kommentaren.
   ============================================================ */

// Haushaltsdezile: Bruttoeinkommen (Jahr), Kapitalanteil, Konsumquote,
// Haushaltsgröße (Äquivalenzgewicht), Vermögen, Anzahl Haushalte (Mio)
// Basis: SOEP v40, EU-SILC 2024, DIW Vermögensverteilung

// ============================================================
// STEUERTARIF-FUNKTIONEN
// ============================================================

// § 32a EStG 2025 — echter Formeltarif (5 Zonen)
// Basis-Grenzwerte 2025; werden beim Ändern von Freibetrag/Spitze/Grenze skaliert.
// Für Status Quo: exakt gesetzliche Werte.
// Bei Parameteränderung: Zonen werden proportional skaliert.


// ── 1. STEUERTARIF-FUNKTIONEN ──

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

// ============================================================
// HAUPTBERECHNUNG
// ============================================================


// ── 2. BERECHNUNG — berechne() + Hilfsfunktionen ──

function berechne(params) {
  // ---------- 1. ARBEITSANGEBOT-REAKTION pro Dezil ----------
  // Basisgrenzsteuersatz-Vergleich zum Status Quo
  const sqGrenze = dez => grenzsteuersatz(dez.brutto*(1-dez.kapital), 12084, 14, 45, 277826);

  // BGE-Arbeitsangebotseffekt (Substitutionseffekt: höherer Reservationslohn)
  // Quellen: RWI 2024 (bis −30 % bei 1.500 €), DIW Pilot 2024 (−2 % kurzfristig, n=107),
  // ZEW Heim et al. (extensiver Margin D1–D4), ifo Mikrosimulation 2021.
  // Kompromiss: deutlicher Effekt bei unteren Dezilen, minimal bei oberen.
  const BGE_LABOR_EFF = [0.15, 0.12, 0.09, 0.06, 0.04, 0.025, 0.015, 0.01, 0.005, 0.00, 0.00, 0.00];
  const bge_labor_scale = Math.min(1.67, (params.bge || 0) / 1200);

  const dezile = DEZILE.map((d, idx) => {
    const gs_neu = grenzsteuersatz(d.brutto * (1-d.kapital), params.freibetrag, params.eingang, params.spitze, params.grenze);
    const gs_sq = sqGrenze(d);
    const delta_nettolohn = (1 - gs_neu) - (1 - gs_sq);

    let elas = ELAST.labor_supply;
    let avoidance = 1.0;

    if (d.label === 'D10c') {
      // Top 1%: höhere Arbeitsangebots-Elastizität (extensive margin: Stunden, Rentenentscheidung)
      elas = ELAST.d10c_labor;
      // Steuervermeidung / Einkommensverschiebung: greift ab GSatz > 45%
      // (Kapitalgesellschaft, Stiftung, Timing-Effekte)
      const avoid_trigger = Math.max(0, gs_neu - 0.45);
      const wegzug_trigger = Math.max(0, gs_neu - 0.60);
      avoidance = Math.max(0.40,
        1 - ELAST.d10c_avoidance * avoid_trigger
          - ELAST.d10c_wegzug * wegzug_trigger
      );
    }

    const labor_factor_raw = 1 + elas * (delta_nettolohn / Math.max(0.0001, 1 - gs_sq));
    const lf_tax = Math.max(0.55, Math.min(1.25, labor_factor_raw)) * avoidance;
    // BGE: Substitutionseffekt — skaliert mit BGE/1200 und Dezil (RWI/ZEW)
    const lf = Math.max(0.55, lf_tax * (1 - BGE_LABOR_EFF[idx] * bge_labor_scale));
    return { ...d, labor_factor: lf, brutto_adj: d.brutto * lf, gs_neu, avoidance };
  });

  // ---------- 2. EINKOMMENSTEUER ----------
  let est_aufkommen = 0;
  let est_pro_dezil = [];
  for (const d of dezile) {
    const arbeit = d.brutto_adj * (1 - d.kapital);
    const kapital = d.brutto_adj * d.kapital;
    const est_arbeit = estTarif(arbeit, params.freibetrag, params.eingang, params.spitze, params.grenze);
    let est_kap;
    if (params.synthetisch) {
      // Alle Einkünfte zusammen besteuern
      const total = estTarif(d.brutto_adj, params.freibetrag, params.eingang, params.spitze, params.grenze);
      const est_kap_sy = total - est_arbeit;
      est_kap = Math.max(0, est_kap_sy);
    } else {
      est_kap = kapital * params.abgeltung / 100;
    }
    const tot = est_arbeit + est_kap;
    est_aufkommen += tot * d.anzahl / 1000;   // Mrd.
    est_pro_dezil.push({ d: d.d, est: tot, est_arbeit, est_kap });
  }

  // ---------- 3. KÖRPERSCHAFTSTEUER + GEWERBE ----------
  // Basis-Unternehmensgewinn 2025 ca. 400 Mrd. (Vor-Steuer)
  const gewinn_basis = 400;
  const investment_factor = 1 + ELAST.investment * ((params.kst + (params.gewst_aus ? 0 : params.gewst))/100 - 0.30);
  const gewinn = gewinn_basis * Math.max(0.7, Math.min(1.2, investment_factor));
  const kst_auf = gewinn * params.kst / 100;
  const gewst_auf = params.gewst_aus ? 0 : gewinn * params.gewst / 100;

  // ---------- 4. MWST ----------
  // F3: Verhaltensreaktion Konsum auf BEIDE MwSt-Sätze getrennt (Lewbel/Pendakur 2009).
  // Vorher reagierte cons_factor nur auf den Regelsatz — Senkung des ermäßigten Satzes hatte keinen Effekt.
  const cf_reg = Math.max(0.85, Math.min(1.1, 1 + ELAST.consumption * (params.mwst     - 19) / 100));
  const cf_erm = Math.max(0.85, Math.min(1.1, 1 + ELAST.consumption * (params.mwst_erm -  7) / 100));
  let mwst_auf = 0;
  for (const d of dezile) {
    // Netto nach ESt und SV (SV-Basis = Arbeitseinkommen, K3-Vorkorrektur hier vereinfacht)
    const est_d = est_pro_dezil.find(x => x.d === d.d).est;
    const arbeit_mwst = d.brutto_adj * (1 - d.kapital);
    const bbg_kv_mwst = params.kv_bbg_frei ? Infinity : Math.round((params.bbg ?? 90000) * (62100 / 90000));
    const sv_d = Math.min(arbeit_mwst, params.bbg ?? 90000) * (params.rv + params.alpf * 0.42) / 100 * 0.5
               + Math.min(arbeit_mwst, bbg_kv_mwst) * (params.kv + params.alpf * 0.58) / 100 * 0.5;
    const netto = d.brutto_adj - est_d - sv_d;
    const konsum = netto * d.konsum;
    // 70% Regelsatz, 30% ermäßigt (grob aus VGR); je Kategorie eigene Verhaltensreaktion
    const mwst_d = konsum * (0.7 * params.mwst     / (100 + params.mwst)     * cf_reg
                           + 0.3 * params.mwst_erm / (100 + params.mwst_erm) * cf_erm);
    mwst_auf += mwst_d * d.anzahl / 1000;
  }
  // R08: VAT-Gap-Korrekturfaktor (EU-Kommission / CASE VAT Gap 2024: DE ~3,7 % des theoretischen Aufkommens ungehoben)
  mwst_auf *= 0.963;

  // ---------- 5. CO2 ----------
  // Emissionen Deutschland ca. 650 Mio t, davon ~500 Mio t im CO2-Bepreisungsbereich
  const emissions_basis = 500;
  const co2_factor = 1 + ELAST.co2 * ((params.co2 - 55) / 100);
  const emissionen = emissions_basis * Math.max(0.4, Math.min(1.1, co2_factor));
  const co2_auf = emissionen * params.co2 / 1000;
  const klimageld_auszahlung = params.klimageld ? co2_auf * 0.7 : 0; // 70% zurück als Klimageld

  // ---------- 6. VERMÖGEN / ERBSCHAFT / BODEN ----------
  // Erbschaftsmasse pro Jahr ca. 400 Mrd., oberste 10% erben ~60%
  const erb_masse_top = 400 * 0.6;
  const erb_masse_unten = 400 * 0.4;
  const erb_satz_eff = params.erb * (params.betriebs ? 0.3 : 0.9) / 100; // Ausnahmen senken eff. Satz
  const erb_auf = erb_masse_top * erb_satz_eff + erb_masse_unten * Math.min(params.erb, 15)/100 * 0.5;

  // Bodenwert Deutschland ca. 5000 Mrd.
  const boden_auf = 5000 * params.boden / 100;

  // Vermögensteuer: Vermögen > 2 Mio € ca. 3500 Mrd.
  const verm_auf = 3500 * params.verm / 100;

  // ---------- 7. SV-BEITRÄGE ----------
  // Versicherungspflichtige Lohnsumme ca. 1750 Mrd., BBG begrenzt
  const bbg = params.bbg ?? 90000;
  // BBG-Erhöhung: ~12% der sozialversicherungspflichtigen Löhne liegt zwischen 90k und 160k
  const bbg_lohnsumme_factor = 1 + Math.max(0, (bbg - 90000) / 90000) * 0.12;
  const lohnsumme_sv = 1750 * bbg_lohnsumme_factor;
  const buerger_boost = params.buergerv ? 1.15 : 1.0; // breitere Basis
  const rv_auf = lohnsumme_sv * params.rv / 100 * buerger_boost;
  // KV-Reformboni (Bürgerversicherungs-Bausteine — ifo Forschungsbericht 159/2025, DIW):
  // kv_bbg_frei: Lohnbasis über KV-BBG (62.100 €) wird beitragspflichtig → +~18 Mrd. bei 16,3%
  // kv_kapital:  Kapital- und Mieteinkünfte GKV-Mitglieder KV-pflichtig → +~8 Mrd. bei 16,3%
  const kv_bbg_frei_bonus = params.kv_bbg_frei ? 18 * (params.kv / 16.3) : 0;
  const kv_kapital_bonus  = params.kv_kapital  ?  8 * (params.kv / 16.3) : 0;
  const kv_auf = lohnsumme_sv * params.kv / 100 * buerger_boost + kv_bbg_frei_bonus + kv_kapital_bonus;
  const al_auf = lohnsumme_sv * params.alpf / 100 * buerger_boost;

  // ---------- 7b. ZUCMAN-MINDESTSTEUER ----------
  // 2%-Mindeststeuer auf Nettovermögen ultra-Reicher (Zucman G20 2024)
  // Basis D10c: 0,41 Mio. HH × 7 Mio. € Median-Vermögen = ~2.870 Mrd. €
  // Avoidance: ~15% bei 2% Satz (Jakobsen/Kleven/Kolsrud 2024)
  const zucman_basis = 2870;
  const zucman_avoidance = 1 - 0.15 * Math.min(1, (params.zucman ?? 0) / 2);
  const zucman_auf = zucman_basis * (params.zucman ?? 0) / 100 * zucman_avoidance;

  // ---------- 8. KLEINE VERBRAUCHSTEUERN ----------
  const klein_auf = params.kleine_st ?
    (BASIS_AUFKOMMEN.energie + BASIS_AUFKOMMEN.tabak + BASIS_AUFKOMMEN.kfz + BASIS_AUFKOMMEN.sonstige + BASIS_AUFKOMMEN.solz_abgelt) : 0;

  // ---------- 9. TRANSFERS ----------
  const bge = params.bge || 0;

  // BGE + Rentenreform: Einsparung weil BGE als Sockel die Rentenzahlung reduziert
  // Quelle: Rentenbericht 2024 — RV-Gesamtausgaben inkl. Bundeszuschuss SQ ~430 Mrd. €/J.
  // M3: Ausgabenbasis skaliert mit rv-Regler (Umlagesystem: niedrigere Beiträge = niedrigeres Leistungsniveau).
  // Damit wird verhindert, dass rv_einsparung gegen eine feste Basis gerechnet wird, die der rv-Slider
  // schon implizit abgesenkt hat (Doppelkorrektur-Vermeidung).
  const RV_AUSGABEN_SQ = 430;
  const rv_ausgaben_basis = RV_AUSGABEN_SQ * (params.rv / 18.6); // skaliert mit Beitragssatz
  let rv_einsparung = 0;
  if (bge > 0) {
    const rl = params.rente_grenze || 35000;              // €/Jahr Einkommensgrenze
    const avg_g = (rl * 0.55) / 12;                      // avg monatl. Nettoeink. Geringverdiener
    const avg_h = (rl * 1.80) / 12;                      // avg monatl. Nettoeink. Gutverdiener
    const rentner_h = Math.min(15, Math.max(2, (rl - 15000) / 3000)); // Mio. Gutverdiener-Rentner
    const rentner_g = 21 - rentner_h;                    // Mio. Geringverdiener-Rentner
    const ziel_g = ((params.rente_niveau_gering || 80) / 100) * avg_g;
    const ziel_h = ((params.rente_niveau_hoch   || 50) / 100) * avg_h;
    const topup_g = Math.max(0, ziel_g - bge);           // monatl. Aufstockung Geringverdiener
    const topup_h = Math.max(0, ziel_h - bge);           // monatl. Aufstockung Gutverdiener
    const rv_neu = (rentner_g * topup_g + rentner_h * topup_h) * 12 / 1000; // Mrd./Jahr
    rv_einsparung = Math.max(0, rv_ausgaben_basis - rv_neu);
  }

  // Bürgergeld: wenn BGE >= BG-Niveau, vollständig durch BGE ersetzt (RWI 2024)
  const bg_effektiv = bge >= params.bg ? 0 : params.bg;
  const bg_auszahlung = 5.5 * bg_effektiv * 12 / 1000; // Mrd.
  // Kindergeld: ca. 17 Mio Kinder
  const kg_auszahlung = 17 * params.kg * 12 / 1000;
  // Negative ESt falls aktiviert
  let neg_est_auszahlung = 0;
  if (params.neg_est) neg_est_auszahlung = 30;

  // BGE Bruttokosten: ~70 Mio. Erwachsene (Destatis Mikrozensus 2024)
  // Quelle: RWI 2024, ifo Mikrosimulation 2021 (Blömer/Peichl)
  const bge_brutto = bge * 12 * 70 / 1000; // Mrd. — bei 1.200 € = ~1.008 Mrd./Jahr

  // ---------- 10. GESAMTEINNAHMEN ----------
  const rev = {
    est: est_aufkommen,
    kst: kst_auf,
    gewst: gewst_auf,
    mwst: mwst_auf,
    co2: co2_auf - klimageld_auszahlung,
    erbschaft: erb_auf,
    boden: boden_auf,
    vermoegen: verm_auf,
    zucman: zucman_auf,
    rv: rv_auf,
    kv: kv_auf,
    al: al_auf,
    klein: klein_auf
  };
  const einnahmen_total = Object.values(rev).reduce((a,b)=>a+b,0);

  // ---------- 11. VERWALTUNGSKOSTEN ----------
  const admin_kosten =
    est_aufkommen * ADMIN_QUOTE.est +
    (est_aufkommen * (params.synthetisch ? 0.3 : 0.2)) * (ADMIN_QUOTE.kapital - ADMIN_QUOTE.est) +
    mwst_auf * ADMIN_QUOTE.mwst +
    kst_auf * ADMIN_QUOTE.kst +
    gewst_auf * ADMIN_QUOTE.gewst +
    co2_auf * ADMIN_QUOTE.co2 +
    erb_auf * ADMIN_QUOTE.erbschaft +
    boden_auf * ADMIN_QUOTE.grundst +
    verm_auf * ADMIN_QUOTE.verm +
    zucman_auf * ADMIN_QUOTE.verm +
    klein_auf * ADMIN_QUOTE.klein +
    (rv_auf + kv_auf + al_auf) * ADMIN_QUOTE.sv +
    (bg_auszahlung + kg_auszahlung + neg_est_auszahlung) * ADMIN_QUOTE.transfer +
    bge_brutto * 0.008; // BGE: 0,8% Verwaltungskosten — kein Bedürftigkeitstest (RWI 2024)

  // ---------- 12. AUSGABEN inkl. Transfers ----------
  // F1: SV-Ausgabenseite koppeln — Umlagesystem: Beitragssatz ↓ → Leistungen ↓ (§ 213 SGB VI).
  // Sozial=850 enthält grob: RV ~390, GKV ~290, AL+PV ~90, Bürgergeld etc. ~80 Mrd.
  // Bürgergeld wird separat über bg_auszahlung geführt; die SV-Anteile skalieren mit den Reglern.
  const SV_AUSG = { rv: 390, kv: 290, alpf: 90 };
  const sv_ausgaben_delta =
    SV_AUSG.rv   * (params.rv   / 18.6 - 1) +
    SV_AUSG.kv   * (params.kv   / 16.3 - 1) +
    SV_AUSG.alpf * (params.alpf /  6.2 - 1);
  const ausgaben_total = AUSGABEN_TOTAL + bg_auszahlung + kg_auszahlung + neg_est_auszahlung + bge_brutto + admin_kosten - 140 - rv_einsparung + sv_ausgaben_delta;

  // ---------- 13. SALDO ----------
  const saldo = einnahmen_total - ausgaben_total;

  // ---------- 14. ZAHL AKTIVER STEUERARTEN ----------
  let nst = 0;
  if (est_aufkommen > 0) nst++;
  if (kst_auf > 0) nst++;
  if (gewst_auf > 0) nst++;
  if (mwst_auf > 0) nst += 2;
  if (co2_auf > 0) nst++;
  if (erb_auf > 0) nst++;
  if (boden_auf > 0) nst++;
  if (verm_auf > 0) nst++;
  if (zucman_auf > 0) nst++;
  if (rv_auf > 0) nst++;
  if (kv_auf > 0) nst++;
  if (al_auf > 0) nst += 2;
  if (klein_auf > 0) nst += 7;

  // ---------- 15. HAUSHALTSBELASTUNG pro Dezil (vs. Status Quo) ----------
  const hh_delta = berechneDezilDelta(dezile, params, est_pro_dezil, klimageld_auszahlung, bg_auszahlung, kg_auszahlung);

  // ---------- 16. GINI ----------
  const gini = berechneGini(hh_delta.netto);
  const palma = berechnePalma(hh_delta.netto);

  // ---------- 17. VERHALTENSINDIZES ----------
  const avg_labor = dezile.reduce((a,d) => a + d.labor_factor * d.anzahl, 0) / dezile.reduce((a,d) => a + d.anzahl, 0);
  const behavior = {
    labor: avg_labor * 100,
    konsum: (0.7 * cf_reg + 0.3 * cf_erm) * 100, // F3: gewichteter Schnitt beider MwSt-Faktoren
    invest: investment_factor * 100,
    co2: co2_factor * 100
  };

  // ---------- 18. ARMUTSRISIKOQUOTE ----------
  // Gewichteter Median (nach Haushaltsanzahl) — korrekt für ungleiche Dezilgrößen (D10a/b/c)
  const median_netto = berechneMedianGewichtet(hh_delta.netto, dezile);
  // K4: EU-SILC-Standard 60 % (Eurostat). Das Modell arbeitet mit Dezil-Durchschnittswerten;
  // einzelne Haushalte innerhalb von D1 können deutlich unter dem Mittelwert liegen.
  // Ein Armutsrisiko von ~0 % im Status quo spiegelt wider, dass Bürgergeld + Klimageld
  // den Dezil-1-Mittelwert über die 60%-Schwelle hebt — korrekt, aber kein Abbild
  // der Innerhalb-Dezil-Streuung (bekannte Modell-Vereinfachung durch Dezil-Durchschnitte).
  const poverty_line = median_netto * 0.60;
  const total_hh_all = dezile.reduce((a,d)=>a+d.anzahl,0);
  const armutsrisiko = dezile.reduce((a,d,i)=>hh_delta.netto[i]<poverty_line?a+d.anzahl:a,0)/total_hh_all*100;

  // ---------- 19. SCHULDENQUOTE Δ ----------
  // BIP Deutschland 2025 ~4.200 Mrd. €; Saldo / BIP = jährliche Schuldenquotenänderung
  const bip = 4200;
  const schuldenquote_delta = -(saldo / bip) * 100; // negativ = Schulden steigen

  // ---------- 20. METR (Marginal Effective Tax Rate) je Dezil ----------
  // METR = ESt-Grenzsteuersatz + SV-Grenzbelastung (AN-Anteil) + Transfer-Entzug
  const metr = dezile.map((d, i) => {
    const brutto = d.brutto_adj;
    const arbeit = brutto * (1 - d.kapital);
    const gs_est = grenzsteuersatz(arbeit, params.freibetrag, params.eingang, params.spitze, params.grenze);
    // K3: Separate BBG für KV/PV (62.100 €) und RV/AL (params.bbg).
    // RV+AL Grenzbelastung fällt weg sobald Arbeitseinkommen ≥ RV-BBG
    const bbg_rv_m = params.bbg ?? 90000;
    const bbg_kv_m = Math.round(bbg_rv_m * (62100 / 90000));
    const sv_grenz_rv = arbeit < bbg_rv_m ? (params.rv + params.alpf * 0.42) / 100 * 0.5 : 0;
    // kv_bbg_frei: kein Deckel → Grenzbelastung gilt bei jedem Einkommensniveau
    const sv_grenz_kv = (params.kv_bbg_frei || arbeit < bbg_kv_m) ? (params.kv + params.alpf * 0.58) / 100 * 0.5 : 0;
    const sv_grenz = sv_grenz_rv + sv_grenz_kv;
    // Transfer-Entzug: Bürgergeld-Empfänger verlieren 80% des Zusatzeinkommens (§ 11b SGB II)
    // Bei BGE >= Bürgergeld: kein Entzug mehr (BGE ist bedingungslos, kein Anrechnungsprinzip)
    const bg_entzug_arr = [0.80, 0.70, 0.20, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const bg_entzug = bge >= params.bg ? 0 : bg_entzug_arr[i];
    return Math.min(0.99, gs_est + sv_grenz + bg_entzug);
  });

  // ---------- 21. DEADWEIGHT LOSS ----------
  // M2: DWL pro Dezil summieren statt über Durchschnitts-Grenzsteuersatz — Jensen-Ungleichung:
  // E[gs²] ≥ E[gs]², daher unterschätzt avg_gs²-Ansatz den DWL systematisch.
  // Korrekt: ∑ 0.5 × ε × gs_i² / (1−gs_i) × Lohnsumme_i  (Harberger-Dreieck je Dezil)
  const dwl = dezile.reduce((a, d) => {
    const arbeit_dwl = d.brutto_adj * (1 - d.kapital);
    const gs = grenzsteuersatz(arbeit_dwl, params.freibetrag, params.eingang, params.spitze, params.grenze);
    const lohnsumme_d = arbeit_dwl * d.anzahl / 1000; // Mrd.
    return a + 0.5 * ELAST.labor_supply * (gs * gs) / Math.max(0.01, 1 - gs) * lohnsumme_d;
  }, 0);

  // ---------- 19b. SCHULDENBREMSE (Art. 109 GG) ----------
  // Vereinfacht: struktureller Saldo ≈ Gesamtsaldo / BIP (keine Konjunkturbereinigung im Modell)
  const saldo_bip_pct = saldo / bip * 100;
  const schuldenbremse_ok = saldo_bip_pct >= -0.35;

  // ---------- 19c. DYNAMISCHES SCORING ----------
  // Verhaltensbedingte Aufkommensänderung gegenüber mechanischer (statischer) Wirkung
  // KSt: investment_factor-Abweichung von 1 = Investitionsreaktion auf KSt-Änderung
  const dynamisch_kst = gewinn_basis * params.kst / 100 * (investment_factor - 1);
  // ESt: labor_factor-Abweichung → Arbeitsangebotsreaktion (Saez/Chetty-Konsens ε = 0,20)
  const dynamisch_est = est_aufkommen * (avg_labor - 1);
  const dynamisch_delta = dynamisch_kst + dynamisch_est;

  return {
    rev, einnahmen_total, ausgaben_total, saldo, admin_kosten, nst,
    hh_delta, gini, palma, behavior, klimageld_auszahlung,
    bg_auszahlung, kg_auszahlung, neg_est_auszahlung,
    armutsrisiko, schuldenquote_delta, metr, dwl, poverty_line,
    rv_einsparung,
    // Research-basierte Erweiterungen (QUELLENRECHERCHE.md)
    saldo_bip_pct, schuldenbremse_ok,
    dynamisch_kst, dynamisch_est, dynamisch_delta,
    investment_factor, avg_labor,
    // GKV-Reform-Boni (für GKV-Panel-Darstellung)
    kv_bbg_frei_bonus, kv_kapital_bonus
  };
}

function berechneDezilDelta(dezile, params, est_dez, klima, bg, kg) {
  // Netto-Einkommen pro Dezil NEU
  const netto = [];
  const delta = [];
  const belastung_pct = [];
  for (let i = 0; i < dezile.length; i++) {
    const d = dezile[i];
    const est = est_dez[i].est;
    const brutto = d.brutto_adj;
    // K3: SV nur auf Arbeitseinkommen (nicht Kapital); KV-BBG (62.100 €) < RV/AL-BBG
    const arbeit_dez = brutto * (1 - d.kapital);
    const bbg_rv_dez = params.bbg ?? 90000;
    // kv_bbg_frei: kein KV-Beitragsdeckel → gesamtes Arbeitseinkommen KV-pflichtig
    const bbg_kv_dez = params.kv_bbg_frei ? Infinity : Math.round(bbg_rv_dez * (62100 / 90000));
    const sv_lohn = Math.min(arbeit_dez, bbg_rv_dez) * (params.rv + params.alpf * 0.42) / 100 * 0.5
                  + Math.min(arbeit_dez, bbg_kv_dez) * (params.kv + params.alpf * 0.58) / 100 * 0.5;
    // kv_kapital: Kapitalerträge von GKV-Mitgliedern werden KV-pflichtig (Mieteinnahmen, Zinsen, Dividenden)
    // GKV-Quote sinkt in den oberen Dezilen (mehr PKV)
    const GKV_QUOTE = [0.95, 0.95, 0.95, 0.93, 0.90, 0.85, 0.80, 0.75, 0.70, 0.55, 0.30, 0.08];
    const sv_kapital = params.kv_kapital ? brutto * d.kapital * params.kv / 100 * 0.5 * GKV_QUOTE[i] : 0;
    const sv = sv_lohn + sv_kapital;
    // MwSt auf Konsum
    const vornetto = brutto - est - sv;
    const konsum = vornetto * d.konsum;
    const mwst = konsum * (0.7 * params.mwst / (100 + params.mwst) + 0.3 * params.mwst_erm / (100 + params.mwst_erm));
    // CO2-Last (untere Dezile höherer Anteil am Einkommen)
    // CO₂-Last: Dezil-Anteil am Einkommen × CO₂-Preis × Emissionsreaktion
    // D10a/b/c: sinkender CO2-Anteil am Einkommen, aber absolut höher
    const co2_share = [0.040, 0.038, 0.036, 0.034, 0.032, 0.030, 0.028, 0.025, 0.022, 0.018, 0.015, 0.010];
    const co2_factor_dez = Math.max(0.4, Math.min(1.1, 1 + ELAST.co2 * (params.co2 - 55) / 100));
    const co2_last = brutto * co2_share[i] * (params.co2 / 55) * co2_factor_dez;
    // Klimageld zurück (gleichverteilt pro Kopf)
    const total_hh = DEZILE.reduce((a,d)=>a+d.anzahl,0);
    const klimageld_per_hh = klima * 1000 / total_hh;
    // Transfers erhalten
    // Bürgergeld: D1–D3/D4, D10a/b/c = 0
    const bg_quote = [0.60, 0.25, 0.08, 0.02, 0, 0, 0, 0, 0, 0, 0, 0];
    // Kindergeld: Mikrozensus 2024; D10a/b/c: 0,45/0,35/0,20 Kinder im Schnitt
    const kg_quote = [0.80, 1.10, 1.20, 1.15, 1.05, 0.95, 0.85, 0.75, 0.65, 0.50, 0.35, 0.20];
    const bge_p = params.bge || 0;
    // Bürgergeld effektiv: 0 wenn BGE >= BG-Niveau (BGE ersetzt es, RWI 2024)
    const bg_effektiv_hh = bge_p >= params.bg ? 0 : params.bg;
    let transfers = 0;
    transfers += bg_effektiv_hh * 12 * bg_quote[i];
    transfers += params.kg * 12 * kg_quote[i];
    transfers += bge_p * 12; // BGE: jeder Erwachsene erhält vollen Betrag (bedingungslos)
    if (params.neg_est && i < 3) transfers += 3000;

    const netto_final = brutto - est - sv - mwst - co2_last + klimageld_per_hh + transfers;

    // STATUS-QUO-Vergleich (hart codiert auf Basisparameter gerechnet)
    const netto_sq = berechneNettoSQ(d);
    netto.push(netto_final);
    delta.push(netto_final - netto_sq);
    belastung_pct.push(100 * (est + sv + mwst + co2_last - transfers) / brutto);
  }
  return { netto, delta, belastung_pct };
}

function berechneNettoSQ(d) {
  // Status Quo: freibetrag 12084, eingang 14, spitze 45, grenze 277826
  const brutto = d.brutto;
  // F2: Kapital und Arbeit getrennt besteuern — konsistent mit berechne()
  // Vorher wurde estTarif(brutto) genutzt, was Kapitalanteil doppelt progressiv besteuert hätte.
  const arbeit_sq = brutto * (1 - d.kapital);
  const kapital_sq = brutto * d.kapital;
  const est = estTarif(arbeit_sq, 12084, 14, 45, 277826) + kapital_sq * 0.25; // Abgeltungsteuer SQ
  // SV nur auf Arbeitseinkommen; KV-BBG (62.100 €) < RV/AL-BBG (90.000 €)
  const sv = Math.min(arbeit_sq, 90000) * (18.6 + 2.6) / 100 * 0.5   // RV + AL
           + Math.min(arbeit_sq, 62100) * (16.3 + 3.6) / 100 * 0.5;  // KV + PV
  const vornetto = brutto - est - sv;
  const konsum = vornetto * d.konsum;
  const mwst = konsum * (0.7 * 19/119 + 0.3 * 7/107);
  const co2_share = [0.040, 0.038, 0.036, 0.034, 0.032, 0.030, 0.028, 0.025, 0.022, 0.018, 0.015, 0.010];
  const co2_last = brutto * co2_share[d.idx];
  // Klimageld SQ konsistent mit PRESETS.status_quo (co2=55, 500 Mio.t Basis)
  const sq_co2_auf = 500 * 55 / 1000; // 27,5 Mrd.
  const total_hh_sq = DEZILE.reduce((a,x)=>a+x.anzahl,0);
  const klimageld_per_hh = sq_co2_auf * 0.7 * 1000 / total_hh_sq;
  let transfers = 0;
  const bg_quote_sq = [0.60, 0.25, 0.08, 0.02, 0, 0, 0, 0, 0, 0, 0, 0];
  const kg_quote_sq = [0.80, 1.10, 1.20, 1.15, 1.05, 0.95, 0.85, 0.75, 0.65, 0.50, 0.35, 0.20];
  transfers += 563 * 12 * bg_quote_sq[d.idx];
  transfers += 255 * 12 * kg_quote_sq[d.idx];
  return brutto - est - sv - mwst - co2_last + klimageld_per_hh + transfers;
}

// ============================================================
// RENTENREFORM & GKV
// ============================================================


// ── 3. RENDER — Renten, SVG-Grafiken ──

function berechneRente(params, rv_aufkommen_aktuell) {
  const lohnsumme_sv = 1750; // Mrd. Beitragsbasis

  // --- Generationenkapital: historisches Was-wäre-wenn ---
  // Jedes Jahr wird Fondsquote % des RV-Aufkommens investiert
  const years_history = Math.max(0, 2025 - params.startjahr);
  const annual_inv = rv_aufkommen_aktuell * params.kapitalquote / 100; // Mrd. / Jahr
  let kapitalstock = 0;
  const ks_history = []; // für Chart
  for (let y = 0; y < years_history; y++) {
    kapitalstock = (kapitalstock + annual_inv) * (1 + params.rendite_fonds / 100);
    ks_history.push({ jahr: params.startjahr + y + 1, ks: kapitalstock });
  }
  const jahresertrag = kapitalstock * params.rendite_fonds / 100; // Mrd. / Jahr
  const beitragsentlastung = (jahresertrag / lohnsumme_sv) * 100; // Prozentpunkte

  // --- Beitragssatz-Projektion 2025–2045 ---
  // Demografiedruck: ohne Reform +0,3 PP/Jahr (SVR-Schätzung)
  const demo_anstieg = 0.30;
  const sq_beitrag = 18.6;
  const proj_ohne = [];
  const proj_mit = [];
  let ks_proj = kapitalstock;
  for (let y = 0; y <= 20; y++) {
    const beitrag_ohne = sq_beitrag + y * demo_anstieg;
    // Fonds wächst weiter: jedes Projektionsjahr investiert man weiter + Zinseszins
    if (params.kapitalquote > 0) {
      ks_proj = (ks_proj + annual_inv) * (1 + params.rendite_fonds / 100);
    }
    const ertrag_y = ks_proj * params.rendite_fonds / 100;
    const entlastung_y = (ertrag_y / lohnsumme_sv) * 100;
    proj_ohne.push({ jahr: 2025 + y, beitrag: beitrag_ohne });
    proj_mit.push({ jahr: 2025 + y, beitrag: Math.max(12, beitrag_ohne - entlastung_y) });
  }

  // --- GKV Reformen ---
  // PKV-Abschaffung: ~11 Mio. Privatversicherte; GKV-Kosten höher als PKV-Einsparung
  const pkv_versicherte = 11; // Mio.
  // GKV-Beitrag bei aktueller Quote für diese Einkommensgruppe ~600€/M, PKV heute ~450€/M
  // PKV-Abschaffung: mehr Einnahmen durch breitere Basis, aber auch höhere Leistungsausgaben
  const pkv_zusatz_einnahmen = params.pkv_abschaffen ? pkv_versicherte * 0.60 * 12 / 1000 : 0; // Mrd.
  const pkv_zusatz_ausgaben  = params.pkv_abschaffen ? pkv_versicherte * 0.65 * 12 / 1000 : 0; // etwas mehr wegen GKV-Standard
  const pkv_netto_effekt = pkv_zusatz_einnahmen - pkv_zusatz_ausgaben;

  // Kassenfusion: GKV-Verwaltungskosten ~12 Mrd.; proportionaler Fixkostenabbau
  const kv_admin_sq = 12;
  const kassen_ersparnis = params.anzahl_kv < 95
    ? kv_admin_sq * (1 - params.anzahl_kv / 95) * 0.45
    : 0;

  // Prävention: langfristiger ROI 1,5× (Vereinfachung; EU-Studie: 1€ → 3€ über 20J.)
  const praevention_ersparnis = params.praevention * 1.5 - params.praevention; // Nettoersparnis

  const gkv_gesamt_effekt = pkv_netto_effekt + kassen_ersparnis + praevention_ersparnis;

  return {
    kapitalstock, jahresertrag, beitragsentlastung, annual_inv, ks_history,
    proj_ohne, proj_mit,
    pkv_netto_effekt, kassen_ersparnis, praevention_ersparnis, gkv_gesamt_effekt
  };
}

function renderRenten(p, r) {
  if (!p.kapitalquote && !p.pkv_abschaffen && p.anzahl_kv >= 95 && !p.praevention && !p.kv_kapital && !p.kv_bbg_frei) {
    document.getElementById('renten-panel').style.display = 'none';
    return;
  }
  document.getElementById('renten-panel').style.display = '';

  const rente = berechneRente(p, r.rev.rv);
  const f1 = n => n.toFixed(1).replace('.', ',');

  // KPIs
  const kpis = [
    { label: 'Kapitalstock 2025', value: rente.kapitalstock.toFixed(0) + ' Mrd. €',
      delta: p.kapitalquote > 0 ? `${p.kapitalquote}% Fondsquote seit ${p.startjahr}` : 'Kein Fonds aktiv', cls: p.kapitalquote > 0 ? 'good' : 'neutral' },
    { label: 'Jahresertrag Fonds', value: rente.jahresertrag.toFixed(1) + ' Mrd. €',
      delta: rente.beitragsentlastung > 0 ? '−' + f1(rente.beitragsentlastung) + ' PP Beitragssatz' : '—', cls: rente.beitragsentlastung > 0 ? 'good' : 'neutral' },
    { label: 'RV-Entlastung 2045', value: (() => { const ohne = 18.6 + 20*0.3; const mit = document.getElementById('renten-panel') ? rente.proj_mit[20]?.beitrag : ohne; return f1(ohne - (mit||ohne)) + ' PP'; })(),
      delta: 'gegenüber ohne Reform', cls: rente.beitragsentlastung > 0 ? 'good' : 'neutral' },
    { label: 'GKV-Struktureffekt', value: (rente.gkv_gesamt_effekt >= 0 ? '+' : '') + f1(rente.gkv_gesamt_effekt) + ' Mrd. €',
      delta: rente.kassen_ersparnis > 0 ? `Kassenfusion: +${f1(rente.kassen_ersparnis)} Mrd.` : 'Nur strukturelle Effekte', cls: rente.gkv_gesamt_effekt > 0 ? 'good' : rente.gkv_gesamt_effekt < -1 ? 'bad' : 'neutral' }
  ];
  document.getElementById('renten_kpis').innerHTML = kpis.map(k => `
    <div class="kpi" style="background:var(--paper);border:1px solid var(--rule);padding:14px 16px;">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value" style="font-size:22px">${k.value}</div>
      <div class="kpi-delta ${k.cls}">${k.delta}</div>
    </div>`).join('');

  // Kapitalstock Chart
  renderKapitalstockSVG(rente, p);

  // Beitragssatz Projektion
  renderBeitragProjSVG(rente, p);

  // GKV Panel
  const gkvItems = [
    { label: 'PKV-Abschaffung (Netto)', v: rente.pkv_netto_effekt, aktiv: p.pkv_abschaffen,
      note: p.pkv_abschaffen ? '11 Mio. PKV → GKV; Mehrausgaben überwiegen leicht' : 'inaktiv' },
    { label: 'Kassenfusion (Verwalt.)', v: rente.kassen_ersparnis, aktiv: p.anzahl_kv < 95,
      note: p.anzahl_kv < 95 ? `${p.anzahl_kv} statt 95 Kassen; Fixkostenabbau 45%` : 'inaktiv' },
    { label: 'Prävention (Nettonutzen)', v: rente.praevention_ersparnis, aktiv: p.praevention > 0,
      note: p.praevention > 0 ? `${p.praevention} Mrd. Invest × 1,5 ROI (vereinf.)` : 'inaktiv' },
    { label: 'Kapitalerträge KV-pflichtig', v: r.kv_kapital_bonus, aktiv: p.kv_kapital,
      note: p.kv_kapital ? `+${r.kv_kapital_bonus.toFixed(1)} Mrd. bei ${p.kv}% KV-Satz (ifo FB 159/2025)` : 'inaktiv' },
    { label: 'KV-BBG abschaffen', v: r.kv_bbg_frei_bonus, aktiv: p.kv_bbg_frei,
      note: p.kv_bbg_frei ? `+${r.kv_bbg_frei_bonus.toFixed(1)} Mrd. bei ${p.kv}% KV-Satz (DIW Wochenbericht 2025)` : 'inaktiv' }
  ].filter(x => x.aktiv);

  if (gkvItems.length === 0) {
    document.getElementById('gkv_panel').innerHTML = '';
    return;
  }

  const maxAbs = Math.max(1, ...gkvItems.map(x => Math.abs(x.v)));
  document.getElementById('gkv_panel').innerHTML = `
    <div style="font-family:'DM Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:12px;">GKV-Struktureffekte (Mrd. € / Jahr)</div>
    <div style="display:flex;flex-direction:column;gap:14px;">
    ${gkvItems.map(item => {
      const pct = Math.max(2, Math.abs(item.v) / maxAbs * 100);
      const cls = item.v >= 0 ? 'pos' : 'neg';
      return `<div>
        <div style="display:grid;grid-template-columns:180px 1fr 72px;align-items:center;gap:10px;margin-bottom:4px;">
          <div style="font-family:'DM Mono',monospace;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${item.label}">${item.label}</div>
          <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>
          <div style="font-family:'DM Mono',monospace;font-size:11px;text-align:right;white-space:nowrap;">${item.v >= 0 ? '+' : ''}${f1(item.v)} Mrd.</div>
        </div>
        <div style="font-size:11px;color:var(--muted);font-style:italic;padding-left:4px;">${item.note}</div>
      </div>`;
    }).join('')}
    </div>
    <p style="font-size:11px;color:var(--muted);margin-top:14px;font-style:italic;">Quelle: GKV-SV Jahresbericht 2025, PKV-Verband, WHO Prevention ROI Report 2017, BMG.</p>`;
}

function renderKapitalstockSVG(rente, p) {
  const el = document.getElementById('kapitalstock_chart');
  if (!el) return;
  if (p.kapitalquote === 0 || rente.ks_history.length === 0) {
    el.innerHTML = '<p style="color:var(--muted);font-style:italic;font-size:13px;padding:12px 0;">Fondsquote = 0 % — kein Kapitalstock aufgebaut.<br>Setze Fondsquote > 0 und ein Startjahr um die historische Simulation zu sehen.</p>';
    return;
  }
  const W = 580, H = 160, pl = 52, pr = 16, pt = 12, pb = 28;
  const iW = W - pl - pr, iH = H - pt - pb;
  const data = rente.ks_history;
  const maxKS = Math.max(1, ...data.map(d => d.ks));
  const minJahr = data[0].jahr, maxJahr = data[data.length-1].jahr;
  const xOf = j => pl + ((j - minJahr) / Math.max(1, maxJahr - minJahr)) * iW;
  const yOf = v => pt + iH - (v / maxKS) * iH;

  const pts = data.map(d => xOf(d.jahr) + ',' + yOf(d.ks)).join(' ');
  const area = `${pl},${pt+iH} ` + pts + ` ${xOf(maxJahr)},${pt+iH}`;

  const yVals = [0, 0.25, 0.5, 0.75, 1.0].map(f => {
    const v = f * maxKS;
    const y = yOf(v);
    const label = v >= 1000 ? (v/1000).toFixed(1).replace('.',',') + 'k' : Math.round(v);
    return `<line x1="${pl}" y1="${y}" x2="${pl+iW}" y2="${y}" stroke="rgba(42,39,32,0.08)" stroke-width="1"/>
            <text x="${pl-5}" y="${y+4}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${label}</text>`;
  }).join('');

  const xLabels = [];
  for (let j = minJahr; j <= maxJahr; j += Math.max(1, Math.ceil((maxJahr - minJahr) / 5))) {
    xLabels.push(`<text x="${xOf(j)}" y="${pt+iH+16}" text-anchor="middle" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${j}</text>`);
  }

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H+4}" style="width:100%;overflow:visible">
    ${yVals}${xLabels.join('')}
    <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <line x1="${pl}" y1="${pt+iH}" x2="${pl+iW}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <polygon points="${area}" fill="var(--good)" opacity="0.15"/>
    <polyline points="${pts}" fill="none" stroke="var(--good)" stroke-width="2.5"/>
    <text x="${xOf(maxJahr)-4}" y="${yOf(data[data.length-1].ks)-8}" text-anchor="end" font-size="11" font-family="DM Mono,monospace" font-weight="600" fill="var(--good)">${Math.round(rente.kapitalstock)} Mrd. €</text>
  </svg>`;
}

function renderBeitragProjSVG(rente, p) {
  const el = document.getElementById('beitrag_proj_chart');
  if (!el) return;
  const W = 580, H = 160, pl = 48, pr = 16, pt = 12, pb = 28;
  const iW = W - pl - pr, iH = H - pt - pb;

  const allVals = [...rente.proj_ohne.map(d => d.beitrag), ...rente.proj_mit.map(d => d.beitrag)];
  const minV = Math.min(15, ...allVals), maxV = Math.max(25, ...allVals);
  const xOf = j => pl + ((j - 2025) / 20) * iW;
  const yOf = v => pt + iH - ((v - minV) / (maxV - minV)) * iH;

  const pts_ohne = rente.proj_ohne.map(d => xOf(d.jahr) + ',' + yOf(d.beitrag)).join(' ');
  const pts_mit  = rente.proj_mit.map(d => xOf(d.jahr) + ',' + yOf(d.beitrag)).join(' ');

  const yVals = [Math.ceil(minV), Math.round((minV+maxV)/2), Math.floor(maxV)].map(v => {
    const y = yOf(v);
    return `<line x1="${pl}" y1="${y}" x2="${pl+iW}" y2="${y}" stroke="rgba(42,39,32,0.08)" stroke-width="1"/>
            <text x="${pl-5}" y="${y+4}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${v}%</text>`;
  }).join('');

  const xLabels = [2025,2030,2035,2040,2045].map(j =>
    `<text x="${xOf(j)}" y="${pt+iH+16}" text-anchor="middle" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${j}</text>`
  ).join('');

  const legend = p.kapitalquote > 0
    ? `<line x1="${pl+8}" y1="${pt+8}" x2="${pl+26}" y2="${pt+8}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4,2"/>
       <text x="${pl+30}" y="${pt+12}" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">ohne Reform</text>
       <line x1="${pl+130}" y1="${pt+8}" x2="${pl+148}" y2="${pt+8}" stroke="var(--good)" stroke-width="2.5"/>
       <text x="${pl+152}" y="${pt+12}" font-size="10" font-family="DM Mono,monospace" fill="var(--good)">mit Reform</text>`
    : `<text x="${pl+8}" y="${pt+14}" font-size="11" font-family="DM Mono,monospace" fill="var(--muted)" font-style="italic">Fondsquote = 0 — kein Unterschied sichtbar</text>`;

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H+4}" style="width:100%;overflow:visible">
    ${yVals}${xLabels}
    <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <line x1="${pl}" y1="${pt+iH}" x2="${pl+iW}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <polyline points="${pts_ohne}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4,2" opacity="0.7"/>
    <polyline points="${pts_mit}"  fill="none" stroke="var(--good)" stroke-width="2.5"/>
    ${legend}
  </svg>`;
}

// ============================================================
// LAFFER-KURVE
// ============================================================


// ── 4. RENDER — Laffer-Kurve ──

let _lafferTimer = null;
let _lafferPCache = null;
let _lafferPts = null;

function renderLaffer(p) {
  const el = document.getElementById('laffer_chart');
  if (!el) return;

  // Debounce: compute only 200ms after last change
  clearTimeout(_lafferTimer);
  _lafferTimer = setTimeout(() => _renderLafferNow(p), 200);
}

function _renderLafferNow(p) {
  const el = document.getElementById('laffer_chart');
  if (!el) return;

  // Cache: skip recompute if only spitze changed (curve shape is driven by other params)
  const cacheKey = JSON.stringify({...p, spitze: 0});
  if (_lafferPCache !== cacheKey) {
    _lafferPts = [];
    for (let s = 5; s <= 75; s += 2.5) {
      const rr = berechne({ ...p, spitze: s });
      _lafferPts.push({ s, est: rr.rev.est });
    }
    _lafferPCache = cacheKey;
  }
  const pts = _lafferPts;

  const maxEst = Math.max(...pts.map(x => x.est));
  const peakPt = pts.reduce((a, b) => b.est > a.est ? b : a);
  const curPt = pts.reduce((a, b) => Math.abs(b.s - p.spitze) < Math.abs(a.s - p.spitze) ? b : a);

  const W = 640, H = 180, pl = 52, pr = 20, pt2 = 16, pb = 30;
  const iW = W - pl - pr, iH = H - pt2 - pb;
  const minEst = Math.min(...pts.map(x => x.est)) * 0.97;
  const xOf = s  => pl + ((s - 5) / 70) * iW;
  const yOf = v  => pt2 + iH - ((v - minEst) / (maxEst * 1.05 - minEst)) * iH;

  const line = pts.map(x => xOf(x.s) + ',' + yOf(x.est)).join(' ');
  const area = `${xOf(pts[0].s)},${pt2+iH} ` + line + ` ${xOf(pts[pts.length-1].s)},${pt2+iH}`;

  // Y-axis: deduplicated labels
  const yTickSet = new Set([Math.round(minEst/50)*50, Math.round((minEst+maxEst)/2/50)*50, Math.round(maxEst/50)*50]);
  const yVals = [...yTickSet].filter(v => v >= minEst && v <= maxEst*1.1).map(v => {
    const y = yOf(v);
    return `<line x1="${pl}" y1="${y}" x2="${pl+iW}" y2="${y}" stroke="rgba(42,39,32,0.08)" stroke-width="1"/>
            <text x="${pl-5}" y="${y+4}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${Math.round(v)}</text>`;
  }).join('');

  const xVals = [10,20,30,40,50,60,70].map(s => {
    const x = xOf(s);
    return `<line x1="${x}" y1="${pt2}" x2="${x}" y2="${pt2+iH}" stroke="rgba(42,39,32,0.08)" stroke-width="1"/>
            <text x="${x}" y="${pt2+iH+16}" text-anchor="middle" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${s}%</text>`;
  }).join('');

  // Peak-Markierung — text-anchor rechts wenn zu nah am Rand
  const px = xOf(peakPt.s), py = yOf(peakPt.est);
  const peakNearRight = px > pl + iW * 0.6;
  const peakMark = `
    <line x1="${px}" y1="${pt2}" x2="${px}" y2="${pt2+iH}" stroke="var(--good)" stroke-width="1" stroke-dasharray="4,3" opacity="0.7"/>
    <circle cx="${px}" cy="${py}" r="5" fill="var(--good)" opacity="0.9"/>
    <text x="${peakNearRight ? px-8 : px+8}" y="${py-8}" text-anchor="${peakNearRight ? 'end' : 'start'}" font-size="11" font-family="DM Mono,monospace" font-weight="600" fill="var(--good)">Max: ${peakPt.s}% → ${Math.round(peakPt.est)} Mrd.</text>`;

  // Aktuelle Position
  const cx = xOf(p.spitze), cy = yOf(curPt.est);
  const curNearRight = cx > pl + iW * 0.75;
  const curMark = `
    <line x1="${cx}" y1="${pt2}" x2="${cx}" y2="${pt2+iH}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="3,2"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="var(--accent)"/>
    <text x="${curNearRight ? cx-8 : cx+8}" y="${cy-6}" text-anchor="${curNearRight ? 'end' : 'start'}" font-size="11" font-family="DM Mono,monospace" fill="var(--accent)">${p.spitze}%</text>`;

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H+4}" style="width:100%;overflow:visible">
    ${yVals}${xVals}
    <line x1="${pl}" y1="${pt2}" x2="${pl}" y2="${pt2+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <line x1="${pl}" y1="${pt2+iH}" x2="${pl+iW}" y2="${pt2+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <polygon points="${area}" fill="var(--accent)" opacity="0.07"/>
    <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>
    ${peakMark}${curMark}
    <text x="${pl+8}" y="${pt2+14}" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">ESt-Aufkommen (Mrd. €)</text>
  </svg>`;
}

function berechneGini(werte) {
  const sorted = [...werte].sort((a,b)=>a-b);
  const n = sorted.length;
  const sum = sorted.reduce((a,b)=>a+b,0);
  if (sum <= 0) return 0;
  let cum = 0;
  for (let i = 0; i < n; i++) cum += (i+1) * sorted[i];
  const gini = (2*cum) / (n*sum) - (n+1)/n;
  return Math.max(0, Math.min(1, gini));
}

function berechneMedianGewichtet(werte, dez) {
  // Gewichteter Median: Hälfte der Haushalte liegt darunter
  const pairs = werte.map((v,i) => ({v, n: dez[i].anzahl})).sort((a,b)=>a.v-b.v);
  const half = pairs.reduce((a,p)=>a+p.n,0) / 2;
  let cum = 0;
  for (const p of pairs) { cum += p.n; if (cum >= half) return p.v; }
  return pairs[pairs.length-1].v;
}

function berechnePalma(werte) {
  // Palma-Ratio: Durchschnittseinkommen Top-10% / Durchschnitt Bottom-40%
  // Mit D10-Split: top 10% = D10a+D10b+D10c (je nach Anzahl genau 10%)
  const pairs = werte.map((v,i) => ({v, n: DEZILE[i].anzahl})).sort((a,b)=>a.v-b.v);
  const total_n = pairs.reduce((a,p)=>a+p.n,0);
  let bot_sum=0, bot_n=0, top_sum=0, top_n=0, cum_bot=0, cum_top=0;
  for (const p of pairs) {
    if (cum_bot < total_n*0.40+0.05) { bot_sum+=p.v*p.n; bot_n+=p.n; cum_bot+=p.n; }
  }
  for (let j=pairs.length-1; j>=0; j--) {
    if (cum_top < total_n*0.10+0.05) { top_sum+=pairs[j].v*pairs[j].n; top_n+=pairs[j].n; cum_top+=pairs[j].n; }
  }
  return (bot_n>0&&top_n>0) ? (top_sum/top_n)/(bot_sum/bot_n) : 0;
}

// ============================================================
// PRESETS
// ============================================================


// ── 5. PARAMETER — getParams / setParams / fmtEUR / REF ──


// ============================================================
// UI
// ============================================================

function getParams() {
  return {
    freibetrag: +document.getElementById('freibetrag').value,
    eingang:    +document.getElementById('eingang').value,
    spitze:     +document.getElementById('spitze').value,
    grenze:     +document.getElementById('grenze').value,
    synthetisch: document.getElementById('synthetisch').checked,
    abgeltung:  +document.getElementById('abgeltung').value,
    kst:        +document.getElementById('kst').value,
    gewst:      +document.getElementById('gewst').value,
    gewst_aus:  document.getElementById('gewst_aus').checked,
    mwst:       +document.getElementById('mwst').value,
    mwst_erm:   +document.getElementById('mwst_erm').value,
    co2:        +document.getElementById('co2').value,
    klimageld:  document.getElementById('klimageld').checked,
    erb:        +document.getElementById('erb').value,
    betriebs:   document.getElementById('betriebs').checked,
    boden:      +document.getElementById('boden').value,
    verm:       +document.getElementById('verm').value,
    rv:         +document.getElementById('rv').value,
    kv:         +document.getElementById('kv').value,
    alpf:       +document.getElementById('alpf').value,
    buergerv:   document.getElementById('buergerv').checked,
    bg:         +document.getElementById('bg').value,
    kg:         +document.getElementById('kg').value,
    neg_est:    document.getElementById('neg_est').checked,
    kleine_st:  document.getElementById('kleine_st').checked,
    kapitalquote:   +document.getElementById('kapitalquote').value,
    rendite_fonds:  +document.getElementById('rendite_fonds').value,
    startjahr:      +document.getElementById('startjahr').value,
    pkv_abschaffen: document.getElementById('pkv_abschaffen').checked,
    kv_kapital:     document.getElementById('kv_kapital').checked,
    kv_bbg_frei:    document.getElementById('kv_bbg_frei').checked,
    anzahl_kv:      +document.getElementById('anzahl_kv').value,
    praevention:    +document.getElementById('praevention').value,
    bbg:            +document.getElementById('bbg').value,
    zucman:         +document.getElementById('zucman').value,
    bge:                +document.getElementById('bge').value,
    rente_niveau_gering: +document.getElementById('rente_niveau_gering').value,
    rente_niveau_hoch:   +document.getElementById('rente_niveau_hoch').value,
    rente_grenze:        +document.getElementById('rente_grenze').value
  };
}

function setParams(p) {
  document.getElementById('freibetrag').value = p.freibetrag;
  document.getElementById('eingang').value = p.eingang;
  document.getElementById('spitze').value = p.spitze;
  document.getElementById('grenze').value = p.grenze;
  document.getElementById('synthetisch').checked = p.synthetisch;
  document.getElementById('abgeltung').value = p.abgeltung;
  document.getElementById('kst').value = p.kst;
  document.getElementById('gewst').value = p.gewst;
  document.getElementById('gewst_aus').checked = p.gewst_aus;
  document.getElementById('mwst').value = p.mwst;
  document.getElementById('mwst_erm').value = p.mwst_erm;
  document.getElementById('co2').value = p.co2;
  document.getElementById('klimageld').checked = p.klimageld;
  document.getElementById('erb').value = p.erb;
  document.getElementById('betriebs').checked = p.betriebs;
  document.getElementById('boden').value = p.boden;
  document.getElementById('verm').value = p.verm;
  document.getElementById('rv').value = p.rv;
  document.getElementById('kv').value = p.kv;
  document.getElementById('alpf').value = p.alpf;
  document.getElementById('buergerv').checked = p.buergerv;
  document.getElementById('bg').value = p.bg;
  document.getElementById('kg').value = p.kg;
  document.getElementById('neg_est').checked = p.neg_est;
  document.getElementById('kleine_st').checked = p.kleine_st;
  document.getElementById('kapitalquote').value = p.kapitalquote ?? 0;
  document.getElementById('rendite_fonds').value = p.rendite_fonds ?? 7;
  document.getElementById('startjahr').value = p.startjahr ?? 2020;
  document.getElementById('pkv_abschaffen').checked = p.pkv_abschaffen ?? false;
  document.getElementById('anzahl_kv').value = p.anzahl_kv ?? 95;
  document.getElementById('praevention').value = p.praevention ?? 0;
  document.getElementById('bbg').value = p.bbg ?? 90000;
  document.getElementById('zucman').value = p.zucman ?? 0;
  document.getElementById('bge').value = p.bge ?? 0;
}

function fmtEUR(x) {
  if (Math.abs(x) >= 1000) return (x/1000).toFixed(1).replace('.',',') + ' Bio.';
  if (Math.abs(x) >= 1)    return x.toFixed(0) + ' Mrd.';
  return (x*1000).toFixed(0) + ' Mio.';
}

function fmtSignedMrd(x) {
  const sign = x >= 0 ? '+' : '−';
  return sign + Math.abs(x).toFixed(1) + ' Mrd.';
}

// Referenz: Status Quo
let REF = null;
function computeRef() {
  REF = berechne(PRESETS.status_quo);
}


// ── 6. RENDER — render() Hauptfunktion ──

let _heavyTimer = null;
function scheduleHeavyRender(p, r) {
  clearTimeout(_heavyTimer);
  _heavyTimer = setTimeout(() => {
    renderEstKurve(p);
    renderLaffer(p);
    const metrHtml = r.metr.map((m, i) => {
      const pct = Math.min(100, m * 100);
      const cls = m > 0.70 ? 'neg' : m > 0.50 ? 'neu' : 'pos';
      return `<div class="bar-row">
        <div class="bar-label">${DEZILE[i].label}</div>
        <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>
        <div class="bar-value">${Math.round(m * 100)} %</div>
      </div>`;
    }).join('');
    document.getElementById('metr_bars').innerHTML = metrHtml;
    renderIncomeDist(r, p);
    renderRenten(p, r);
    renderSchuldenpfad(r);
    renderChallenges(r);
    renderWissenschaftsPanel(p);
    renderRechenweg(r, p);
  }, 150);
}

function render() {
  const p = getParams();

  // Labels
  document.getElementById('v_freibetrag').textContent = p.freibetrag.toLocaleString('de-DE') + ' €';
  document.getElementById('v_eingang').textContent = p.eingang + ' %';
  document.getElementById('v_spitze').textContent = p.spitze + ' %';
  document.getElementById('v_grenze').textContent = p.grenze.toLocaleString('de-DE') + ' €';
  document.getElementById('v_abgeltung').textContent = p.abgeltung + ' %';
  document.getElementById('v_kst').textContent = p.kst + ' %';
  document.getElementById('v_gewst').textContent = p.gewst + ' %';
  document.getElementById('v_mwst').textContent = p.mwst + ' %';
  document.getElementById('v_mwst_erm').textContent = p.mwst_erm + ' %';
  document.getElementById('v_co2').textContent = p.co2 + ' €/t';
  document.getElementById('v_erb').textContent = p.erb + ' %';
  document.getElementById('v_boden').textContent = p.boden.toFixed(1) + ' %';
  document.getElementById('v_verm').textContent = p.verm.toFixed(1) + ' %';
  document.getElementById('v_rv').textContent = p.rv.toFixed(1) + ' %';
  document.getElementById('v_kv').textContent = p.kv.toFixed(1) + ' %';
  document.getElementById('v_alpf').textContent = p.alpf.toFixed(1) + ' %';
  document.getElementById('v_bge').textContent = p.bge > 0 ? p.bge + ' €/Monat' : 'aus';
  document.getElementById('v_bg').textContent = p.bg + ' €';
  document.getElementById('v_kg').textContent = p.kg + ' €';
  document.getElementById('v_kapitalquote').textContent = p.kapitalquote + ' %';
  document.getElementById('v_rendite_fonds').textContent = p.rendite_fonds + ' %';
  document.getElementById('v_startjahr').textContent = p.startjahr;
  document.getElementById('v_anzahl_kv').textContent = p.anzahl_kv;
  document.getElementById('v_praevention').textContent = p.praevention + ' Mrd.';
  document.getElementById('v_bbg').textContent = (p.bbg / 1000).toFixed(0) + '.000 €';
  document.getElementById('v_zucman').textContent = p.zucman.toFixed(1) + ' %';

  // Abgeltungsteuer-Row nur zeigen wenn nicht synthetisch
  document.getElementById('row_abgeltung').style.opacity = p.synthetisch ? 0.3 : 1;

  const r = berechne(p);

  // KPI
  document.getElementById('kpi_saldo').textContent = fmtSignedMrd(r.saldo) + ' €';
  const saldoDelta = document.getElementById('kpi_saldo_d');
  if (r.saldo > 0) { saldoDelta.textContent = 'Überschuss'; saldoDelta.className = 'kpi-delta good'; }
  else if (r.saldo > -50) { saldoDelta.textContent = 'moderates Defizit'; saldoDelta.className = 'kpi-delta neutral'; }
  else { saldoDelta.textContent = 'hohes Defizit'; saldoDelta.className = 'kpi-delta bad'; }

  document.getElementById('kpi_einn').textContent = Math.round(r.einnahmen_total);
  document.getElementById('kpi_gini').textContent = r.gini.toFixed(3).replace('.', ',');
  const giniDelta = document.getElementById('kpi_gini_d');
  const dG = r.gini - REF.gini;
  giniDelta.textContent = (dG >= 0 ? '+' : '') + dG.toFixed(3).replace('.', ',') + ' vs. Basis';
  giniDelta.className = 'kpi-delta ' + (dG < -0.005 ? 'good' : dG > 0.005 ? 'bad' : 'neutral');

  document.getElementById('kpi_admin').textContent = r.admin_kosten.toFixed(1).replace('.',',') + ' Mrd.';
  const admDelta = document.getElementById('kpi_admin_d');
  const dA = r.admin_kosten - REF.admin_kosten;
  admDelta.textContent = fmtSignedMrd(dA) + ' €';
  admDelta.className = 'kpi-delta ' + (dA < -1 ? 'good' : dA > 1 ? 'bad' : 'neutral');

  document.getElementById('kpi_nst').textContent = r.nst;
  document.getElementById('kpi_arb').textContent = r.behavior.labor.toFixed(1);
  const arbDelta = document.getElementById('kpi_arb_d');
  const dArb = r.behavior.labor - 100;
  arbDelta.textContent = (dArb >= 0 ? '+' : '') + dArb.toFixed(1) + ' Index';
  arbDelta.className = 'kpi-delta ' + (dArb > 1 ? 'good' : dArb < -1 ? 'bad' : 'neutral');

  // KPI card tone backgrounds
  function setKpiTone(id, tone) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'kpi' + (tone ? ' tone-' + tone : '');
  }
  const saldoTone = r.saldo > 0 ? 'good' : r.saldo > -50 ? 'warn' : 'bad';
  setKpiTone('kpi_card_saldo', saldoTone);
  setKpiTone('kpi_card_sbremse', r.schuldenbremse_ok ? 'good' : 'bad');
  const giniTone = (r.gini - REF.gini) > 0.005 ? 'bad' : (r.gini - REF.gini) < -0.005 ? 'good' : 'neu';
  setKpiTone('kpi_card_gini', giniTone);
  setKpiTone('kpi_card_einn', 'neu');

  // Warnungen
  const warnbox = document.getElementById('warnbox');
  const warnings = [];
  if (r.saldo < -150) warnings.push('Das Defizit ist sehr hoch (>150 Mrd. €) — langfristig nicht tragbar ohne Wachstum.');
  if (r.behavior.labor < 95) warnings.push('Starker Rückgang des Arbeitsangebots — Grenzsteuersätze möglicherweise zu hoch (Laffer-Bereich).');
  if (r.behavior.invest < 90) warnings.push('Investitionsrückgang — Unternehmenssteuerbelastung verringert Kapitalbildung.');
  if (p.gewst > 0 && p.gewst_aus === false && p.kst > 25) warnings.push('Körperschaft- + Gewerbesteuer zusammen > 30 % — international unwettbewerbsfähig.');
  if (p.mwst > 25) warnings.push('MwSt sehr hoch — trifft untere Dezile überproportional (regressiv).');
  if (r.gini > REF.gini + 0.02) warnings.push('Ungleichheit nimmt spürbar zu.');

  if (warnings.length > 0) {
    warnbox.style.display = 'block';
    document.getElementById('warntext').textContent = warnings.join(' · ');
  } else {
    warnbox.style.display = 'none';
  }

  // REVENUE BARS
  const revLabels = {
    est: 'Einkommensteuer', kst: 'Körperschaftst.', gewst: 'Gewerbest.',
    mwst: 'Mehrwertsteuer', co2: 'CO₂ (netto)', erbschaft: 'Erbschaftst.',
    boden: 'Bodenwertst.', vermoegen: 'Vermögenst.', zucman: 'Zucman-Mindestst.',
    rv: 'Rentenvers.', kv: 'Krankenvers.', al: 'AL+Pflege',
    klein: 'Kleine Verbrauchst.'
  };
  const revMax = Math.max(...Object.values(r.rev));
  const revHtml = Object.entries(r.rev)
    .sort((a,b) => b[1] - a[1])
    .map(([k,v]) => `
      <div class="bar-row">
        <div class="bar-label">${revLabels[k]}</div>
        <div class="bar-track"><div class="bar-fill neu" style="width:${Math.max(0, (v/revMax)*100)}%"></div></div>
        <div class="bar-value">${v.toFixed(1)}</div>
      </div>`).join('');
  document.getElementById('revenue_bars').innerHTML = revHtml;

  // HOUSEHOLD CHART
  const maxAbsDelta = Math.max(...r.hh_delta.delta.map(Math.abs));
  const hhHtml = r.hh_delta.delta.map((v, i) => {
    const leftPct = v < 0 ? (Math.abs(v) / maxAbsDelta) * 100 : 0;
    const rightPct = v > 0 ? (v / maxAbsDelta) * 100 : 0;
    return `
      <div class="divergent-row">
        <div class="div-label">${DEZILE[i].label}</div>
        <div class="div-track-left"><div class="div-fill-left" style="width:${leftPct}%"></div></div>
        <div class="div-center">0</div>
        <div class="div-track-right"><div class="div-fill-right" style="width:${rightPct}%"></div></div>
        <div class="div-value" style="color:${v>=0?'var(--good)':'var(--bad)'}">${v>=0?'+':'−'}${Math.abs(Math.round(v)).toLocaleString('de-DE')}</div>
      </div>`;
  }).join('');
  document.getElementById('household_chart').innerHTML = hhHtml;

  // DISTRIB BARS
  const dBars = [
    { label: 'Gini (neu)', value: r.gini, ref: REF.gini, max: 0.5, fmt: v => v.toFixed(3).replace('.',',') },
    { label: 'Gini (Basis)', value: REF.gini, ref: REF.gini, max: 0.5, fmt: v => v.toFixed(3).replace('.',','), muted: true },
    { label: 'Palma', value: r.palma, ref: REF.palma, max: 10, fmt: v => v.toFixed(2).replace('.',',') },
    { label: 'Arm. 20%/reich.20%', value: Math.max(...r.hh_delta.netto) / Math.min(...r.hh_delta.netto.filter(x=>x>0)) || 0, ref: 0, max: 15, fmt: v => v.toFixed(1).replace('.',',') }
  ];
  const dHtml = dBars.map(b => {
    const pct = (b.value / b.max) * 100;
    const dir = b.value < b.ref ? 'pos' : b.value > b.ref ? 'neg' : 'neu';
    const cls = b.muted ? 'neu' : dir;
    return `
      <div class="bar-row">
        <div class="bar-label">${b.label}</div>
        <div class="bar-track"><div class="bar-fill ${cls}" style="width:${Math.min(100,pct)}%;${b.muted?'opacity:0.4':''}"></div></div>
        <div class="bar-value">${b.fmt(b.value)}</div>
      </div>`;
  }).join('');
  document.getElementById('distrib_bars').innerHTML = dHtml;

  // BURDEN BARS
  const burdenMax = Math.max(...r.hh_delta.belastung_pct.map(Math.abs));
  const bHtml = r.hh_delta.belastung_pct.map((v, i) => `
    <div class="bar-row">
      <div class="bar-label">${DEZILE[i].label}</div>
      <div class="bar-track"><div class="bar-fill ${v<0?'pos':'neg'}" style="width:${Math.min(100,Math.abs(v)/burdenMax*100)}%"></div></div>
      <div class="bar-value">${v>=0?'+':'−'}${Math.abs(v).toFixed(1)} %</div>
    </div>`).join('');
  document.getElementById('burden_bars').innerHTML = bHtml;

  // BEHAVIOR BARS
  const bhvMetrics = [
    { label: 'Arbeit', v: r.behavior.labor },
    { label: 'Konsum', v: r.behavior.konsum },
    { label: 'Investition', v: r.behavior.invest },
    { label: 'CO₂-Emissionen', v: r.behavior.co2 }
  ];
  const bhvHtml = bhvMetrics.map(m => {
    const pct = Math.min(100, Math.max(0, m.v - 50));
    const cls = m.label === 'CO₂-Emissionen' ? (m.v < 100 ? 'pos' : 'neg') : (m.v > 100 ? 'pos' : m.v < 100 ? 'neg' : 'neu');
    return `
      <div class="bar-row">
        <div class="bar-label">${m.label}</div>
        <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>
        <div class="bar-value">${m.v.toFixed(1)}</div>
      </div>`;
  }).join('');
  document.getElementById('behavior_bars').innerHTML = bhvHtml;

  // WIRTSCHAFTLICHE WIRKUNGSANALYSE (R01, R10, R12)
  const bip_impuls = -(r.saldo - REF.saldo) * 0.65; // Fiskalmultiplikator 0,65 (ECB/Bundesbank-Konsens DE)
  const stab_index = r.metr.slice(0, 4).reduce((a, m) => a + m, 0) / 4 * 100; // Ø METR D1–D4 als Stabilisierungsgrad
  const wirkBars = [
    {
      label: 'BIP-Impuls (Multiplikator 0,65)',
      value: bip_impuls,
      fmt: v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' Mrd. €',
      cls: bip_impuls > 5 ? 'pos' : bip_impuls < -5 ? 'neg' : 'neu',
      pct: Math.min(100, Math.abs(bip_impuls) / 50 * 100),
      hint: 'Fiskalimpuls × 0,65 (ECB WP 1267 · Bundesbank DP 28/2018)'
    },
    {
      label: 'Auto-Stabilisatoren (Ø METR D1–D4)',
      value: stab_index,
      fmt: v => v.toFixed(1) + ' %',
      cls: stab_index > 50 ? 'pos' : stab_index < 35 ? 'neg' : 'neu',
      pct: Math.min(100, stab_index),
      hint: 'Dämpfungsgrad Einkommensschock — DE Benchmark: ~48 % (Dolls et al. 2020)'
    },
    {
      label: 'Dyn. Scoring: KSt-Investitionseffekt',
      value: r.dynamisch_kst,
      fmt: v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' Mrd. €',
      cls: r.dynamisch_kst > 0 ? 'pos' : r.dynamisch_kst < 0 ? 'neg' : 'neu',
      pct: Math.min(100, Math.abs(r.dynamisch_kst) / 20 * 100),
      hint: 'Verhaltensbedingte KSt-Aufkommensänderung via Investitionselastizität (Neumeier SVR 2025)'
    },
    {
      label: 'Dyn. Scoring: ESt-Arbeitsangebotseffekt',
      value: r.dynamisch_est,
      fmt: v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' Mrd. €',
      cls: r.dynamisch_est > 0 ? 'pos' : r.dynamisch_est < 0 ? 'neg' : 'neu',
      pct: Math.min(100, Math.abs(r.dynamisch_est) / 20 * 100),
      hint: 'Verhaltensbedingte ESt-Aufkommensänderung via Arbeitselastizität ε = 0,20 (Gruber/Saez 2002)'
    },
    {
      label: 'Dyn. Scoring gesamt (KSt + ESt)',
      value: r.dynamisch_delta,
      fmt: v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' Mrd. €',
      cls: r.dynamisch_delta > 0 ? 'pos' : r.dynamisch_delta < 0 ? 'neg' : 'neu',
      pct: Math.min(100, Math.abs(r.dynamisch_delta) / 30 * 100),
      hint: 'Gesamter Verhaltenseffekt — positiv = Mehraufkommen durch Verhaltensreaktion'
    }
  ];
  document.getElementById('wirk_bars').innerHTML = wirkBars.map(b => `
    <div class="bar-row" title="${b.hint}">
      <div class="bar-label">${b.label}</div>
      <div class="bar-track"><div class="bar-fill ${b.cls}" style="width:${b.pct}%"></div></div>
      <div class="bar-value">${b.fmt(b.value)}</div>
    </div>`).join('');

  // NEUE KPIs
  const armutEl = document.getElementById('kpi_armut');
  const armutDEl = document.getElementById('kpi_armut_d');
  armutEl.textContent = r.armutsrisiko.toFixed(1).replace('.', ',') + ' %';
  const dArmut = r.armutsrisiko - REF.armutsrisiko;
  armutDEl.textContent = (dArmut >= 0 ? '+' : '') + dArmut.toFixed(1).replace('.', ',') + ' PP vs. Basis';
  armutDEl.className = 'kpi-delta ' + (dArmut < -0.5 ? 'good' : dArmut > 0.5 ? 'bad' : 'neutral');

  const schuldEl = document.getElementById('kpi_schuld');
  const schuldDEl = document.getElementById('kpi_schuld_d');
  schuldEl.textContent = (r.schuldenquote_delta >= 0 ? '+' : '') + r.schuldenquote_delta.toFixed(2).replace('.', ',') + ' %';
  schuldEl.style.color = r.schuldenquote_delta > 0.5 ? 'var(--bad)' : r.schuldenquote_delta < -0.2 ? 'var(--good)' : 'var(--ink)';
  schuldDEl.textContent = r.schuldenquote_delta > 0 ? 'Schulden steigen' : r.schuldenquote_delta < 0 ? 'Schulden sinken' : 'Ausgeglichen';
  schuldDEl.className = 'kpi-delta ' + (r.schuldenquote_delta > 0.5 ? 'bad' : r.schuldenquote_delta < 0 ? 'good' : 'neutral');

  document.getElementById('kpi_dwl').textContent = r.dwl.toFixed(0) + ' Mrd.';
  const dwlDEl = document.getElementById('kpi_dwl_d');
  const dDwl = r.dwl - REF.dwl;
  dwlDEl.textContent = (dDwl >= 0 ? '+' : '') + dDwl.toFixed(0) + ' Mrd. vs. Basis';
  dwlDEl.className = 'kpi-delta ' + (dDwl > 5 ? 'bad' : dDwl < -5 ? 'good' : 'neutral');

  // SCHULDENBREMSE-KPI (Art. 109 GG) — R05
  const sbEl  = document.getElementById('kpi_sbremse');
  const sbDEl = document.getElementById('kpi_sbremse_d');
  sbEl.textContent = r.schuldenbremse_ok ? '✓ eingehalten' : '✗ verletzt';
  sbEl.style.color = '';
  sbDEl.textContent = (r.saldo_bip_pct >= 0 ? '+' : '') + r.saldo_bip_pct.toFixed(2).replace('.', ',') + ' % BIP';
  sbDEl.className = 'kpi-delta ' + (r.schuldenbremse_ok ? 'good' : 'bad');

  // KPI BENCHMARKS
  document.getElementById('kpi_saldo_bench').textContent = KPI_BENCH.saldo;
  document.getElementById('kpi_einn_bench').textContent = KPI_BENCH.einn;
  document.getElementById('kpi_gini_bench').textContent = KPI_BENCH.gini;
  document.getElementById('kpi_admin_bench').textContent = KPI_BENCH.admin;
  document.getElementById('kpi_nst_bench').textContent = KPI_BENCH.nst;
  document.getElementById('kpi_arb_bench').textContent = KPI_BENCH.arb;
  document.getElementById('kpi_armut_bench').textContent = KPI_BENCH.armut;
  document.getElementById('kpi_schuld_bench').textContent = KPI_BENCH.schuld;
  document.getElementById('kpi_dwl_bench').textContent = KPI_BENCH.dwl;

  // Cross-page param sync
  localStorage.setItem('haushaltsspiel_params', JSON.stringify(p));

  // URL-Hash aktualisieren
  window.history.replaceState(null, '', paramsToHash(p));

  // SCORE PANEL
  renderScore(r);

  // SCHWERE CHART-RENDERS — debounced, feuern 150ms nach letzter Änderung
  scheduleHeavyRender(p, r);

  // KPI PULSE — detect changed KPI values and flash them
  const _kpiPulseIds = ['kpi_saldo','kpi_einn','kpi_gini','kpi_admin','kpi_nst','kpi_arb','kpi_armut','kpi_schuld','kpi_dwl','kpi_sbremse'];
  _kpiPulseIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.textContent;
    if (_prevKpiValues[id] !== undefined && _prevKpiValues[id] !== cur) {
      const tile = el.closest('.kpi');
      if (tile) {
        tile.classList.remove('kpi-changed');
        void tile.offsetWidth;
        tile.classList.add('kpi-changed');
      }
    }
    _prevKpiValues[id] = cur;
  });

  // BGE PANEL
  (function() {
    const bge_p = p.bge || 0;
    const bgePanel = document.getElementById('bge-impact-panel');
    const bgeSectionTitle = document.getElementById('bge-section-title');
    const bgeLiveCost = document.getElementById('bge-live-cost');
    if (!bgePanel) return;
    // BGE vs. Grundfreibetrag Warnung
    const bgeWarnBox = document.getElementById('bge-freibetrag-warning');
    if (bgeWarnBox) {
      const fb_monat = (p.freibetrag || 12084) / 12;
      if (bge_p > fb_monat) {
        bgeWarnBox.style.display = 'block';
        document.getElementById('bge-warn-val').textContent = bge_p;
        document.getElementById('bge-warn-fb').textContent = Math.round(fb_monat);
      } else {
        bgeWarnBox.style.display = 'none';
      }
    }

    // Slider-Labels für Rentenregler
    const rnGering = document.getElementById('rente_niveau_gering');
    const rnHoch   = document.getElementById('rente_niveau_hoch');
    const rnGrenze = document.getElementById('rente_grenze');
    if (rnGering) document.getElementById('v_rente_niveau_gering').textContent = rnGering.value + ' %';
    if (rnHoch)   document.getElementById('v_rente_niveau_hoch').textContent   = rnHoch.value + ' %';
    if (rnGrenze) document.getElementById('v_rente_grenze').textContent = (rnGrenze.value / 1000).toFixed(0) + '.000 €/J.';

    if (bge_p > 0) {
      bgePanel.style.display = 'block';
      if (bgeLiveCost) bgeLiveCost.style.display = 'block';
      if (bgeSectionTitle) bgeSectionTitle.classList.add('bge-on');
      document.getElementById('bge-panel-badge').textContent = bge_p + ' €/Monat';

      const bge_brutto = bge_p * 12 * 70 / 1000;
      const bg_saved = bge_p >= p.bg ? 5.5 * p.bg * 12 / 1000 : 0;
      const rv_saved = r.rv_einsparung || 0;
      const bge_netto = bge_brutto - bg_saved - rv_saved;
      const total_rev = 1450;
      const fin_pct = Math.min(100, (bge_netto / total_rev) * 100);

      document.getElementById('bge-cost-gross').textContent = bge_brutto.toFixed(0) + ' Mrd. €/Jahr';
      document.getElementById('bge-cost-save').textContent = bg_saved > 0 ? '−' + bg_saved.toFixed(0) + ' Mrd.' : '—';
      document.getElementById('bge-cost-rv').textContent = rv_saved > 0 ? '−' + rv_saved.toFixed(0) + ' Mrd.' : '—';
      document.getElementById('bge-cost-net').textContent = bge_netto.toFixed(0) + ' Mrd. €/Jahr';

      // Renten-Box ein-/ausblenden
      const renteBox = document.getElementById('bge-rente-box');
      if (renteBox) renteBox.style.display = 'block';

      const BGE_EFF_r = [0.15,0.12,0.09,0.06,0.04,0.025,0.015,0.01,0.005,0,0,0];
      const bge_sc = Math.min(1.67, bge_p / 1200);
      const avg_eff = BGE_EFF_r.reduce((a,v) => a + v, 0) / BGE_EFF_r.length * bge_sc * 100;

      const kpiNetClass = bge_netto > 300 ? 'bad' : bge_netto > 100 ? 'neutral' : 'good';
      document.getElementById('bge-kpi-row').innerHTML = [
        { label:'Bruttokosten', val: bge_brutto.toFixed(0)+' Mrd. €', note:'70 Mio. × '+bge_p+' € × 12', cls:'bad' },
        { label:'Bürgergeld-Ersatz', val: bg_saved > 0 ? '−'+bg_saved.toFixed(0)+' Mrd.' : '—', note: bg_saved > 0 ? 'vollständig ersetzt' : 'BGE < Bürgergeld-Niveau', cls: bg_saved > 0 ? 'good' : 'neutral' },
        { label:'RV-Einsparung', val: rv_saved > 0 ? '−'+rv_saved.toFixed(0)+' Mrd.' : '—', note: rv_saved > 0 ? 'Aufstockungsrente statt Vollrente' : 'BGE zu niedrig für Aufstockung', cls: rv_saved > 0 ? 'good' : 'neutral' },
        { label:'Nettokosten', val: bge_netto.toFixed(0)+' Mrd. €', note:'zu finanzieren', cls: kpiNetClass },
        { label:'Arbeitsangebot Ø', val: '−'+avg_eff.toFixed(1)+' %', note:'RWI/ZEW Kompromiss', cls:'neutral' },
      ].map(k => `<div class="bge-kpi"><div class="bge-kpi-label">${k.label}</div><div class="bge-kpi-val ${k.cls}">${k.val}</div><div class="bge-kpi-note">${k.note}</div></div>`).join('');

      const finFill = document.getElementById('bge-fin-fill');
      if (finFill) finFill.style.width = Math.max(0, fin_pct).toFixed(0) + '%';
      const finPct = document.getElementById('bge-fin-pct');
      if (finPct) finPct.textContent = bge_netto.toFixed(0) + ' Mrd. € (' + Math.max(0, fin_pct).toFixed(0) + ' % der Einnahmen)';
    } else {
      bgePanel.style.display = 'none';
      if (bgeLiveCost) bgeLiveCost.style.display = 'none';
      if (bgeSectionTitle) bgeSectionTitle.classList.remove('bge-on');
      const renteBox = document.getElementById('bge-rente-box');
      if (renteBox) renteBox.style.display = 'none';
    }
  })();

  _lastResult = r;
  _lastParams  = p;

  // Live scenario update
  if (activeScenarioSlot) {
    SZENARIO[activeScenarioSlot] = { p, r };
    renderSzenarioVergleich();
  }
}

// ============================================================
// CHALLENGES
// ============================================================


// ── 7. CHALLENGES — Logik ──


function dateSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h ^ s.charCodeAt(i), 16777619)) >>> 0;
  return h;
}

function isoWeek(d) {
  const dt = new Date(d); dt.setHours(0,0,0,0);
  dt.setDate(dt.getDate() + 3 - (dt.getDay() + 6) % 7);
  const w1 = new Date(dt.getFullYear(), 0, 4);
  return 1 + Math.round(((dt - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
}

function challengeKey(diff) {
  const now = new Date();
  if (diff === 'daily')   return now.toISOString().slice(0, 10);
  if (diff === 'weekly')  return now.getFullYear() + '-W' + String(isoWeek(now)).padStart(2,'0');
  if (diff === 'monthly') return now.toISOString().slice(0, 7);
}

function pickChallenge(diff) {
  const pool = CHALLENGES.filter(c => c.diff === diff);
  return pool[dateSeed(challengeKey(diff)) % pool.length];
}

function challengeProgress(sub, r) {
  const cur = sub.cur(r), ref = sub.refFn(), tgt = sub.tgt;
  if (sub.dir === 'down') {
    if (ref <= tgt) return 100; // already at/below target in ref
    return Math.max(0, Math.min(100, (ref - cur) / (ref - tgt) * 100));
  } else {
    if (ref >= tgt) return 100;
    return Math.max(0, Math.min(100, (cur - ref) / (tgt - ref) * 100));
  }
}

function lsKey(diff) { return 'challenge_done_' + diff + '_' + challengeKey(diff); }

function renderChallenges(r) {
  const slots = [
    { diff:'daily',   label:'TAGES-CHALLENGE',   period: new Date().toLocaleDateString('de-DE', {weekday:'long', day:'numeric', month:'long'}), accent:'var(--accent)' },
    { diff:'weekly',  label:'WOCHEN-CHALLENGE',   period: 'KW ' + isoWeek(new Date()) + ' · ' + new Date().getFullYear(), accent:'var(--accent)' },
    { diff:'monthly', label:'MONATS-CHALLENGE',   period: new Date().toLocaleDateString('de-DE', {month:'long', year:'numeric'}), accent:'var(--good)' },
  ];

  const html = slots.map(slot => {
    const c = pickChallenge(slot.diff);
    const allDone = c.subs.every(s => s.check(r));
    const wasAlreadyDone = localStorage.getItem(lsKey(slot.diff)) === c.id;

    if (allDone && !wasAlreadyDone) localStorage.setItem(lsKey(slot.diff), c.id);

    const subsHtml = c.subs.map(sub => {
      const pct = challengeProgress(sub, r);
      const done = sub.check(r);
      const ctx = CHALLENGE_CTX[sub.label] ? `<div class="challenge-context">${CHALLENGE_CTX[sub.label]}</div>` : '';
      return `<div class="challenge-bar-wrap">
        <div class="challenge-bar-label">
          <span>${sub.label}</span>
          <span class="cur" style="color:${done ? slot.accent : 'var(--ink)'}">${sub.fmt(sub.cur(r))}</span>
        </div>
        <div class="challenge-track">
          <div class="challenge-fill" style="width:${pct}%;background:${done ? slot.accent : 'rgba(42,39,32,0.35)'}"></div>
        </div>
        ${ctx}
      </div>`;
    }).join('');

    const badge = allDone
      ? `<div class="challenge-done-badge" style="color:${slot.accent};border-color:${slot.accent}">✓ Geschafft!</div>`
      : `<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);margin-top:8px;">${c.subs.filter(s=>s.check(r)).length}/${c.subs.length} Ziele erreicht</div>`;

    return `<div class="challenge-card${allDone ? ' done' : ''}">
      <div class="challenge-accent-bar" style="background:${slot.accent}"></div>
      <div class="challenge-period">${slot.label} · ${slot.period}</div>
      <div class="challenge-title">${c.title}</div>
      <div class="challenge-desc">${c.desc}</div>
      ${subsHtml}
      ${badge}
    </div>`;
  }).join('');

  document.getElementById('challenges-grid').innerHTML = html;
}

// ============================================================
// WISSENSCHAFTS-KOMPASS
// ============================================================

function berechneWissenschaftsScore(p) {
  const kst_total = p.kst + (p.gewst_aus ? 0 : p.gewst);

  // ifo-Linie: niedrige Unternehmensteuern, keine Vermögensteuer, Angebotsorientierung
  const ifo = Math.min(100, Math.round(
    25 * Math.max(0, 1 - (kst_total - 20) / 15) +   // KSt+GewSt nah an 20%: max
    20 * (p.verm === 0 && (p.zucman ?? 0) === 0 ? 1 : 0.2) +
    20 * (!p.synthetisch ? 1 : 0) +
    20 * (p.gewst_aus ? 1 : p.gewst <= 10 ? 0.6 : 0.2) +
    15 * Math.max(0, 1 - Math.abs(p.spitze - 42) / 20)  // Spitze nah bei 42%
  ));

  // DIW-Linie: synthetisch, hoher Spitzensteuersatz, Erb-Reform, Vermögensteuer, hohe BBG
  const diw = Math.min(100, Math.round(
    25 * (p.synthetisch ? 1 : 0) +
    20 * Math.max(0, Math.min(1, (p.spitze - 42) / 18)) +  // Spitze 42–60%
    15 * (!p.betriebs ? 1 : 0) +
    20 * Math.min(1, ((p.verm ?? 0) + (p.zucman ?? 0) * 0.5) / 1.5) +
    10 * Math.max(0, (p.erb - 20) / 30) +
    10 * Math.min(1, Math.max(0, ((p.bbg ?? 90000) - 90000) / 70000))
  ));

  // Zucman-Linie: internationale Koordination, Milliardärssteuer, CO₂, Steuertransparenz
  const zucman_s = Math.min(100, Math.round(
    40 * Math.min(1, (p.zucman ?? 0) / 2) +
    20 * Math.min(1, ((p.verm ?? 0) + (p.erb > 30 ? 0.5 : 0)) / 1.5) +
    25 * Math.min(1, Math.max(0, (p.co2 - 55) / 150)) +
    15 * (!p.kleine_st ? 1 : 0)
  ));

  // Kirchhof-Linie: Flat Tax, Vereinfachung, wenig Steuerarten
  const kirchhof = Math.min(100, Math.round(
    30 * Math.max(0, 1 - Math.abs(p.eingang - p.spitze) / 25) +  // je flacher, desto mehr
    25 * (!p.kleine_st ? 1 : 0) +
    20 * (p.gewst_aus ? 1 : 0) +
    15 * (p.verm === 0 && (p.zucman ?? 0) === 0 ? 1 : 0) +
    10 * (!p.neg_est && !p.buergerv ? 1 : 0)   // Vereinfachung Sozialstaat
  ));

  return { ifo, diw, zucman: zucman_s, kirchhof };
}

function renderWissenschaftsPanel(p) {
  const scores = berechneWissenschaftsScore(p);
  const lager = [
    { key: 'ifo',      label: 'ifo/Fuest · Angebotsorientiert',   score: scores.ifo,      color: 'var(--accent)',  desc: 'Niedrige Unternehmensteuern, keine Vermögensteuer, Entlastung Mitte' },
    { key: 'diw',      label: 'DIW/Bach · Verteilungsorientiert',  score: scores.diw,      color: 'var(--accent)', desc: 'Synthetisch, höhere Spitze, Erbschafts-/Vermögensteuer, hohe BBG' },
    { key: 'zucman',   label: 'Zucman · Internationalistisch',     score: scores.zucman,   color: 'var(--good)', desc: 'Zucman-Mindeststeuer, CO₂-Preis, internationale Koordination' },
    { key: 'kirchhof', label: 'Kirchhof · Vereinfachung',          score: scores.kirchhof, color: 'var(--warn)',    desc: 'Flat Tax, wenige Steuerarten, GewSt abschaffen' }
  ];

  const dominant = lager.reduce((a, b) => b.score > a.score ? b : a);

  const barsHtml = lager.map(l => `
    <div style="margin-bottom:10px;">
      <div style="display:grid;grid-template-columns:220px 1fr 42px;align-items:center;gap:10px;">
        <div style="font-family:'DM Mono',monospace;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${l.desc}">${l.label}</div>
        <div class="bar-track"><div class="bar-fill neu" style="width:${l.score}%;background:${l.color};opacity:${l.score > 0 ? 0.8 : 0.2}"></div></div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;text-align:right;">${l.score}%</div>
      </div>
    </div>`).join('');

  document.getElementById('wissenschafts_bars').innerHTML = barsHtml;
  document.getElementById('wissenschafts_note').textContent =
    dominant.score >= 40
      ? `Deine Einstellungen ähneln am stärksten dem ${dominant.label.split('·')[1].trim()}-Lager (${dominant.score}%). ${dominant.desc}.`
      : 'Deine Einstellungen lassen sich keinem Lager klar zuordnen — ein eklektischer Mix.';
}

// ============================================================
// TOOLTIP-DATEN
// ============================================================


// ── 8. TOOLTIPS — Logik ──


// ============================================================
// TOOLTIP-FUNKTIONEN
// ============================================================

function injectTooltips() {
  const popup = document.getElementById('tt-popup');

  Object.entries(TOOLTIPS).forEach(([id, tip]) => {
    const input = document.getElementById(id);
    if (!input) return;
    const row = input.closest('.slider-row, .toggle-row');
    if (!row) return;

    const btn = document.createElement('button');
    btn.className = 'tt-btn';
    btn.type = 'button';
    btn.textContent = 'ⓘ';
    btn.setAttribute('aria-label', tip.title + ' — Erklärung');

    let activeByClick = false;

    btn.addEventListener('mouseenter', e => { showTooltip(e, tip); activeByClick = false; });
    btn.addEventListener('mouseleave', () => { if (!activeByClick) hideTooltip(); });
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (activeByClick && !popup.hasAttribute('hidden')) {
        hideTooltip(); activeByClick = false;
      } else {
        showTooltip(e, tip); activeByClick = true;
      }
    });

    if (row.classList.contains('slider-row')) {
      const label = row.querySelector('label');
      const valueSpan = label.querySelector('.value');
      if (valueSpan) label.insertBefore(btn, valueSpan);
      else label.appendChild(btn);
    } else {
      const span = row.querySelector('span');
      if (span) span.appendChild(btn);
    }
  });

  document.addEventListener('click', () => hideTooltip());
}

function showTooltip(e, tip) {
  const popup = document.getElementById('tt-popup');
  document.getElementById('tt-title').textContent = tip.title;
  document.getElementById('tt-text').textContent = tip.text;
  document.getElementById('tt-quelle').textContent = tip.quelle;
  popup.removeAttribute('hidden');
  positionTooltip(e.target);
}

function hideTooltip() {
  document.getElementById('tt-popup').setAttribute('hidden', '');
}

function positionTooltip(target) {
  const popup = document.getElementById('tt-popup');
  const rect = target.getBoundingClientRect();
  let top = rect.bottom + 8;
  let left = rect.left - 10;
  if (left + 310 > window.innerWidth) left = window.innerWidth - 315;
  if (left < 4) left = 4;
  if (top + 180 > window.innerHeight) top = rect.top - 185;
  popup.style.top = top + 'px';
  popup.style.left = left + 'px';
}

// ============================================================
// RECHENWEG
// ============================================================

function renderRechenweg(r, p) {
  const panel = document.getElementById('rw-body');
  if (!panel) return;
  const details = document.getElementById('rw-details');
  if (!details || !details.open) return;

  const f = (n, d=1) => n.toFixed(d).replace('.', ',');
  const fk = n => Math.round(n).toLocaleString('de-DE');

  // Zonen-Grenzen berechnen (für Tabelle)
  const sq_total = 265741;
  const scale = (p.grenze - p.freibetrag) / sq_total;
  const z2_end = p.freibetrag + Math.round(4921 * scale);
  const z3_end = p.freibetrag + Math.round((4921 + 49755) * scale);
  const z4_end = p.grenze;
  const satz4 = Math.min(p.spitze, p.eingang * 0.05 + p.spitze * 0.95);

  // Beispiel-Dezil (D5 = 40.000 € Brutto)
  const d5_brutto = 40000;
  const d5_est = estTarif(d5_brutto, p.freibetrag, p.eingang, p.spitze, p.grenze);
  const d5_gs = (grenzsteuersatz(d5_brutto, p.freibetrag, p.eingang, p.spitze, p.grenze) * 100).toFixed(1);
  const d5_eff = (effSteuersatz(d5_brutto, p.freibetrag, p.eingang, p.spitze, p.grenze) * 100).toFixed(1);

  // D5-Zone bestimmen
  const d5_zve = d5_brutto - p.freibetrag;
  const z2w = 4921 * scale;
  const z3w = 49755 * scale;
  const d5_zone = d5_zve <= 0 ? 1 : d5_zve <= z2w ? 2 : d5_zve <= z2w + z3w ? 3 : d5_zve <= z2w + z3w + 211065 * scale ? 4 : 5;

  panel.innerHTML = `
    <div class="rw-section">
      <div class="rw-section-title">1 · Einkommensteuer — § 32a EStG Formeltarif</div>
      <div class="rw-text">Das Modell verwendet einen parametrischen Formeltarif mit 5 Zonen analog § 32a EStG. In Zonen 2 und 3 steigt der Grenzsteuersatz <em>linear</em> an (Integral der Grenzrate = exakte Steuer). Die Zonengrenzen skalieren proportional zu den Slider-Werten. Kein Sprung an Zonengrenzen.</div>
      <table class="rw-zone-table">
        <tr><th>Zone</th><th>ZVE-Bereich</th><th>Grenzsteuersatz</th><th>Formeltyp</th></tr>
        <tr class="${d5_zone===1?'active-zone':''}"><td>1</td><td>0 – ${fk(p.freibetrag)} €</td><td>0 %</td><td>Grundfreibetrag</td></tr>
        <tr class="${d5_zone===2?'active-zone':''}"><td>2</td><td>${fk(p.freibetrag)} – ${fk(z2_end)} €</td><td>${p.eingang} → ${(p.eingang + (satz4*100 - p.eingang)*0.344).toFixed(1)} %</td><td>linear ansteigend (§ 32a Nr. 2)</td></tr>
        <tr class="${d5_zone===3?'active-zone':''}"><td>3</td><td>${fk(z2_end)} – ${fk(z3_end)} €</td><td>${(p.eingang + (satz4*100 - p.eingang)*0.344).toFixed(1)} → ${(satz4*100).toFixed(1)} %</td><td>linear ansteigend (§ 32a Nr. 3)</td></tr>
        <tr class="${d5_zone===4?'active-zone':''}"><td>4</td><td>${fk(z3_end)} – ${fk(z4_end)} €</td><td>${Math.round(satz4)} %</td><td>linear (§ 32a Nr. 4)</td></tr>
        <tr class="${d5_zone===5?'active-zone':''}"><td>5</td><td>ab ${fk(z4_end)} €</td><td>${p.spitze} %</td><td>Spitzensteuersatz (§ 32a Nr. 5)</td></tr>
      </table>
      <div class="rw-text"><strong>Beispiel Dezil 5</strong> (Brutto ~40.000 €):
        ZVE = 40.000 − ${fk(p.freibetrag)} = ${fk(d5_brutto - p.freibetrag)} € → Zone ${d5_zone}
        → ESt = <span class="rw-hl">${fk(Math.round(d5_est))} €</span>
        · Grenzsteuersatz: ${d5_gs} % · Effektivsteuersatz: ${d5_eff} %</div>
      <div class="rw-text">Gesamtaufkommen ESt: <span class="rw-hl">${f(r.rev.est)} Mrd. €</span>
        ${p.synthetisch ? '· Kapital synthetisch zusammen besteuert' : `· Kapital dual: Abgeltung ${p.abgeltung}%`}
        · Quelle: BMF Steuerschätzung 2025</div>
    </div>

    <div class="rw-section">
      <div class="rw-section-title">2 · Verhaltensreaktion — Arbeitsangebot</div>
      <div class="rw-formula">Δ_Arbeit = ε × Δ(1 − GSatz_neu) / (1 − GSatz_Basis)
D1–D10b: ε = ${ELAST.labor_supply} (intensive margin, Saez/Chetty Konsens)
D10c (Top 1%): ε = ${ELAST.d10c_labor} + Avoidance-Effekt ab GSatz > 45%
  Avoidance = 1 − ${ELAST.d10c_avoidance} × max(0, GSatz−0,45) − ${ELAST.d10c_wegzug} × max(0, GSatz−0,60)
  (Einkommensverschiebung: Kapitalgesellschaft, Stiftung, Timing)
  (Wegzug: steuerbedingte Emigration bei sehr hohen Sätzen)
Begrenzung: 0,55 – 1,25 (D10c: 0,40 Minimum)</div>
      <div class="rw-text">Arbeitsangebots-Index: <span class="${r.behavior.labor >= 99.5 ? 'rw-good' : r.behavior.labor < 97 ? 'rw-bad' : ''}">${f(r.behavior.labor)} (Basis: 100,0)</span>
        · D10c-Avoidance: ${p.spitze > 45 ? `aktiv (GS ${p.spitze}% > 45% Schwelle)` : `inaktiv (GS ${p.spitze}% ≤ 45% Schwelle)`}
        · Quellen: Saez/Chetty/Gruber (2012), Piketty/Saez/Stantcheva (2014), Kleven/Schultz (2014), Brülhart et al. (2019)</div>
    </div>

    <div class="rw-section">
      <div class="rw-section-title">3 · Mehrwertsteuer</div>
      <div class="rw-formula">MwSt_Dezil = Netto × Konsumquote × (0,70 × ${p.mwst}/(100+${p.mwst}) + 0,30 × ${p.mwst_erm}/(100+${p.mwst_erm}))
Konsumquoten: D1=100% … D10=55% (aus EU-SILC, Destatis)
Verhaltensreakt.: Konsum × (1 + ε × Δ_MwSt), ε = ${ELAST.consumption}</div>
      <div class="rw-text">MwSt-Aufkommen: <span class="rw-hl">${f(r.rev.mwst)} Mrd. €</span>
        · Basis 2025: 303 Mrd. · 70% Regelgut, 30% ermäßigt</div>
    </div>

    <div class="rw-section">
      <div class="rw-section-title">4 · CO₂-Steuer (BEHG)</div>
      <div class="rw-formula">Emissionen_neu = 500 Mio. t × (1 + (${ELAST.co2}) × (${p.co2} − 55) / 100)
         = ${f(500 * Math.max(0.4, Math.min(1.1, 1 + ELAST.co2 * (p.co2 - 55)/100)), 1)} Mio. t CO₂
Aufkommen = Emissionen × ${p.co2} €/t${p.klimageld ? `\nKlimageld = Aufkommen × 70%  →  ${f(r.klimageld_auszahlung)} Mrd. € zurück (pro Kopf)` : ''}</div>
      <div class="rw-text">Netto-Aufkommen: <span class="rw-hl">${f(r.rev.co2)} Mrd. €</span>
        · Bepreisungsbereich: Wärme + Verkehr (~500 Mio. t) · Quelle: DEHSt, UBA 2025</div>
    </div>

    <div class="rw-section">
      <div class="rw-section-title">5 · Sozialversicherung</div>
      <div class="rw-formula">Beitragsbasis = Lohnsumme bis BBG ≈ 1.750 Mrd. €${p.buergerv ? ' × 1,15 (Bürgerversicherung)' : ''}
RV: ${p.rv}%  ·  KV: ${p.kv}%  ·  AL+Pflege: ${p.alpf}%
AN-Anteil ≈ 50% (je hälftig AN/AG)</div>
      <div class="rw-text">Aufkommen: RV <span class="rw-hl">${f(r.rev.rv)} Mrd.</span>
        · KV <span class="rw-hl">${f(r.rev.kv)} Mrd.</span>
        · AL+Pflege <span class="rw-hl">${f(r.rev.al)} Mrd.</span>
        · Quelle: DRV, GKV-SV, BA 2025</div>
    </div>

    <div class="rw-section">
      <div class="rw-section-title">6 · Staatshaushalt — Saldo</div>
      <div class="rw-formula">Saldo = Einnahmen − Ausgaben
Einnahmen:  ${f(r.einnahmen_total, 0)} Mrd. €
Festausgaben: ${Math.round(AUSGABEN_TOTAL)} Mrd. € (Sozial/Gesundheit/Bildung/Verteidigung etc.)
Variable:     ${f(r.bg_auszahlung + r.kg_auszahlung + r.neg_est_auszahlung, 1)} Mrd. € (Transfers)
              + ${f(r.admin_kosten, 1)} Mrd. € (Verwaltungskosten)
              − 140 Mrd. € (Verwaltung Basis ersetzt)
Ausgaben:   ${f(r.ausgaben_total, 0)} Mrd. €
────────────────────────────────
Saldo:      ${r.saldo >= 0 ? '+' : ''}${f(r.saldo)} Mrd. €</div>
      <div class="rw-text">Ausgaben-Basis: BMF Bundeshaushalt 2025 (konsolidierter Gesamtstaat inkl. Länderhaushalte, SV)</div>
    </div>

    <div class="rw-section">
      <div class="rw-section-title">7 · Gini-Koeffizient</div>
      <div class="rw-formula">Gini = (2 × Σ(rank_i × Netto_i)) / (n × Σ Netto_i) − (n+1)/n
Basis: Nettoeinkommen nach ESt, SV, MwSt, CO₂-Last und Transfers pro Dezil
n = 10 (Dezile als repräsentative Punkte)</div>
      <div class="rw-text">Gini aktuell: <span class="${r.gini < REF.gini - 0.005 ? 'rw-good' : r.gini > REF.gini + 0.005 ? 'rw-bad' : 'rw-hl'}">${r.gini.toFixed(3).replace('.',',')}</span>
        · Basis (Status Quo 2025): ${REF.gini.toFixed(3).replace('.',',')}
        · SOEP-Basis Deutschland 2023: ~0,295 (nach Steuern) · Quelle: SOEP v40, DIW</div>
    </div>

    <div class="rw-section">
      <div class="rw-section-title">8 · Verwaltungskosten</div>
      <div class="rw-formula">Kosten = Σ (Aufkommen_Steuer × Kosten-Quote_Steuer)
Quoten: ESt Arbeit 2,5% · MwSt 1,0% · KSt 4,0% · GewSt 5,0%
        Erbschaft 8,0% · CO₂ 2,0% · SV 1,5% · Kleine Verbr. 20,0%</div>
      <div class="rw-text">Gesamt: <span class="rw-hl">${f(r.admin_kosten)} Mrd. €</span>
        · Aktive Steuerarten: ${r.nst}
        · Quelle: Bundesrechnungshof, OECD Tax Administration 2024, Normenkontrollrat</div>
    </div>
  `;
}

// ============================================================
// INIT
// ============================================================

// Section toggles (ctrl-section-head + legacy section-title)
document.querySelectorAll('.ctrl-section-head[data-toggle], .section-title[data-toggle]').forEach(el => {
  el.addEventListener('click', () => el.classList.toggle('collapsed'));
});

// Visual slider sync


// ── 9. SLIDER & VISUALISIERUNGEN ──

function syncSlider(input) {
  const track = input.closest('.slider-track');
  if (!track) return;
  const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
  const fill = track.querySelector('.slider-fill');
  const thumb = track.querySelector('.slider-thumb');
  if (fill) fill.style.width = pct + '%';
  if (thumb) thumb.style.left = pct + '%';
  const col = track.dataset.accent;
  if (col) {
    if (fill) fill.style.background = col;
    if (thumb) thumb.style.borderColor = col;
    const row = track.closest('.slider-row');
    const valSpan = row && row.querySelector('.value');
    if (valSpan) valSpan.style.color = col;
  }
}
function syncAllSliders() {
  document.querySelectorAll('.styled-slider').forEach(syncSlider);
}

// Preset buttons
document.querySelectorAll('#presets button').forEach(btn => {
  btn.addEventListener('click', () => {
    pushHistory();
    document.querySelectorAll('#presets button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    setParams(PRESETS[btn.dataset.preset]);
    render();
    syncAllSliders();
  });
});

// Render-Drosselung: maximal 1× pro Animationsframe, egal wie schnell der Slider bewegt wird
let _renderPending = false;
let _historyTimer = null;

function scheduleRender() {
  if (_renderPending) return;
  _renderPending = true;
  requestAnimationFrame(() => {
    _renderPending = false;
    render();
  });
}

// Listen on all inputs
document.querySelectorAll('input[type="range"], input[type="checkbox"]').forEach(inp => {
  inp.addEventListener('input', () => {
    if (inp.classList.contains('styled-slider')) syncSlider(inp);
    // History nur beim Loslassen, nicht bei jedem Tick
    clearTimeout(_historyTimer);
    _historyTimer = setTimeout(pushHistory, 400);
    document.querySelectorAll('#presets button').forEach(b => b.classList.remove('active'));
    scheduleRender();
  });
});

function renderEstKurve(p) {
  const el = document.getElementById('est_kurve');
  if (!el) return;
  const W = 640, H = 200, pl = 48, pr = 16, pt = 12, pb = 32;
  const iW = W - pl - pr, iH = H - pt - pb;
  const maxInc = 350000, maxRate = 55;

  const pts_grenz = [], pts_eff = [];
  for (let i = 0; i <= 280; i++) {
    const inc = (i / 280) * maxInc;
    const gs = grenzsteuersatz(inc, p.freibetrag, p.eingang, p.spitze, p.grenze) * 100;
    const es = effSteuersatz(inc, p.freibetrag, p.eingang, p.spitze, p.grenze) * 100;
    const x = pl + (inc / maxInc) * iW;
    const yg = pt + iH - Math.min(iH, (gs / maxRate) * iH);
    const ye = pt + iH - Math.min(iH, (es / maxRate) * iH);
    pts_grenz.push(x + ',' + yg);
    pts_eff.push(x + ',' + ye);
  }

  const yGrid = [0,10,20,30,40,50].map(v => {
    const y = pt + iH - (v / maxRate) * iH;
    return `<line x1="${pl}" y1="${y}" x2="${pl+iW}" y2="${y}" stroke="rgba(42,39,32,0.1)" stroke-width="1"/>
            <text x="${pl-5}" y="${y+4}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${v}%</text>`;
  }).join('');
  const xGrid = [50,100,150,200,250,300,350].map(v => {
    const x = pl + (v*1000 / maxInc) * iW;
    return `<line x1="${x}" y1="${pt}" x2="${x}" y2="${pt+iH}" stroke="rgba(42,39,32,0.1)" stroke-width="1"/>
            <text x="${x}" y="${pt+iH+18}" text-anchor="middle" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${v}k</text>`;
  }).join('');

  // Dezil-Markierungen
  const dezilMarks = DEZILE.map(d => {
    const x = pl + (Math.min(d.brutto, maxInc) / maxInc) * iW;
    const gs = grenzsteuersatz(d.brutto*(1-d.kapital), p.freibetrag, p.eingang, p.spitze, p.grenze)*100;
    const y = pt + iH - Math.min(iH, (gs / maxRate) * iH);
    return `<circle cx="${x}" cy="${y}" r="3" fill="var(--accent)" opacity="0.7"/>
            <text x="${x}" y="${pt+iH+28}" text-anchor="middle" font-size="9" font-family="DM Mono,monospace" fill="var(--muted)">${d.label}</text>`;
  }).join('');

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H+10}" style="width:100%;overflow:visible">
    ${yGrid}${xGrid}
    <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <line x1="${pl}" y1="${pt+iH}" x2="${pl+iW}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <polyline points="${pts_eff.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5,3" opacity="0.8"/>
    <polyline points="${pts_grenz.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>
    ${dezilMarks}
    <g transform="translate(${pl+8},${pt+10})">
      <line x1="0" y1="0" x2="18" y2="0" stroke="var(--accent)" stroke-width="2.5"/>
      <text x="22" y="4" font-size="11" font-family="DM Mono,monospace" fill="var(--ink)">Grenzsteuersatz</text>
      <line x1="0" y1="16" x2="18" y2="16" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5,3"/>
      <text x="22" y="20" font-size="11" font-family="DM Mono,monospace" fill="var(--ink)">Effektivsteuersatz</text>
    </g>
  </svg>`;
}

function renderIncomeDist(r, p) {
  const el = document.getElementById('income_dist_chart');
  if (!el) return;
  const W = 640, H = 180, pl = 48, pr = 16, pt = 12, pb = 32;
  const iW = W - pl - pr, iH = H - pt - pb;
  const maxNetto = Math.max(...r.hh_delta.netto) * 1.05;

  const nBars = r.hh_delta.netto.length;
  const bars = r.hh_delta.netto.map((n, i) => {
    const barW = Math.max(2, (iW / nBars) - 3);
    const x = pl + i * (iW / nBars) + 1.5;
    const barH = Math.max(2, (n / maxNetto) * iH);
    const y = pt + iH - barH;
    const isPoor = n < r.poverty_line;
    const fill = isPoor ? 'var(--bad)' : (r.hh_delta.delta[i] > 100 ? 'var(--good)' : 'var(--ink)');
    const nStr = n >= 1000 ? Math.round(n/1000) + 'k' : Math.round(n);
    const lbl = DEZILE[i].label;
    const fontSize = nBars > 10 ? '8' : '9';
    return `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${fill}" opacity="${isPoor?'1':'0.75'}"/>
            <text x="${x+barW/2}" y="${y-4}" text-anchor="middle" font-size="${fontSize}" font-family="DM Mono,monospace" fill="var(--muted)">${nStr}</text>
            <text x="${x+barW/2}" y="${pt+iH+18}" text-anchor="middle" font-size="${fontSize}" font-family="DM Mono,monospace" fill="var(--muted)">${lbl}</text>`;
  }).join('');

  // Armutsgrenze
  const povertyY = pt + iH - (r.poverty_line / maxNetto) * iH;
  const povertyLine = r.poverty_line > 0 ?
    `<line x1="${pl}" y1="${povertyY}" x2="${pl+iW}" y2="${povertyY}" stroke="var(--bad)" stroke-width="1.5" stroke-dasharray="6,3"/>
     <text x="${pl+iW-4}" y="${povertyY-5}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="var(--bad)">Armutsgrenze ${Math.round(r.poverty_line/1000)}k €</text>` : '';

  const yLabels = [0, 0.25, 0.5, 0.75, 1.0].map(f => {
    const v = Math.round(f * maxNetto / 1000);
    const y = pt + iH - f * iH;
    return `<line x1="${pl}" y1="${y}" x2="${pl+iW}" y2="${y}" stroke="rgba(42,39,32,0.08)" stroke-width="1"/>
            <text x="${pl-5}" y="${y+4}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${v}k</text>`;
  }).join('');

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H+10}" style="width:100%;overflow:visible">
    ${yLabels}
    <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <line x1="${pl}" y1="${pt+iH}" x2="${pl+iW}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    ${bars}${povertyLine}
  </svg>`;
}


// ── 10. EXPORT & SCHULDENPFAD ──

function exportCSV() {
  const p = getParams();
  const r = berechne(p);
  const rows = [];
  const sep = ';';

  rows.push(['Haushaltsspiel Deutschland — Export', new Date().toLocaleDateString('de-DE')].join(sep));
  rows.push([]);

  rows.push(['=== PARAMETER ===']);
  rows.push(['Grundfreibetrag', p.freibetrag + ' €']);
  rows.push(['Eingangssteuersatz', p.eingang + ' %']);
  rows.push(['Spitzensteuersatz', p.spitze + ' %']);
  rows.push(['Einkommen ab Spitzensatz', p.grenze + ' €']);
  rows.push(['Kapital synthetisch', p.synthetisch ? 'Ja' : 'Nein']);
  rows.push(['Abgeltungsteuer', p.abgeltung + ' %']);
  rows.push(['Körperschaftsteuer', p.kst + ' %']);
  rows.push(['Gewerbesteuer', p.gewst_aus ? 'abgeschafft' : p.gewst + ' %']);
  rows.push(['MwSt Regelsatz', p.mwst + ' %']);
  rows.push(['MwSt ermäßigt', p.mwst_erm + ' %']);
  rows.push(['CO₂-Preis', p.co2 + ' €/t']);
  rows.push(['Klimageld', p.klimageld ? 'Ja' : 'Nein']);
  rows.push(['Erbschaftsteuer Spitze', p.erb + ' %']);
  rows.push(['Bodenwertsteuer', p.boden + ' %']);
  rows.push(['Vermögensteuer', p.verm + ' %']);
  rows.push(['Rentenversicherung', p.rv + ' %']);
  rows.push(['Krankenversicherung', p.kv + ' %']);
  rows.push(['AL+Pflege', p.alpf + ' %']);
  rows.push(['Bürgerversicherung', p.buergerv ? 'Ja' : 'Nein']);
  rows.push(['Bürgergeld-Regelsatz', p.bg + ' €/Monat']);
  rows.push(['Kindergeld', p.kg + ' €/Monat']);
  rows.push([]);

  rows.push(['=== FISKAL-KENNZAHLEN (Mrd. €) ===']);
  rows.push(['Einnahmen gesamt', r.einnahmen_total.toFixed(1)]);
  rows.push(['Ausgaben gesamt', r.ausgaben_total.toFixed(1)]);
  rows.push(['Saldo', r.saldo.toFixed(1)]);
  rows.push(['Verwaltungskosten', r.admin_kosten.toFixed(1)]);
  rows.push([]);

  rows.push(['=== EINNAHMEN NACH STEUERART (Mrd. €) ===']);
  const rLabels = {est:'Einkommensteuer',kst:'Körperschaftsteuer',gewst:'Gewerbesteuer',mwst:'Mehrwertsteuer',co2:'CO₂ (netto)',erbschaft:'Erbschaftsteuer',boden:'Bodenwertsteuer',vermoegen:'Vermögensteuer',rv:'Rentenversicherung',kv:'Krankenversicherung',al:'AL+Pflege',klein:'Kleine Verbrauchsteuern'};
  Object.entries(r.rev).forEach(([k,v]) => rows.push([rLabels[k]||k, v.toFixed(1)]));
  rows.push([]);

  rows.push(['=== VERTEILUNG NACH DEZIL ===']);
  rows.push(['Dezil', 'Netto-Einkommen (€)', 'Δ vs. Status Quo (€)', 'Steuerbelastung (%)']);
  r.hh_delta.netto.forEach((n, i) => rows.push([
    'D' + (i+1), Math.round(n), Math.round(r.hh_delta.delta[i]), r.hh_delta.belastung_pct[i].toFixed(1)
  ]));
  rows.push([]);

  rows.push(['=== VERTEILUNGS- & VERHALTENSKENNZAHLEN ===']);
  rows.push(['Gini-Koeffizient (neu)', r.gini.toFixed(4)]);
  rows.push(['Gini-Koeffizient (Basis)', REF.gini.toFixed(4)]);
  rows.push(['Palma-Ratio', r.palma.toFixed(3)]);
  rows.push(['Arbeitsangebot Index', r.behavior.labor.toFixed(1)]);
  rows.push(['Konsum Index', r.behavior.konsum.toFixed(1)]);
  rows.push(['Investitionen Index', r.behavior.invest.toFixed(1)]);
  rows.push(['CO₂-Emissionen Index', r.behavior.co2.toFixed(1)]);

  const csvStr = rows.map(r => Array.isArray(r) ? r.join(sep) : r).join('\n');
  const blob = new Blob(['\uFEFF' + csvStr], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'haushaltsspiel_export_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// SCHULDENQUOTENPFAD
// ============================================================

function berechneSchuldenpfad(saldo_neu, saldo_sq) {
  const bip_g = 0.015; // nominal 1,5 % BIP-Wachstum
  const zins  = 0.025; // Ø-Zins auf Bestandsschulden (Rollover-Effekt ~2,5 %)
  let bip     = 4200;
  let schuld_neu = 64.0 / 100 * bip;  // Startpunkt: 64 % BIP 2025 (IMF Article IV 2025)
  let schuld_sq  = 64.0 / 100 * bip;
  const pfad = [{jahr:2025, neu:64.0, sq:64.0}];

  for (let y = 1; y <= 20; y++) {
    bip *= (1 + bip_g);
    // Zinsdynamik: wenn neue Schulden > SQ-Schulden, fallen Mehrzinsen an
    const extra_zins = (schuld_neu - schuld_sq) * zins;
    schuld_neu -= (saldo_neu - extra_zins);
    schuld_sq  -= saldo_sq;
    pfad.push({ jahr: 2025+y, neu: schuld_neu/bip*100, sq: schuld_sq/bip*100 });
  }
  return pfad;
}

function renderSchuldenpfad(r) {
  const el = document.getElementById('schulden_pfad_chart');
  if (!el) return;
  const pfad = berechneSchuldenpfad(r.saldo, REF.saldo);
  const W=640, H=160, pl=48, pr=16, pt=12, pb=28;
  const iW=W-pl-pr, iH=H-pt-pb;
  const allV = pfad.flatMap(p=>[p.neu,p.sq]);
  const minV = Math.min(30, ...allV), maxV = Math.max(80, ...allV);
  const xOf = j => pl + ((j-2025)/20)*iW;
  const yOf = v => pt + iH - ((v-minV)/(maxV-minV))*iH;

  const pts_neu = pfad.map(p=>xOf(p.jahr)+','+yOf(p.neu)).join(' ');
  const pts_sq  = pfad.map(p=>xOf(p.jahr)+','+yOf(p.sq)).join(' ');

  const yVals = [40,50,60,70,80,90].filter(v=>v>=minV-5&&v<=maxV+5).map(v => {
    const y = yOf(v);
    const isM = v===60, isR = v===90;
    const col = isM ? 'rgba(200,64,31,0.5)' : isR ? 'rgba(200,64,31,0.8)' : 'rgba(42,39,32,0.08)';
    return `<line x1="${pl}" y1="${y}" x2="${pl+iW}" y2="${y}" stroke="${col}" stroke-width="${isM||isR?1.5:1}" stroke-dasharray="${isM||isR?'6,3':''}"/>
            <text x="${pl-5}" y="${y+4}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="${isM||isR?'var(--bad)':'var(--muted)'}">
              ${v}%${isM?' ←Maas.':isR?' ←R/R':''}
            </text>`;
  }).join('');
  const xLabels = [2025,2030,2035,2040,2045].map(j=>
    `<text x="${xOf(j)}" y="${pt+iH+16}" text-anchor="middle" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">${j}</text>`
  ).join('');

  const endNeu = pfad[pfad.length-1].neu.toFixed(1);
  const endSQ  = pfad[pfad.length-1].sq.toFixed(1).replace('.',',');
  const sameScenario = Math.abs(r.saldo - REF.saldo) < 0.5;

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H+4}" style="width:100%;overflow:visible">
    ${yVals}${xLabels}
    <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    <line x1="${pl}" y1="${pt+iH}" x2="${pl+iW}" y2="${pt+iH}" stroke="var(--rule)" stroke-width="1.5"/>
    ${!sameScenario?`<polyline points="${pts_sq}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4,2" opacity="0.6"/>`:'' }
    <polyline points="${pts_neu}" fill="none" stroke="${r.saldo>0?'var(--good)':'var(--bad)'}" stroke-width="2.5"/>
    <text x="${xOf(2045)-4}" y="${yOf(pfad[20].neu)-8}" text-anchor="end" font-size="11" font-family="DM Mono,monospace" font-weight="600" fill="${r.saldo>0?'var(--good)':'var(--bad)'}">${(+endNeu).toFixed(1).replace('.',',')} %</text>
    ${!sameScenario?`<text x="${xOf(2045)-4}" y="${yOf(pfad[20].sq)+14}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">SQ: ${endSQ} %</text>`:''}
    <g transform="translate(${pl+8},${pt+8})">
      <line x1="0" y1="0" x2="18" y2="0" stroke="${r.saldo>0?'var(--good)':'var(--bad)'}" stroke-width="2.5"/>
      <text x="22" y="4" font-size="10" font-family="DM Mono,monospace" fill="var(--ink)">Aktuelles Szenario</text>
      ${!sameScenario?`<line x1="0" y1="14" x2="18" y2="14" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4,2"/>
      <text x="22" y="18" font-size="10" font-family="DM Mono,monospace" fill="var(--muted)">Status Quo</text>`:''}
    </g>
  </svg>`;
}

// ============================================================
// SHARE-URL
// ============================================================


// ── 11. SHARE, SZENARIEN, SCORING, HISTORY ──

function paramsToHash(p) {
  try { return '#' + btoa(JSON.stringify(p)); } catch { return ''; }
}
function hashToParams(hash) {
  try { return JSON.parse(atob(hash.slice(1))); } catch { return null; }
}
function copyShareLink() {
  const p = getParams();
  const url = window.location.origin + window.location.pathname + paramsToHash(p);
  const btn = document.getElementById('share-btn');
  const fallback = () => { prompt('Link kopieren (Strg+C):', url); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        btn.textContent = '✓ Kopiert!';
        setTimeout(() => btn.textContent = 'Link kopieren', 1800);
      }).catch(fallback);
    } else {
      fallback();
    }
  } catch(e) { fallback(); }
}

// ============================================================
// SZENARIO-VERGLEICH — Live-Edit-Modus
// ============================================================

const SZENARIO = { A: null, B: null };
let activeScenarioSlot = null; // null | 'A' | 'B'

function enterScenarioMode(slot) {
  if (activeScenarioSlot === slot) {
    // Toggle off: exit mode, keep data
    activeScenarioSlot = null;
    updateScenarioModeUI();
    return;
  }
  // If switching from other slot: save current state there first
  if (activeScenarioSlot && activeScenarioSlot !== slot) {
    const cp = getParams();
    SZENARIO[activeScenarioSlot] = { p: cp, r: berechne(cp) };
    // Load the other slot's params if they exist
    if (SZENARIO[slot]) setParams(SZENARIO[slot].p);
  } else if (!SZENARIO[slot]) {
    // First time entering this slot: snapshot current state as starting point
    const cp = getParams();
    SZENARIO[slot] = { p: cp, r: berechne(cp) };
  } else {
    // Re-entering a slot that already has data: reload its params
    setParams(SZENARIO[slot].p);
  }
  activeScenarioSlot = slot;
  updateScenarioModeUI();
  render();
}

function exitScenarioMode() {
  activeScenarioSlot = null;
  updateScenarioModeUI();
}

function updateScenarioModeUI() {
  const bar   = document.getElementById('scenario-mode-bar');
  const label = document.getElementById('scenario-mode-label');
  const btnA  = document.getElementById('save-a-btn');
  const btnB  = document.getElementById('save-b-btn');
  const sidebar = document.getElementById('controls-sidebar');

  bar.className = 'scenario-mode-bar';
  btnA.classList.remove('active');
  btnB.classList.remove('active');
  sidebar.style.borderLeft = '';

  if (activeScenarioSlot === 'A') {
    bar.classList.add('mode-a');
    label.textContent = 'Szenario A aktiv — Regler anpassen';
    btnA.classList.add('active');
  } else if (activeScenarioSlot === 'B') {
    bar.classList.add('mode-b');
    label.textContent = 'Szenario B aktiv — Regler anpassen';
    btnB.classList.add('active');
  }
}

function renderSzenarioVergleich() {
  const el = document.getElementById('szenario-panel');
  if (!el) return;
  const { A, B } = SZENARIO;
  if (!A || !B) {
    el.style.display = A ? 'block' : 'none';
    if (A && !B) el.innerHTML = `<div class="panel" style="border-top:3px solid var(--accent);padding:16px 20px;display:flex;align-items:center;gap:12px;">
      <span style="font-family:'DM Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);">Szenario A gespeichert</span>
      <span style="font-size:13px;color:var(--muted);">Klicke „Szenario B" um ein zweites Szenario zu bearbeiten und zu vergleichen.</span>
    </div>`;
    return;
  }
  el.style.display = 'block';

  const metrics = [
    { label: 'Staatssaldo',       fA: A.r.saldo,              fB: B.r.saldo,              fmt: v=>(v>=0?'+':'')+v.toFixed(1).replace('.',',')+' Mrd.',   good: v=>v>0 },
    { label: 'Einnahmen',         fA: A.r.einnahmen_total,    fB: B.r.einnahmen_total,    fmt: v=>Math.round(v)+' Mrd.',                                  good: null },
    { label: 'Gini-Koeffizient',  fA: A.r.gini,               fB: B.r.gini,               fmt: v=>v.toFixed(3).replace('.',','),                          good: v=>v<0 },
    { label: 'Armutsrisiko',      fA: A.r.armutsrisiko,       fB: B.r.armutsrisiko,       fmt: v=>v.toFixed(1).replace('.',',')+' %',                     good: v=>v<0 },
    { label: 'Arbeitsangebot',    fA: A.r.behavior.labor,     fB: B.r.behavior.labor,     fmt: v=>v.toFixed(1),                                           good: v=>v>0 },
    { label: 'CO₂-Index',         fA: A.r.behavior.co2,       fB: B.r.behavior.co2,       fmt: v=>v.toFixed(1),                                           good: v=>v<0 },
    { label: 'Verwaltungskosten', fA: A.r.admin_kosten,       fB: B.r.admin_kosten,       fmt: v=>v.toFixed(1).replace('.',',')+' Mrd.',                  good: v=>v<0 },
    { label: 'Wohlfahrtsverlust', fA: A.r.dwl,                fB: B.r.dwl,                fmt: v=>v.toFixed(0)+' Mrd.',                                   good: v=>v<0 },
    { label: 'Schuldenq. Δ/Jahr', fA: A.r.schuldenquote_delta,fB: B.r.schuldenquote_delta,fmt: v=>(v>=0?'+':'')+v.toFixed(2).replace('.',',')+' %',      good: v=>v<0 },
  ];

  const rows = metrics.map(m => {
    const delta = m.fB - m.fA;
    const cls = m.good ? (m.good(delta) ? 'good' : delta===0 ? 'neutral' : 'bad') : 'neutral';
    const sign = delta >= 0 ? '+' : '';
    const deltaFmt = m.fmt(delta).replace(m.fmt(0).replace(/[+\-]/, ''), ''); // rough delta fmt
    const deltaStr = (delta >= 0 ? '+' : '') + (Math.abs(delta) < 0.005 ? '0' :
      Math.abs(delta) < 1 ? delta.toFixed(3).replace('.',',') :
      Math.abs(delta) < 100 ? delta.toFixed(1).replace('.',',') :
      Math.round(delta).toString());
    return `<tr>
      <td style="padding:6px 12px;font-size:13px;border-bottom:1px solid rgba(42,39,32,0.08)">${m.label}</td>
      <td style="padding:6px 12px;font-family:'DM Mono',monospace;font-size:12px;color:var(--accent);border-bottom:1px solid rgba(42,39,32,0.08)">${m.fmt(m.fA)}</td>
      <td style="padding:6px 12px;font-family:'DM Mono',monospace;font-size:12px;color:var(--good);border-bottom:1px solid rgba(42,39,32,0.08)">${m.fmt(m.fB)}</td>
      <td style="padding:6px 12px;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;color:var(--${cls});border-bottom:1px solid rgba(42,39,32,0.08)">${deltaStr}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `<div class="panel" style="border-top:3px solid var(--accent)">
    <h2>Szenario-Vergleich A vs. B</h2>
    <div class="panel-sub">Spalte Δ = B minus A · Grün = Verbesserung nach Szenario B</div>
    <table style="width:100%;border-collapse:collapse;margin-top:12px;">
      <thead><tr>
        <th style="padding:6px 12px;text-align:left;font-family:'DM Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);border-bottom:2px solid var(--rule)">Kennzahl</th>
        <th style="padding:6px 12px;text-align:left;font-family:'DM Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);border-bottom:2px solid var(--rule)">Szenario A</th>
        <th style="padding:6px 12px;text-align:left;font-family:'DM Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--good);border-bottom:2px solid var(--rule)">Szenario B</th>
        <th style="padding:6px 12px;text-align:left;font-family:'DM Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);border-bottom:2px solid var(--rule)">Δ (B−A)</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:10px;font-size:11px;color:var(--muted);font-style:italic">Aktuelles Szenario überschreibt beim nächsten Speichern.</p>
  </div>`;
}

// ============================================================
// GESAMTNOTE / SCORE
// ============================================================
function berechneGesamtnote(r) {
  // Fiskal: saldo ≥ 0 = 100, −200 = 0
  const fiskal  = Math.max(0, Math.min(100, (r.saldo + 200) / 200 * 100));
  // Gleichheit: gini 0.265 = 100, 0.38 = 0
  const gleich  = Math.max(0, Math.min(100, (0.38 - r.gini) / (0.38 - 0.265) * 100));
  // Effizienz: admin_kosten 80 = 100, 230 = 0
  const effiz   = Math.max(0, Math.min(100, (230 - r.admin_kosten) / 150 * 100));
  // Arbeit: labor 103 = 100, 96 = 0
  const arbeit  = Math.max(0, Math.min(100, (r.behavior.labor - 96) / 7 * 100));

  const score = Math.round(fiskal * 0.30 + gleich * 0.30 + effiz * 0.20 + arbeit * 0.20);

  let grade, gradeClass;
  if      (score >= 93) { grade = 'A+'; gradeClass = 'grade-a'; }
  else if (score >= 87) { grade = 'A';  gradeClass = 'grade-a'; }
  else if (score >= 80) { grade = 'B+'; gradeClass = 'grade-b'; }
  else if (score >= 73) { grade = 'B';  gradeClass = 'grade-b'; }
  else if (score >= 67) { grade = 'C+'; gradeClass = 'grade-c'; }
  else if (score >= 60) { grade = 'C';  gradeClass = 'grade-c'; }
  else if (score >= 53) { grade = 'D+'; gradeClass = 'grade-d'; }
  else if (score >= 47) { grade = 'D';  gradeClass = 'grade-d'; }
  else if (score >= 33) { grade = 'E';  gradeClass = 'grade-e'; }
  else                  { grade = 'F';  gradeClass = 'grade-f'; }

  return { score, grade, gradeClass, dims: { fiskal, gleich, effiz, arbeit } };
}

function renderScore(r) {
  const n = berechneGesamtnote(r);
  const gradeEl = document.getElementById('score-grade');
  gradeEl.textContent = n.grade;
  gradeEl.className = 'score-grade ' + n.gradeClass;
  document.getElementById('score-number').textContent = n.score + ' / 100';

  const dims = [
    { key: 'fiskal',  label: 'Fiskal',     val: n.dims.fiskal },
    { key: 'gleich',  label: 'Gleichheit', val: n.dims.gleich },
    { key: 'effiz',   label: 'Effizienz',  val: n.dims.effiz  },
    { key: 'arbeit',  label: 'Arbeit',     val: n.dims.arbeit },
  ];
  document.getElementById('score-dims').innerHTML = dims.map(d => `
    <div class="score-dim">
      <div class="score-dim-label">${d.label}</div>
      <div class="score-dim-track"><div class="score-dim-fill" style="width:${d.val.toFixed(0)}%"></div></div>
      <div class="score-dim-val">${d.val.toFixed(0)} Pkt.</div>
    </div>`).join('');
}

// ============================================================
// UNDO HISTORY
// ============================================================
function pushHistory() {
  if (!_lastParams) return;
  _history.push(JSON.stringify(_lastParams));
  if (_history.length > 10) _history.shift();
  document.getElementById('undo-btn').disabled = false;
}

function undoHistory() {
  if (!_history.length) return;
  const prev = JSON.parse(_history.pop());
  setParams(prev);
  render();
  syncAllSliders();
  document.getElementById('undo-btn').disabled = _history.length === 0;
}

// ============================================================
// REFORM TOURS (Guided)
// ============================================================


// ── 12. REFORM-TOUR — Logik ──

function startTour(tourId) {
  const tour = REFORM_TOURS.find(t => t.id === tourId);
  if (!tour) return;
  pushHistory();
  _tourActive = tourId;
  _tourStep = 0;
  _tourBaseParams = getParams();
  applyTourStep();
}

function applyTourStep() {
  const tour = REFORM_TOURS.find(t => t.id === _tourActive);
  if (!tour) return;
  const accumulated = Object.assign({}, _tourBaseParams);
  for (let i = 0; i <= _tourStep; i++) {
    Object.assign(accumulated, tour.steps[i].params);
  }
  setParams(accumulated);
  render();
  syncAllSliders();

  const bar = document.getElementById('reform-tour-bar');
  const step = tour.steps[_tourStep];
  bar.classList.add('active');
  document.getElementById('reform-tour-eyebrow').textContent = tour.name + ' · Schritt ' + (_tourStep + 1);
  document.getElementById('reform-tour-title').textContent = step.title;
  document.getElementById('reform-tour-desc').textContent = step.desc;
  document.getElementById('reform-tour-step').textContent = (_tourStep + 1) + ' / ' + tour.steps.length;
  document.getElementById('reform-tour-back').disabled = _tourStep === 0;
  document.getElementById('reform-tour-next').textContent =
    _tourStep < tour.steps.length - 1 ? 'Weiter →' : 'Fertig ✓';
}

function tourNext() {
  const tour = REFORM_TOURS.find(t => t.id === _tourActive);
  if (!tour) return;
  if (_tourStep < tour.steps.length - 1) { _tourStep++; applyTourStep(); }
  else endTour();
}

function tourPrev() {
  if (_tourStep > 0) { _tourStep--; applyTourStep(); }
}

function endTour() {
  _tourActive = null;
  _tourBaseParams = null;
  document.getElementById('reform-tour-bar').classList.remove('active');
}

// ── ALL LET/CONST USED INSIDE render() ──────────────────────
// Must be declared BEFORE render() is called (no hoisting for let/const)
let _lastResult = null, _lastParams = null;
let _prevKpiValues = {};
let _history = [];
let _tourActive = null, _tourStep = 0, _tourBaseParams = null;

// ── KPI BENCHMARKS & CHALLENGE CONTEXT ──────────────────────
// Must be defined BEFORE render() is called (const = no hoisting)


// ── 13. KPI-ANIMATIONEN, KARTEN, SHARE ──


// Capture hash state BEFORE render() modifies window.location via replaceState
const _hadInitialHash = !!window.location.hash;

computeRef();
setParams(PRESETS.status_quo);
// URL-Preset: ?preset=kirchhof etc. (aus Startseiten-Links)
const _urlPreset = new URLSearchParams(window.location.search).get('preset');
if (_urlPreset && PRESETS[_urlPreset]) {
  setParams(PRESETS[_urlPreset]);
  document.querySelectorAll('#presets button').forEach(b =>
    b.classList.toggle('active', b.dataset.preset === _urlPreset));
}
if (window.location.hash) {
  const fromHash = hashToParams(window.location.hash);
  if (fromHash) setParams(fromHash);
}
render();
syncAllSliders();
// Beim initialen Laden alle schweren Renders sofort ausführen (kein Delay)
const _initP = getParams(), _initR = berechne(_initP);
renderEstKurve(_initP);
_renderLafferNow(_initP);
renderIncomeDist(_initR, _initP);
renderRenten(_initP, _initR);
renderSchuldenpfad(_initR);
renderChallenges(_initR);
renderWissenschaftsPanel(_initP);
renderRechenweg(_initR, _initP);
injectTooltips();
updateScenarioModeUI();

// Rechenweg-Panel: bei Aufklappen rendern
document.getElementById('csv-export-btn').addEventListener('click', exportCSV);
document.getElementById('share-btn').addEventListener('click', copyShareLink);
document.getElementById('undo-btn').addEventListener('click', undoHistory);
document.getElementById('save-a-btn').addEventListener('click', () => enterScenarioMode('A'));
document.getElementById('save-b-btn').addEventListener('click', () => enterScenarioMode('B'));

// Mobile Controls Toggle
document.getElementById('mobile-toggle-btn').addEventListener('click', () => {
  const sidebar = document.getElementById('controls-sidebar');
  const label = document.getElementById('mobile-toggle-label');
  const icon = document.getElementById('mobile-toggle-icon');
  const hidden = sidebar.classList.toggle('mobile-hidden');
  label.textContent = hidden ? 'Regler anzeigen' : 'Regler ausblenden';
  icon.textContent = hidden ? '+' : '−';
});

document.getElementById('rw-details').addEventListener('toggle', function() {
  const hint = this.querySelector('.rw-hint');
  if (this.open) {
    hint.textContent = '▾ zuklappen';
    renderRechenweg(berechne(getParams()), getParams());
  } else {
    hint.textContent = '▸ aufklappen';
  }
});
// ============================================================
// ONBOARDING
// ============================================================

function closeOnboarding() {
  const el = document.getElementById('onboarding-overlay');
  if (el) el.style.display = 'none';
  localStorage.setItem('kassensturz_visited_v2', '1');
}

// Close onboarding by clicking the dark backdrop (not the card itself)
// Must use setTimeout 0 — overlay element is parsed AFTER this script block
setTimeout(() => {
  const ov = document.getElementById('onboarding-overlay');
  if (ov) ov.addEventListener('click', function(e) {
    if (e.target === this) closeOnboarding();
  });
}, 0);

function startWith(preset) {
  closeOnboarding();
  pushHistory();
  document.querySelectorAll('#presets button').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`[data-preset="${preset}"]`);
  if (btn) btn.classList.add('active');
  setParams(PRESETS[preset]);
  render();
}

(function initOnboarding() {
  // Use _hadInitialHash (captured before render() adds a hash via replaceState)
  if (!localStorage.getItem('kassensturz_visited_v2') && !_hadInitialHash) {
    setTimeout(() => {
      const el = document.getElementById('onboarding-overlay');
      if (el) el.style.display = 'flex';
    }, 300);
  }
})();


// ============================================================
// RESULT CARD (Canvas export) — multi-format, multi-theme
// ============================================================

let _cardTheme = 'dark';

function openCardModal() {
  document.getElementById('csp-modal').style.display = 'flex';
}
function closeCardModal() {
  document.getElementById('csp-modal').style.display = 'none';
}
function setCardTheme(theme) {
  _cardTheme = theme;
  document.getElementById('csp-dark').classList.toggle('active', theme === 'dark');
  document.getElementById('csp-light').classList.toggle('active', theme === 'light');
  const bg = theme === 'dark' ? '#1a1814' : '#f4f1ea';
  document.querySelectorAll('.csp-preview').forEach(el => { el.style.background = bg; });
}
function pickCardStyle(fmt) {
  closeCardModal();
  downloadResultCard(fmt, _cardTheme);
}

function _cardColors(theme) {
  if (theme === 'light') return {
    bg: '#f4f1ea', text: '#1a1814', muted: '#6b6359', accent: '#c8401f',
    good: '#1e5f3a', bad: '#c8401f',
    cellBg: 'rgba(26,24,20,0.04)', cellBorder: 'rgba(26,24,20,0.10)',
    rule: 'rgba(26,24,20,0.14)', subrule: 'rgba(26,24,20,0.08)',
    url: 'rgba(107,99,89,0.7)',
  };
  return {
    bg: '#1a1814', text: '#fbf9f4', muted: '#6b6359', accent: '#c8401f',
    good: '#5cc888', bad: '#e85840',
    cellBg: 'rgba(251,249,244,0.04)', cellBorder: 'rgba(251,249,244,0.09)',
    rule: 'rgba(251,249,244,0.12)', subrule: 'rgba(251,249,244,0.07)',
    url: 'rgba(107,99,89,0.75)',
  };
}

function _cardKpis(r, p) {
  return [
    { label: 'STAATSSALDO',      val: (r.saldo >= 0 ? '+' : '') + r.saldo.toFixed(0) + ' Mrd. €',    good: r.saldo > -30,          bad: r.saldo < -80 },
    { label: 'GINI-KOEFFIZIENT', val: r.gini.toFixed(3).replace('.', ','),                            good: r.gini < 0.28,          bad: r.gini > 0.32 },
    { label: 'ARMUTSRISIKO',     val: r.armutsrisiko.toFixed(1).replace('.', ',') + ' %',             good: r.armutsrisiko < 8,     bad: r.armutsrisiko > 14 },
    { label: 'VERWALTUNG',       val: r.admin_kosten.toFixed(0) + ' Mrd. €',                          good: r.admin_kosten < 110,   bad: r.admin_kosten > 140 },
    { label: 'SPITZENSTEUERSATZ',val: p.spitze + ' %',                                                good: null,                   bad: null },
    { label: 'CO₂-PREIS',        val: p.co2 + ' €/t',                                                good: p.co2 >= 80,            bad: p.co2 < 30 },
  ];
}

function downloadResultCard(fmt = 'landscape', theme = 'dark') {
  const r = _lastResult, p = _lastParams;
  if (!r || !p) return;

  const activeBtn = document.querySelector('#presets button.active');
  const scenarioName = activeBtn ? activeBtn.textContent.trim().replace(/\u00A0/g, ' ') : 'Eigenes Szenario';
  const btn = document.getElementById('card-btn');
  btn.textContent = '…'; btn.disabled = true;

  const SIZES = { landscape: [1200, 628], square: [1080, 1080], story: [720, 1280] };
  const [W, H] = SIZES[fmt];

  document.fonts.ready.then(() => {
    const canvas = document.getElementById('share-canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const C = _cardColors(theme);
    const mono = '"DM Mono", monospace';
    const serif = '"Fraunces", Georgia, serif';
    const kpis = _cardKpis(r, p);
    const shareUrl = 'kassensturz.de';
    const note = berechneGesamtnote(r);

    // ── BACKGROUND ──
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Radial glow accent
    const glow = ctx.createRadialGradient(W * 0.18, H * 0.28, 0, W * 0.18, H * 0.28, W * 0.5);
    glow.addColorStop(0, theme === 'dark' ? 'rgba(200,64,31,0.07)' : 'rgba(200,64,31,0.05)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

    // Left accent bar
    ctx.fillStyle = C.accent;
    ctx.fillRect(0, 0, Math.round(W * 0.004), H);

    const pad = Math.round(W * 0.04);

    if (fmt === 'landscape') {
      // ── LANDSCAPE LAYOUT ──
      const lPad = 48;

      ctx.fillStyle = C.accent;
      ctx.font = `600 11px ${mono}`;
      ctx.fillText('KASSENSTURZ · HAUSHALTSSPIEL', lPad, 50);
      ctx.fillStyle = C.muted; ctx.textAlign = 'right';
      ctx.font = `10px ${mono}`;
      ctx.fillText(shareUrl, W - lPad, 50);
      ctx.textAlign = 'left';

      ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(lPad, 64); ctx.lineTo(W - lPad, 64); ctx.stroke();

      // Scenario name
      ctx.fillStyle = C.text;
      const nameSize = scenarioName.length > 20 ? 44 : 54;
      ctx.font = `800 ${nameSize}px ${serif}`;
      ctx.fillText(scenarioName, lPad, 140);

      ctx.fillStyle = C.muted;
      ctx.font = `italic 14px ${serif}`;
      ctx.fillText('Dein Steuersystem für Deutschland 2025', lPad, 166);

      // Grade badge top-right
      const gx = W - lPad - 80, gy = 90;
      ctx.fillStyle = C.cellBg; ctx.fillRect(gx, gy, 80, 68);
      ctx.strokeStyle = C.cellBorder; ctx.lineWidth = 0.8; ctx.strokeRect(gx, gy, 80, 68);
      ctx.fillStyle = C.muted; ctx.font = `9px ${mono}`; ctx.textAlign = 'center';
      ctx.fillText('GESAMTNOTE', gx + 40, gy + 17);
      ctx.fillStyle = C.text; ctx.font = `800 36px ${serif}`;
      ctx.fillText(note.grade, gx + 40, gy + 54);
      ctx.textAlign = 'left';

      ctx.strokeStyle = C.subrule;
      ctx.beginPath(); ctx.moveTo(lPad, 184); ctx.lineTo(W - lPad, 184); ctx.stroke();

      // KPI grid 3×2
      const colW = Math.floor((W - lPad * 2 - 32) / 3);
      const rowH = 142; const gridTop = 200;
      kpis.forEach((kpi, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const x = lPad + col * (colW + 16), y = gridTop + row * (rowH + 10);
        ctx.fillStyle = C.cellBg; ctx.fillRect(x, y, colW, rowH);
        ctx.strokeStyle = C.cellBorder; ctx.lineWidth = 0.8; ctx.strokeRect(x, y, colW, rowH);
        ctx.fillStyle = C.muted; ctx.font = `500 9px ${mono}`; ctx.fillText(kpi.label, x + 14, y + 24);
        let color = C.text;
        if (kpi.good === true) color = C.good;
        if (kpi.bad === true)  color = C.bad;
        ctx.fillStyle = color; ctx.font = `800 28px ${serif}`; ctx.fillText(kpi.val, x + 14, y + 82);
      });

      ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(lPad, H - 38); ctx.lineTo(W - lPad, H - 38); ctx.stroke();
      ctx.fillStyle = C.url; ctx.font = `10px ${mono}`;
      ctx.fillText('kassensturz.de · Jetzt selbst ausprobieren', lPad, H - 18);

    } else if (fmt === 'square') {
      // ── SQUARE LAYOUT ──
      const sp = 54;

      ctx.fillStyle = C.accent; ctx.font = `600 11px ${mono}`;
      ctx.fillText('KASSENSTURZ', sp, 54);
      ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.font = `10px ${mono}`;
      ctx.fillText(shareUrl, W - sp, 54);
      ctx.textAlign = 'left';

      ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sp, 70); ctx.lineTo(W - sp, 70); ctx.stroke();

      // Big grade left, score right
      ctx.fillStyle = C.text; ctx.font = `800 120px ${serif}`;
      ctx.fillText(note.grade, sp, 212);

      ctx.fillStyle = C.muted; ctx.font = `italic 14px ${serif}`;
      ctx.fillText('Gesamtnote', sp, 240);

      // Score bar area right side
      const scoreX = W / 2 + 10;
      ctx.fillStyle = C.text; ctx.font = `800 56px ${serif}`;
      ctx.textAlign = 'right';
      ctx.fillText(note.score, W - sp, 185);
      ctx.fillStyle = C.muted; ctx.font = `11px ${mono}`;
      ctx.fillText('/ 100 PUNKTE', W - sp, 210);
      ctx.textAlign = 'left';

      // Scenario name
      ctx.fillStyle = C.text;
      ctx.font = `italic 800 28px ${serif}`;
      const snFit = scenarioName.length > 22 ? 22 : 28;
      ctx.font = `italic 800 ${snFit}px ${serif}`;
      ctx.fillText('"' + scenarioName + '"', sp, 290);

      ctx.strokeStyle = C.subrule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sp, 310); ctx.lineTo(W - sp, 310); ctx.stroke();

      // 4 KPIs in 2×2 grid
      const kpi4 = kpis.slice(0, 4);
      const colW2 = Math.floor((W - sp * 2 - 16) / 2);
      const rowH2 = 148; const gt2 = 328;
      kpi4.forEach((kpi, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = sp + col * (colW2 + 16), y = gt2 + row * (rowH2 + 12);
        ctx.fillStyle = C.cellBg; ctx.fillRect(x, y, colW2, rowH2);
        ctx.strokeStyle = C.cellBorder; ctx.lineWidth = 0.8; ctx.strokeRect(x, y, colW2, rowH2);
        ctx.fillStyle = C.muted; ctx.font = `9px ${mono}`; ctx.fillText(kpi.label, x + 14, y + 26);
        let color = C.text;
        if (kpi.good === true) color = C.good;
        if (kpi.bad === true)  color = C.bad;
        ctx.fillStyle = color; ctx.font = `800 34px ${serif}`; ctx.fillText(kpi.val, x + 14, y + 96);
      });

      ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sp, H - 40); ctx.lineTo(W - sp, H - 40); ctx.stroke();
      ctx.fillStyle = C.url; ctx.font = `10px ${mono}`;
      ctx.fillText('kassensturz.de · Haushaltsspiel Deutschland 2025', sp, H - 18);

    } else {
      // ── STORY / PORTRAIT LAYOUT ──
      const sp = 54;

      // Accent header band
      ctx.fillStyle = C.accent;
      ctx.fillRect(0, 0, W, 8);

      ctx.fillStyle = C.accent; ctx.font = `600 11px ${mono}`; ctx.textAlign = 'center';
      ctx.fillText('KASSENSTURZ · HAUSHALTSSPIEL DEUTSCHLAND', W / 2, 56);
      ctx.textAlign = 'left';

      ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sp, 72); ctx.lineTo(W - sp, 72); ctx.stroke();

      // Big grade centered
      ctx.fillStyle = C.text; ctx.font = `800 140px ${serif}`; ctx.textAlign = 'center';
      ctx.fillText(note.grade, W / 2, 240);
      ctx.fillStyle = C.muted; ctx.font = `600 13px ${mono}`; ctx.textAlign = 'center';
      ctx.fillText(note.score + ' VON 100 PUNKTEN', W / 2, 272);
      ctx.textAlign = 'left';

      ctx.strokeStyle = C.subrule;
      ctx.beginPath(); ctx.moveTo(sp, 292); ctx.lineTo(W - sp, 292); ctx.stroke();

      // Scenario name
      ctx.fillStyle = C.text; ctx.textAlign = 'center';
      const szS = scenarioName.length > 18 ? 30 : 38;
      ctx.font = `800 italic ${szS}px ${serif}`;
      ctx.fillText('"' + scenarioName + '"', W / 2, 360);
      ctx.fillStyle = C.muted; ctx.font = `italic 13px ${serif}`;
      ctx.fillText('Dein Steuersystem für Deutschland', W / 2, 390);
      ctx.textAlign = 'left';

      ctx.strokeStyle = C.subrule;
      ctx.beginPath(); ctx.moveTo(sp, 416); ctx.lineTo(W - sp, 416); ctx.stroke();

      // 6 KPIs stacked
      const kpiH = 114, kpiTop = 436;
      kpis.forEach((kpi, i) => {
        const y = kpiTop + i * (kpiH + 8);
        ctx.fillStyle = C.cellBg; ctx.fillRect(sp, y, W - sp * 2, kpiH);
        ctx.strokeStyle = C.cellBorder; ctx.lineWidth = 0.8;
        ctx.strokeRect(sp, y, W - sp * 2, kpiH);
        ctx.fillStyle = C.muted; ctx.font = `9px ${mono}`; ctx.fillText(kpi.label, sp + 16, y + 26);
        let color = C.text;
        if (kpi.good === true) color = C.good;
        if (kpi.bad === true)  color = C.bad;
        ctx.fillStyle = color; ctx.font = `800 30px ${serif}`; ctx.fillText(kpi.val, sp + 16, y + 76);
      });

      ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sp, H - 48); ctx.lineTo(W - sp, H - 48); ctx.stroke();
      ctx.fillStyle = C.url; ctx.font = `10px ${mono}`; ctx.textAlign = 'center';
      ctx.fillText('kassensturz.de · Jetzt dein Steuersystem gestalten', W / 2, H - 24);
      ctx.textAlign = 'left';
    }

    const link = document.createElement('a');
    link.download = `kassensturz-${fmt}-${theme}-${scenarioName.toLowerCase().replace(/[\s/]+/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    btn.textContent = '✓ Gespeichert'; btn.disabled = false;
    setTimeout(() => { btn.textContent = 'Bild speichern'; }, 2000);
  });
}

document.getElementById('card-btn').addEventListener('click', openCardModal);


(function() {
  const TIPS = {
    freibetrag: "Bis zu diesem Betrag bleibt Einkommen steuerfrei. Ein höherer Freibetrag entlastet alle Steuerpflichtigen – relativ am meisten profitieren Geringverdiener.",
    eingang:    "Der erste Steuersatz auf Einkommen über dem Freibetrag. Laut IZA-Studien dämpfen hohe Eingangssätze besonders die Arbeitsbereitschaft bei Geringverdienern.",
    spitze:     "Höchster Steuersatz für Topverdiener. OECD-Analysen zeigen: Sätze bis ~60 % beeinflussen das Wirtschaftswachstum kaum, erhöhen aber die Staatseinnahmen spürbar.",
    grenze:     "Ab diesem Einkommen gilt der Spitzensteuersatz. Eine niedrigere Grenze erfasst mehr Menschen – sie liegt derzeit bei ca. dem 4-fachen Medianeinkommen.",
    abgeltung:  "Pauschalsteuer auf Kapitalerträge statt des persönlichen Steuersatzes. Ökonomen kritisieren: das begünstigt Kapitaleinkommen strukturell gegenüber Arbeitseinkommen.",
    kst:        "Steuer auf Unternehmensgewinne. Bei zu hohen Sätzen verlagern Konzerne Gewinne ins Ausland – die OECD-Mindeststeuer von 15 % soll das eindämmen.",
    gewst:      "Kommunale Unternehmenssteuer – wichtigste eigene Einnahmequelle der Gemeinden. Sie variiert je nach gemeindlichem Hebesatz erheblich.",
    mwst:       "Konsumsteuer auf fast alle Waren und Dienstleistungen. Wirkt regressiv: einkommensschwache Haushalte zahlen anteilig deutlich mehr davon als Gutverdiener.",
    mwst_erm:   "Gilt für Lebensmittel, Bücher und andere Grundbedürfnisse. Niedrigere Sätze hier entlasten einkommensschwache Haushalte überproportional stark.",
    co2:        "Preis pro Tonne CO₂-Ausstoß. Laut Klimaökonomen der kosteneffizienteste Hebel zur Emissionsreduktion – eine Rückerstattung als Klimageld macht ihn sozial ausgewogen.",
    erb:        "Steuer auf geerbtes Vermögen. Studien zeigen: Erbschaften sind heute die größte Quelle von Vermögensungleichheit – höhere Sätze könnten das bremsen.",
    boden:      "Jahressteuer auf den reinen Grundstückswert ohne Bebauung. Gilt als besonders effizient, da Boden nicht vermehrt werden kann – fördert Nutzung statt Spekulation.",
    verm:       "Jährliche Steuer auf Gesamtvermögen ab 2 Mio. €. Kann Vermögensungleichheit bremsen, erfordert aber aufwändige Bewertung von Immobilien und Betriebsvermögen.",
    zucman:     "Globale Mindeststeuer auf Milliardärsvermögen nach Gabriel Zucman. Würde Kapitalflucht erschweren – setzt jedoch internationale Kooperation voraus.",
    rv:         "Gesamter Rentenbeitrag von Arbeitnehmer und Arbeitgeber zusammen. Höhere Beiträge sichern Renten, erhöhen aber die Lohnnebenkosten und senken den Nettolohn.",
    kv:         "Beitragssatz zur gesetzlichen Krankenversicherung. Steigende Kosten durch Alterung und medizinischen Fortschritt treiben diesen Satz langfristig nach oben.",
    alpf:       "Kombinierter Beitrag für Arbeitslosen- und Pflegeversicherung. Der Pflegeanteil wächst demografisch besonders stark – Experten erwarten bis 2035 deutliche Anstiege.",
    bbg:        "Bis zu diesem Einkommen werden Sozialbeiträge erhoben. Darüber zahlt man nichts mehr – was Gutverdiener relativ stark entlastet gegenüber Normalverdienern.",
    bge:        "Monatlicher Grundeinkommensbetrag pro Person. Pilotstudien in Finnland und den USA zeigen: BGE verbessert psychisches Wohlbefinden mit kaum negativem Effekt auf Arbeitsbereitschaft.",
    bg:         "Monatliche Grundsicherung für Menschen ohne ausreichendes Einkommen. Studien belegen: ausreichende Grundsicherung reduziert Armut und Obdachlosigkeit effektiv.",
    kg:         "Monatliche Zahlung pro Kind, unabhängig vom Einkommen. Direktes Kindergeld gilt laut Forschung als eines der kosteneffizientesten Mittel gegen Kinderarmut.",
    kapitalquote: "Anteil der Rentenbeiträge, der am Kapitalmarkt angelegt wird. Höhere Rendite möglich, aber auch Marktrisiko – Schweden und Norwegen setzen solche Modelle ein.",
    rendite_fonds: "Langfristig erwartete Rendite eines breit diversifizierten Aktienportfolios. Der MSCI World erzielte historisch ~7–8 % p.a. – für die Zukunft ist das nicht garantiert.",
    startjahr:  "Ab diesem Jahr werden Fondsmittel angespart. Früherer Start nutzt den Zinseszinseffekt stärker – selbst wenige Jahre Unterschied machen Milliarden aus.",
    anzahl_kv:  "Weniger Kassen bedeuten geringere Verwaltungskosten, aber weniger Wettbewerb. Aktuelle Forschung legt eine optimale Zahl von ca. 20–40 Kassen nahe.",
    praevention: "Investitionen in Gesundheitsprävention senken langfristig Behandlungskosten. WHO-Analysen zeigen: 1 € Prävention spart langfristig 3–5 € an Folgekosten.",
    rente_niveau_gering: "Ziel-Rentenniveau für Menschen mit niedrigem früherem Einkommen (in % des früheren Nettoeinkommens). BGE liefert den Sockel – die Rente stockt nur noch auf dieses Niveau auf.",
    rente_niveau_hoch:   "Ziel-Rentenniveau für Gutverdiener (% des früheren Nettoeinkommens). Höhere Einkommen erreichen durch BGE+Rente zusammen einen kleineren prozentualen Ersatz – ähnlich dem Schweizer Modell.",
    rente_grenze:        "Einkommensgrenze zwischen 'Geringverdienern' und 'Gutverdienern'. Beeinflusst wie viele Rentner in welche Gruppe fallen und damit die Höhe der RV-Einsparung."
  };

  const tooltip = document.getElementById('slider-tooltip');
  const toggleEl = document.getElementById('toggle_slider_tips');
  let hideTimer;

  function show(input) {
    if (toggleEl && !toggleEl.checked) return;
    const text = TIPS[input.id];
    if (!text) return;
    clearTimeout(hideTimer);
    tooltip.textContent = text;
    tooltip.classList.add('visible');
    reposition(input);
  }

  function reposition(input) {
    const rect = input.getBoundingClientRect();
    const tw = tooltip.offsetWidth || 240;
    const th = tooltip.offsetHeight || 60;
    let left = rect.left + 12;
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    const top = rect.top - th - 10;
    tooltip.style.left = left + 'px';
    tooltip.style.top = (top < 8 ? rect.bottom + 10 : top) + 'px';
  }

  function hide() {
    hideTimer = setTimeout(() => tooltip.classList.remove('visible'), 80);
  }

  if (toggleEl) {
    toggleEl.addEventListener('change', () => { if (!toggleEl.checked) hide(); });
  }

  document.querySelectorAll('input[type="range"]').forEach(input => {
    if (!TIPS[input.id]) return;
    input.addEventListener('mouseenter', () => show(input));
    input.addEventListener('mousemove',  () => reposition(input));
    input.addEventListener('mouseleave', hide);
    input.addEventListener('focus',      () => show(input));
    input.addEventListener('blur',       hide);
    input.addEventListener('input',      () => reposition(input));
    input.addEventListener('touchstart', () => show(input), { passive: true });
    input.addEventListener('touchend',   () => setTimeout(hide, 1200));
  });
})();

// ── MODUL-SYSTEM ─────────────────────────────────────────


// ── 14. MODULE-SYSTEM & INIT ──


// Welche Module sind gerade aktiv (sichtbar)?
const activeModules = new Set(['est','kst','mwst','co2']);

let kpiMoreOpen = false;
function toggleKPIMore() {
  kpiMoreOpen = !kpiMoreOpen;
  document.querySelectorAll('.kpi-secondary').forEach(el => el.classList.toggle('kpi-shown', kpiMoreOpen));
  const toggle = document.getElementById('kpi-more-toggle');
  const chevron = document.getElementById('kpi-more-chevron');
  toggle.childNodes[0].textContent = kpiMoreOpen ? '6 weitere ausblenden ' : '6 weitere Metriken ';
  chevron.textContent = kpiMoreOpen ? '▲' : '▼';
}

function applyModules() {
  document.querySelectorAll('[data-mod]').forEach(el => {
    const id = el.dataset.mod;
    if (!id || !MOD_DEFS[id]) return;
    const wasHidden = el.style.display === 'none';
    const shouldShow = activeModules.has(id);
    el.style.display = shouldShow ? '' : 'none';
    if (shouldShow && wasHidden) {
      el.classList.remove('mod-appeared');
      void el.offsetWidth;
      el.classList.add('mod-appeared');
    }
  });
}

let pickerType = 'control';

function openPicker(type) {
  pickerType = type;
  const overlay = document.getElementById('mod-overlay');
  const title   = document.getElementById('mod-drawer-title');
  const sub     = document.getElementById('mod-drawer-sub');
  title.textContent = type === 'control' ? 'Regler-Module hinzufügen' : 'Darstellungen hinzufügen';
  sub.textContent   = type === 'control' ? 'Welche Parameter möchtest du steuern?' : 'Welche Auswertungen möchtest du sehen?';
  renderModGrid(type);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePicker(e) {
  if (e && e.target !== document.getElementById('mod-overlay')) return;
  document.getElementById('mod-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function renderModGrid(type) {
  const grid = document.getElementById('mod-grid');
  const entries = Object.entries(MOD_DEFS).filter(([,d]) => d.type === type);
  grid.innerHTML = entries.map(([id, d]) => `
    <div class="mod-card ${activeModules.has(id) ? 'active' : ''}" onclick="toggleMod('${id}')">
      <div class="mod-card-name">${d.name}</div>
      <div class="mod-card-desc">${d.desc}</div>
      <span class="mod-card-level ${d.level}">${d.level === 'ein' ? 'Einsteiger' : d.level === 'fort' ? 'Fortgeschritten' : 'Experte'}</span>
    </div>
  `).join('');
}

function toggleMod(id) {
  if (activeModules.has(id)) {
    // Immer mindestens 1 Ergebnis-Modul sichtbar lassen
    const resultActive = [...activeModules].filter(m => MOD_DEFS[m]?.type === 'result');
    const controlActive = [...activeModules].filter(m => MOD_DEFS[m]?.type === 'control');
    if (MOD_DEFS[id].type === 'result' && resultActive.length <= 1) return;
    if (MOD_DEFS[id].type === 'control' && controlActive.length <= 1) return;
    activeModules.delete(id);
  } else {
    activeModules.add(id);
  }
  applyModules();
  renderModGrid(pickerType);
}

// Initial anwenden
applyModules();
