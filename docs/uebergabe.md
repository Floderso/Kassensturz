# Übergabe an einen lokalen Agenten – Kassensturz

Stand: 28.09.2026 · Branch `claude/kassensturz-code-review-col3ha` · letzter Commit vor dieser Datei: `eef2936`

Dieses Dokument richtet sich an einen Agenten, der lokal auf dem Rechner des Projektinhabers arbeitet. Er hat Netzzugang zu amtlichen Quellen (Destatis/GENESIS, DRV, SOEP), die in der bisherigen Cloud-Umgebung gesperrt waren.

## 1. Arbeitsweise (verbindlich)

Der Projektinhaber erwartet:

- **Vor jeder Aufgabe:** Ziele zusammen mit dem Projektinhaber in einem kurzen Interview klären.
- **Keine Emojis.**
- **Kleine Zwischenziele:**
  - Aufgaben in kleine Zwischenziele teilen und jedes einzeln vorstellen.
  - Erst nach gezielter Rückfrage und Freigabe weitermachen.
  - Einen neuen Block nie ohne ausdrückliche Freigabe beginnen.
- **Ton:** sachlich und präzise. Unsicheres als unsicher kennzeichnen.
- **Maßstab:** streng gegen Primärquellen.
  - Ein Wert ohne geprüfte Quelle bleibt `[ANNAHME]`.
  - Eine Quelle, deren Detail nicht geprüft werden konnte, wird mit `[QUELLE PRÜFEN]` markiert.
- **Git:**
  - Entwicklung auf `claude/kassensturz-code-review-col3ha`.
  - `main` ist der Live-Stand (Cloudflare Pages deployt von `main`).
  - Auf `main` nur nach Freigabe und nur als Fast-Forward pushen: `git push origin claude/kassensturz-code-review-col3ha:main`.
  - Keine Modellnamen in Commits oder Dateien.
  - Keinen PR anlegen, außer auf ausdrücklichen Wunsch.

## 2. Projektkontext in Kürze

- **Art des Projekts:** statische Web-App ohne Build-Schritt; ES-Module unter `js/`.
- **Seiten:** `index.html` (Haushaltsspiel), `finanz.html`, `mikro.html`, `quellen.html`, `impressum.html`.
- **Rechenkern:** `js/rechner/`
  - `berechne.js`: Hauptsimulation, Kalibrierung, Stabilisierungskoeffizient
  - `haushalt.js`: zvE, Splitting, Soli, Pareto-Rand
  - `einkommensteuer.js`: § 32a EStG 2026
  - `verteilung.js`
  - `transition.js`
  - `rente.js`
- **Daten und Quellen:**
  - `js/data.js`: alle Parameter
  - `js/quellen.js`: einzige Quellendatei, 103 Einträge; Verweise per ID wie `refs: ['A40']`
- **Offene Daten:** `data.json` und `llms.txt` werden **nicht von Hand** gepflegt. Nach jeder Daten- oder Modelländerung `node tools/export.mjs` ausführen.
- **Dokumentation:**
  - `docs/pruefbericht.md`: 71 Befunde, jeder mit Statuszeile; am Ende steht die Umsetzungsübersicht.
  - `docs/verbesserungsvorschlaege.md`: Vorschläge V-01 bis V-29
  - `docs/verbesserungsplan.md`: Blöcke 1–9

### Tests

Voraussetzung ist Node ≥ 22; es gibt keine Abhängigkeiten.

```bash
for t in tests/*.test.mjs; do node "$t" || exit 1; done
node tools/export.mjs --check
```

- **Testdateien:** 11 Stück, unter anderem:
  - `status_quo`: Fixpunkt
  - `presets`
  - `tarif`: ±1 € gegen § 32a
  - `haushalt`
  - `ausgaben`
  - `zukunft`
  - `laffer`
  - `challenges`: Erreichbarkeit
  - `quellen`: IDs, DOIs und eine Sperrliste korrigierter Falschangaben
  - `export`
- **Kalibrierung im Status quo:** Die Tests prüfen unter anderem:
  - ESt 357 Mrd. €
  - Saldo −119,1 Mrd. € (VGR 2025)
  - Armutsquote 16,1 %
  - ESt-Restfaktor 0,957 (Akzeptanzbereich 0,85–1,15)

**Browserprüfung (optional):**
- Lokalen Server im Repo-Wurzelverzeichnis starten, zum Beispiel `python3 -m http.server 8766`.
- `_headers` (CSP) gilt erst auf Cloudflare. Lokal nur Sichtprüfung: Konsole ohne Fehler, kein `NaN` auf den fünf Seiten.

## 3. Aufgabe A – Block 9 live stellen

- **Stand:**
  - Die Blöcke 1–8 sind auf `main`.
  - Block 9 (`eef2936`) und diese Übergabedatei liegen nur auf dem Branch.
  - Der Push auf `main` scheiterte in der Cloud-Umgebung an einer technischen Störung, nicht an einem inhaltlichen Problem.

**Schritte:**
1. `git fetch origin && git checkout claude/kassensturz-code-review-col3ha && git pull`
2. Prüfen, dass `main` ein Vorfahre ist: `git rev-list --left-right --count origin/main...HEAD` muss links `0` zeigen.
3. Alle Tests und `node tools/export.mjs --check` ausführen. Alles muss grün sein.
4. Mit dem Projektinhaber bestätigen, dann ausführen: `git push origin claude/kassensturz-code-review-col3ha:main`
5. Nach dem Deploy auf kassensturz.org prüfen:
   - `/quellen.html` zeigt 103 Quellen.
   - `/data.json` enthält `meta.erzeugt_aus` und den Schlüssel `grundsteuer`.
   - Im Mikrolabor steht „Essen außer Haus: −0,81“.

## 4. Aufgabe B – Datenlücken schließen

Jede Lücke ist im Code mit `[ANNAHME]` markiert (`grep -rn "\[ANNAHME\]" js`). Empfohlene Reihenfolge nach Wirkung auf die Ergebnisse, **jede Zeile als eigenes Zwischenziel mit Freigabe**:

| Nr. | Lücke | Stelle im Code | Befund | Gesuchte Primärquelle | Wirkung |
|---|---|---|---|---|---|
| B1 | Haushaltsstruktur je Gruppe (Erwachsene, Kinder, Paaranteil, Erwerbstätige) | `js/data.js`, `HH_STRUKTUR` | F-002, F-021, F-068 | Destatis EVS 2023 / Mikrozensus 2024, Haushalte nach Nettoeinkommen und Größe (GENESIS 12211) | ESt, Splitting, alle Verteilungsmaße |
| B2 | Einkommen der Gruppen unter VGR-Niveau | `js/data.js`, `DEZILE.brutto`, `konsum` | F-070 | VGR verfügbares Einkommen und Konsum der privaten Haushalte; Verteilung nach SOEP/DINA-DE | MwSt-Restgröße (44 %), ESt-Restfaktor |
| B3 | Steuerfreier Konsumanteil (0,20) | `KALIBRIERUNG_ZIELE.mwst_steuerfrei_anteil` | F-070 | EVS/VGR-Konsumstruktur nach Verwendungszweck | MwSt-Zerlegung |
| B4 | Ausgaben nach COFOG (Restposten ca. 817 Mrd. €) | `STAATSAUSGABEN`, `VGR_2025` | F-015 | Destatis COFOG Gesamtstaat 2024/2025 | Ausgabenstruktur |
| B5 | Zinsen Gesamtstaat (nur Bund belegt: 30 Mrd. €) | `STAATSAUSGABEN.zinsen` | F-006 (Rest) | VGR geleistete Vermögenseinkommen / Zinsen des Staates | Zinslast der Zukunftssimulation |
| B6 | Öffentlicher Kapitalstock (1.500 Mrd. €) | `FISKAL.kapitalstock_oeff` | F-018 | Destatis Vermögensrechnung, Nettoanlagevermögen des Staates | Investitionswirkung |
| B7 | Demografie-Anker (`renten_faktor`, Altenquotient) | `DEMOGRAFIE_KURVE` | F-042 | aktuelle koordinierte Bevölkerungsvorausberechnung (Variante und Tabelle nennen) | Rentenausgaben Zukunft |
| B8 | Vermögen je Gruppe (nicht exportiert, nicht monoton) | `DEZILE.vermoegen` | F-050 | SOEP/DIW Vermögensbericht; Maß (Median/Mittel) festlegen | nur Veröffentlichung |
| B9 | Pareto-Parameter Top 1 % (a = 1,6) | `TOP_PARETO` | F-071 | Bach/Corneo/Steiner (2012) EER 56(6) – konkreten Wert prüfen | Spitzensatz, Laffer-Maximum |
| B10 | Elastizitäten Arbeit (0,20), Konsum (−0,35) | `ELAST` | F-045, F-046 | Chetty (2012) Econometrica für die Arbeit; eigene Quelle für die MwSt-Reaktion | Verhaltensreaktion |
| B11 | Fortschreibung RV-Beitrag 2040–2045 | `js/rechner/rente.js`, `RV_PFAD_2025` | F-044 | längerfristige DRV/BMAS-Projektion | Rentenfonds-Panel |

Bewusst als Annahme belassen, weil es keine sinnvolle Primärquelle gibt:
- GKV-Fusionsparameter 0,45
- Präventions-ROI 1,5
- Renditeannahmen im Finanzprofil

**Vorgehen je Lücke:**
1. Die Primärquelle abrufen. Tabellen-ID, Abrufdatum und Wert notieren.
2. Den Wert in `js/data.js` eintragen. Die `[ANNAHME]`-Markierung durch die Quellenangabe ersetzen. Bei Bedarf einen Eintrag in `js/quellen.js` ergänzen:
   - ID-Präfix passt zum Typ: A akademisch, B Bericht, C Statistik, G Recht
   - Verweis per `refs`
3. Die Tests ausführen.
   - Ändert sich die Kalibrierung, muss der Status quo weiter die VGR-Summen treffen, und der ESt-Restfaktor muss im Bereich 0,85–1,15 bleiben.
   - Testerwartungen nur anpassen, wenn die neue Zahl belegt ist, und die Änderung im Commit begründen.
4. `node tools/export.mjs` ausführen und `data.json` und `llms.txt` mitcommitten.
5. In `docs/pruefbericht.md` die Statuszeile des Befunds und die Übersicht am Ende aktualisieren.
6. Committen, auf den Branch pushen, dem Projektinhaber berichten. Auf `main` nur nach Freigabe.

## 5. Stolpersteine aus der bisherigen Arbeit

- **Kalibrierungs-Cache:** `kalibrierung()` in `berechne.js` wird einmal berechnet und zwischengespeichert. Tests, die `ELAST` o. Ä. verändern, müssen den Originalwert wiederherstellen (siehe `tests/laffer.test.mjs`).
- **Laffer-Maximum:** Das Maximum im Modell (derzeit 49 %) liegt unter τ* = 1/(1 + a·e) ≈ 61 %, weil zusätzlich ein Vermeidungs- und Wegzugsterm ab 45 % wirkt (`ELAST.d10c_avoidance`, `d10c_wegzug`). Das ist offengelegt und kein Fehler.
- **Challenges:** Challenges werden aus Kennzahl und Schwelle erzeugt (`challenge()` in `js/data.js`). Nach Modelländerungen prüft `tests/challenges.test.mjs`, ob jede Challenge erreichbar bleibt und im Status quo noch nicht erfüllt ist. Schwellen dort anpassen, nicht die Prüfung.
- **Quellen-Sperrliste:** `tests/quellen.test.mjs` enthält eine Sperrliste korrigierter Falschangaben. Wer einen gesperrten Text wieder einführt, bekommt einen roten Test. Das ist beabsichtigt.
- **Finanzrechner:** Die Rechenfunktionen in `finanz.html` sind Inline-Skripte. Es gibt keine Node-Tests dafür, nur Browserprüfungen über `page.evaluate(calcRente(...))`.
- **Dezimalzeichen:** Das Mikrolabor gibt Zahlen mit Dezimalkomma aus (`fmt` in `mikro.html`). Für SVG-Koordinaten `fmt` nicht verwenden.

## 6. Umgebung und Rechte

- Der Projektinhaber gibt Netz- und Push-Rechte lokal selbst frei.
- Secrets (z. B. der API-Key für den Gutachter-Workflow unter `.github/`) werden nicht angefasst und nicht ausgegeben.
