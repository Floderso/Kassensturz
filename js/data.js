// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Statische Daten & Konstanten
// ═══════════════════════════════════════════════════════

// ── DEZILE + STAATSAUSGABEN + BASIS-DATEN ──

const DEZILE = [
  // D1–D9: je 4,1 Mio. Haushalte (SOEP v40, Destatis Mikrozensus 2024)
  { d:1,  idx:0,  label:'D1',   brutto: 14000,  kapital: 0.01, konsum: 1.00, gewicht: 1.3, vermoegen: 1000,    anzahl: 4.1 },
  { d:2,  idx:1,  label:'D2',   brutto: 21000,  kapital: 0.01, konsum: 0.99, gewicht: 1.4, vermoegen: 5000,    anzahl: 4.1 },
  { d:3,  idx:2,  label:'D3',   brutto: 27000,  kapital: 0.02, konsum: 0.96, gewicht: 1.5, vermoegen: 15000,   anzahl: 4.1 },
  { d:4,  idx:3,  label:'D4',   brutto: 33000,  kapital: 0.02, konsum: 0.92, gewicht: 1.6, vermoegen: 35000,   anzahl: 4.1 },
  { d:5,  idx:4,  label:'D5',   brutto: 40000,  kapital: 0.03, konsum: 0.88, gewicht: 1.7, vermoegen: 70000,   anzahl: 4.1 },
  { d:6,  idx:5,  label:'D6',   brutto: 48000,  kapital: 0.03, konsum: 0.85, gewicht: 1.8, vermoegen: 120000,  anzahl: 4.1 },
  { d:7,  idx:6,  label:'D7',   brutto: 58000,  kapital: 0.04, konsum: 0.82, gewicht: 1.9, vermoegen: 200000,  anzahl: 4.1 },
  { d:8,  idx:7,  label:'D8',   brutto: 72000,  kapital: 0.05, konsum: 0.78, gewicht: 2.0, vermoegen: 340000,  anzahl: 4.1 },
  { d:9,  idx:8,  label:'D9',   brutto: 95000,  kapital: 0.07, konsum: 0.72, gewicht: 2.0, vermoegen: 620000,  anzahl: 4.1 },
  // D10 aufgespalten in P90–95, P95–99, Top-1% (Basis: SOEP v40, DINA-DE, DIW Vermögensbericht 2024)
  { d:10, idx:9,  label:'D10a', brutto: 125000, kapital: 0.08, konsum: 0.60, gewicht: 2.0, vermoegen: 450000,  anzahl: 2.05 },
  { d:10, idx:10, label:'D10b', brutto: 220000, kapital: 0.18, konsum: 0.52, gewicht: 2.0, vermoegen: 1500000, anzahl: 1.64 },
  { d:10, idx:11, label:'D10c', brutto: 700000, kapital: 0.45, konsum: 0.40, gewicht: 2.0, vermoegen: 7000000, anzahl: 0.41 },
];
// D10c = Top 1% (0,41 Mio. Haushalte). Brutto 700k ist Durchschnitt — echte Spitze deutlich höher.
// Kapitalanteil D10c: ~45% des Einkommens aus Kapital (DINA-DE, Bach/Buggeln 2024).

// Staatsausgaben 2025 (Gesamtstaat, grob aggregiert)
const STAATSAUSGABEN = {
  sozial:        850,  // inkl. Rente/GKV/Pflege/Bürgergeld (SV + Bund)
  gesundheit:    320,
  bildung:       180,
  verteidigung:   90,
  infrastruktur: 120,
  verwaltung:    140,
  zinsen:         30,  // Bund 2025: 30,2 Mrd. € (Finanzplan des Bundes 2025–2029, Abbildung 4)
  sonstiges:     140
};
const AUSGABEN_TOTAL = Object.values(STAATSAUSGABEN).reduce((a,b)=>a+b,0);

// Basis-Aufkommen Status Quo 2025 (Mrd. €)
// Quelle: BMF, Destatis
const BASIS_AUFKOMMEN = {
  lohnsteuer:     255,
  estveranlagt:    90,   // vE + KapESt
  mwst:           303,
  kst:             45,
  gewst:           75,
  solz_abgelt:     12,   // Abgeltung+Soli
  energie:         37,
  co2:             18,   // BEHG + EU-ETS (nationaler Anteil)
  tabak:           15,
  grundst:         16,
  erbschaft:        8,
  kfz:             10,
  sonstige:        35,   // Versicherung, Stromsteuer, Luftverkehr, etc.
  rv_beitrag:     310,
  kv_beitrag:     290,
  al_pflege:      105
};

// Makroökonomische Basiszahlen (Deutschland 2025)
// Quellen: Destatis VGR, BMF Finanzplan 2025, Deutsche Rentenversicherung Rentenbericht 2024
const BASIS_MAKRO = {
  bip:               4200,  // BIP Deutschland 2025, Mrd. €
  gewinn:             400,  // Unternehmensgewinne vor Steuern, Mrd. €
  emissions:          500,  // CO₂-beprieste Emissionen (BEHG + ETS), Mio. t
  erb_masse:          400,  // Erbschaftsmasse pro Jahr, Mrd. €
  boden_wert:        5000,  // Bodenwert Deutschland gesamt, Mrd. €
  verm_basis:        3500,  // Steuerpflichtiges Vermögen > 2 Mio €, Mrd. €
  lohnsumme_sv:      1750,  // Sozialversicherungspflichtige Lohnsumme, Mrd. €
  rv_ausgaben_sq:     430,  // RV-Gesamtausgaben inkl. Bundeszuschuss (Status quo), Mrd. €
  kv_bbg_kv_sq:     66150,  // Beitragsbemessungsgrenze KV/PV 2025, € p.a. (GKV-Beitragsbemessungsgrenze 2025)
  kv_bbg_frei_bonus:   18,  // Aufkommensgewinn kv_bbg_frei bei kv=16,3 %, Mrd. €
  kv_kapital_bonus:     8,  // Aufkommensgewinn kv_kapital bei kv=16,3 %, Mrd. €
};

// Verwaltungskosten-Quoten (% des jeweiligen Aufkommens)
// BRH, OECD Tax Admin, Normenkontrollrat
const ADMIN_QUOTE = {
  est: 0.025,        // Einkommensteuer Arbeit
  kapital: 0.06,     // komplexe Kapitaleinkünfte
  mwst: 0.010,
  kst: 0.040,
  gewst: 0.050,
  co2: 0.020,
  erbschaft: 0.080,
  grundst: 0.020,
  verm: 0.050,
  klein: 0.200,      // Kleinverbrauchsteuern sehr teuer
  sv: 0.015,
  transfer: 0.050
};

// Verhaltens-Elastizitäten (konservativ)
const ELAST = {
  labor_supply: 0.20,      // Saez/Chetty konsens
  capital_supply: 0.50,    // Kleven/Schultz
  consumption: -0.35,      // MwSt-Pass-Through
  co2: -0.30,              // BEHG Evaluation
  evasion: 0.25,           // Schneider
  investment: -0.40,       // Unternehmenssteuer
  // D10c (Top 1%): höhere Elastizitäten wegen Steuervermeidung, Einkommensverschiebung, Wegzug
  d10c_labor: 0.40,        // Piketty/Saez/Stantcheva (2014): extensive margin höher
  d10c_avoidance: 0.50,    // Einkommensverschiebung/Avoidance ab GS > 45% (Kleven/Schultz DK)
  d10c_wegzug: 0.10        // Steuerbedingte Emigration bei GS > 60% (Brülhart et al. 2019)
};

// Strukturierte Quellenmetadaten zu ELAST — Werte bleiben oben kompatibel
const ELAST_QUELLEN = {
  labor_supply:   { ref: 'Saez/Chetty/Gruber Konsens · ifo Schnelldienst 01/2025',         range: '0,1–0,3', note: 'intensive margin, konservativ; extensive margin untere Dezile 0,2–0,5 (Meghir/Phillips)' },
  capital_supply: { ref: 'Kleven/Schultz (2014) JPubEc',                                    range: '0,4–0,8', note: 'dänische Daten, auf DE übertragbar; hohe Elastizität wegen Ausweichoptionen' },
  consumption:    { ref: 'Lewbel/Pendakur (2009) JPubEc · Metaanalyse Havranek et al. 2018',range: '−0,2 bis −0,5', note: 'MwSt-Pass-Through auf Konsum; getrennt für Regel- und Ermäßigungssatz' },
  co2:            { ref: 'EWI/DIW BEHG-Evaluation 2023 · Edenhofer/PIK 2024',               range: '−0,2 bis −0,4', note: 'kurzfristig konservativ; langfristig höher durch Infrastruktur-/Verhaltensanpassung' },
  evasion:        { ref: 'Schneider (2023) Shadow Economy DE · IfW Kiel 2024',              range: '0,1–0,3', note: 'Schwarzarbeit/Schattenwirtschaft-Reaktion auf Gesamtsteuerlast' },
  investment:     { ref: 'Gechert/Heimberger (2022) NIER · Neumeier SVR Arbeitspapier 03/2025', range: '−0,3 bis −0,5', note: 'KSt-Investitionselastizität; Effekte kleiner als oft behauptet (Meta-Analyse)' },
  d10c_labor:     { ref: 'Piketty/Saez/Stantcheva (2014) AER',                              range: '0,3–0,5', note: 'extensive margin Top 1%: Stunden, Ruhestandsentscheidung, Einkommensverschiebung' },
  d10c_avoidance: { ref: 'Kleven/Schultz (2014) JPubEc · Chetty/Friedman/Saez (2013)',      range: '0,3–0,7', note: 'Einkommensverschiebung/Avoidance ab Grenzsteuersatz > 45 %' },
  d10c_wegzug:    { ref: 'Brülhart/Gruber/Krapf/Schmidheiny (2019) JPubEc',                 range: '0,05–0,15', note: 'steuerbedingte Emigration ab Grenzsteuersatz > 60 %; DE-Effekt kleiner als CH-Schätzung' }
};


// ── PRESETS ──

const PRESETS = {
  status_quo: {
    freibetrag: 12348, eingang: 14, spitze: 45, grenze: 277826,
    synthetisch: false, abgeltung: 25,
    kst: 15, gewst: 14, gewst_aus: false,
    mwst: 19, mwst_erm: 7,
    co2: 55, klimageld: true,
    erb: 20, betriebs: true, boden: 0.4, verm: 0, zucman: 0,
    rv: 18.6, kv: 16.3, alpf: 6.2, buergerv: false, bbg: 90000,
    bg: 563, kg: 259, neg_est: false, kleine_st: true,
    kapitalquote: 0, rendite_fonds: 7, startjahr: 2020,
    pkv_abschaffen: false, kv_kapital: false, kv_bbg_frei: false, anzahl_kv: 95, praevention: 0, bge: 0
  },
  synthetisch: {
    freibetrag: 15000, eingang: 14, spitze: 50, grenze: 300000,
    synthetisch: true, abgeltung: 25,
    kst: 25, gewst: 0, gewst_aus: true,
    mwst: 19, mwst_erm: 7,
    co2: 80, klimageld: true,
    erb: 30, betriebs: false, boden: 1.0, verm: 0.5, zucman: 0,
    rv: 18.6, kv: 14, alpf: 6.2, buergerv: true, bbg: 115000,
    bg: 650, kg: 300, neg_est: false, kleine_st: false,
    kapitalquote: 5, rendite_fonds: 7, startjahr: 2015,
    pkv_abschaffen: false, kv_kapital: true, kv_bbg_frei: false, anzahl_kv: 95, praevention: 3, bge: 0
  },
  kirchhof: {
    freibetrag: 10000, eingang: 25, spitze: 25, grenze: 60000,
    synthetisch: true, abgeltung: 25,
    kst: 25, gewst: 0, gewst_aus: true,
    mwst: 19, mwst_erm: 7,
    co2: 55, klimageld: true,
    erb: 10, betriebs: true, boden: 0.4, verm: 0, zucman: 0,
    rv: 18.6, kv: 16.3, alpf: 6.2, buergerv: false, bbg: 90000,
    bg: 563, kg: 255, neg_est: false, kleine_st: false,
    kapitalquote: 0, rendite_fonds: 7, startjahr: 2020,
    pkv_abschaffen: false, kv_kapital: false, kv_bbg_frei: false, anzahl_kv: 95, praevention: 0, bge: 0
  },
  radikal: {
    freibetrag: 18000, eingang: 20, spitze: 60, grenze: 200000,
    synthetisch: true, abgeltung: 25,
    kst: 30, gewst: 0, gewst_aus: true,
    mwst: 19, mwst_erm: 5,
    co2: 150, klimageld: true,
    erb: 50, betriebs: false, boden: 2.0, verm: 1.5, zucman: 2,
    rv: 20, kv: 14, alpf: 6.2, buergerv: true, bbg: 150000,
    bg: 800, kg: 350, neg_est: true, kleine_st: false,
    kapitalquote: 10, rendite_fonds: 7, startjahr: 2010,
    pkv_abschaffen: true, kv_kapital: true, kv_bbg_frei: true, anzahl_kv: 20, praevention: 10, bge: 0
  },
  simpel: {
    freibetrag: 15000, eingang: 20, spitze: 50, grenze: 250000,
    synthetisch: true, abgeltung: 25,
    kst: 20, gewst: 0, gewst_aus: true,
    mwst: 19, mwst_erm: 7,
    co2: 100, klimageld: true,
    erb: 30, betriebs: false, boden: 1.5, verm: 0, zucman: 0,
    rv: 18.6, kv: 16.3, alpf: 6.2, buergerv: false, bbg: 90000,
    bg: 600, kg: 280, neg_est: false, kleine_st: false,
    kapitalquote: 0, rendite_fonds: 7, startjahr: 2020,
    pkv_abschaffen: false, kv_kapital: false, kv_bbg_frei: false, anzahl_kv: 95, praevention: 0, bge: 0
  },
  nordisch: {
    freibetrag: 14000, eingang: 20, spitze: 52, grenze: 120000,
    synthetisch: false, abgeltung: 30,
    kst: 22, gewst: 0, gewst_aus: true,
    mwst: 25, mwst_erm: 12,
    co2: 120, klimageld: true,
    erb: 15, betriebs: true, boden: 0.8, verm: 0, zucman: 0,
    rv: 22, kv: 12, alpf: 7.0, buergerv: true, bbg: 120000,
    bg: 750, kg: 350, neg_est: false, kleine_st: true,
    kapitalquote: 15, rendite_fonds: 7, startjahr: 2005,
    pkv_abschaffen: true, kv_kapital: true, kv_bbg_frei: true, anzahl_kv: 30, praevention: 8, bge: 0
  },
  koalition27: {
    freibetrag: 13000, eingang: 12, spitze: 44, grenze: 290000,
    synthetisch: false, abgeltung: 25,
    kst: 13, gewst: 12, gewst_aus: false,
    mwst: 19, mwst_erm: 7,
    co2: 65, klimageld: true,
    erb: 20, betriebs: true, boden: 0.4, verm: 0, zucman: 0,
    rv: 18.6, kv: 16.3, alpf: 6.2, buergerv: false, bbg: 90000,
    bg: 550, kg: 259, neg_est: false, kleine_st: true,
    kapitalquote: 10, rendite_fonds: 7, startjahr: 2024,
    pkv_abschaffen: false, kv_kapital: false, kv_bbg_frei: false, anzahl_kv: 95, praevention: 3, bge: 0
  },
  bge: {
    // BGE 1.200 €/Monat für alle Erwachsenen (~70 Mio.)
    // Finanzierungsmodell: ifo Mikrosimulation 2021 (Blömer/Peichl)
    // Freibetrag 0: BGE dient als effektiver Grundfreibetrag (14.400 €/Jahr)
    // Spitzensteuersatz 60% nötig laut ifo; synthetische ESt auf Kapital
    // Bürgergeld abgeschafft (BGE > 563 €); MwSt leicht erhöht
    freibetrag: 0, eingang: 30, spitze: 60, grenze: 277826,
    synthetisch: true, abgeltung: 30,
    kst: 25, gewst: 14, gewst_aus: false,
    mwst: 22, mwst_erm: 7,
    co2: 80, klimageld: false,
    erb: 30, betriebs: false, boden: 1.0, verm: 0, zucman: 0,
    rv: 18.6, kv: 16.3, alpf: 6.2, buergerv: false, bbg: 90000,
    bg: 0, kg: 255, neg_est: false, kleine_st: false,
    kapitalquote: 0, rendite_fonds: 7, startjahr: 2020,
    pkv_abschaffen: false, kv_kapital: false, kv_bbg_frei: false, anzahl_kv: 95, praevention: 0, bge: 1200
  }
};


// ── CHALLENGES ──

const CHALLENGES = [
  // ── TÄGLICH (leicht, ein Ziel) ──────────────────────────
  { id:'gini_285', diff:'daily', title:'Soziale Balance',
    desc:'Gini-Koeffizient unter 0,285 senken',
    subs:[{ label:'Gini', check:r=>r.gini<0.285, cur:r=>r.gini, tgt:0.285, refFn:ref=>ref.gini, dir:'down', fmt:v=>v.toFixed(3).replace('.',',') }]},
  { id:'saldo_50', diff:'daily', title:'Haushaltsdisziplin',
    desc:'Defizit unter 50 Mrd. € drücken',
    subs:[{ label:'Saldo', check:r=>r.saldo>-50, cur:r=>r.saldo, tgt:-50, refFn:ref=>ref.saldo, dir:'up', fmt:v=>v.toFixed(0)+' Mrd.' }]},
  { id:'admin_120', diff:'daily', title:'Schlankerer Staat',
    desc:'Verwaltungskosten unter 120 Mrd. €',
    subs:[{ label:'Verwaltung', check:r=>r.admin_kosten<120, cur:r=>r.admin_kosten, tgt:120, refFn:ref=>ref.admin_kosten, dir:'down', fmt:v=>v.toFixed(0)+' Mrd.' }]},
  { id:'labor_101', diff:'daily', title:'Beschäftigungsimpuls',
    desc:'Arbeitsangebot-Index über 101',
    subs:[{ label:'Arbeit-Index', check:r=>r.behavior.labor>101, cur:r=>r.behavior.labor, tgt:101, refFn:()=>100, dir:'up', fmt:v=>v.toFixed(1) }]},
  { id:'armut_16', diff:'daily', title:'Armutsreduktion',
    desc:'Armutsrisikoquote unter 8 %',
    subs:[{ label:'Armutsrisiko', check:r=>r.armutsrisiko<8, cur:r=>r.armutsrisiko, tgt:8, refFn:ref=>ref.armutsrisiko, dir:'down', fmt:v=>v.toFixed(1)+' %' }]},
  { id:'co2_85', diff:'daily', title:'Klimakurs',
    desc:'CO₂-Emissionen auf Index unter 85',
    subs:[{ label:'CO₂-Index', check:r=>r.behavior.co2<85, cur:r=>r.behavior.co2, tgt:85, refFn:()=>100, dir:'down', fmt:v=>v.toFixed(1) }]},
  { id:'nst_12', diff:'daily', title:'Steuervereinfachung',
    desc:'Höchstens 12 aktive Steuerarten',
    subs:[{ label:'Steuerarten', check:r=>r.nst<=12, cur:r=>r.nst, tgt:12, refFn:ref=>ref.nst, dir:'down', fmt:v=>v+' Arten' }]},
  { id:'invest_101', diff:'daily', title:'Standortpflege',
    desc:'Investitionsindex über 101',
    subs:[{ label:'Investition', check:r=>r.behavior.invest>101, cur:r=>r.behavior.invest, tgt:101, refFn:()=>100, dir:'up', fmt:v=>v.toFixed(1) }]},
  { id:'palma_18', diff:'daily', title:'Einkommensschere',
    desc:'Palma-Koeffizient unter 1,8 senken',
    subs:[{ label:'Palma', check:r=>r.palma<1.8, cur:r=>r.palma, tgt:1.8, refFn:ref=>ref.palma, dir:'down', fmt:v=>v.toFixed(2).replace('.',',') }]},
  { id:'dwl_50', diff:'daily', title:'Effizienzgewinn',
    desc:'Wohlfahrtsverlust des Steuersystems unter 50 Mrd. €',
    subs:[{ label:'Wohlfahrtsverlust', check:r=>r.dwl<50, cur:r=>r.dwl, tgt:50, refFn:ref=>ref.dwl, dir:'down', fmt:v=>v.toFixed(0)+' Mrd.' }]},
  { id:'co2_80', diff:'daily', title:'Klimaschritt',
    desc:'CO₂-Emissionen auf Index unter 80',
    subs:[{ label:'CO₂-Index', check:r=>r.behavior.co2<80, cur:r=>r.behavior.co2, tgt:80, refFn:()=>100, dir:'down', fmt:v=>v.toFixed(1) }]},
  { id:'schuld_plus1', diff:'daily', title:'Schuldendisziplin',
    desc:'Schuldenquote um weniger als 1 % BIP steigen lassen',
    subs:[{ label:'Schulden-Δ', check:r=>r.schuldenquote_delta<1.0, cur:r=>r.schuldenquote_delta, tgt:1.0, refFn:ref=>ref.schuldenquote_delta, dir:'down', fmt:v=>v.toFixed(2)+' %' }]},
  { id:'armut_12', diff:'daily', title:'Armutsbekämpfung',
    desc:'Armutsrisikoquote unter 12 %',
    subs:[{ label:'Armutsrisiko', check:r=>r.armutsrisiko<12, cur:r=>r.armutsrisiko, tgt:12, refFn:ref=>ref.armutsrisiko, dir:'down', fmt:v=>v.toFixed(1)+' %' }]},
  { id:'invest_103', diff:'daily', title:'Investitionsklima',
    desc:'Investitionsindex über 103',
    subs:[{ label:'Investition', check:r=>r.behavior.invest>103, cur:r=>r.behavior.invest, tgt:103, refFn:()=>100, dir:'up', fmt:v=>v.toFixed(1) }]},

  // ── WÖCHENTLICH (mittel, anspruchsvoller) ───────────────
  { id:'gini_270', diff:'weekly', title:'Starke Umverteilung',
    desc:'Gini-Koeffizient unter 0,270',
    subs:[{ label:'Gini', check:r=>r.gini<0.270, cur:r=>r.gini, tgt:0.270, refFn:ref=>ref.gini, dir:'down', fmt:v=>v.toFixed(3).replace('.',',') }]},
  { id:'saldo_0', diff:'weekly', title:'Schwarze Null',
    desc:'Staatssaldo auf ≥ 0 Mrd. bringen',
    subs:[{ label:'Saldo', check:r=>r.saldo>=0, cur:r=>r.saldo, tgt:0, refFn:ref=>ref.saldo, dir:'up', fmt:v=>v.toFixed(0)+' Mrd.' }]},
  { id:'nst_7', diff:'weekly', title:'Kirchhof-Schüler',
    desc:'Maximal 7 aktive Steuerarten',
    subs:[{ label:'Steuerarten', check:r=>r.nst<=7, cur:r=>r.nst, tgt:7, refFn:ref=>ref.nst, dir:'down', fmt:v=>v+' Arten' }]},
  { id:'invest_104', diff:'weekly', title:'Investitionsoffensive',
    desc:'Investitionsindex über 104',
    subs:[{ label:'Investition', check:r=>r.behavior.invest>104, cur:r=>r.behavior.invest, tgt:104, refFn:()=>100, dir:'up', fmt:v=>v.toFixed(1) }]},
  { id:'armut_14', diff:'weekly', title:'Soziale Gerechtigkeit',
    desc:'Armutsrisikoquote unter 5 %',
    subs:[{ label:'Armutsrisiko', check:r=>r.armutsrisiko<5, cur:r=>r.armutsrisiko, tgt:5, refFn:ref=>ref.armutsrisiko, dir:'down', fmt:v=>v.toFixed(1)+' %' }]},
  { id:'schuld_neg', diff:'weekly', title:'Schuldenabbau',
    desc:'Schuldenquote jährlich sinkend (Δ < 0)',
    subs:[{ label:'Schulden-Δ', check:r=>r.schuldenquote_delta<0, cur:r=>r.schuldenquote_delta, tgt:0, refFn:ref=>ref.schuldenquote_delta, dir:'down', fmt:v=>v.toFixed(2)+' %' }]},
  { id:'co2_70', diff:'weekly', title:'Klimaführerschaft',
    desc:'CO₂-Emissionen auf Index unter 70',
    subs:[{ label:'CO₂-Index', check:r=>r.behavior.co2<70, cur:r=>r.behavior.co2, tgt:70, refFn:()=>100, dir:'down', fmt:v=>v.toFixed(1) }]},
  { id:'admin_100', diff:'weekly', title:'Effizienzreform',
    desc:'Verwaltungskosten unter 100 Mrd. €',
    subs:[{ label:'Verwaltung', check:r=>r.admin_kosten<100, cur:r=>r.admin_kosten, tgt:100, refFn:ref=>ref.admin_kosten, dir:'down', fmt:v=>v.toFixed(0)+' Mrd.' }]},
  { id:'schuldenbremse', diff:'weekly', title:'Schuldenbremse',
    desc:'Strukturellen Saldo auf ≥ −0,35 % BIP bringen (Art. 109 GG)',
    subs:[{ label:'Saldo % BIP', check:r=>r.saldo_bip_pct>=-0.35, cur:r=>r.saldo_bip_pct, tgt:-0.35, refFn:ref=>ref.saldo_bip_pct, dir:'up', fmt:v=>(v>=0?'+':'')+v.toFixed(2)+' %' }]},
  { id:'metr_d1_70', diff:'weekly', title:'Armutsfalle durchbrechen',
    desc:'Grenzbelastung des untersten Dezils unter 70 % senken',
    subs:[{ label:'METR D1', check:r=>r.metr[0]<0.70, cur:r=>r.metr[0]*100, tgt:70, refFn:()=>99, dir:'down', fmt:v=>v.toFixed(0)+' %' }]},

  // ── MONATLICH (schwer, Kombinationen) ───────────────────
  { id:'gini_saldo', diff:'monthly', title:'Quadratur des Kreises',
    desc:'Gini < 0,280 UND Saldo > −30 Mrd.',
    subs:[
      { label:'Gini < 0,280',    check:r=>r.gini<0.280,   cur:r=>r.gini,          tgt:0.280,  refFn:ref=>ref.gini,         dir:'down', fmt:v=>v.toFixed(3).replace('.',',') },
      { label:'Saldo > −30',     check:r=>r.saldo>-30,    cur:r=>r.saldo,         tgt:-30,    refFn:ref=>ref.saldo,        dir:'up',   fmt:v=>v.toFixed(0)+' Mrd.' }
    ]},
  { id:'labor_co2', diff:'monthly', title:'Grünes Wachstum',
    desc:'Arbeitsangebot > 101 UND CO₂-Index < 80',
    subs:[
      { label:'Arbeit > 101',   check:r=>r.behavior.labor>101,  cur:r=>r.behavior.labor, tgt:101, refFn:()=>100, dir:'up',   fmt:v=>v.toFixed(1) },
      { label:'CO₂ < 80',       check:r=>r.behavior.co2<80,     cur:r=>r.behavior.co2,   tgt:80,  refFn:()=>100, dir:'down', fmt:v=>v.toFixed(1) }
    ]},
  { id:'invest_admin', diff:'monthly', title:'Effizienz & Kapital',
    desc:'Investitionen > 103 UND Verwaltung < 105 Mrd.',
    subs:[
      { label:'Invest. > 103',  check:r=>r.behavior.invest>103, cur:r=>r.behavior.invest, tgt:103, refFn:()=>100, dir:'up',   fmt:v=>v.toFixed(1) },
      { label:'Verwalt. < 105', check:r=>r.admin_kosten<105,    cur:r=>r.admin_kosten,    tgt:105, refFn:ref=>ref.admin_kosten, dir:'down', fmt:v=>v.toFixed(0)+' Mrd.' }
    ]},
  { id:'triple_klima', diff:'monthly', title:'Klimasozialpakt',
    desc:'Gini < 0,285, Saldo > −50 Mrd., CO₂ < 80',
    subs:[
      { label:'Gini < 0,285',   check:r=>r.gini<0.285,         cur:r=>r.gini,          tgt:0.285, refFn:ref=>ref.gini,  dir:'down', fmt:v=>v.toFixed(3).replace('.',',') },
      { label:'Saldo > −50',    check:r=>r.saldo>-50,          cur:r=>r.saldo,         tgt:-50,   refFn:ref=>ref.saldo, dir:'up',   fmt:v=>v.toFixed(0)+' Mrd.' },
      { label:'CO₂ < 80',       check:r=>r.behavior.co2<80,    cur:r=>r.behavior.co2,  tgt:80,    refFn:()=>100,       dir:'down', fmt:v=>v.toFixed(1) }
    ]},
  { id:'sozmark', diff:'monthly', title:'Soziale Marktwirtschaft',
    desc:'Armut < 14%, Investitionen > 101, Saldo > −40 Mrd.',
    subs:[
      { label:'Armut < 6 %',    check:r=>r.armutsrisiko<6,      cur:r=>r.armutsrisiko,   tgt:6,   refFn:ref=>ref.armutsrisiko, dir:'down', fmt:v=>v.toFixed(1)+' %' },
      { label:'Invest. > 101',  check:r=>r.behavior.invest>101, cur:r=>r.behavior.invest, tgt:101, refFn:()=>100,              dir:'up',   fmt:v=>v.toFixed(1) },
      { label:'Saldo > −40',    check:r=>r.saldo>-40,           cur:r=>r.saldo,           tgt:-40, refFn:ref=>ref.saldo,        dir:'up',   fmt:v=>v.toFixed(0)+' Mrd.' }
    ]},
  { id:'gini_invest_schuld', diff:'monthly', title:'Aufstieg ohne Schulden',
    desc:'Gini < 0,278, Investitionen > 102, Schuldenquote Δ < 0',
    subs:[
      { label:'Gini < 0,278',   check:r=>r.gini<0.278,          cur:r=>r.gini,            tgt:0.278, refFn:ref=>ref.gini,              dir:'down', fmt:v=>v.toFixed(3).replace('.',',') },
      { label:'Invest. > 102',  check:r=>r.behavior.invest>102, cur:r=>r.behavior.invest,  tgt:102,   refFn:()=>100,                  dir:'up',   fmt:v=>v.toFixed(1) },
      { label:'Schulden-Δ < 0', check:r=>r.schuldenquote_delta<0, cur:r=>r.schuldenquote_delta, tgt:0, refFn:ref=>ref.schuldenquote_delta, dir:'down', fmt:v=>v.toFixed(2)+' %' }
    ]},
  { id:'dwl_gini', diff:'monthly', title:'Gerecht & effizient',
    desc:'Wohlfahrtsverlust < 45 Mrd., Gini < 0,285, Saldo > −55 Mrd.',
    subs:[
      { label:'DWL < 45 Mrd.',  check:r=>r.dwl<45,              cur:r=>r.dwl,             tgt:45,    refFn:ref=>ref.dwl,               dir:'down', fmt:v=>v.toFixed(0)+' Mrd.' },
      { label:'Gini < 0,285',   check:r=>r.gini<0.285,          cur:r=>r.gini,            tgt:0.285, refFn:ref=>ref.gini,              dir:'down', fmt:v=>v.toFixed(3).replace('.',',') },
      { label:'Saldo > −55',    check:r=>r.saldo>-55,           cur:r=>r.saldo,           tgt:-55,   refFn:ref=>ref.saldo,             dir:'up',   fmt:v=>v.toFixed(0)+' Mrd.' }
    ]},
  { id:'generationen', diff:'monthly', title:'Generationengerechtigkeit',
    desc:'Schuldenquote sinkend, CO₂-Index < 80, Investitionen > 102',
    subs:[
      { label:'Schulden-Δ < 0',  check:r=>r.schuldenquote_delta<0,     cur:r=>r.schuldenquote_delta,    tgt:0,   refFn:ref=>ref.schuldenquote_delta, dir:'down', fmt:v=>v.toFixed(2)+' %' },
      { label:'CO₂-Index < 80',  check:r=>r.behavior.co2<80,           cur:r=>r.behavior.co2,           tgt:80,  refFn:()=>100,                      dir:'down', fmt:v=>v.toFixed(1) },
      { label:'Invest. > 102',   check:r=>r.behavior.invest>102,       cur:r=>r.behavior.invest,        tgt:102, refFn:()=>100,                      dir:'up',   fmt:v=>v.toFixed(1) }
    ]},
];


// ── TOOLTIPS ──

const TOOLTIPS = {
  freibetrag: {
    title: "Grundfreibetrag",
    text: "Bis zu diesem Betrag bleibt Einkommen vollständig steuerfrei. BVerfG: sächliches Existenzminimum darf nicht besteuert werden. 2026 auf 12.348 € angehoben (Steueränderungsgesetz 2025). Alle Lager fordern Erhöhung — Einigkeit ist selten.",
    quelle: "§ 32a Abs. 1 EStG · 2026: 12.348 € · Steueränderungsgesetz Okt. 2025 · BMF"
  },
  eingang: {
    title: "Eingangssteuersatz",
    text: "Grenzsteuersatz auf den ersten Euro über dem Freibetrag. Im § 32a-Formeltarif quadratisch steigend — kein harter Knick. ifo (Blömer/Fuest/Peichl 2025): 'Mittelstandsbauch' entsteht, wenn Eingangssatz zu nah am Spitzensatz liegt.",
    quelle: "§ 32a Abs. 1 Nr. 2 EStG · 2025: 14% · ifo Schnelldienst 01/2025"
  },
  spitze: {
    title: "Spitzensteuersatz",
    text: "42% ab ~66.760 € (Eckwert), 45% ab 277.826 € (Reichensteuer). DIW/Bach: Erhöhung auf 49–52% kaum Aufkommensverlust, hoher Verteilungseffekt. ifo/Fuest: ab ~55% sinkt Aufkommen durch Verhaltensreaktion (Laffer-Kurve sichtbar im Modell).",
    quelle: "§ 32a Nr. 4+5 EStG · Piketty/Saez/Stantcheva (2014) AER · ifo Schnelldienst 01/2025"
  },
  grenze: {
    title: "Einkommen ab Spitzensatz",
    text: "Ab diesem Brutto greift der volle Spitzensatz. 2025: 277.826 €. Das Modell skaliert alle Tarifzonen proportional zu diesem Wert — Änderungen simulieren eine Verschiebung des gesamten Progressionsverlaufs.",
    quelle: "§ 32a Abs. 1 Nr. 5 EStG · 2025: 277.826 € · BMF Steuerschätzung 2025"
  },
  synthetisch: {
    title: "Synthetisch vs. Dual",
    text: "Synthetisch: Kapital- und Arbeitseinkommen zusammen progressiv besteuert (DE bis 2008). Dual (aktuell): Kapitalerträge pauschal mit Abgeltungsteuer. DIW (Bach/Sinclair 2026): synthetisch gerechter, mehr Aufkommen aus D10b/c. ifo: dual vermeidet Kapitalflucht (Elastizität 0,5).",
    quelle: "§§ 32d, 43 EStG · Bach/Sinclair DIW Wochenbericht 4/2026 · Kleven/Schultz (2014)"
  },
  abgeltung: {
    title: "Abgeltungsteuer",
    text: "Pauschalsteuer auf Dividenden, Zinsen, Kursgewinne. Gilt nur im dualen System. Seit 2009 in DE. Sparerpauschbetrag: 1.000 €/Jahr. Kritik: Kapital wird deutlich niedriger besteuert als Spitzenlohn. Profitiert fast ausschließlich D10b/c.",
    quelle: "§ 32d EStG · 2025: 25% + Soli · Bach/Wichers DIW 2026: Abschaffung → +15 Mrd. Aufkommen"
  },
  kst: {
    title: "Körperschaftsteuer",
    text: "Steuer auf Gewinne von Kapitalgesellschaften. KSt (15%) + Soli + GewSt (~14%) = ~30% Gesamtbelastung. ifo/Fuest (2025): Senkung auf 25% würde Investitionen signifikant steigern. Meta-Analyse Gechert/Heimberger (2022): Effekte kleiner als behauptet. SVR (Neumeier 2025): −0,5% Investitionen je PP KSt-Senkung. Koalitionsvertrag 2025: −5 PP bis 2033 (5×1 PP ab 2028) → Investitionsimpuls ~+25 Mrd. €/Jahr laut SVR.",
    quelle: "§ 23 KStG · Blömer/Fuest/Peichl ifo 01/2025 · Gechert/Heimberger 2022 · Neumeier SVR Arbeitspapier 03/2025 · Koalitionsvertrag 2025"
  },
  gewst: {
    title: "Gewerbesteuer",
    text: "Kommunalsteuer: Gewerbertrag × 3,5% × Hebesatz (Ø 432%). Stark kritisiert: komplex, wirtschaftsfeindlich, kommunal ungleich. Sachverständigenrat 2020/21: Abschaffung empfohlen. Koalitionsvertrag 2025: Reformdiskussion angekündigt, aber noch kein Beschluss.",
    quelle: "GewStG · Ø Hebesatz 432% · SVR Jahresgutachten 2020/21 · Koalitionsvertrag CDU/SPD 2025"
  },
  gewst_aus: {
    title: "Gewerbesteuer abschaffen",
    text: "Kommunen verlieren ~75 Mrd. € — Ersatz nötig (höherer Gemeindeanteil ESt/USt). BDI und ifo befürworten Abschaffung für mehr Standortattraktivität. Kommunalverbände lehnen ab wegen Eigenfinanzierungsanspruch (Art. 28 GG).",
    quelle: "Art. 28 Abs. 2 GG · SVR 2020/21 · Koalitionsvertrag 2025: 'prüfen' · BDI Positionspapier 2025"
  },
  mwst: {
    title: "Mehrwertsteuer Regelsatz",
    text: "~70% des Konsums. Größte Einzelsteuer: 303 Mrd. €. Wirkt regressiv — D1 gibt fast 100% des Einkommens aus, D10c nur ~40%. ifo/Peichl: MwSt-Erhöhung als 'wachstumsfreundliche' Gegenfinanzierung für ESt-Senkung diskutiert.",
    quelle: "§ 12 UStG · 2025: 19% · BMF Steuerschätzung 2025 · ifo Schnelldienst 01/2025"
  },
  mwst_erm: {
    title: "Ermäßigter MwSt-Satz",
    text: "Lebensmittel, Bücher, ÖPNV, Gastronomie (dauerhaft 7% ab 2026). ~30% des Konsums. Dämpft Regressivität der MwSt, aber schlecht zielgerichtet: Reiche profitieren absolut mehr. Kosten der Ermäßigung: ~30 Mrd. €/Jahr.",
    quelle: "§ 12 Abs. 2 UStG · Gastronomie: Steueränderungsgesetz 2025 · BMF Steuerschätzung 2025"
  },
  co2: {
    title: "CO₂-Preis (BEHG)",
    text: "Nationaler Emissionshandel (BEHG) für Wärme und Verkehr. EU-ETS deckt Industrie/Strom separat. Emissionselastizität: −0,30 (EWI/DIW). Klima-Konsens: höherer CO₂-Preis ist effizientestes Klimainstrument, wenn sozial ausgeglichen (Klimageld). Pro-Kopf-Klimageld: bei 55 €/t ~150 €/Person/Jahr, bei 100 €/t ~190 €/Person/Jahr, bei 150 €/t ~250 €/Person/Jahr. IMK Policy-Brief 161 (Endres 2023): CO₂-Last trifft D1 relativ stärker (~4 % des Einkommens vs. ~1 % bei D10c) — Pro-Kopf-Rückzahlung macht Gesamteffekt für D1–D4 positiv.",
    quelle: "BEHG § 10 · 2025: 55 €/t · Edenhofer/PIK 2024 · Endres IMK Policy-Brief 161/2023 · FÖS/Greenpeace 2024"
  },
  klimageld: {
    title: "Klimageld (Pro-Kopf-Rückzahlung)",
    text: "70% der CO₂-Einnahmen pro Kopf zurück. Macht CO₂-Steuer insgesamt progressiv: Arme emittieren weniger, bekommen gleich viel. Ökonomen-Konsens (ifo, DIW, PIK): CO₂-Preis + Klimageld ist effizient UND gerecht. Im Modell: 70% gleichverteilt.",
    quelle: "PIK Potsdam · Edenhofer/Franks/Kalkuhl (2021) Nature Climate Change · Koalitionsvertrag 2025"
  },
  erb: {
    title: "Erbschaftsteuer",
    text: "Progressiver Tarif je nach Verwandtschaft. Effektiver Satz weit unter Nominal durch Betriebsvermögens-Ausnahmen (BFH). Bach/Sinclair/Bührle/Wichers (DIW 2025): Reform-Szenarien 10–30% Flat Tax nach Abbau der Privilegien zeigen +10–40 Mrd. Aufkommen.",
    quelle: "§§ 10, 19 ErbStG · Bach/Sinclair/Bührle/Wichers DIW 2025 · Finanzausschuss BT Juli 2025"
  },
  betriebs: {
    title: "Betriebsvermögens-Ausnahme",
    text: "§§ 13a/13b: bis 100% Steuerbefreiung für Betriebsvermögen. BRH 2016: 'Haupteinfallstor zur Steuervermeidung'. Bach/Sinclair (DIW 2025): Privilegien erlaubten 2024 Steuererlasse von 3,4 Mrd. €. Abschaffung = Kern aller DIW/Grünen-Reformvorschläge.",
    quelle: "§§ 13a, 13b ErbStG · BVerfG 2014 · BRH-Bericht 2016 · Bach/Sinclair DIW 2025"
  },
  boden: {
    title: "Bodenwertsteuer",
    text: "Grundsteuer nur auf Bodenwert, nicht Gebäude. Anreiz zur Bebauung, gegen Spekulation. Henry George (1879). DIW und IW empfehlen nach Grundsteuerreform 2025. Einige Bundesländer (Hamburg, Bayern) prüfen eigene Modelle.",
    quelle: "Henry George (1879) · DIW Diskussionspapier 2025 · IW Köln 2024 · Akt. GrSt: 16 Mrd."
  },
  verm: {
    title: "Vermögensteuer",
    text: "Jährliche Steuer auf Nettovermögen. In DE seit 1997 ausgesetzt. Bach/Wichers/Mudrack (DIW 2026): Linke-Modell erzielt ~100 Mrd./Jahr; bei Freibetrag 10–20 Mio. immer noch 110–125 Mrd. Nur ~1,9% der Bevölkerung betroffen. Migrationseffekte kleiner als oft behauptet (Kleven/Landais 2024).",
    quelle: "BVerfGE 93, 121 · Bach/Wichers/Mudrack DIW 2026 · Jakobsen/Kleven/Kolsrud NBER 2024"
  },
  rv: {
    title: "Rentenversicherungsbeitrag",
    text: "AN+AG je hälftig. Nur bis BBG (90.600 € West 2025) fällig — wirkt regressiv. SVR-Projektion: ohne Reform steigt Beitragssatz bis 2045 auf ~25%. Generationenkapital (Rentenpaket II 2024): 12 Mrd./Jahr in Staatsfonds ab 2024.",
    quelle: "§ 158 SGB VI · 2025: 18,6% · BBG 90.600 € · Rentenpaket II BT-Drs. 20/10749 · DRV"
  },
  kv: {
    title: "Krankenversicherungsbeitrag",
    text: "GKV-Beitrag inkl. Zusatzbeitrag (~1,7%). BBG: 66.150 € (2025). Demografiedruck: GKV-Finanzierungslücke ~50 Mrd. bis 2030 (GKV-SV). Bürgerversicherung würde Basis verbreitern. PKV-Abschaffung: per Saldo leicht negativ (Mehrausgaben > Mehreinnahmen).",
    quelle: "§ 241 SGB V · 2025: 16,3% · GKV-SV Jahresbericht 2025 · BMG Kassenstatistik"
  },
  alpf: {
    title: "Arbeitslosen- + Pflegeversicherung",
    text: "ALV: 2,6% bis BBG 90.600 €. Pflegeversicherung: 3,6% (Kinderlose +0,6%) bis BBG 66.150 €. Pflegeversicherung unter massivem Reformdruck: Pflegebedürftige wachsen demografisch stark. Koalitionsvertrag 2025: Pflegereform für 2026 angekündigt.",
    quelle: "§ 341 SGB III · § 55 SGB XI · 2025: 6,2% · Koalitionsvertrag CDU/SPD 2025 · BMG"
  },
  buergerv: {
    title: "Bürgerversicherung",
    text: "Alle Einkommensarten beitragspflichtig, PKV-Versicherte in GKV. Im Modell: Beitragsbasis +15%. Befürworter (SPD, Grüne, Lauterbach): mehr Solidarität und Finanzierungssicherheit. Gegner (CDU, PKV): Qualitätsverlust, Ärzteschwund. Wissenschaftlich umstritten.",
    quelle: "Lauterbach et al. (2005) · IGES Institut 2021 · SPD-Grundsatzprogramm 2023"
  },
  bg: {
    title: "Bürgergeld-Regelsatz",
    text: "563 €/Monat für Alleinstehende (2025). ~5,5 Mio. Bedarfsgemeinschaften. ifo/Peichl (2025): Schlüsselreform ist METR-Senkung (Anrechnung 80% → 60%), nicht Regelsatz selbst. Simulation zeigt: METR D1 liegt bei 80%+ — stärkstes Arbeitsmarkthemmnis. ifo Forschungsbericht 159 (2025): Reformvariante mit 60% Anrechnungsquote senkt D1-METR auf ~64% und könnte das Arbeitsangebot im untersten Dezil spürbar steigern.",
    quelle: "§ 20 SGB II · 2025: 563 € · Blömer/Fuest/Peichl ifo 01/2025 · ifo Forschungsbericht 159/2025 · ifo/ZEW METR-Simulation 2024"
  },
  kg: {
    title: "Kindergeld",
    text: "Vorauszahlung auf Kinderfreibetrag (§ 31 EStG) — bei hohen Einkommen wird steuerlich günstigere Variante verrechnet. Ab 2025: 259 € (Steueränderungsgesetz Okt. 2025). ~17 Mio. Kinder. Alle Parteien einig: Kindergeld gehört erhöht.",
    quelle: "§ 66 EStG · 259 €/Monat ab 2025 · Steueränderungsgesetz 2025 · Familienkasse"
  },
  neg_est: {
    title: "Negative Einkommensteuer",
    text: "Unterhalb eines Schwellwerts zahlt Staat einen Betrag aus statt Steuer einzuziehen. Friedman (1962). Vorteil: ein einheitliches System, weniger Bürokratie, kein Transferentzug-Cliff. Im Modell: +30 Mrd. für D1–D3. Verwandt: US Earned Income Tax Credit.",
    quelle: "Friedman (1962) · Bürgergeld-Reform Vorschlag ifo 2025 · OECD Taxing Wages 2025"
  },
  kleine_st: {
    title: "Kleine Verbrauchsteuern",
    text: "Energie (37), Tabak (15), Kfz (10), Versicherung, Strom, Luftverkehr u.a. — zusammen ~109 Mrd. €. BRH: Verwaltungskosten 15–30% des Aufkommens (ineffizient). Kirchhof-Modell: alle abschaffen. Koalition 2025: kein Beschluss zur Abschaffung.",
    quelle: "BMF Steuerschätzung 2025 · BRH Jahresberichte · Kirchhof Einkommensteuergesetzbuch 2011"
  },
  kapitalquote: {
    title: "Fondsquote Rentenversicherung",
    text: "Anteil RV-Aufkommen in Staatsfonds (Generationenkapital). Rentenpaket II 2024: 12 Mrd./Jahr ab 2024 beschlossen (~4% des RV-Aufkommens). Modell zeigt: früherer Start hätte durch Zinseszins erheblich mehr Puffer erzeugt.",
    quelle: "Rentenpaket II · BT-Drs. 20/10749 · Norges Bank NBIM 2024 · DRV Rentenversicherungsbericht"
  },
  rendite_fonds: {
    title: "Erwartete Jahresrendite",
    text: "Nominalrendite des Staatsfonds. MSCI World historisch ~7% nominal, ~5% real. Norwegischer Staatsfonds (GPF-G): Ø 6,3% seit 1998. Konservativ: 4–5%. Das Modell rechnet nominell — Inflationsabzug für reale Interpretation nötig.",
    quelle: "Norges Bank NBIM Annual Report 2024 · Shiller historische Returns · KfW-Research 2025"
  },
  startjahr: {
    title: "Startjahr der Fondsinvestition",
    text: "Je früher, desto mehr Zinseszins-Effekt. Rürup-Kommission (2003) empfahl bereits Kapitaldeckungs-Element — nicht umgesetzt. Schweden: Premiumpension seit 1994 (2,5% der Löhne). Deutschland hat erst 2024 begonnen.",
    quelle: "Rürup-Kommission 2003 · SVR Jahresgutachten 2004 · Rentenpaket II 2024 · OECD Pensions 2024"
  },
  pkv_abschaffen: {
    title: "PKV abschaffen",
    text: "~11 Mio. PKV-Versicherte in GKV. Pro: breitere Einkommensbasis, Solidarausgleich. Contra: GKV-Ausgaben steigen (PKV-Klientel kostenintensiv), Ärzteabwanderung, Qualitätsrisiken. Im Modell: leicht negativer Nettoeffekt.",
    quelle: "PKV-Verband 2025 · IGES Institut 2021 · GKV-SV Schätzung · Lauterbach et al. 2005"
  },
  anzahl_kv: {
    title: "Anzahl Krankenkassen",
    text: "2025: ~95 GKV-Kassen (1995: ~1.200). Fusionen senken Verwaltungskosten (Fixkostendegression ~45%). Einheitskasse (Taiwan/Kanada): sehr niedrige Verwaltungskosten, weniger Wettbewerb. Koalition 2025: keine Fusionspflicht geplant.",
    quelle: "GKV-SV Jahresbericht 2025 · BMG Kassenstatistik · Reinhardt et al. Health Affairs 2004"
  },
  praevention: {
    title: "Prävention-Investitionen",
    text: "Zusatzinvestitionen in Vorsorge, Früherkennung, betriebliche Gesundheit. WHO (2017): ROI 3–5 € pro 1 € über 20 Jahre. Im Modell: vereinfacht 1,5× Nettonutzen (konservativ). GKV-Präventionsbericht 2024: aktuell ~700 Mio. €/Jahr.",
    quelle: "WHO (2017) 'Return on investment of public health interventions' · GKV-SV Präventionsbericht 2024"
  },
  bbg: {
    title: "Beitragsbemessungsgrenze (BBG)",
    text: "Bis zu dieser Einkommenshöhe werden SV-Beiträge fällig — darüber nicht. Wirkt stark regressiv: Wer mehr verdient als die BBG, zahlt keinen Grenzanteil mehr. Erhöhung würde Finanzierungsbasis verbreitern und Progressivität erhöhen. DIW: BBG-Anhebung = günstigste Reform zur SV-Finanzierung.",
    quelle: "§ 6 SGB IV · RV-BBG 2025: 90.600 € · KV-BBG: 66.150 € · DIW Wochenbericht 2025"
  },
  zucman: {
    title: "Zucman-Mindeststeuer (Milliardäre)",
    text: "2%-Mindeststeuer auf Nettovermögen ultra-Reicher — Vorschlag von Gabriel Zucman im Auftrag der G20-Präsidentschaft (Brasilien 2024). Weltweites Aufkommen: 200–250 Mrd. $. Deutschland war 2024 Hauptblockierer (zusammen mit USA). Im Modell: Basis ~2.870 Mrd. € (D10c-Vermögen); Avoidance-Abschlag ~15% bei 2% Satz.",
    quelle: "Zucman G20 Report 2024 · EU Tax Observatory 2024 · Jakobsen/Kleven/Kolsrud NBER 2024"
  },
  kv_kapital: {
    title: "Kapitalerträge KV-pflichtig",
    text: "GKV-Mitglieder zahlen Beitrag auch auf Kapitalerträge (Dividenden, Zinsen, Mieteinnahmen). Derzeit: nur auf Arbeitseinkommen bis BBG (66.150 €). Reform würde Beitragsbasis strukturell verbreitern. ifo Forschungsbericht 159/2025: Mehreinnahmen ~8 Mrd. € / Jahr bei 16,3% Satz. Erfasst ca. 90% der unteren Dezile, nur ~8% im Spitzendezil (PKV-Quote).",
    quelle: "§ 226 SGB V · ifo Forschungsbericht 159/2025 · GKV-SV Jahresbericht 2025 · DIW Wochenbericht 4/2026"
  },
  kv_bbg_frei: {
    title: "KV-Beitragsbemessungsgrenze abschaffen",
    text: "Aktuell: KV-Beiträge nur bis 66.150 € (2025). Darüber: kein weiterer Beitrag — wirkt stark regressiv. Abschaffung: alle Arbeitseinkommen KV-pflichtig ohne Deckel. DIW (2025): Mehreinnahmen ~18 Mrd. € / Jahr bei 16,3% Satz. Entlastet mittlere Einkommen nicht direkt, stärkt aber GKV-Finanzierungsbasis dauerhaft.",
    quelle: "§ 6 Abs. 7 SGB V · KV-BBG 2025: 66.150 € · DIW Wochenbericht 4/2026 · GKV-SV Jahresbericht 2025"
  }
};


// ── REFORM_TOURS ──

const REFORM_TOURS = [
  {
    id: 'kirchhof',
    name: 'Kirchhof-Reform',
    steps: [
      { title: 'Flat Tax einführen',           desc: 'Einheitlicher Steuersatz von 25 % für alle Einkommen.',        params: { eingang: 25, spitze: 25 } },
      { title: 'Grundfreibetrag erhöhen',      desc: 'Schutz für niedrige Einkommen: Freibetrag auf 18.000 €.',      params: { freibetrag: 18000 } },
      { title: 'Gewerbesteuer abschaffen',     desc: 'Vereinfachung: Gewerbesteuer auf 0 — nur Körperschaftsteuer.', params: { gewst: 0 } },
      { title: 'Auf 4 Steuern reduzieren',     desc: 'Erbschaft-, Boden-, Vermögenssteuer abschaffen.',              params: { erb: 0, boden: 0.0, verm: 0.0, zucman: 0.0 } },
    ]
  },
  {
    id: 'skandinavisch',
    name: 'Skandinavisches Modell',
    steps: [
      { title: 'MwSt erhöhen',                 desc: 'Höhere Konsumsteuer — 25 % wie in Dänemark/Schweden.',         params: { mwst: 25 } },
      { title: 'Duale Einkommensteuer',         desc: 'Kapital separat mit 27 % besteuert (NK-Modell).',              params: { synthetisch: false, abgeltung: 27 } },
      { title: 'Niedrige Körperschaftsteuer',  desc: 'Attraktiv für Unternehmen: KSt auf 20 %.',                     params: { kst: 20 } },
      { title: 'Hohe Transferleistungen',      desc: 'Bürgergeld 700 €, Kindergeld 300 € für Umverteilung.',         params: { bg: 700, kg: 300 } },
    ]
  },
  {
    id: 'umverteilung',
    name: 'Starke Umverteilung',
    steps: [
      { title: 'Spitzensteuer erhöhen',         desc: 'Spitzensteuersatz von 42 % auf 58 % für Top-Einkommen.',      params: { spitze: 58 } },
      { title: 'Kapital wie Arbeit besteuern',  desc: 'Abgeltungsteuer abschaffen — synthetisches System.',           params: { synthetisch: true } },
      { title: 'Erbschaftsteuer stärken',       desc: 'Erbschaftsteuersatz auf 35 % — weniger Ausnahmen.',            params: { erb: 35 } },
      { title: 'Vermögensteuer einführen',      desc: 'Zucman-Modell: 1,5 % Steuer auf sehr hohe Vermögen.',         params: { verm: 1.5, zucman: 1.5 } },
    ]
  },
];



// ── KPI_BENCH + CHALLENGE_CTX ──

const KPI_BENCH = {
  saldo:  'DE 2024: −85 Mrd. · EU-Ø: −180 Mrd.',
  einn:   'DE 2024: ~1.450 Mrd. · Steuerquote 22 % BIP',
  gini:   'DE: 0,295 · DK: 0,281 · SE: 0,273 · US: 0,395',
  admin:  'DE ~2 % Steueraufkommen (OECD-Ø)',
  nst:    'DE aktuell: ~40 Steuerarten',
  arb:    'Elastizitäten: Saez/Chetty/Gruber',
  armut:  'DE 2023: 14,8 % (EU-SILC) · EU-Ø: 16,5 %',
  schuld: 'DE Schuldenquote 2025: ~64 % BIP (IMF Art. IV 2025)',
  dwl:    'Schätzung: 5–15 % des Steueraufkommens',
  zins:   'Bund 2025: 7,7 Ct/€ (30,2 Mrd.) · Projektion 2029: 17,2 Ct/€ (66,5 Mrd.) · Tief 2021: 4,6 Ct · Quelle: IW Köln (Hentze 2025) · BMF Finanzplan 2025–2029 (Abbildung 4)',
};
const CHALLENGE_CTX = {
  'Saldo':            'DE 2024: ca. −85 Mrd. €',
  'Gini':             'DE heute: 0,295 · Dänemark: 0,281',
  'Armutsrisiko':     'DE 2023: 14,8 % (EU-SILC)',
  'Verwaltungskosten':'DE ~2 % Steueraufkommen (OECD)',
  'Arbeitsangebot':   'Indexbasis = 100 (Status quo)',
  'Einnahmen':        'DE Steuerquote ~22 % BIP',
  'Steuerarten':      'Kirchhof-Ideal: 4–5 Steuerarten',
  'CO₂':              'DE 2030-Ziel: −65 % ggü. 1990',
  'Schuldenquote':    'Verfassungsgrenze: 0,35 % BIP/Jahr',
  'Wohlfahrtsverlust':'ca. 5–15 % des Steueraufkommens (Lit.)',
  'Saldo % BIP':      'Art. 109 GG: Schuldenbremse greift bei < −0,35 % BIP',
  'METR D1':          'Status quo ~99 % (80 % Bürgergeld-Entzug + ~20 % SV · ifo 2025)',
  'DWL < 45 Mrd.':    'Harberger-Effizienzkosten: sinken mit flacheren Grenzsteuersätzen',
  'CO₂-Index < 80':   'Basis 100 = 500 Mio. t · DE 2030-Ziel: −65 % ggü. 1990',
  'Palma':            'DE heute ~1,9 · Dänemark ~1,4 · USA ~2,3 (Eurostat)',
  'Wohlfahrtsverlust':'Harberger-Dreieck je Dezil · sinkt mit flacherem Tarif',
  'Schulden-Δ':       'Status quo: +2 % BIP/Jahr · Schuldenbremse: < +0,35 %',
};


// ── MOD_DEFS ──

const MOD_DEFS = {
  // CONTROL MODULES
  est:        { type:'control', name:'Einkommensteuer',       desc:'Grundfreibetrag, Eingangs- & Spitzensteuersatz, synthetisch/dual', level:'ein' },
  kst:        { type:'control', name:'Unternehmen & Gewerbe', desc:'Körperschaft- und Gewerbesteuer, Abschaffungs-Toggle', level:'ein' },
  mwst:       { type:'control', name:'Mehrwertsteuer',        desc:'Regel- und ermäßigter Satz', level:'ein' },
  co2:        { type:'control', name:'CO₂-Steuer & Klimageld',desc:'CO₂-Preis und Rückzahlungsquote', level:'ein' },
  verm:       { type:'control', name:'Vermögen & Erbschaft',  desc:'Erbschaft-, Vermögen-, Bodenwertsteuer', level:'fort' },
  sv:         { type:'control', name:'Sozialversicherung',    desc:'RV, KV, ALV+Pflege, BBG, Bürgerversicherung', level:'fort' },
  bge:        { type:'control', name:'BGE · Grundeinkommen',  desc:'Bedingungsloses Grundeinkommen simulieren', level:'fort' },
  transfers:  { type:'control', name:'Transfers & Sozialstaat',desc:'Bürgergeld, Kindergeld, Negative ESt', level:'fort' },
  kleine:     { type:'control', name:'Verbrauchsteuern',      desc:'Energie, Tabak, Kfz, Versicherung u.a.', level:'exp' },
  renten_ctrl:{ type:'control', name:'Rentenreform',          desc:'Fondsquote, Rendite, Startjahr', level:'exp' },
  gkv_ctrl:   { type:'control', name:'GKV-Strukturreformen',  desc:'PKV, Kassenfusion, Prävention, KV-BBG', level:'exp' },
  // RESULT MODULES
  wirk:      { type:'result', name:'Wirtschaftliche Wirkung',    desc:'Fiskalmultiplikator, Stabilisatoren, Dynamisches Scoring', level:'fort' },
  einnahmen: { type:'result', name:'Einnahmen nach Steuerart',   desc:'Aufkommen aller Steuern in Mrd. €', level:'ein' },
  haushalt:  { type:'result', name:'Wer gewinnt, wer verliert',  desc:'Netto-Δ pro Haushalt + Verteilungskennzahlen', level:'ein' },
  belastung: { type:'result', name:'Belastung & Verhaltenseffekte', desc:'Gesamtabgabenquote je Dezil + Verhaltensreaktionen', level:'fort' },
  est_kurve: { type:'result', name:'ESt-Tarifkurve',             desc:'Grenz- und Effektivsteuersatz im Verlauf', level:'fort' },
  laffer:    { type:'result', name:'Laffer-Kurve',               desc:'Aufkommen vs. Spitzensteuersatz', level:'exp' },
  metr:      { type:'result', name:'METR & Einkommensverteilung',desc:'Grenzabgabensätze je Dezil + Verteilungsvisualisierung', level:'exp' },
  schulden:  { type:'result', name:'Schuldenquotenpfad',         desc:'Projektion 2025–2045 vs. Maastricht-Grenze', level:'fort' },
};



// BGE Arbeitsangebotseffekt-Koeffizienten je Dezil (D1..D10c)
// Quelle: RWI 2024, DIW Pilot 2024, ZEW Heim et al., ifo Mikrosimulation 2021
const BGE_LABOR_EFF = [0.15, 0.12, 0.09, 0.06, 0.04, 0.025, 0.015, 0.01, 0.005, 0.00, 0.00, 0.00];

export { DEZILE, ELAST, ELAST_QUELLEN, BASIS_AUFKOMMEN, ADMIN_QUOTE, BASIS_MAKRO, PRESETS, MOD_DEFS, AUSGABEN_TOTAL, CHALLENGES, CHALLENGE_CTX, TOOLTIPS, REFORM_TOURS, KPI_BENCH, BGE_LABOR_EFF };
