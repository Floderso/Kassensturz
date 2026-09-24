# Prüfbericht Kassensturz – Phase 3: Verbesserungsplan

Bezug: `docs/pruefbericht.md` (F-001 … F-067), `docs/verbesserungsvorschlaege.md` (V-01 … V-29).

## Priorisierungslogik

1. **Abhängigkeiten zuerst:** Ein Schritt steht vor einem anderen, wenn dieser ohne ihn nicht sinnvoll umsetzbar ist.
2. **Gleiche Abhängigkeitsebene:** Der höhere Schweregrad entscheidet. Ein Schritt übernimmt dabei den Schweregrad des höchsten Befunds, den er (direkt oder als Voraussetzung) ermöglicht.
3. **Sonderregel (Rücksprache):** Maßnahmen, die unmittelbare Risiken der Live-Seite beheben (Datenschutz, Workflow), stehen unabhängig davon an erster Stelle.

Zwei Vorschläge werden für eine saubere Reihenfolge geteilt:
- **V-03a:** Status-quo-Konstanten aus einer Quelle und Fixpunkt-Test. Sofort umsetzbar.
- **V-03b:** Eigene Bemessungsgrundlagen und Kalibrierung. Erst nach dem Umbau des Haushaltsmodells sinnvoll, da vorher unklar ist, was kalibriert wird.
- **V-06a:** Budgetidentität, also Zinsen nur einmal buchen. Sofort umsetzbar.
- **V-06b:** Nominale Konsistenz und Zinsbasis Gesamtstaat. Braucht den neuen Ausgabenrahmen aus V-09.
- **V-15a:** Quellendatei als einzige Quelle und Korrekturen F-023 bis F-026. Vor dem Modellumbau, damit neuer Code direkt per ID zitiert.
- **V-15b:** Export von `data.json`/`llms.txt`, zusammen mit V-24 am Ende, wenn die Daten final sind.

## Abhängigkeiten

```
V-01 ──► V-29                          (CSP erst ohne Drittanbieter sinnvoll)
V-17 ──► V-28                          (gleiche Datei; Zugriffsschutz vor Robustheit)
V-08 ──► V-02 ──► V-21
            └───► V-03b ──► V-14       (Laffer braucht exakten Tarif und kalibriertes Aufkommen)
V-02 ──► V-26                          (Kennzahlen/Challenges auf Äquivalenzbasis)
V-21 ──► V-26
V-09 ──► V-16, V-13, V-06b             (Ausgabenrahmen vor Einzelposten, Fiskalregel, Zinsbasis)
V-06a ─► V-06b ──► V-12                (Schuldendynamik vor Wachstumskanälen)
V-15a ─► (alle Blöcke mit neuen Quellenangaben) ──► V-22, V-15b/V-24
V-03a ─► alle Rechenkern-Blöcke        (Fixpunkt-Test als Sicherheitsnetz)
```

Unabhängig voneinander: V-04, V-05, V-07, V-10, V-11, V-18, V-19, V-20, V-23, V-25, V-27.

---

## Block 1 – Live-Risiken und Sicherheit

| Reihenfolge | Schritt | Vorschlag | Befunde | Schweregrad |
|---|---|---|---|---|
| 1.1 | Google-Ads-Tag entfernen, Fonts lokal einbinden, Datenschutzerklärung korrigieren | V-01 | F-001 | kritisch |
| 1.2 | `_headers` mit CSP und Security-Headern | V-29 | F-067 | leicht (setzt 1.1 voraus) |
| 1.3 | Workflow nur für OWNER/MEMBER/COLLABORATOR, Prompt-Abgrenzung, keine Links in der Ausgabe | V-17 | F-029 | schwer |
| 1.4 | Workflow: Fork-PRs überspringen, Fehlerbehandlung, Action per SHA pinnen | V-28 | F-064, F-065, F-066 | leicht |
| 1.5 | URL-, Hash- und localStorage-Eingaben validieren | V-25 | F-054, F-060 | leicht |

**Prüfung:**
- Die Seite lädt im Browser ohne Anfragen an Google-Domains (Netzwerkprotokoll).
- Die Schriften werden korrekt dargestellt.
- Kein CSP-Verstoß in der Konsole.
- `?preset=constructor` und ein manipulierter Hash führen zum Status quo.

**Erreicht nach Block 1:**
- Die Live-Seite überträgt ohne Einwilligung keine Daten an Dritte, und die Datenschutzerklärung stimmt.
- Der kostenpflichtige Workflow kann nicht mehr von Fremden ausgelöst oder für Inhalte im Projektnamen missbraucht werden.
- Externe Eingaben sind validiert.

---

## Block 2 – Kritische Einzelkorrekturen ohne Abhängigkeiten und Prüfgerüst

| Reihenfolge | Schritt | Vorschlag | Befunde | Schweregrad |
|---|---|---|---|---|
| 2.1 | Status-quo-Konstanten aus `PRESETS.status_quo` ableiten; Test „Status quo ist Fixpunkt“ (Netto-Δ = 0, Arbeit = 1, Investition = 1, SV-Δ = 0) | V-03a | F-010, F-011, F-012 | schwer (Voraussetzung für alle Rechenkern-Blöcke) |
| 2.2 | Reglerraster so, dass alle Presets exakt darstellbar sind; HTML-Startwerte = Status quo; `setParams` mit Status-quo-Fallback; Preset-Test | V-07 | F-007, F-053 | kritisch |
| 2.3 | Status quo ohne Klimageld; Status-quo-Rechnung beachtet das Flag | V-04 | F-004, F-049 | kritisch |
| 2.4 | Budgetidentität in der Transition (Zinsen nur im Saldo) | V-06a | F-006 | kritisch |
| 2.5 | Klimamodul: TCRE-Einheit, nur zusätzliche Emissionen, DICE-2023-Parameter, Hinweistext | V-05 | F-005, F-027 | kritisch |

2.1 steht trotz geringerem Schweregrad vorn, weil der Test die übrigen Schritte absichert.

**Prüfung:**
- `node tests/status_quo.test.mjs` und `node tests/presets.test.mjs` grün.
- Im Browser: Nach dem Laden entsprechen alle Regler exakt `PRESETS.status_quo`, und alle „Δ vs. Basis“-Anzeigen stehen auf 0.
- Nachrechnung der Zukunftssimulation zeigt keine Doppelzinsung (Test: Saldo = 0 ⇒ Schuld konstant).

**Erreicht nach Block 2:**
- Der Status quo ist ein echter Fixpunkt und bildet geltendes Recht ab (kein Klimageld).
- Die Anzeige stimmt mit dem Referenzwert überein.
- Die Zukunftssimulation ist frei von Doppelzinsung und um Größenordnungen überzeichnetem Klimaschaden.
- Automatische Tests schützen den Referenzpunkt für alle folgenden Blöcke.

Offen bleiben nach Block 2 die Kalibrierung der Aufkommen (F-002, F-003) und die Nominalrechnung (F-008).

---

## Block 3 – Quellen-Fundament

| Reihenfolge | Schritt | Vorschlag | Befunde | Schweregrad |
|---|---|---|---|---|
| 3.1 | `js/quellen.js` als einzige Quelle; `quellen.html` rendert daraus; Referenzen per ID; ID- und DOI-Test | V-15a | – (Struktur) | schwer (Voraussetzung) |
| 3.2 | Korrekturen: Rentenpaket II nicht in Kraft; Brülhart et al.; Jakobsen et al.; Steuerfortentwicklungsgesetz, Grundfreibetrag 2025, Kindergeld | V-15a | F-023, F-024, F-025, F-026 | schwer |

**Prüfung:**
- Test: Alle referenzierten Quellen-IDs existieren, und alle DOIs sind formal gültig.
- Sichtprüfung von `quellen.html` und den betroffenen Tooltips.

**Erreicht nach Block 3:**
- Die öffentlich sichtbaren Falschaussagen zu Rechtsstand und Literatur sind korrigiert.
- Neue Quellenangaben aus den Blöcken 4–7 werden an genau einer Stelle gepflegt.

---

## Block 4 – Tarif und Haushaltsmodell (Rechenkern Einnahmen)

| Reihenfolge | Schritt | Vorschlag | Befunde | Schweregrad |
|---|---|---|---|---|
| 4.1 | `TARIF_2026` mit gesetzlichen Eckwerten; `satz_z4` als Parameter und Regler; Presets mit bisherigen impliziten Werten; Tariftest (±1 € gegen § 32a) | V-08 | F-009, F-022 (Teil) | schwer (Voraussetzung für kritisch) |
| 4.2 | Datenrecherche Haushaltsstruktur je Dezil (Erwachsene, Kinder, Paaranteil, Erwerbstätige) aus Mikrozensus/EVS; Werte mit Tabellen-ID und Abrufdatum | V-02 (Daten) | – | Voraussetzung |
| 4.3 | `haushalt.js`: zvE, Splitting, Soli, Abgeltung mit Sparerpauschbetrag und Soli; SV-Berechnung in einer Funktion; Verhaltensreaktion nur auf Arbeit | V-02 | F-002, F-034, F-036 | kritisch |
| 4.4 | Verteilungsmaße auf Äquivalenzeinkommen je Person (Gini, Palma, S80/S20, Median) mit Offenlegung | V-02 | F-021 | schwer |
| 4.5 | Armutsquote aus Verteilung innerhalb der Gruppen, kalibriert auf den amtlichen Wert | V-21 | F-035, F-040 | leicht |
| 4.6 | Eigene Bemessungsgrundlagen (KSt, GewSt, MwSt ohne steuerfreie Umsätze, Erbschaft) und offen ausgewiesene Kalibrierfaktoren (Akzeptanz 0,85–1,15); Aufkommenstest | V-03b | F-003 | kritisch |
| 4.7 | Zucman-Instrument auf Hochvermögende bzw. Umbenennung | V-23 | F-037 | leicht |

**Prüfung:**
- Tarif-, Status-quo- und Aufkommenstests grün: Jede Steuer im Status quo trifft `BASIS_AUFKOMMEN` auf ±1 Mrd. €, und die Kalibrierfaktoren liegen im Akzeptanzbereich.
- Die Presets werden vor und nach dem Umbau verglichen, und die Abweichungen werden erklärt.

**Erreicht nach Block 4:**
- Die Einnahmenseite rechnet nach § 32a EStG auf dem zvE der Veranlagung, und jede Steuer hat ihre eigene, belegte Bemessungsgrundlage.
- Im Status quo stimmt das Aufkommen mit der Kassenstatistik überein.
- Verteilungs- und Armutskennzahlen folgen der amtlichen Definition und sind mit den Benchmarks vergleichbar.

---

## Block 5 – Ausgaben, Transfers und Sozialversicherung

| Reihenfolge | Schritt | Vorschlag | Befunde | Schweregrad |
|---|---|---|---|---|
| 5.1 | Ausgabenrahmen nach COFOG (Gesamtstaat) mit herausgelösten Modellposten; Erhebungskosten nur als Δ; BGE-Anrechnung gegen den Rentenposten | V-09 | F-013, F-014, F-015 | schwer |
| 5.2 | Bürgergeld nach Regelbedarfsstufen plus Unterkunftskosten (BA-Statistik) | V-16 | F-028 | schwer |
| 5.3 | Fiskalregel: Maastricht-Defizitquote statt Schuldenbremse; Info-Tooltip Reform 2025; Challenge anpassen | V-13 | F-020 | schwer |
| 5.4 | Rentenfonds: Ausschüttung vs. Thesaurierung, reale Rendite | V-10 | F-016 | schwer |
| 5.5 | GKV/PKV mit Einheiten im Namen und belegten Werten | V-11 | F-017, F-043 | schwer |

**Prüfung:**
- Test: Summe der Ausgabenposten im Status quo = COFOG-Gesamtwert, ohne überlappende Posten.
- BGE-Einsparung ≤ Rentenposten.
- Rentenfonds-Test: Bei Ausschüttung = 1 bleibt der Kapitalstock real konstant (ohne Neuzuführung).
- PKV-Einheitentest.

**Erreicht nach Block 5:**
- Die Ausgabenseite ist ein konsistenter, belegter Rahmen ohne Doppelzählungen.
- Transfers entstehen aus ihren rechtlichen Bestimmungsgrößen.
- Die angezeigte Fiskalregel passt zur Modellebene.

---

## Block 6 – Zukunftssimulation

| Reihenfolge | Schritt | Vorschlag | Befunde | Schweregrad |
|---|---|---|---|---|
| 6.1 | Nominale Konsistenz (alle Aggregate mit nominalem BIP-Pfad, belegte Wachstumsrate); Zinsbasis Gesamtstaat; Refinanzierungsanteil; offengelegte Annahme zur Tarifindexierung | V-06b | F-008 | schwer |
| 6.2 | Ein Multiplikator als Flusseffekt; dauerhafte Wirkung über öffentlichen Kapitalstock; HANK-Gewichtung für Investitionen entfernen | V-12 | F-018, F-019, F-038, F-039 | schwer |

**Prüfung:**
- Test: Saldo = 0 ⇒ Schuldenquote sinkt mit 1/(1+g)ⁿ.
- Investitionsimpuls mit Laufzeitende ⇒ BIP-Effekt klingt mit der Abschreibung ab.
- Die vier Zukunftsszenarien werden vor und nach dem Umbau verglichen.

**Erreicht nach Block 6:**
- Die Zukunftssimulation ist in sich konsistent: eine Preisbasis, Budgetidentität, getrennte und belegte Kanäle für Nachfrage und Angebot.

---

## Block 7 – Kennzahlen und Anzeige

| Reihenfolge | Schritt | Vorschlag | Befunde | Schweregrad |
|---|---|---|---|---|
| 7.1 | Laffer-Kurve: nur Spitzensatz, Gesamtaufkommen, Aussage aus dem Modell, Quelle Diamond/Saez | V-14 | F-022, F-048 | schwer |
| 7.2 | Benchmarks mit gleicher Abgrenzung; Challenge-IDs generiert, Schwellen neu, Erreichbarkeitstest; S80/S20-Referenz; METR-Balken umbenannt oder echter Stabilisierungskoeffizient | V-26 | F-055, F-056, F-057, F-058 | leicht |

**Prüfung:**
- Die Laffer-Aussage im Tooltip entspricht dem berechneten Kurvenverlauf.
- Test: Jede Tages-Challenge ist erreichbar.
- Sichtprüfung im Browser.

**Erreicht nach Block 7:**
- Alle angezeigten Aussagen, Ziele und Vergleichswerte werden aus dem Modell erzeugt und können ihm nicht mehr widersprechen.

---

## Block 8 – Finanztools und Mikrolabor

| Reihenfolge | Schritt | Vorschlag | Befunde | Schweregrad |
|---|---|---|---|---|
| 8.1 | Altersvorsorge: Kaufkraft korrekt, Kapitalbedarf aus der Rentenphase, Bengen-Quelle | V-18 | F-030, F-031 | schwer |
| 8.2 | Kredit vs. Investieren: gleicher Mittelabfluss in beiden Szenarien | V-19 | F-032 | schwer |
| 8.3 | Markup vs. Lerner-Index; unbelegten Vergleich entfernen | V-20 | F-033, F-063 (Teil) | schwer |
| 8.4 | Effektiver Monatszins, Steueroption, Monopol-Guard, Inzidenz mit echten Punktelastizitäten | V-27 | F-059, F-061, F-062 | leicht |

**Prüfung:**
- Referenzrechnungen mit Hand- bzw. Tabellenwerten, z. B. Rentenbarwertfaktor und Annuität.
- Grenzfälle (MC ≥ Prohibitivpreis, Inflation 0 %, Rendite 0 %).

**Erreicht nach Block 8:**
- Die persönlichen Finanzrechner liefern Beträge in einer definierten Preisbasis und vergleichen Szenarien fair.
- Die Mikrolabor-Kennzahlen sind korrekt benannt und hergeleitet.

---

## Block 9 – Restliche Zitate und Datenexport

| Reihenfolge | Schritt | Vorschlag | Befunde | Schweregrad |
|---|---|---|---|---|
| 9.1 | Restliche Zitat- und Tooltip-Korrekturen über `quellen.js` | V-22 | F-041, F-042, F-044, F-045, F-046, F-047, F-051, F-052, F-063 (Teil) | leicht |
| 9.2 | `data.json`/`llms.txt` per Skript aus `data.js`; Bezeichner korrigieren; Monotonie-Test | V-15b, V-24 | F-050 | leicht |
| 9.3 | Abschluss: vollständiger Testlauf, Browser-Durchgang aller Seiten, Aktualisierung `docs/pruefbericht.md` mit Status je Befund | – | alle | – |

**Erreicht nach Block 9:**
- Jede Quellen- und Datenangabe existiert genau einmal und stimmt mit dem Original überein.
- Die veröffentlichten Daten entsprechen dem Rechenmodell.
- Für alle 67 Befunde ist der Status dokumentiert.

---

## Hinweise zur Umsetzung (Phase 4)

- Jeder Block wird einzeln umgesetzt, committet und auf `claude/kassensturz-code-review-col3ha` gepusht. Danach folgen Zusammenfassung und Halt bis zur Freigabe.
- Schritte mit **[QUELLE PRÜFEN]** beginnen mit der Recherche. Wird ein Wert nicht belastbar gefunden, wird er als Annahme gekennzeichnet und im Blockbericht genannt, statt stillschweigend eingesetzt.
- Die Blöcke 4–6 verändern Modellergebnisse sichtbar. Der Blockbericht enthält deshalb jeweils eine Vorher/Nachher-Tabelle der Presets (Saldo, Gini, Armutsquote, Aufkommen je Steuer).
