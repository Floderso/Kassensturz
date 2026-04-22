# Das große Haushaltsspiel Deutschlands
## Konzept für eine datenbasierte Steuer- und Sozialstaats-Simulation

**Version:** 1.0 · Entwurf
**Zweck:** Ein interaktives Simulationssystem, mit dem einzelne Steuern und Sozialregeln angepasst und die Auswirkungen auf Staatshaushalt, verschiedene Haushaltstypen, Ungleichheit und Verwaltungskosten beobachtet werden können.

---

## 1. Zielsetzung

Die Simulation soll drei Fragen beantworten, die an einer echten Reform zu beantworten wären:

1. **Fiskalisch:** Wie verändert sich der Staatshaushalt? Reichen die Einnahmen für die Ausgaben? Welche Verwaltungskosten entstehen?
2. **Verteilungspolitisch:** Wer gewinnt, wer verliert? Verändert sich die Ungleichheit (Gini, Palma, S80/S20)?
3. **Verhaltensökonomisch:** Wie reagieren Haushalte und Unternehmen? Mehr oder weniger Arbeit? Konsum? Investition?

Die Simulation ist **kein Prognosemodell** für die echte Wirtschaft, sondern ein **Lernspiel**, das die zentralen Trade-offs steuerpolitischer Entscheidungen sichtbar macht.

---

## 2. Wissenschaftliche Grundlage

Die Simulation orientiert sich an etablierten Mikrosimulationsmodellen:

- **EUROMOD** (EU-weites Steuer-/Transfermodell, JRC Sevilla)
- **ifo-Mikrosimulationsmodell** (ifo Institut München)
- **STSM** (ZEW Mannheim)
- **DIW-Mikrosimulationsmodell** (Bach, Haan, Peichl)
- **Mirrlees Review** (UK, methodische Grundlagen optimaler Besteuerung)

Die Struktur folgt dem **statischen Mikrosimulationsansatz**: Ein repräsentatives Sample von Haushaltstypen wird durch das Steuer-Transfer-System "gerechnet"; Verhaltensreaktionen werden über **Elastizitäten** aus der empirischen Literatur modelliert.

### Datenquellen

| Bereich | Quelle | Jahr |
|---|---|---|
| Bundeshaushalt | BMF (bundesfinanzministerium.de) | 2025 |
| Steueraufkommen | BMF-Steuerschätzung | 2025 |
| Einkommensverteilung | SOEP / DIW, EU-SILC, IW Verteilungsbericht | 2024/25 |
| Haushaltsstruktur | Destatis Mikrozensus | 2024 |
| Sozialversicherung | Rentenversicherung Bund, GKV-Spitzenverband | 2025 |
| Verwaltungskosten | BRH, Normenkontrollrat, Wiss. Dienst BT | div. |
| Elastizitäten | ZEW, ifo, Saez/Chetty Reviews | 2012–2024 |

---

## 3. Architektur der Simulation

### 3.1 Akteure

**Haushaltstypen (repräsentativ, 10 Dezile des Nettoäquivalenzeinkommens):**

Jeder Haushaltstyp ist definiert durch:
- Bruttoarbeitseinkommen
- Kapitaleinkommen (Dividenden, Zinsen, Mieten)
- Vermögensbestand (für Erbschaft-/Vermögensteuer)
- Konsumquote (dezilabhängig: untere Dezile ~100 %, oberstes ~60 %)
- Haushaltsgröße (Single, Paar, Paar+Kind, Rentner)
- Erwerbsstatus (beschäftigt, selbstständig, Transfer, Rente)

**Unternehmenssektor (aggregiert):**
- Gesamtgewinn (Vor-Steuer-Profit aller Kapitalgesellschaften)
- Investitionsquote
- Lohnsumme

**Staat (3 Ebenen):**
- Bund, Länder, Kommunen (+ Sozialversicherung als eigener Block)

### 3.2 Steuer- und Abgabenmodul

Parametrisierbar, d.h. jeder Wert ist ein Regler/Slider:

**Einkommensteuer**
- Grundfreibetrag (EUR/Jahr)
- Tarifformel (Stufen oder Funktion mit Eingangssatz, Spitzensatz, Einkommensgrenze)
- Progressionsverlauf (linear, konvex, Knickstellen)
- Option: synthetisch vs. dual (Kapital separat besteuern)

**Kapitaleinkommen**
- Gleichbehandlung mit Arbeit (ein/aus)
- Falls dual: Abgeltungsteuersatz
- Anrechnung Körperschaftsteuer (ja/nein)

**Körperschaftsteuer / Gewerbesteuer**
- Satz
- Integration in ESt (Anrechnungsverfahren)

**Mehrwertsteuer**
- Regelsatz
- Ermäßigter Satz
- Liste ermäßigter Güter (Anteil am Warenkorb)

**CO₂-Steuer**
- EUR/Tonne
- Steigerungspfad
- Klimageld-Rückerstattung (ja/nein, Höhe pro Kopf)

**Erbschaftsteuer**
- Freibetrag
- Progressionskurve
- Betriebsvermögens-Ausnahme (ja/nein)

**Grundsteuer / Bodenwertsteuer**
- Satz auf Bodenwert
- Satz auf Gebäudewert

**Sozialversicherungsbeiträge**
- Rentenversicherung (Satz, Beitragsbemessungsgrenze)
- Krankenversicherung (Satz, BBG, Bürgerversicherung ja/nein)
- Arbeitslosen-/Pflegeversicherung

**Transfers**
- Bürgergeld-Regelsatz
- Kindergeld / Kinderfreibetrag
- Wohngeld-Parameter
- Negative Einkommensteuer (ein/aus)

### 3.3 Verhaltens-Modul

Zentrale Elastizitäten (aus empirischer Literatur, konservativ gewählt):

| Reaktion | Elastizität | Quelle |
|---|---|---|
| Arbeitsangebot (intensiv) | 0,1–0,3 | Saez/Chetty/Gruber |
| Arbeitsangebot (extensiv, untere Dezile) | 0,2–0,5 | Meghir/Phillips |
| Kapitaleinkommen / Steuersatz | 0,4–0,8 | Kleven/Schultz |
| Konsum / MwSt | −0,3 bis −0,5 | Div. Meta-Studien |
| Erbschaft / Steuer (Wegzug) | 0,1–0,2 | Brülhart et al. |
| CO₂-Emissionen / CO₂-Preis | −0,2 bis −0,4 | EWI, DIW |
| Schwarzarbeit / Gesamtsteuerlast | 0,1–0,3 | Schneider |

Formel (vereinfacht) für Arbeitsangebotsreaktion:
```
Δ_Arbeitsstunden = ε × Δ(1 − Grenzsteuersatz)
```

### 3.4 Verwaltungskostenmodul

Für jede Steuer wird eine Verwaltungskosten-Quote geschätzt (Vollzugskosten Staat + Befolgungskosten Bürger/Unternehmen):

| Steuer | Kosten in % des Aufkommens | Quelle |
|---|---|---|
| Einkommensteuer (Arbeit) | 1,5–2 % | BMF, OECD |
| Einkommensteuer (komplexe Einkünfte) | 5–8 % | BRH |
| Mehrwertsteuer | 0,8–1,2 % | OECD |
| Körperschaftsteuer | 3–5 % | BRH |
| Gewerbesteuer | 4–6 % | Wiss. Dienst BT |
| Erbschaftsteuer | 5–10 % | BRH |
| Kleinstverbrauchsteuern (Kaffee, Sekt) | 15–30 % | BRH |
| Bodenwertsteuer (nach Einführung) | 1–2 % | IW / DIW |

**Vereinfachungsbonus:** Bei Reduktion der Steuerarten sinken pauschal die Befolgungskosten in der Wirtschaft (geschätzt ~1 % BIP bei Reduktion auf 5 Hauptsteuern).

### 3.5 Haushaltsdynamik

Pro Periode (= 1 Simulationsjahr):
1. Einkommen werden erzielt (inkl. Verhaltensreaktion)
2. Steuern/Abgaben werden erhoben
3. Transfers werden ausgezahlt
4. Konsum/Sparen wird entschieden
5. Staatshaushalt wird konsolidiert → Defizit/Überschuss
6. Verteilungskennzahlen werden berechnet

---

## 4. Ausgabe / Dashboard

Die Simulation zeigt in Echtzeit:

**Fiskal-Kennzahlen**
- Staatseinnahmen total (+ Aufschlüsselung pro Steuer)
- Staatsausgaben (Sozial, Verteidigung, Investition, Zinsen, Sonstige)
- Primärsaldo, Gesamtsaldo
- Schuldenquote-Veränderung

**Verteilungs-Kennzahlen**
- Gini-Koeffizient (vor und nach Steuern/Transfers)
- Palma-Ratio
- S80/S20
- Armutsrisikoquote
- Gewinner/Verlierer pro Dezil (EUR/Jahr)

**Effizienz-Kennzahlen**
- Verwaltungskosten total (in EUR und % BIP)
- Anzahl aktiver Steuerarten
- Geschätzter "Deadweight Loss" (Wohlfahrtsverlust)

**Verhaltens-Indikatoren**
- Arbeitsangebot (Index)
- Konsum (Index)
- Investitionen (Index)
- CO₂-Emissionen (Index)

---

## 5. Szenarien / Voreinstellungen

Vorgefertigte "Paper-Szenarien" zum Vergleich:

1. **Status quo 2025** — Deutschland aktuell
2. **Kirchhof-Modell** — Flat Tax 25 %, 4 Steuern
3. **Synthetisch progressiv** — dein Modell aus den Vorgesprächen
4. **Nordisches Modell** — hohe MwSt, niedrigere Kapitalsteuer
5. **Radikale Vereinfachung** — 5 Steuern, alles andere weg
6. **Stark umverteilend** — Spitzensteuer 60 %, Erbschaft 50 %, Vermögensteuer

---

## 6. Grenzen des Modells

**Ehrlich gesagt:** Ein Mikrosimulationsmodell, das realistische Prognosen liefert, braucht Teams von Ökonomen über Jahre (EUROMOD, ifo-MSM). Das hier ist ein **Lerntool**, das:

- **kann:** Größenordnungen, Trade-offs und Richtungseffekte sichtbar machen
- **kann nicht:** makroökonomische Feedbacks (BIP-Wachstum, Arbeitslosigkeit dynamisch), regionale Unterschiede, internationale Kapitalflucht präzise modellieren
- **bewusst vereinfacht:** 10 Haushaltstypen statt Millionen Einzeldatensätze; statische Reaktionen statt allgemeines Gleichgewicht

Die Ergebnisse sollen **Hypothesen** erzeugen, nicht Politik ersetzen.

---

## 7. Weiterentwicklung

Mögliche Ausbaustufen:
- Sozialversicherung dynamisch (Demographie, Rentenniveau)
- Regionaler Finanzausgleich
- Import/Export (CO₂-Grenzausgleich)
- Zeitreihe über 20+ Jahre (Schuldenpfad)
- Monte-Carlo-Simulation bei unsicheren Elastizitäten
- Export der Ergebnisse als CSV für eigene Analysen
