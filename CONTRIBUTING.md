# Beitragen zu Kassensturz

Danke für dein Interesse! Das Projekt lebt von korrekten Daten und guten Ideen.

## Was besonders willkommen ist

- **Datenkorrekturen** — veraltete oder fehlerhafte Zahlen in `js/data.js`
- **Neue Szenarien** — politische Reformvorschläge mit Quellenangabe
- **Quellenergänzungen** — neuere Studien zu Elastizitäten oder Verteilung
- **UI-Verbesserungen** — Lesbarkeit, Zugänglichkeit, mobile Darstellung
- **Übersetzungen** — englische Version des Interface

## Wie du beiträgst

1. Fork das Repository
2. Erstelle einen Branch: `git checkout -b fix/kurze-beschreibung`
3. Mach deine Änderung
4. Öffne einen Pull Request mit kurzer Beschreibung **und Quelle**, falls du Zahlen änderst

## Datenänderungen

Jede Änderung an Zahlen in `js/data.js` oder der Simulationslogik in `js/haushaltsspiel.js` muss eine belastbare Quelle haben (amtliche Statistik, peer-reviewed, offizieller Bericht). Bitte die Quelle direkt im PR nennen.

## Tests

Vor einem Pull Request bitte alle Tests ausführen (Node ≥ 22, keine Abhängigkeiten):

```bash
for t in tests/*.test.mjs; do node "$t" || exit 1; done
```

Sie prüfen unter anderem, dass der Status quo ein Fixpunkt ist (keine Veränderung gegenüber sich selbst), dass jedes Preset in den Reglern exakt darstellbar ist und dass die Zukunftssimulation die Budgetidentität einhält. Wer Status-quo-Werte in `PRESETS.status_quo` fortschreibt (z. B. Grundfreibetrag des nächsten Jahres), sieht hier sofort, ob ein Regler angepasst werden muss.

## Grenzen des Modells

Vor einem Beitrag lohnt sich ein Blick in [`Konzept_Steuersimulation.md`](Konzept_Steuersimulation.md) — dort ist dokumentiert, was das Modell bewusst vereinfacht und was es nicht abbilden kann.

## Lizenz

Mit einem Pull Request stimmst du zu, dass dein Beitrag unter der [CC BY 4.0](LICENSE)-Lizenz des Projekts veröffentlicht wird.
