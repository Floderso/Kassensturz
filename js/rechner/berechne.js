// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
import { DEZILE, ELAST, BASIS_MAKRO, STAATSAUSGABEN, PRESETS, BASIS_AUFKOMMEN, ADMIN_QUOTE, AUSGABEN_TOTAL, BGE_LABOR_EFF, PERIOD_STATE_0 } from '../data.js';
import { estTarif, grenzsteuersatz } from './einkommensteuer.js';
import { berechneGini, berechneMedianGewichtet, berechnePalma, berechneDezilDelta, berechneNettoSQ } from './verteilung.js';

// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Hauptsimulation
// Abhängigkeiten (Ladereihenfolge beachten):
//   data.js               → DEZILE, BASIS_AUFKOMMEN, ADMIN_QUOTE, ELAST, STAATSAUSGABEN
//   rechner/einkommensteuer.js → estTarif, grenzsteuersatz
//   rechner/verteilung.js → berechneDezilDelta, berechneGini, berechnePalma,
//                           berechneMedianGewichtet, berechneNettoSQ
// ═══════════════════════════════════════════════════════

// Quellenmetadaten — zentrale Berechnungsannahmen
const FORMEL_QUELLEN_BERECHNE = {
  arbeitsangebot: {
    formel: 'labor_factor = 1 + ε × Δ(1 − GS) / (1 − GS_SQ)',
    ref:    'Saez/Chetty/Gruber Konsens · ifo Schnelldienst 01/2025 · Piketty/Saez/Stantcheva (2014) AER',
    note:   'ε = 0,20 (intensive margin, konservativ); D10c: ε = 0,40 + Avoidance/Wegzug-Korrektur'
  },
  bge_arbeitsangebot: {
    formel: 'lf = lf_tax × (1 − BGE_LABOR_EFF[i] × min(1,67; BGE/1200))',
    ref:    'RWI (2024) bis −30 % bei 1.500 € · DIW Pilot 2024 (n=107) · ZEW Heim et al. (extensiver Margin) · ifo Mikrosimulation 2021',
    note:   'Skaliert mit BGE/1.200 und Dezil; D1: −15 %, D10a–c: 0 %'
  },
  mwst_konsumanteil: {
    formel: 'MwSt = Konsum × (0,70 × t_reg/(1+t_reg) + 0,30 × t_erm/(1+t_erm))',
    ref:    'Destatis VGR 2024 (ca. 70 % Regelsatz-Konsum) · Lewbel/Pendakur (2009) JPubEc',
    note:   '70/30-Split grob; feiner auflösbar mit EVS-Einzeldaten. VAT-Gap-Korrekturfaktor 0,963 (CASE 2024)'
  },
  co2_emissionen: {
    formel: 'Emissionen = 500 × max(0,4; min(1,1; 1 + ε_CO₂ × (p − 55)/100))',
    ref:    'BEHG § 10 · EWI/DIW BEHG-Evaluation 2023 · Edenhofer/PIK 2024',
    note:   'Basis 500 Mio. t im Bepreisungsbereich; ε_CO₂ = −0,30 (kurzfristig konservativ)'
  },
  erbschaft: {
    formel: 'Erb_auf = Masse_top × Satz_eff + Masse_unten × min(Satz,15%)/2',
    ref:    'Bach/Sinclair/Bührle/Wichers DIW 2025 · §§ 10, 19 ErbStG · BRH 2016',
    note:   'Erbschaftsmasse ~400 Mrd./Jahr; Top 60 % erben ~60 %. Betriebsvermögen-Ausnahme: eff. Satz × 0,3'
  },
  zucman: {
    formel: 'Zucman_auf = 2.870 × Satz% × (1 − 0,15 × min(1; Satz/2))',
    ref:    'Zucman G20 Report 2024 · EU Tax Observatory 2024 · Jakobsen/Kleven/Kolsrud NBER 2024',
    note:   'Basis D10c: 0,41 Mio. HH × 7 Mio. € Median-Vermögen = ~2.870 Mrd. €; Avoidance 15 % bei 2 %'
  },
  sv_beitraege: {
    formel: 'SV = Lohnsumme_sv × Satz%  (nur bis BBG)',
    ref:    '§ 158 SGB VI · § 241 SGB V · § 341 SGB III · § 55 SGB XI · DRV Beitragssätze 2025',
    note:   'BBG-Lohnsummen-Faktor: +12 % je 90 k € BBG-Erhöhung (12 % der sozialversicherungspflichtigen Löhne)'
  },
  verwaltungskosten: {
    formel: 'Admin = ∑ Aufkommen_i × Quote_i  (ADMIN_QUOTE je Steuer)',
    ref:    'BRH Jahresberichte · OECD Tax Administration 2024 · Normenkontrollrat Jahresbericht 2024',
    note:   'BGE-Verwaltungskosten 0,8 % (kein Bedürftigkeitstest vs. 5 % Bürgergeld, RWI 2024)'
  },
  deadweight_loss: {
    formel: 'DWL = ∑ᵢ 0,5 × ε × GS_i² / (1 − GS_i) × Lohnsumme_i  (Harberger-Dreieck je Dezil)',
    ref:    'Harberger (1964) · Saez (2001) JPubEc · Chetty (2009) AER P&P',
    note:   'M2: Dezil-Summierung statt Durchschnitts-GS — Jensen-Ungleichung: E[GS²] ≥ E[GS]²'
  },
  dynamisches_scoring: {
    formel: 'Δ_dyn = Δ_KSt × (investment_factor − 1) + Δ_ESt × (avg_labor − 1)',
    ref:    'CBO Dynamic Scoring Guidelines · ifo Schnelldienst 01/2025 · Saez/Chetty Konsens',
    note:   'Verhaltensbedingte Aufkommensabweichung gegenüber mechanischer (statischer) Wirkung'
  }
};


function berechne(params, zustand = null) {
  // Periodenübergreifender Zustand für Multi-Perioden-Simulation
  const bip_faktor       = zustand ? zustand.bip / BASIS_MAKRO.bip : 1.0;
  const renten_faktor    = zustand ? (zustand.renten_faktor    ?? 1.0) : 1.0;
  const lohnbasis_faktor = zustand ? (zustand.lohnbasis_faktor ?? 1.0) : 1.0;

  // Dynamische Zinslast: im Multi-Perioden-Modus aus aktuellem Schuldenstand ableiten.
  // Effektivzins SQ: 30 Mrd. / (64 % × 4.200 Mrd.) ≈ 1,12 % (Altschulden nahe 0 %, Rollover ~2,5 %)
  const schuld_sq_mrd = PERIOD_STATE_0.schuldenquote / 100 * PERIOD_STATE_0.bip; // 2.688 Mrd.
  const zins_effektivrate = STAATSAUSGABEN.zinsen / schuld_sq_mrd;               // ≈ 0.01116
  const zinsen_dyn = zustand
    ? (zustand.schuldenquote / 100 * zustand.bip) * zins_effektivrate
    : STAATSAUSGABEN.zinsen;

  // ---------- 1. ARBEITSANGEBOT-REAKTION pro Dezil ----------
  // Basisgrenzsteuersatz-Vergleich zum Status Quo
  const sqGrenze = dez => grenzsteuersatz(dez.brutto*(1-dez.kapital), 12084, 14, 45, 277826);

  // BGE-Arbeitsangebotseffekt (Substitutionseffekt: höherer Reservationslohn)
  // Quellen: RWI 2024 (bis −30 % bei 1.500 €), DIW Pilot 2024 (−2 % kurzfristig, n=107),
  // ZEW Heim et al. (extensiver Margin D1–D4), ifo Mikrosimulation 2021.
  // Kompromiss: deutlicher Effekt bei unteren Dezilen, minimal bei oberen.
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
  const investment_factor = 1 + ELAST.investment * ((params.kst + (params.gewst_aus ? 0 : params.gewst))/100 - 0.30);
  const gewinn = BASIS_MAKRO.gewinn * bip_faktor * Math.max(0.7, Math.min(1.2, investment_factor));
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
    const bbg_kv_mwst = params.kv_bbg_frei ? Infinity : Math.round((params.bbg ?? 90000) * (BASIS_MAKRO.kv_bbg_kv_sq / 90000));
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
  const co2_factor = 1 + ELAST.co2 * ((params.co2 - 55) / 100);
  const emissionen = BASIS_MAKRO.emissions * Math.max(0.4, Math.min(1.1, co2_factor));
  const co2_auf = emissionen * params.co2 / 1000;
  const klimageld_auszahlung = params.klimageld ? co2_auf * 0.7 : 0; // 70% zurück als Klimageld

  // ---------- 6. VERMÖGEN / ERBSCHAFT / BODEN ----------
  const erb_satz_eff = params.erb * (params.betriebs ? 0.3 : 0.9) / 100;
  const erb_auf = BASIS_MAKRO.erb_masse * 0.6 * erb_satz_eff
                + BASIS_MAKRO.erb_masse * 0.4 * Math.min(params.erb, 15) / 100 * 0.5;
  const boden_auf = BASIS_MAKRO.boden_wert * params.boden / 100;
  const verm_auf  = BASIS_MAKRO.verm_basis  * params.verm  / 100;

  // ---------- 7. SV-BEITRÄGE ----------
  const bbg = params.bbg ?? 90000;
  // BBG-Erhöhung: ~12% der sozialversicherungspflichtigen Löhne liegt zwischen 90k und 160k
  const bbg_lohnsumme_factor = 1 + Math.max(0, (bbg - 90000) / 90000) * 0.12;
  const lohnsumme_sv = BASIS_MAKRO.lohnsumme_sv * lohnbasis_faktor * bbg_lohnsumme_factor;
  const buerger_boost = params.buergerv ? 1.15 : 1.0;
  const rv_auf = lohnsumme_sv * params.rv / 100;
  // kv_bbg_frei/kv_kapital: Aufkommensschätzung skaliert mit aktuellem KV-Satz (ifo 159/2025, DIW)
  const kv_bbg_frei_bonus = params.kv_bbg_frei ? BASIS_MAKRO.kv_bbg_frei_bonus * (params.kv / 16.3) : 0;
  const kv_kapital_bonus  = params.kv_kapital  ? BASIS_MAKRO.kv_kapital_bonus  * (params.kv / 16.3) : 0;
  const kv_auf = lohnsumme_sv * params.kv / 100 * buerger_boost + kv_bbg_frei_bonus + kv_kapital_bonus;
  const al_auf = lohnsumme_sv * params.alpf / 100;

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
  // renten_faktor: demografisch bedingte Mehrkosten (Baby-Boomer-Rentenwelle, Destatis 2021)
  const rv_ausgaben_basis = BASIS_MAKRO.rv_ausgaben_sq * (params.rv / 18.6) * renten_faktor;
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
  // Demografieaufschlag: steigende RV-Ausgaben durch Alterung (RV-Anteil ~390 Mrd.)
  const demografie_aufschlag = 390 * (renten_faktor - 1.0);
  // invest_impuls: zusätzliche öffentliche Investitionen (Mrd./Jahr, reduziert Saldo)
  const invest_impuls = params.invest_impuls || 0;
  const ausgaben_total = AUSGABEN_TOTAL + bg_auszahlung + kg_auszahlung + neg_est_auszahlung + bge_brutto + admin_kosten - STAATSAUSGABEN.verwaltung - STAATSAUSGABEN.zinsen + zinsen_dyn - rv_einsparung + sv_ausgaben_delta + demografie_aufschlag + invest_impuls;

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
  const gini = berechneGini(hh_delta.netto, dezile);
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
  // Kontinuierliches Intra-Dezil-Modell — kalibriert auf EU-SILC DE 2023 (14,8 %)
  // Intra-Dezil-Armutsanteile SQ: D1 90 %, D2 62 %, D3 5 % (SOEP v40, IAB Kurzbericht 2024)
  // Dezil-Durchschnitte überschätzen Nettoeinkommen des untersten Quintils → binärer Schwellen-
  // ansatz würde armutsrisiko ≈ 0 % ergeben. Power-Law-Approximation bildet Streuung ab.
  const POV_SQ = [0.90, 0.62, 0.05, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const netto_sq_all = dezile.map(d => berechneNettoSQ(d));
  const median_netto = berechneMedianGewichtet(hh_delta.netto, dezile);
  const poverty_line = median_netto * 0.60;
  const poverty_line_sq = berechneMedianGewichtet(netto_sq_all, dezile) * 0.60;
  const total_hh_all = dezile.reduce((a,d)=>a+d.anzahl,0);
  const armutsrisiko = dezile.reduce((acc, d, i) => {
    const pov_sq_i = POV_SQ[i];
    if (pov_sq_i === 0) return acc;
    // Relative Einkommensveränderung, bereinigt um Verschiebung der relativen Armutsgrenze
    const rel = (hh_delta.netto[i] / netto_sq_all[i]) / (poverty_line / poverty_line_sq);
    // Elastizität −1,5: Einkommensstieg +1 % → Armutsanteil −1,5 % (Bourguignon 2003, DE-kalibriert)
    const pov_i = Math.max(0, Math.min(1, pov_sq_i * Math.pow(rel, -1.5)));
    return acc + pov_i * d.anzahl;
  }, 0) / total_hh_all * 100;

  // ---------- 19. SCHULDENQUOTE Δ ----------
  const bip_aktuell = BASIS_MAKRO.bip * bip_faktor;
  const schuldenquote_delta = -(saldo / bip_aktuell) * 100;

  // ---------- 20. METR (Marginal Effective Tax Rate) je Dezil ----------
  // METR = ESt-Grenzsteuersatz + SV-Grenzbelastung (AN-Anteil) + Transfer-Entzug
  const metr = dezile.map((d, i) => {
    const brutto = d.brutto_adj;
    const arbeit = brutto * (1 - d.kapital);
    const gs_est = grenzsteuersatz(arbeit, params.freibetrag, params.eingang, params.spitze, params.grenze);
    // K3: Separate BBG für KV/PV (62.100 €) und RV/AL (params.bbg).
    // RV+AL Grenzbelastung fällt weg sobald Arbeitseinkommen ≥ RV-BBG
    const bbg_rv_m = params.bbg ?? 90000;
    const bbg_kv_m = Math.round(bbg_rv_m * (BASIS_MAKRO.kv_bbg_kv_sq / 90000));
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
  const saldo_bip_pct = saldo / bip_aktuell * 100;
  const schuldenbremse_ok = saldo_bip_pct >= -0.35;

  // ---------- 19c. DYNAMISCHES SCORING ----------
  // Verhaltensbedingte Aufkommensänderung gegenüber mechanischer (statischer) Wirkung
  // KSt: investment_factor-Abweichung von 1 = Investitionsreaktion auf KSt-Änderung
  const dynamisch_kst = BASIS_MAKRO.gewinn * bip_faktor * params.kst / 100 * (investment_factor - 1);
  // ESt: labor_factor-Abweichung → Arbeitsangebotsreaktion (Saez/Chetty-Konsens ε = 0,20)
  const dynamisch_est = est_aufkommen * (avg_labor - 1);
  const dynamisch_delta = dynamisch_kst + dynamisch_est;

  return {
    rev, einnahmen_total, ausgaben_total, saldo, admin_kosten, nst,
    hh_delta, gini, palma, behavior, klimageld_auszahlung,
    bg_auszahlung, kg_auszahlung, neg_est_auszahlung,
    armutsrisiko, schuldenquote_delta, metr, dwl, poverty_line,
    rv_einsparung, bge_brutto,
    // Research-basierte Erweiterungen (QUELLENRECHERCHE.md)
    saldo_bip_pct, schuldenbremse_ok,
    dynamisch_kst, dynamisch_est, dynamisch_delta,
    investment_factor, avg_labor,
    // GKV-Reform-Boni (für GKV-Panel-Darstellung)
    kv_bbg_frei_bonus, kv_kapital_bonus,
    // Multi-Perioden-Felder
    emissionen, bip_aktuell, invest_impuls, demografie_aufschlag, sv_ausgaben_delta, zinsen_dyn,
  };
}

export { berechne, FORMEL_QUELLEN_BERECHNE };
