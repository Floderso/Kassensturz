// SPDX-License-Identifier: CC-BY-4.0
// Erzeugt data.json und llms.txt aus js/data.js und dem Status-quo-Lauf des Rechenmodells (V-15b, V-24, F-050).
// Aufruf: node tools/export.mjs          → schreibt beide Dateien
//         node tools/export.mjs --check  → prüft nur, ob die Dateien aktuell sind (Exit 1 sonst)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DATENSTAND, DEZILE, BASIS_AUFKOMMEN, BASIS_MAKRO, VGR_2025, PRESETS, TOP_PARETO, FISKAL } from '../js/data.js';
import { berechne } from '../js/rechner/berechne.js';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const r1 = x => Math.round(x * 10) / 10;

function erzeugeDaten() {
  const r = berechne(PRESETS.status_quo);
  const B = BASIS_AUFKOMMEN;
  return {
    meta: {
      quelle: 'kassensturz.org',
      lizenz: 'CC BY 4.0',
      stand: DATENSTAND,
      erzeugt_aus: 'js/data.js und Status-quo-Lauf von js/rechner/berechne.js (tools/export.mjs)',
      hinweis: 'Dezile: Modellgruppen (D10 geteilt in P90–95, P95–99, Top 1 %), Einkommen der Gruppen liegen unter dem VGR-Niveau (Prüfbericht F-070). ' +
               'Haushaltsstruktur (Erwachsene, Kinder, Paaranteil, Erwerbstätige) ist eine gekennzeichnete Annahme. ' +
               'Vermögen je Gruppe wird nicht veröffentlicht, weil Herkunft und Maß ungeklärt sind (F-050). ' +
               'Aufkommen: überwiegend Werte 2025 als Näherung für 2026.',
    },
    dezile: DEZILE.map(d => ({
      gruppe: d.label,
      haushalte_mio: d.anzahl,
      brutto_jahr_eur: d.brutto,
      anteil_kapitaleinkommen: d.kapital,
      erwachsene_annahme: d.erwachsene,
      kinder_annahme: d.kinder,
      paaranteil_annahme: d.paar_anteil,
      erwerbstaetige_annahme: d.erwerbstaetige,
    })),
    steueraufkommen_mrd_eur: {
      lohnsteuer: B.lohnsteuer,
      einkommensteuer_veranlagt_inkl_kapitalertragsteuer: B.estveranlagt,
      abgeltungsteuer_und_soli: B.solz_abgelt,
      mehrwertsteuer: B.mwst,
      koerperschaftsteuer: B.kst,
      gewerbesteuer: B.gewst,
      energiesteuer: B.energie,
      co2_bepreisung: B.co2,
      tabaksteuer: B.tabak,
      grundsteuer: B.grundst,
      erbschaft_und_schenkungsteuer: B.erbschaft,
      kfz_steuer: B.kfz,
      sonstige_verbrauchsteuern: B.sonstige,
      rentenversicherungsbeitraege: B.rv_beitrag,
      krankenversicherungsbeitraege: B.kv_beitrag,
      arbeitslosen_und_pflegeversicherung: B.al_pflege,
    },
    gesamtstaat_vgr_2025_mrd_eur: { einnahmen: VGR_2025.einnahmen, ausgaben: VGR_2025.ausgaben, saldo: VGR_2025.saldo, steuern: VGR_2025.steuern },
    modell_status_quo_2026_mrd_eur: {
      einnahmen: r1(r.einnahmen_total),
      ausgaben: r1(r.ausgaben_total),
      saldo: r1(r.saldo),
      saldo_bip_prozent: Math.round(r.saldo_bip_pct * 100) / 100,
      einkommensteuer_inkl_soli: r1(r.rev.est),
      ausgabenposten: Object.fromEntries(Object.entries(r.ausgaben_posten).map(([k, v]) => [k, r1(v)])),
      armutsrisikoquote_prozent: r1(r.armutsrisiko),
    },
    makro_2026: {
      bip_mrd_eur: BASIS_MAKRO.bip,
      co2_bepreiste_emissionen_mio_t: BASIS_MAKRO.emissions,
      sozialversicherungspflichtige_lohnsumme_mrd_eur: BASIS_MAKRO.lohnsumme_sv,
      kv_beitragsbemessungsgrenze_eur: BASIS_MAKRO.kv_bbg_kv_sq,
      nominalwachstum_annahme: FISKAL.wachstum_nominal,
    },
    annahmen: {
      pareto_parameter_top1: TOP_PARETO.a,
      oeffentlicher_kapitalstock_mrd_eur: FISKAL.kapitalstock_oeff,
    },
  };
}

const fmt = (x, d = 1) => x.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

function erzeugeLlms(D) {
  const m = D.modell_status_quo_2026_mrd_eur, v = D.gesamtstaat_vgr_2025_mrd_eur;
  return `# Kassensturz

> Kassensturz ist eine interaktive Plattform zur Simulation des deutschen Steuersystems und Staatshaushalts. Die Daten stammen aus öffentlichen Quellen; wo keine Primärquelle vorliegt, sind Werte als Annahme gekennzeichnet. Die Nutzung ist kostenlos und ohne Anmeldung möglich.

## Was ist Kassensturz?

Kassensturz macht Finanz- und Steuerpolitik verständlich — durch interaktive Regler, Echtzeit-Berechnungen und Visualisierungen. Nutzer können Steuerszenarien durchspielen und sehen, wie sich Änderungen auf Staatshaushalt, Einkommensverteilung und Haushaltsgruppen auswirken. Das Modell ist ein vereinfachtes Gruppenmodell (12 Einkommensgruppen) mit offen ausgewiesener Kalibrierung.

## Hauptseiten

- [Das große Haushaltsspiel](https://kassensturz.org/): Simulation des deutschen Steuersystems mit Reglern für Einkommensteuer, Mehrwertsteuer, CO₂-Preis, Unternehmensteuern, Sozialabgaben u. v. m.; zeigt Auswirkungen auf Staatshaushalt, Verteilungsmaße und Einkommensgruppen.
- [Finanztools](https://kassensturz.org/finanz.html): Sparplan-, Kredit- und Altersvorsorgerechner
- [Mikrolabor](https://kassensturz.org/mikro.html): Mikroökonomie-Modelle (Angebot und Nachfrage, Elastizität, Steuerinzidenz, Mindestlohn, Monopol)
- [Quellenverzeichnis](https://kassensturz.org/quellen.html): verwendete Quellen mit Verwendungszweck

## Kennzahlen (Datenstand ${D.meta.stand})

- Gesamtstaat laut VGR 2025: Einnahmen ${fmt(v.einnahmen)} Mrd. €, Ausgaben ${fmt(v.ausgaben)} Mrd. €, Saldo ${fmt(v.saldo)} Mrd. €
- Status quo im Modell (kalibriert auf die VGR 2025): Saldo ${fmt(m.saldo)} Mrd. € (${fmt(m.saldo_bip_prozent, 2)} % des BIP), Einkommensteuer inkl. Soli ${fmt(m.einkommensteuer_inkl_soli)} Mrd. €
- BIP 2026: ${fmt(D.makro_2026.bip_mrd_eur, 0)} Mrd. € (Schätzung)

## Offene Daten

- [data.json](https://kassensturz.org/data.json): maschinenlesbare Kerndaten (Modellgruppen, Steueraufkommen, VGR-Summen, Status-quo-Ergebnis des Modells, Annahmen). Erzeugt aus dem Quellcode (tools/export.mjs).

## Lizenz

Inhalte und Daten: CC BY 4.0 — Florian Aram Feuerriegel
Quellenangabe: kassensturz.org

## Häufige Fragen, die dieses Tool beantwortet

- Wie viel Einkommensteuer zahlt wer in Deutschland?
- Was passiert, wenn der Spitzensteuersatz erhöht wird?
- Wie wirkt sich eine MwSt-Erhöhung auf verschiedene Einkommensgruppen aus?
- Wie hoch ist das Staatsdefizit?
- Wie viel kostet die Rente den Staat?
- Was würde eine Vermögensteuer einbringen?
- Wie ungleich ist die Einkommensverteilung (Gini, Palma, S80/S20)?
- Was kostet das Bürgergeld?
- Wie wirkt die CO₂-Bepreisung auf Haushalte unterschiedlicher Einkommensgruppen?
`;
}

export function erzeugeDateien() {
  const D = erzeugeDaten();
  return { 'data.json': JSON.stringify(D, null, 2) + '\n', 'llms.txt': erzeugeLlms(D) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pruefen = process.argv.includes('--check');
  let veraltet = 0;
  for (const [name, inhalt] of Object.entries(erzeugeDateien())) {
    const pfad = join(WURZEL, name);
    if (pruefen) {
      let alt = ''; try { alt = readFileSync(pfad, 'utf8'); } catch {}
      if (alt !== inhalt) { console.error(`${name} ist veraltet — node tools/export.mjs ausführen`); veraltet++; }
    } else {
      writeFileSync(pfad, inhalt);
      console.log(`${name} geschrieben`);
    }
  }
  process.exit(veraltet ? 1 : 0);
}
