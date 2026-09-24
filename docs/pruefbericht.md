# Prüfbericht Kassensturz – Phase 1: Fehlerbericht

Stand: 24.09.2026 · Prüfgegenstand: Branch `claude/kassensturz-code-review-col3ha`, Commit `e33f00a`

## Prüfrahmen

- **Umfang:** gesamtes Repository (Rechenkern `js/rechner/*`, Datenbasis `js/data.js`/`data.json`, `index.html` + `js/haushaltsspiel.js` + `js/render/*`, `finanz.html`, `mikro.html`, `quellen.html`, `impressum.html`, `Konzept_Steuersimulation.md`, `llms.txt`, GitHub-Workflow + `.github/scripts/claude_review.py`)
- **Maßstab:** streng gegen Primärquellen (EStG, Gesetzgebungsstand, Originalpublikationen)
- **Nicht geprüft:** Architektur, Wartbarkeit, Design
- **Methode:**
  - statische Durchsicht
  - numerische Nachrechnung: Die Module wurden unverändert unter Node ausgeführt.
  - Browser-Verifikation: Die Seite wurde lokal gehostet und in Headless-Chromium geladen, um die Reglerwerte auszulesen.
  - Abgleich externer Angaben per Websuche mit den Originalquellen
- **Kategorien:** W = wissenschaftliche Korrektheit · Z = Zitierfehler · T = technischer Fehler (Logik/Sicherheit)
- **Schweregrade:**
  - kritisch: Kernaussage oder Rechtskonformität der Live-Seite falsch
  - schwer: Ergebnisse oder Aussagen erheblich verzerrt
  - leicht: begrenzte Auswirkung

Referenzwerte der Nachrechnung (Status quo, `berechne(PRESETS.status_quo)`):

| Größe | Modell | Referenz im eigenen Repo / Primärquelle |
|---|---|---|
| Einkommensteuer (Lohnst. + veranl. ESt) | 675,3 Mrd. € | 345 Mrd. € (`BASIS_AUFKOMMEN`) |
| MwSt | 144,5 Mrd. € | 303 Mrd. € |
| KSt / GewSt | 60,2 / 56,2 Mrd. € | 45 / 75 Mrd. € |
| Erbschaftsteuer | 26,4 Mrd. € | 8 Mrd. € |
| CO₂ netto | 6,4 Mrd. € | 21 Mrd. € |
| Gini / Palma | 0,357 / 6,36 | 0,295 (eigener Benchmark `KPI_BENCH`) |
| Armutsrisikoquote | 15,69 % | „kalibriert auf 14,8 %“ (Kommentar) |
| Schuldenquote Baseline 2026 → 2042 | 65,3 % → 123,6 % | – |

---

## Kritisch

### F-001 · kritisch · T (Sicherheit/Datenexposition) · Google-Tracking ohne Einwilligung, Datenschutzerklärung faktisch falsch
- **Fundstelle:** `index.html:133-139`; `impressum.html:111-112`; Google-Fonts-Einbindung u. a. `index.html:143` (ebenso `finanz.html:24`, `mikro.html:24`, `quellen.html:19`, `impressum.html:11`)
- **Beleg:**
  - `<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18178856279"></script>` … `gtag('config', 'AW-18178856279');`
  - Impressum: „Diese Seite erhebt keine personenbezogenen Daten und verwendet keine Cookies. Es werden keine Nutzerdaten an Dritte weitergegeben.“
- **Begründung:**
  - Der Google-Ads-Tag wird bedingungslos beim Seitenaufruf geladen. Es gibt keine Consent-Abfrage im Code.
  - `gtag.js` mit `AW-`-ID überträgt die IP-Adresse und Geräteinformationen an Google und setzt bzw. liest Cookies für Conversion-Tracking.
  - Auch die Google Fonts werden direkt von `fonts.googleapis.com`/`fonts.gstatic.com` geladen. Das überträgt die IP-Adresse an Google (vgl. LG München I, Urt. v. 20.01.2022, 3 O 17493/20).
  - Die Datenschutzerklärung verneint beides ausdrücklich. Sie ist damit für die Live-Seite nachweislich unzutreffend.
  - Betroffen sind die Informationspflichten (Art. 13 DSGVO), die Rechtsgrundlage (Art. 6 DSGVO) und die Einwilligungspflicht für Endgerätezugriffe (§ 25 TDDDG).
  - Die Einstufung ist technisch-faktisch und keine Rechtsberatung.

### F-002 · kritisch · W · Einkommensteuer auf Haushalts-Brutto ohne Splitting und Abzüge – Aufkommen doppelt so hoch wie real
- **Fundstelle:** `js/rechner/berechne.js:126-141`, insb. `:129`, `:140`
- **Beleg:** `const est_arbeit = estTarif(arbeit, params.freibetrag, params.eingang, params.spitze, params.grenze);` · `est_aufkommen += tot * d.anzahl / 1000;   // Mrd.`
- **Begründung:**
  - `arbeit` ist das Bruttoeinkommen eines ganzen Haushalts (`DEZILE[i].brutto`). Darauf wird der Einzelveranlagungstarif angewandt.
  - Es fehlen:
    - Ehegattensplitting (§ 32a Abs. 5 EStG)
    - Vorsorgeaufwendungen/Sozialversicherungsbeiträge (§ 10 EStG)
    - Werbungskosten- bzw. Arbeitnehmer-Pauschbetrag (§ 9a EStG)
    - Kinderfreibeträge und Sonderausgaben
  - § 32a EStG gilt jedoch für das zu versteuernde Einkommen einer Person bzw. eines Veranlagungspaars.
  - Ergebnis: 675,3 Mrd. € Einkommensteuer gegenüber 345 Mrd. € im eigenen Referenzwert. Das ist Faktor 1,96.
  - Alle darauf aufbauenden Größen sind verzerrt: Netto je Dezil, Konsum, MwSt, Gini, Laffer, dynamisches Scoring.
  - Das Konzeptdokument verspricht dagegen eine „Mikrosimulation“ mit Haushaltstypen (`Konzept_Steuersimulation.md:31, 51-58`).

### F-003 · kritisch · W · Übrige Einnahmen nicht auf die Referenzwerte kalibriert
- **Fundstelle:**
  - MwSt `js/rechner/berechne.js:155-171`
  - KSt/GewSt `:145-148`
  - Erbschaft `:180-182`
  - Referenz `js/data.js:60-77`
- **Beleg:** `const erb_auf = BASIS_MAKRO.erb_masse * 0.6 * erb_satz_eff + BASIS_MAKRO.erb_masse * 0.4 * Math.min(params.erb, 15) / 100 * 0.5;`
- **Begründung:**
  - Die Nachrechnung im Status quo ergibt:
    - MwSt 144,5 statt 303 Mrd. € (−52 %)
    - Erbschaftsteuer 26,4 statt 8 Mrd. € (×3,3)
    - KSt 60,2 statt 45 Mrd. €
    - GewSt 56,2 statt 75 Mrd. €
  - Das plausibel wirkende Gesamtaufkommen (1.838 Mrd. €) entsteht nur, weil sich diese Fehler und F-002 gegenseitig ausgleichen.
  - Jede Reform einer einzelnen Steuer wird dadurch gegen eine falsche Bemessungsgrundlage gerechnet. Beispiel: Eine MwSt-Erhöhung wirkt im Modell nur halb so stark wie real.
  - Für die MwSt kommt hinzu: Der gesamte Konsum wird besteuert (70/30-Split), obwohl Mieten und weitere Leistungen nach § 4 UStG steuerfrei sind.

### F-004 · kritisch · W · Status quo enthält ein Klimageld, das es 2026 nicht gibt
- **Fundstelle:** `js/data.js:148`; `js/rechner/berechne.js:177`, `:255`
- **Beleg:** `co2: 65, klimageld: true,` · `const klimageld_auszahlung = params.klimageld ? co2_auf * 0.7 : 0; // 70% zurück als Klimageld`
- **Begründung:**
  - Eine Pro-Kopf-Rückzahlung der CO₂-Einnahmen ist 2026 geltendes Recht weder im BEHG noch in einem anderen Gesetz.
  - Der „Status quo 2026“ zieht trotzdem 70 % der CO₂-Einnahmen ab (netto 6,4 statt 21 Mrd. €) und verteilt sie in `berechneNettoSQ` auf die Haushalte um.
  - Der Referenzpunkt aller Δ-Berechnungen bildet damit eine nicht existierende Politik ab.

### F-005 · kritisch · W · Klimasensitivität um Faktor ~1.100 zu hoch; zudem Gesamt- statt Zusatzemissionen
- **Fundstelle:** `js/rechner/transition.js:36`, `:117`
- **Beleg:** `const KLIMA_SENS_PER_MT    = 5e-4;  // °C je Mt kumulierter CO₂-Zusatz-Emissionen (vereinfacht)` · `const co2_kumulat_next = prevState.co2_kumulat + prevResult.emissionen * n;`
- **Begründung:**
  - IPCC AR6 WG1 SPM (D.1.1) nennt als TCRE-Bestwert 0,45 °C je 1.000 Gt CO₂. Das entspricht 4,5·10⁻⁷ °C je Mt.
  - Der Code verwendet 5·10⁻⁴ °C je Mt, also etwa den 1.100-fachen Wert.
  - Zusätzlich werden die gesamten deutschen bepreisten Emissionen kumuliert (327 Mt/Jahr), nicht die im Kommentar genannten „Zusatz-Emissionen“.
  - Folge in der Baseline: nach 16 Jahren 5.232 Mt → +2,6 °C allein durch Deutschland. Über `diceKlimaMalus` wird daraus ein BIP-Verlust von mehreren Prozent.
  - Der Klimaschaden in der Zukunftssimulation ist damit um Größenordnungen überzeichnet.

### F-006 · kritisch · T/W · Zinsen in der Zukunftssimulation doppelt gezählt, mit zwei verschiedenen Zinssätzen
- **Fundstelle:** `js/rechner/berechne.js:77-83`, `:297`; `js/rechner/transition.js:32`, `:113`
- **Beleg:** `const zinsen_dyn = zustand ? (zustand.schuldenquote / 100 * zustand.bip) * zins_effektivrate : STAATSAUSGABEN.zinsen;` · `const schuld_next = schuld_curr * Math.pow(1 + zins, n) - prevResult.saldo * n;` · `const ZINS_SCHULDEN        = 0.025;`
- **Begründung:**
  - `saldo` enthält bereits die Zinsausgaben `zinsen_dyn`, berechnet mit ca. 1,12 % Effektivzins (`berechne.js:297`).
  - In der Transition wird der Schuldenstand zusätzlich mit 2,5 % p. a. aufgezinst, und davon wird der bereits zinsbelastete Saldo abgezogen.
  - Korrekt wäre `schuld_next = schuld_curr − Σ saldo`, wobei der Saldo die Zinsen enthält. Alternativ: aufzinsen und dafür einen Primärsaldo abziehen.
  - Die doppelte Zählung ist ein Hauptgrund für den Anstieg der Schuldenquote von 65,3 % auf 123,6 % im Status-quo-Pfad.

### F-007 · kritisch · T · Range-Slider runden die Status-quo-Werte; Anzeige und Referenz `REF` fallen auseinander
- **Fundstelle:**
  - `index.html:224`, `:236`, `:353`, `:426`, `:430`
  - `js/haushaltsspiel.js:73-113` (`setParams`)
  - `js/haushaltsspiel.js:141`
- **Beleg:**
  - `id="freibetrag" min="0" max="30000" step="500"`
  - `id="grenze" min="50000" max="500000" step="10000"`
  - `id="bbg" min="40000" max="160000" step="5000"`
  - `REF = berechne(PRESETS.status_quo);`
- **Begründung:**
  - HTML-Range-Inputs runden zugewiesene Werte auf `min + k·step`. Im Browser verifiziert: Nach dem Laden der Seite stehen die Regler auf
    - `freibetrag=12500` (statt 12.348)
    - `grenze=280000` (statt 277.826)
    - `bbg=100000` (statt 101.400)
    - `bg=560` (statt 563)
    - `kg=260` (statt 259)
  - `getParams()` liest diese gerundeten Werte. `REF` wird dagegen aus den ungerundeten `PRESETS` berechnet.
  - Der als „Status quo“ angezeigte Zustand ist damit nicht der Referenzpunkt. Alle „Δ vs. Basis“-Anzeigen sind schon ohne Nutzereingabe verschoben.
  - Ebenso betroffen: Presets `koalition27` (12.900 → 13.000), `kirchhof`, `simpel`, `bge` (BBG, Bürgergeld, Grenze).

---

## Schwer

### F-008 · schwer · W · Zukunftssimulation vermischt nominale und reale Größen
- **Fundstelle:** `js/rechner/transition.js:31`, `:106-109`; `js/rechner/berechne.js:73-75`, `:146`
- **Beleg:** `const BIP_WACHSTUM_NOMINAL = 0.015;  // Ø nominales BIP-Wachstum je Jahr (Bundesbank)`
- **Begründung:**
  - 1,5 % nominal liegt unter jeder Projektion mit Inflation um 2 %. Das nominale Wachstum liegt realistischerweise bei etwa 3 %.
  - `berechne()` skaliert nur den Unternehmensgewinn mit `bip_faktor`. Lohnsumme, Konsum, Transfers und Ausgaben bleiben über 20 Jahre nominal konstant, während Schulden nominal aufgezinst werden.
  - Die Staatsquote auf der Einnahmenseite sinkt dadurch mechanisch. Der Schuldenpfad ist nicht interpretierbar.
  - Zudem ist „Bundesbank“ als Quelle für 1,5 % nominal nicht nachvollziehbar belegt (siehe Kopfkommentar `transition.js:18`: „Bundesbank Winterprognose 2024“).

### F-009 · schwer · W · Einkommensteuertarif weicht von § 32a EStG 2026 ab
- **Fundstelle:** `js/rechner/einkommensteuer.js:5`, `:36-61`, `:88-94`
- **Beleg:** `// Rechtsgrundlage: § 32a EStG 2025 (Formeltarif, 5 Zonen)` · `const sq_z2 = 4921;   // Breite Zone 2 (SQ)` · `const satz4 = Math.min(spitze, eingang * 0.05 + spitze * 0.95) / 100;`
- **Begründung:**
  - Die Zonenbreiten 4.921/49.755/211.065 entsprechen den Eckwerten 17.005/66.760 aus 2024. Nach dem Steuerfortentwicklungsgesetz gilt 2026: 17.799/69.878/277.825, also Breiten 5.451/52.079/207.947.
  - Der Satz der vierten Zone ergibt bei 14/45 den Wert 43,45 %, gesetzlich sind es 42 %.
  - Nachrechnung gegen die Formel § 32a Abs. 1 EStG 2026:

    | zvE | Modell | Gesetz | Abweichung |
    |---|---|---|---|
    | 40.000 € | 7.428 € | 7.209 € | +219 € |
    | 100.000 € | 32.085 € | 30.864 € | +1.221 € |
    | ab 277.825 € | – | – | konstant +3.800 € |

  - Grenzsteuersatz am Ende von Zone 2 im Modell: 24,34 % (gesetzlich 23,97 %).
  - Der Tooltip behauptet den gesetzlichen Tarif („42% ab 69.879 €“, `data.js:405`), gerechnet wird ein anderer.

### F-010 · schwer · T · Arbeitsangebotsreaktion wird gegen einen veralteten Grundfreibetrag gerechnet
- **Fundstelle:** `js/rechner/berechne.js:87`
- **Beleg:** `const sqGrenze = dez => grenzsteuersatz(dez.brutto*(1-dez.kapital), 12084, 14, 45, 277826);`
- **Begründung:**
  - `PRESETS.status_quo.freibetrag` ist 12.348. Der Vergleichsgrenzsteuersatz nutzt 12.084.
  - Dadurch ist `labor_factor ≠ 1` schon im Status quo (Nachrechnung: `avg_labor = 1,000295`).
  - Die Netto-Δ je Dezil im Status quo sind ungleich null (+9 € für D1 bis −1 € für D10c).
  - Der Referenzpunkt ist nicht neutral.

### F-011 · schwer · T · SV-Ausgaben-Kopplung mit falscher Basis: +21,3 Mrd. € Ausgaben im Status quo
- **Fundstelle:** `js/rechner/berechne.js:288-292`
- **Beleg:** `SV_AUSG.kv   * (params.kv   / 16.3 - 1) +`
- **Begründung:**
  - Der KV-Satz im Status quo ist 17,5 (`data.js:150`). Die Normierung erfolgt aber auf 16,3.
  - Im Status quo entstehen dadurch 290 · (17,5/16,3 − 1) = +21,3 Mrd. € zusätzliche Ausgaben.
  - Sie stecken in jedem Saldo und jedem Szenario-Vergleich.

### F-012 · schwer · T · Investitionsfaktor im Status quo ≠ 1
- **Fundstelle:** `js/rechner/berechne.js:145`
- **Beleg:** `const investment_factor = 1 + ELAST.investment * ((params.kst + (params.gewst_aus ? 0 : params.gewst))/100 - 0.30);`
- **Begründung:**
  - Die Referenzbelastung ist mit 0,30 fest codiert. Der Status quo ergibt jedoch 15 + 14 = 29 %, damit `investment_factor = 1,004`.
  - Gewinne, KSt, GewSt, Verhaltensindex „Investition“ (100,4) und `dynamisch_kst` weichen im Status quo von ihren Basiswerten ab.
  - Zusätzlich fehlt der Soli auf die KSt (15,825 %), den die eigene Quelle G03 nennt.

### F-013 · schwer · W · Erhebungskosten der Steuern ersetzen die gesamten Verwaltungsausgaben
- **Fundstelle:** `js/rechner/berechne.js:268-282`, `:297`
- **Beleg:** `… + bge_brutto + admin_kosten - STAATSAUSGABEN.verwaltung - STAATSAUSGABEN.zinsen + zinsen_dyn …`
- **Begründung:**
  - `STAATSAUSGABEN.verwaltung` (140 Mrd. €) sind die allgemeinen Verwaltungsausgaben des Staates.
  - `admin_kosten` sind nur die Erhebungskosten der Abgaben (Quoten aus `ADMIN_QUOTE`), im Status quo 68,6 Mrd. €.
  - Durch die Ersetzung sinken die Staatsausgaben im Status quo um ca. 71 Mrd. €. Jede Steuerreform verändert zudem scheinbar die gesamte Staatsverwaltung.
  - Die Challenge „Verwaltungskosten unter 120 Mrd. €“ misst daher eine falsch definierte Größe.

### F-014 · schwer · W · BGE-Renteneinsparung gegen inkonsistente Ausgabenbasis
- **Fundstelle:** `js/rechner/berechne.js:220-234`; `js/data.js:89`
- **Beleg:** `const rv_ausgaben_basis = BASIS_MAKRO.rv_ausgaben_sq * (params.rv / 18.6) * renten_faktor;` · `rv_ausgaben_sq:     449,`
- **Begründung:**
  - In den Ausgaben ist die Rentenversicherung mit ca. 390 Mrd. € enthalten (`berechne.js:286`, `SV_AUSG.rv`). Die Einsparung wird aber gegen 449 Mrd. € gerechnet.
  - Preset „BGE“: `rv_einsparung = 321 Mrd. €`. Das sind 82 % des RV-Ausgabenanteils, der überhaupt im Haushalt steht.
  - Die Einsparung kann den enthaltenen Posten übersteigen.
  - Zusätzlich:
    - `rentner_h`/`rentner_g` (Summe 21 Mio.) sind unbelegt.
    - Die Durchschnittseinkommen `rl * 0.55` bzw. `rl * 1.80` sind ad hoc gesetzt.

### F-015 · schwer · W · Staatsausgaben: GKV doppelt, Gesamtvolumen zu niedrig
- **Fundstelle:** `js/data.js:43-52`; `js/rechner/berechne.js:286`; `data.json` `staatsausgaben_2026_mrd_eur`
- **Beleg:** `gesundheit:    320,  // Stand 2025, s.o.` · `// Sozial=850 enthält grob: RV ~390, GKV ~290, AL+PV ~90, Bürgergeld etc. ~80 Mrd.`
- **Begründung:**
  - Laut eigenem Kommentar enthält „sozial“ bereits die GKV (~290 Mrd. €). „gesundheit“ (320 Mrd. €) wird zusätzlich addiert. Das ist eine Doppelzählung.
  - Das Bürgergeld ist in „sozial“ enthalten und wird außerdem über `bg_auszahlung` separat addiert (`berechne.js:297`).
  - `llms.txt` und `data.json` veröffentlichen „Staatsausgaben Gesamtstaat 2026: ca. 1.888 Mrd. €“ als Datum. Nach VGR liegen die Ausgaben des Gesamtstaats bei rund 2,1 Bio. €.
  - Die Aufschlüsselung ist nach eigener Angabe eine „2025er-Schätzung“ ohne Primärquelle (`data.js:39-42`).

### F-016 · schwer · W · Rentenfonds: Erträge gleichzeitig ausgeschüttet und reinvestiert
- **Fundstelle:** `js/rechner/rente.js:61-72`
- **Beleg:** `ks_proj = (ks_proj + annual_inv) * (1 + params.rendite_fonds / 100);` · `const entlastung_y = (ertrag_y / lohnsumme_sv) * 100;`
- **Begründung:**
  - Der volle Jahresertrag wird als Beitragsentlastung verbucht und zugleich im Kapitalstock thesauriert. Ein Euro Ertrag wird damit zweimal verwendet.
  - Außerdem wird mit Nominalrendite (Default 7 %) gegen eine konstante nominale Lohnsumme gerechnet. Der eigene Hinweis „Inflationsabzug für Realrendite nötig“ (`rente.js:15`) wird nicht umgesetzt.
  - Beispiel Fondsquote 10 % ab 2010: Der Beitragssatz mit Fonds fällt bis 2045 auf die Untergrenze von 12 %.

### F-017 · schwer · T · PKV-Abschaffung: Einheitenfehler um Faktor 1.000
- **Fundstelle:** `js/rechner/rente.js:76-81`
- **Beleg:** `const pkv_zusatz_einnahmen = params.pkv_abschaffen ? pkv_versicherte * 0.60 * 12 / 1000 : 0; // Mrd.`
- **Begründung:**
  - 11 Mio. Personen × 600 €/Monat × 12 = 79,2 Mrd. €. Der Code liefert 0,0792 „Mrd.“.
  - Der Nettoeffekt beträgt −0,0066 Mrd. € statt der dokumentierten Größenordnung (`FORMEL_QUELLEN_RENTE.pkv_abschaffung.note`: „Einnahmen +~8 Mrd., Ausgaben +~8,5 Mrd.“).
  - Auch diese Dokumentation passt nicht zu den eigenen Parametern (0,60/0,65 T€ × 11 Mio. × 12).

### F-018 · schwer · W · „HANK“-Multiplikator konzeptionell falsch hergeleitet und kumulativ als Niveaueffekt angewandt
- **Fundstelle:** `js/rechner/transition.js:58-68`, `:106-108`
- **Beleg:** `return INVEST_MULTIPLIKATOR * (mpc_eff / HANK_MPC_BENCHMARK);` · `const invest_impuls_bonus = 1 + (invest_impuls * n * mu_g) / prevState.bip;`
- **Begründung:**
  - Der Multiplikator öffentlicher Investitionen wird mit der MPC-Verteilung der Netto-Δ aus der Steuerpolitik gewichtet. Beides hat keinen kausalen Zusammenhang, und Kaplan/Moll/Violante (2018) begründen das nicht (siehe F-039).
  - Der Impuls wird als Summe über n Jahre × Multiplikator als dauerhafter Niveauaufschlag auf das BIP gebucht und kumuliert sich über die Perioden.
  - Ergebnis im Szenario „Investitionsschub“ (60/60/30/0/0 Mrd. €/J.): BIP 2042 = 6.647 statt 5.640 Mrd. € (+17,9 %), auch nach Ende der Investitionen.
  - Das widerspricht der zitierten Meta-Literatur zu Multiplikatoren, die kurzfristige Flusseffekte beschreibt.

### F-019 · schwer · W · Zwei widersprüchliche Fiskalmultiplikatoren
- **Fundstelle:** `js/haushaltsspiel.js:387`; `js/rechner/transition.js:33`
- **Beleg:** `label: 'BIP-Impuls (Multiplikator 0,65)',` · `const INVEST_MULTIPLIKATOR = 1.2;    // Fiskalmultiplikator öffentl. Investitionen (Gechert/Heimberger)`
- **Begründung:**
  - Dieselbe Oberfläche zeigt einen Multiplikator von 0,65 und rechnet in der Zukunftssimulation mit 1,2.
  - Beide werden unterschiedlichen, nicht spezifizierten Quellen zugeschrieben.

### F-020 · schwer · W · Schuldenbremse falsch operationalisiert
- **Fundstelle:** `js/rechner/berechne.js:391-394`; `index.html:572`; `js/data.js:327`
- **Beleg:** `const schuldenbremse_ok = saldo_bip_pct >= -0.35;` · `Grenze: −0,35 % BIP (Bund)`
- **Begründung:**
  - Art. 115 GG begrenzt die strukturelle Nettokreditaufnahme des Bundes. Das Modell wendet die Grenze auf den Saldo des Gesamtstaats einschließlich Sozialversicherung an, ohne Konjunkturbereinigung und ohne finanzielle Transaktionen.
  - Die Grundgesetzänderung vom März 2025 fehlt:
    - Ausnahme für Verteidigungsausgaben über 1 % des BIP
    - Spielraum der Länder von 0,35 % des BIP
    - Sondervermögen Infrastruktur
  - Die Live-Seite meldet im Status quo „✗ verletzt -1,99 % BIP“. Das ist keine korrekte Aussage über die Schuldenbremse.

### F-021 · schwer · W · Gini, Palma und S80/S20 nicht äquivalenzgewichtet; widerspricht Konzept und Benchmark
- **Fundstelle:**
  - `js/rechner/verteilung.js:46-84`
  - `js/data.js:11` (Feld `gewicht`, nirgends verwendet), `js/data.js:613`
  - `Konzept_Steuersimulation.md:51`, `:58`
- **Beleg:** `const pairs = werte.map((v, i) => ({ v, n: dez[i].anzahl })).sort((a, b) => a.v - b.v);` · Konzept: „10 Dezile des Nettoäquivalenzeinkommens“ · Benchmark: `gini:   'DE: 0,295 · DK: 0,281 · SE: 0,273 · US: 0,395'`
- **Begründung:**
  - Die amtlichen Ungleichheitsmaße (EU-SILC/Destatis) beruhen auf dem Nettoäquivalenzeinkommen (neue OECD-Skala) je Person.
  - Das Modell berechnet sie auf Haushaltsnettoeinkommen je Haushalt. Das vorhandene Feld `gewicht` (1,3–2,0) wird nie verwendet.
  - Gini im Status quo: 0,357, direkt neben dem Benchmark 0,295. Palma im Status quo: 6,36 (OECD-Werte für DE ca. 1,1). Die Werte sind nicht vergleichbar.
  - Weil Gruppenmittelwerte verwendet werden, ist die Ungleichheit innerhalb der Gruppen zudem gleich null.
  - Die Challenges (`gini_285`, `palma_18`) beziehen sich implizit auf die amtliche Skala.

### F-022 · schwer · W · Laffer-Kurve zeigt kein Maximum; Tooltip behauptet das Gegenteil
- **Fundstelle:** `js/render/laffer.js:31-34`; `js/data.js:405`; `quellen.html:378`
- **Beleg:** `for (let s = 5; s <= 75; s += 2.5) {` · Tooltip: „ifo/Fuest: ab ~55% sinkt Aufkommen durch Verhaltensreaktion (Laffer-Kurve sichtbar im Modell).“
- **Begründung:**
  - Nachrechnung: Das ESt-Aufkommen steigt monoton (45 % → 675, 55 % → 746, 75 % → 850 Mrd. €). Im dargestellten Bereich gibt es kein Maximum.
  - Der Tooltip und Quelle A15 („Aufkommensmaximum bei ~65–70 %“) behaupten jedoch ein sichtbares Maximum.
  - Außerdem verändert der Regler „Spitze“ über `satz4 = 0,05·eingang + 0,95·spitze` auch den Satz der gesamten 42-%-Zone. Für `spitze < eingang` fallen die Grenzsteuersätze.
  - Die Kurve bildet daher keine Variation des Spitzensteuersatzes ab.

### F-023 · schwer · Z · Rentenpaket II / Generationenkapital als geltendes Recht dargestellt
- **Fundstelle:** `js/data.js:480` (Tooltip `rv`), `:520`, `:530`; `quellen.html:769-774` (B32); `js/rechner/rente.js:14`
- **Beleg:** „Rentenpaket II 2024: 12 Mrd./Jahr ab 2024 beschlossen“ · „Deutschland hat erst 2024 begonnen.“ · `quelle:'Bundesgesetzblatt 2024',`
- **Begründung:**
  - Der Gesetzentwurf wurde im Herbst 2024 im Bundestag beraten und ist mit dem Ende der Koalition im November 2024 nicht verabschiedet worden ([Bundestag Textarchiv](https://www.bundestag.de/dokumente/textarchiv/2024/kw42-pa-arbeit-rentenpaket-1022606)).
  - Eine Verkündung im Bundesgesetzblatt existiert nicht, und es fließen keine 12 Mrd. €/Jahr in ein Generationenkapital.
  - Die Angabe „BT-Drs. 20/10749“ ist nicht nachvollziehbar belegt.

### F-024 · schwer · Z · Brülhart et al. falsch zitiert und sachfremd verwendet
- **Fundstelle:** `quellen.html:324-331` (A09); `js/data.js:123`, `:136`
- **Beleg:** `quelle:'American Economic Journal: Economic Policy, 11(4), 1–37',` · `doi:'10.1257/pol.20180598',` · `// Steuerbedingte Emigration bei GS > 60% (Brülhart et al. 2019)`
- **Begründung:**
  - Die korrekten Angaben lauten: AEJ: Economic Policy 14(4), 2022, S. 111–150, DOI 10.1257/pol.20200258 ([AEA](https://www.aeaweb.org/articles?id=10.1257%2Fpol.20200258)). Band, Seiten, Jahr und DOI im Verzeichnis sind falsch.
  - Die Studie untersucht die Reaktion auf die kantonale Vermögensteuer. Sie liefert keine Emigrationselastizität für Einkommensteuer-Grenzsätze über 60 %, wofür `ELAST.d10c_wegzug` sie heranzieht.

### F-025 · schwer · Z · Jakobsen et al. mit falschen Autoren und falschem Publikationsort
- **Fundstelle:** `quellen.html:428-433` (A22); `js/rechner/berechne.js:44-47`, `:202`
- **Beleg:** `autor:'Jakobsen, K., Kleven, H. & Kolsrud, J.',` · `quelle:'NBER Working Paper (überarbeitete Fassung)',`
- **Begründung:**
  - Die Publikation lautet: Jakobsen, K., Jakobsen, K., Kleven, H. & Zucman, G. (2020), QJE 135(1), 329–388, DOI 10.1093/qje/qjz032 ([OUP](https://academic.oup.com/qje/article-abstract/135/1/329/5584349)).
  - „Kolsrud“ ist kein Koautor.
  - Der verwendete Wert „Avoidance 15 % bei 2 % Satz“ ist dort nicht in dieser Form ausgewiesen.

### F-026 · schwer · Z · Tarif-Rechtsgrundlage, Grundfreibetrag 2025 und Kindergeld falsch angegeben
- **Fundstelle:** `quellen.html:839`, `:963-968` (G17); `js/data.js:395`, `:505`
- **Beleg:** „Einkommensteuergesetz i.d.F. des Steueränderungsgesetzes Oktober 2025 · Grundfreibetrag 12.084 €, ab 2026: 12.348 €“ · „Ab 2025: 259 € (Steueränderungsgesetz Okt. 2025)“
- **Begründung:**
  - Der Grundfreibetrag 2025 beträgt 12.096 €, 2026 12.348 €. Beide wurden durch das Steuerfortentwicklungsgesetz vom 23.12.2024 festgelegt ([Haufe](https://www.haufe.de/steuern/gesetzgebung-politik/steuerfortentwicklungsgesetz_168_628032.html)), nicht durch ein „Steueränderungsgesetz Oktober 2025“.
  - Das Kindergeld betrug 2025 255 € und beträgt erst ab 2026 259 €.
  - Die Default-Werte im HTML (`index.html:224` `value="12084"`, `:430` `value="255"`) übernehmen die falschen bzw. veralteten Werte.

### F-027 · schwer · Z · DICE-Parameter falsch zugeordnet
- **Fundstelle:** `js/rechner/transition.js:21`, `:34`, `:72`
- **Beleg:** `const DICE_D2              = 0.00267; // DICE-Schadensparameter d₂ (Nordhaus 2023; kalibriert AR6)`
- **Begründung:**
  - DICE-2023 (Barrage & Nordhaus, PNAS 121(13), 2024) verwendet γ = 0,003467. DICE-2016R2 verwendet 0,00227 ([PNAS](https://www.pnas.org/doi/abs/10.1073/pnas.2312030121)).
  - 0,00267 entspricht keiner der beiden Versionen.
  - Einen „Nordhaus (2023) PNAS“ mit dem Titel „An Optimal Transition Path“ gibt es in dieser Form nicht.

### F-028 · schwer · W/Z · Bürgergeld: falsche Bezugsgröße und nur Regelsatz Alleinstehender
- **Fundstelle:** `js/data.js:500`; `js/rechner/berechne.js:238`
- **Beleg:** „~5,5 Mio. Bedarfsgemeinschaften“ · `const bg_auszahlung = 5.5 * bg_effektiv * 12 / 1000; // Mrd.`
- **Begründung:**
  - Rund 5,5 Mio. ist die Zahl der Leistungsberechtigten. Bedarfsgemeinschaften gibt es etwa 2,9 Mio. (BA-Statistik).
  - Der Code multipliziert 5,5 Mio. mit dem Regelsatz für Alleinstehende (563 €). Kinder haben aber niedrigere Regelbedarfsstufen, und Kosten der Unterkunft sowie Heizung fehlen.
  - Ausgaben und Einsparungen bei BGE bzw. Bürgergeldreform sind damit in ihrer Zusammensetzung falsch.

### F-029 · schwer · T (Sicherheit) · GitHub-Workflow: Kostenmissbrauch und Prompt-Injection durch beliebige Nutzer
- **Fundstelle:** `.github/workflows/claude-gutachter.yml:6-7`; `.github/scripts/claude_review.py:111-116`, `:157-158`, `:177-181`
- **Beleg:** `issues:` / `types: [opened]` · `Issue-Inhalt: {ISSUE_BODY}` · `PR-Beschreibung: {PR_BODY}`
- **Begründung:**
  - Jeder GitHub-Account kann durch Öffnen eines Issues einen bezahlten Aufruf der Anthropic-API mit dem Repository-Secret auslösen. Es gibt keine Autoren- oder Häufigkeitsbegrenzung, also ist Kostenmissbrauch möglich.
  - Issue- bzw. PR-Text und Diff werden unmaskiert in den Prompt eingesetzt. Die Modellausgabe wird ungeprüft mit `issues: write` als Kommentar unter der Identität von `github-actions` gepostet.
  - Ein Angreifer kann so gezielt Inhalte, etwa Links oder falsche „ANNEHMEN“-Empfehlungen, im Namen des Projekts veröffentlichen lassen.

### F-030 · schwer · W · Altersvorsorge-Rechner rechnet Kapitalbedarf ohne Inflation und korrigiert in die falsche Richtung
- **Fundstelle:** `finanz.html:1632-1659`
- **Beleg:** `const benoetigtesKapital = luecke * 12 / 0.04;` · `const realWunsch = p.wunschrente / Math.pow(1 + p.inflation / 100, jahre);`
- **Begründung:**
  - Wunschrente und gesetzliche Rente werden in heutiger Kaufkraft eingegeben. Die Lücke wird ohne Inflationierung bis zum Rentenbeginn in einen nominalen Kapitalbedarf umgerechnet, und die Sparrate wird mit nominaler Rendite berechnet.
  - Der Wert „Real (inflat.)“ zinst die Wunschrente ab, statt sie auf den künftigen Nominalwert hochzurechnen.
  - Beispiel 30 Jahre bei 2 % Inflation: Kapitalbedarf und Sparrate sind um den Faktor ~1,8 zu niedrig.

### F-031 · schwer · T · Regler „Rentenphase“ ohne Wirkung; 4-%-Regel fix und unbelegt
- **Fundstelle:** `finanz.html:1672`, `:1635`
- **Beleg:** `rentenphase:   +document.getElementById('rentenphase').value,` · `const benoetigtesKapital = luecke * 12 / 0.04;`
- **Begründung:**
  - `p.rentenphase` wird eingelesen und angezeigt, geht aber in keine Berechnung ein. Der Nutzer sieht bei jeder Rentenphase dasselbe Ergebnis.
  - Die feste Entnahmerate von 4 % stammt aus US-Daten für 30-jährige Entnahmezeiträume (Bengen 1994) und ist nicht zitiert.

### F-032 · schwer · W · Kredit-Rechner: Szenarienvergleich asymmetrisch
- **Fundstelle:** `finanz.html:1470-1488` vs. `:1497-1508`
- **Beleg:** `if (restschuld <= 0) break;` · `portfolioB = (portfolioB + extraMonthly_B) * (1 + ri);`
- **Begründung:**
  - In Szenario A (Sondertilgung) entfallen nach vorzeitiger Tilgung Rate und Zusatzbudget ersatzlos und werden nicht investiert.
  - In Szenario B fließt das Budget bis zum Laufzeitende ins Portfolio.
  - Der Vergleich begünstigt damit systematisch „Investieren“, und das Gewinner-Banner ist verzerrt.

### F-033 · schwer · W/Z · Markup als Lerner-Index ausgegeben
- **Fundstelle:** `mikro.html:974`
- **Beleg:** `Empirisch: Meta/Google ≈ 0,5–0,6 · US-Wirtschaft Ø: 0,21 (1980) → 0,61 (2016).`
- **Begründung:**
  - De Loecker/Eeckhout/Unger (2020, QJE; Quelle A14) berichten Markups μ = P/MC von 1,21 (1980) auf 1,61 (2016).
  - Der Lerner-Index beträgt L = 1 − 1/μ, also ≈ 0,17 → 0,38. Die Seite gibt die Nachkommastellen des Markups als Lerner-Index aus.
  - „Meta/Google ≈ 0,5–0,6“ ist unbelegt.

---

## Leicht

### F-034 · leicht · W · Arbeitsangebotsfaktor skaliert auch Kapitaleinkommen
- **Fundstelle:** `js/rechner/berechne.js:120`
- **Beleg:** `return { ...d, labor_factor: lf, brutto_adj: d.brutto * lf, gs_neu, avoidance };`
- **Begründung:** Die Reaktion auf den Grenzsteuersatz für Arbeit wird auf das gesamte Bruttoeinkommen angewandt, einschließlich Kapitalanteil (bei D10c 45 %).

### F-035 · leicht · W · Armutsrisikoquote nicht auf den genannten Wert kalibriert
- **Fundstelle:** `js/rechner/berechne.js:335-339`
- **Beleg:** `// Kontinuierliches Intra-Dezil-Modell — kalibriert auf EU-SILC DE 2023 (14,8 %)` · `const POV_SQ = [0.90, 0.62, 0.05, 0, 0, 0, 0, 0, 0, 0, 0, 0];`
- **Begründung:**
  - (0,90 + 0,62 + 0,05) · 4,1/41 = 15,7 %. Die Nachrechnung ergibt 15,69 % statt der angegebenen 14,8 %.
  - Die Anteile „D1 90 %, D2 62 %“ sind nicht an einer konkreten Tabelle belegt.
  - Die Elastizität −1,5 stammt aus der Literatur zur Wachstumselastizität absoluter Armut in Entwicklungsländern (siehe F-040).

### F-036 · leicht · W · Soli und Sparerpauschbetrag fehlen
- **Fundstelle:** `js/rechner/berechne.js:137`; `js/rechner/verteilung.js:151-152`
- **Beleg:** `est_kap = kapital * params.abgeltung / 100;`
- **Begründung:**
  - Die Abgeltungsteuer wird ohne Soli (effektiv 26,375 %) und ohne Sparerpauschbetrag gerechnet. Die eigenen Tooltips und die Quelle G02 nennen beides.
  - Der Solidaritätszuschlag auf die veranlagte ESt fehlt im Tarif vollständig.

### F-037 · leicht · W · „Zucman-Mindeststeuer“ auf falsche Bemessungsgrundlage
- **Fundstelle:** `js/rechner/berechne.js:199-205`, `:46`
- **Beleg:** `const zucman_basis = 2870;` · „0,41 Mio. HH × 7 Mio. € Median-Vermögen“
- **Begründung:**
  - Der Vorschlag von Zucman (2024) betrifft Milliardäre (weltweit ca. 3.000 Personen), nicht die obersten 1 % der Haushalte.
  - Das Datenfeld ist als Durchschnitt beschrieben (`data.js:25`), wird hier aber als „Median“ bezeichnet.
  - Die Bemessungsgrundlage ist um Größenordnungen zu breit.

### F-038 · leicht · Z · Gechert/Heimberger falsch zitiert und als Multiplikatorquelle missbraucht
- **Fundstelle:** `js/data.js:133`; `js/rechner/transition.js:33`
- **Beleg:** `ref: 'Gechert/Heimberger (2022) NIER · …'`
- **Begründung:**
  - Das Paper ist im European Economic Review 147 (2022) erschienen (so auch korrekt in `quellen.html` A20), nicht im NIER.
  - Es ist eine Meta-Regression zu Körperschaftsteuersenkungen und Wachstum. Es liefert weder einen Multiplikator von 1,2 für öffentliche Investitionen noch eine Investitionselastizität von −0,40.

### F-039 · leicht · Z · Kaplan/Moll/Violante (2018) sachfremd zitiert
- **Fundstelle:** `js/rechner/transition.js:20`, `:51`
- **Beleg:** `//   HANK-Multiplikator: Kaplan/Moll/Violante (2018) AER · McKay/Nakamura/Steinsson (2016)`
- **Begründung:** „Monetary Policy According to HANK“ (AER 108(3), 2018) behandelt die Transmission der Geldpolitik. Es enthält keinen MPC-gewichteten Investitionsmultiplikator in der hier implementierten Form.

### F-040 · leicht · Z · Bourguignon (2003) falsch zugeordnet
- **Fundstelle:** `js/rechner/verteilung.js:30`; `js/rechner/berechne.js:350`
- **Beleg:** `ref:    'Bourguignon (2003) JPubEc · …'`
- **Begründung:**
  - „The Growth Elasticity of Poverty Reduction“ ist ein Buchkapitel (Eicher/Turnovsky (Hrsg.), Inequality and Growth, MIT Press 2003), kein JPubEc-Artikel.
  - Es betrifft absolute Armut, nicht die relative Armutsrisikoquote.

### F-041 · leicht · Z · „WHO 2017“ und „Reinhardt 2004“ belegen die Parameter nicht
- **Fundstelle:** `js/rechner/rente.js:29`, `:34`; `quellen.html` B28
- **Beleg:** `ref:    'GKV-SV Jahresbericht 2025 · Reinhardt et al. Health Affairs 2004',` · `ref:    'WHO (2017) Return on Investment of Public Health Interventions · …'`
- **Begründung:**
  - Die systematische Übersicht ist Masters, R. et al. (2017), J Epidemiol Community Health 71(8), keine WHO-Publikation.
  - Reinhardt et al. (2004) ist ein internationaler Ausgabenvergleich und belegt keine Fixkostendegression von 45 % bei Kassenfusionen.
  - Der Code-Kommentar nennt zudem „EU-Studie: 1€ → 3€“ (`rente.js:89`). Das widerspricht der Quellenangabe.

### F-042 · leicht · Z · Veraltete Bevölkerungsvorausberechnung
- **Fundstelle:** `js/rechner/transition.js:23`; `js/data.js` (`DEMOGRAFIE_KURVE`)
- **Beleg:** `//   Demografie:         Destatis 14. Bev.-Vorausberechnung 2021 · DEMOGRAFIE_KURVE in data.js`
- **Begründung:**
  - Maßgeblich ist die 15. koordinierte Bevölkerungsvorausberechnung (Destatis, Dezember 2022).
  - Die Ankerwerte `renten_faktor` 1,06/1,14/… sind keiner Tabelle zugeordnet.

### F-043 · leicht · Z · PKV-Versichertenzahl zu hoch
- **Fundstelle:** `js/rechner/rente.js:76`; `js/data.js` (Tooltip `pkv_abschaffen`)
- **Beleg:** `const pkv_versicherte = 11; // Mio.`
- **Begründung:** Laut PKV-Zahlenbericht (Quelle B24) gibt es ca. 8,7 Mio. Vollversicherte. 11 Mio. ist ohne Beleg.

### F-044 · leicht · Z · RV-Beitragspfad unbelegt und über offiziellen Projektionen
- **Fundstelle:** `js/rechner/rente.js:57-58`, `:20`
- **Beleg:** `const demo_anstieg = 0.30;` · `'+0,3 PP/Jahr bis 2045 ohne Reform (konservativer SVR-Wert).'`
- **Begründung:**
  - Das ergibt 24,6 % im Jahr 2045. Der Rentenversicherungsbericht 2024 bzw. die Begründung zum Rentenpaket II weisen etwa 22,3 % aus.
  - Ein „SVR-Wert 0,3 PP/Jahr“ ist nicht nachgewiesen.

### F-045 · leicht · Z · Kleven/Schultz und Lewbel/Pendakur mit falscher Zeitschrift; EASI belegt keine MwSt-Elastizität
- **Fundstelle:** `js/data.js:129-130`; `js/rechner/berechne.js:30`, `:151`
- **Beleg:** `capital_supply: { ref: 'Kleven/Schultz (2014) JPubEc', …` · `consumption:    { ref: 'Lewbel/Pendakur (2009) JPubEc · …'`
- **Begründung:**
  - Die Quellen erschienen in AEJ: Economic Policy 6(4) bzw. AER 99(3); so auch `quellen.html` A23/A25.
  - Das EASI-Nachfragesystem ist eine Methodik und liefert keine Konsumelastizität gegenüber dem MwSt-Satz von −0,35.
  - Kleven/Schultz schätzt Elastizitäten des zu versteuernden Einkommens (ETI), keine „Kapitalangebotselastizität 0,5“.

### F-046 · leicht · Z · Arbeitsangebotselastizität inkonsistent belegt
- **Fundstelle:** `js/data.js:114`, `:128`; `quellen.html` A21; `js/haushaltsspiel.js:416`
- **Beleg:** `labor_supply: 0.20,      // Saez/Chetty konsens`
- **Begründung:**
  - Im Code heißt es „Saez/Chetty/Gruber Konsens“, im Verzeichnis Gruber & Saez (2002), in der Oberfläche „Gruber/Saez 2002“.
  - Gruber/Saez schätzt die Elastizität des zu versteuernden Einkommens (ETI; ca. 0,4 bzw. 0,12 für das breite Einkommen), nicht die Arbeitsangebotselastizität.

### F-047 · leicht · Z · Kleven/Landais unvollständig und ungenau
- **Fundstelle:** `quellen.html:444-449` (A24)
- **Beleg:** `autor:'Kleven, H. & Landais, C.',` · `titel:'Tax Migration and the Limits of Tax Policy',`
- **Begründung:** Die Publikation lautet: Kleven, H., Landais, C., Muñoz, M. & Stantcheva, S. (2020), „Taxation and Migration: Evidence and Policy Implications“, JEP 34(2), 119–142.

### F-048 · leicht · Z · Doerrenberg/Peichl als Beleg für ein Laffer-Maximum
- **Fundstelle:** `quellen.html:378` (A15)
- **Beleg:** `verwendet:'Laffer-Kurve · ZEW-Schätzung: Aufkommensmaximum bei ~65–70 % Spitzensteuersatz für Deutschland'`
- **Begründung:** Das Paper untersucht den Zusammenhang zwischen Umverteilungspolitik und Ungleichheit in OECD-Ländern und schätzt kein aufkommensmaximierendes Steuersatzniveau für Deutschland.

### F-049 · leicht · Z · Klimageld mit dem Koalitionsvertrag 2025 belegt
- **Fundstelle:** `js/data.js:456`
- **Beleg:** `quelle: "PIK Potsdam · Edenhofer/Franks/Kalkuhl (2021) Nature Climate Change · Koalitionsvertrag 2025"`
- **Begründung:** Der Koalitionsvertrag 2025 sieht keine Pro-Kopf-Rückzahlung im Sinne des Moduls vor. Zusammen mit F-004 entsteht so der Eindruck geltender Politik.

### F-050 · leicht · W · `data.json` falsch bezeichnet und nicht monoton
- **Fundstelle:** `data.json:121` sowie Felder `vermoegen_median_eur`; `js/data.js:19`, `:21`
- **Beleg:** `"grunderwerbsteuer": 16,` · D9 `vermoegen: 620000` vs. D10a `vermoegen: 450000`
- **Begründung:**
  - Der Wert 16 Mrd. € ist die Grundsteuer (`data.js` `grundst`, Tooltip „Akt. GrSt: 16 Mrd.“), nicht die Grunderwerbsteuer.
  - Das Vermögen von D10a liegt unter dem von D9, obwohl die Gruppen nach Einkommen aufsteigend sortiert sind. Das ist unplausibel.
  - „median“ widerspricht der Beschreibung als Durchschnitt.
  - `data.json` wird als maschinenlesbare Primärdatenquelle veröffentlicht (`llms.txt`).

### F-051 · leicht · Z · Veraltete KV-Beitragsbemessungsgrenze in Tooltips
- **Fundstelle:** `js/data.js:560`, `:565`
- **Beleg:** „Derzeit: nur auf Arbeitseinkommen bis BBG (66.150 €).“
- **Begründung:** 66.150 € ist die BBG 2025. Das Modell rechnet mit 69.750 € (2026). Auch die Bezugssätze „16,3 %“ passen nicht zum Status quo 17,5 %.

### F-052 · leicht · W · Vermögensteuer-Tooltip in sich widersprüchlich
- **Fundstelle:** `js/data.js:475`
- **Beleg:** „Linke-Modell erzielt ~100 Mrd./Jahr; bei Freibetrag 10–20 Mio. immer noch 110–125 Mrd.“
- **Begründung:** Ein höherer Freibetrag verkleinert die Bemessungsgrundlage. Ein höheres Aufkommen als beim Modell mit niedrigerem Freibetrag ist ohne zusätzliche Erläuterung (z. B. höhere Sätze) nicht plausibel.

### F-053 · leicht · T · Veraltete Default-Werte bei fehlenden Parametern
- **Fundstelle:** `js/haushaltsspiel.js:107`; `index.html:353`
- **Beleg:** `document.getElementById('bbg').value = p.bbg ?? 90000;` · `id="bbg" … value="90000"`
- **Begründung:** Share-Links oder gespeicherte Sitzungen ohne `bbg` erhalten eine BBG von 90.000 € statt 101.400 €. Ebenso stehen in `index.html` weitere veraltete Startwerte (`freibetrag` 12.084, `kg` 255).

### F-054 · leicht · T · `?preset=` akzeptiert geerbte Objekteigenschaften; Hash-Parameter ungeprüft
- **Fundstelle:** `js/haushaltsspiel.js:1373-1381`, `:1082-1084`
- **Beleg:** `if (_urlPreset && PRESETS[_urlPreset]) {` · `try { return JSON.parse(atob(hash.slice(1))); } catch { return null; }`
- **Begründung:**
  - `?preset=constructor` (bzw. `toString`) ist truthy. `setParams(Object)` setzt dann alle Regler auf `undefined`, also auf ihre Mittelwerte. Im Browser verifiziert: `freibetrag=15000`, `spitze=48`, `co2=150`.
  - Hash-Objekte mit fehlenden Feldern führen zum selben Effekt.
  - Eine Code-Ausführung ist nicht möglich, weil alle Werte in Regler bzw. Checkboxen geschrieben werden.

### F-055 · leicht · W · Benchmark „Einnahmen“ in sich widersprüchlich und nicht vergleichbar
- **Fundstelle:** `js/data.js:612`
- **Beleg:** `einn:   'DE 2024: ~1.450 Mrd. · Steuerquote 22 % BIP',`
- **Begründung:** 1.450 Mrd. € entsprechen bei einem BIP von ca. 4.300 Mrd. € rund 34 %, nicht 22 %. Der Modellwert (1.836 Mrd. €) enthält Sozialbeiträge, der Benchmark offenbar nicht.

### F-056 · leicht · T · Challenges: ID und Ziel inkonsistent; „tägliches“ Ziel praktisch unerreichbar
- **Fundstelle:** `js/data.js:270-272`, `:282-284`
- **Beleg:** `{ id:'armut_16', diff:'daily', title:'Armutsreduktion', desc:'Armutsrisikoquote unter 8 %'` · `{ id:'palma_18', diff:'daily', … desc:'Palma-Koeffizient unter 1,8 senken'`
- **Begründung:**
  - Die IDs kodieren andere Schwellen als die Beschreibungen (16 vs. 8; `armut_14` vs. „unter 5 %“).
  - Palma im Status quo 6,36; selbst die umverteilendsten Presets erreichen nur 2,61–2,77. Als „leichte“ Tagesaufgabe ist das ungeeignet (Folge von F-021).

### F-057 · leicht · T · S80/S20-Balken mit Referenzwert 0
- **Fundstelle:** `js/haushaltsspiel.js:323-338`
- **Beleg:** `ref: 0, max: 15, fmt: v => v.toFixed(1).replace('.',',') }`
- **Begründung:** Mit `ref: 0` gilt immer `value > ref`, und der Balken wird stets als Verschlechterung eingefärbt. Zudem gilt F-021 (Haushalts- statt Äquivalenzeinkommen).

### F-058 · leicht · W/Z · „Automatische Stabilisatoren“ als Durchschnitt der METR
- **Fundstelle:** `js/haushaltsspiel.js:384`, `:400`
- **Beleg:** `const stab_index = r.metr.slice(0, 4).reduce((a, m) => a + m, 0) / 4 * 100; // Ø METR D1–D4 als Stabilisierungsgrad` · `(Dolls et al. 2020)`
- **Begründung:**
  - Der Stabilisierungskoeffizient nach Dolls/Fuest/Peichl (J Public Econ 96, 2012) misst den Anteil eines aggregierten Einkommensschocks, der durch das Steuer-Transfer-System absorbiert wird.
  - Die mittlere Grenzbelastung der unteren vier Dezile ist ein anderes Konzept. Die Jahresangabe 2020 ist nicht nachvollziehbar.

### F-059 · leicht · W · Finanzrechner: Verzinsungskonvention und Steuern vereinfacht, nicht offengelegt
- **Fundstelle:** `finanz.html:1321`, `:1336`, `:1204`
- **Beleg:** `const r = p.rendite / 100 / 12;` · `const steuerAbzug    = renditeGewinn * p.steuer / 100;` · `const blendedRendite = (stockPct * 7 + bondPct * 2.5 + cashPct * 3) / 100;`
- **Begründung:**
  - Die eingegebene Jahresrendite wird als Nominalzins mit monatlicher Verzinsung behandelt: 7 % ergeben effektiv 7,23 %.
  - Einzahlungen sind vorschüssig verzinst, ohne Hinweis.
  - Sparerpauschbetrag, Teilfreistellung (§ 20 InvStG) und Soli fehlen.
  - Die Renditeannahmen (Tagesgeld 3 % > Anleihen 2,5 %) sind unbelegt.

### F-060 · leicht · T · `JSON.parse` auf localStorage ohne Fehlerbehandlung
- **Fundstelle:** `finanz.html:1279`, `:1784-1785`
- **Beleg:** `const p = JSON.parse(saved);` · `Object.assign(answers, JSON.parse(savedAnswers));`
- **Begründung:**
  - Ein beschädigter oder fremd gesetzter localStorage-Eintrag wirft eine Ausnahme in `init()`. Die Initial-Renders der Rechner entfallen dann.
  - Ist localStorage gesperrt (Privatmodus/Richtlinie), wirft schon `localStorage.getItem`.

### F-061 · leicht · T · Monopolmodell erzeugt negative Mengen
- **Fundstelle:** `mikro.html:387`, `:894`
- **Beleg:** `id="mo_mc" min="5" max="70"` · `const Qm = (Pd0 - MC) / (2 * sd);`
- **Begründung:**
  - Der Prohibitivpreis beginnt schon bei 60, die Grenzkosten gehen bis 70.
  - Für MC ≥ Pd0 werden negative Mengen, negative Gewinne und ein negativer Lerner-Index ausgegeben, statt „kein Markt“ anzuzeigen.

### F-062 · leicht · W · Steuerinzidenz: angezeigte Elastizitäten sind nicht die Modellelastizitäten
- **Fundstelle:** `mikro.html:671`
- **Beleg:** `const ss = sd * ed / es;  // supply slope so that elasticity ratio matches`
- **Begründung:**
  - Nur das Verhältnis ε_D/ε_S wird getroffen. Die Punktelastizitäten im Gleichgewicht weichen von den angezeigten Werten ab (z. B. ε_D = P₀/Q₀ = 1,22 bei gleichen Reglern).
  - Die Lastverteilung selbst ist korrekt.

### F-063 · leicht · Z · Elastizitätsangaben im Mikrolabor unbelegt bzw. widersprechen der eigenen Quelle
- **Fundstelle:** `mikro.html:652`, `:974`
- **Beleg:** `Benzin ε ≈ −0,25 · Lebensmittel ε ≈ −0,27 · Restaurants ε ≈ −2,3.`
- **Begründung:** Die eigene Quelle A01 (Andreyeva et al. 2010) nennt für „food away from home“ 0,81. Für −2,3 fehlt ein Beleg, ebenso für „Meta/Google ≈ 0,5–0,6“.

### F-064 · leicht · T · Workflow scheitert bei jedem Fork-PR
- **Fundstelle:** `.github/workflows/claude-gutachter.yml:3-5`; `.github/scripts/claude_review.py:188-190`
- **Beleg:** `if not ANTHROPIC_API_KEY:` … `sys.exit(1)`
- **Begründung:** Bei `pull_request` aus Forks stellt GitHub keine Secrets bereit. Das Skript beendet sich mit Exit 1, und jeder externe Beitrag erhält einen roten Check.

### F-065 · leicht · T · Unvollständige Fehlerbehandlung im Review-Skript
- **Fundstelle:** `.github/scripts/claude_review.py:67-73`, `:89-92`
- **Beleg:** `except urllib.error.HTTPError as e:`
- **Begründung:**
  - `URLError`, Timeouts und `KeyError`/`IndexError` bei unerwarteter API-Antwort werden nicht abgefangen.
  - Fehler beim Posten führen nicht zu einem Fehler-Exitcode. Ein fehlgeschlagener Kommentar bleibt unbemerkt.

### F-066 · leicht · T · Action nicht per Commit-SHA gepinnt
- **Fundstelle:** `.github/workflows/claude-gutachter.yml:18`
- **Beleg:** `- uses: actions/checkout@v4`
- **Begründung:** Ein veränderlicher Tag in einem Workflow mit `pull-requests: write`/`issues: write` und Zugriff auf ein bezahltes API-Secret ist ein Supply-Chain-Risiko. Empfohlen ist Pinning per SHA.

### F-067 · leicht · T · Keine Security-Header
- **Fundstelle:** Repository-Wurzel (keine `_headers`-Datei; nur `_redirects`)
- **Beleg:** Verzeichnisinhalt: `_redirects`, kein `_headers`
- **Begründung:**
  - Für Cloudflare Pages sind keine Header wie `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy` und `frame-ancestors` definiert.
  - Die Seite nutzt ausgiebig `innerHTML` und lädt Drittskripte (F-001). Eine CSP wäre hier die zweite Verteidigungslinie.

---

## Geprüft ohne Befund (Auswahl)

- Keine XSS-Einfallstore in `quellen.html`: Die Suche filtert nur statische Daten.
- Hash/Preset/localStorage im Haushaltsspiel: Alle Werte laufen über DOM-Regler und werden in Zahlen bzw. Booleans umgewandelt.
- `finanz.html`/`mikro.html`: Es werden nur numerische Werte interpoliert.
- Workflow: Externe Texte werden per `env` übergeben, nicht per `${{ }}` im `run`-Block. Keine Shell-Injection.
- Korrekt implementiert:
  - Annuitätenformel (`finanz.html`)
  - Konsumenten- und Produzentenrente, Inzidenzaufteilung, Lohnelastizität im Mindestlohnmodell (`mikro.html`)
  - MwSt-Herausrechnung t/(1+t)
  - Harberger-Formel des DWL-Terms (unter den Annahmen des Modells)
  - Grenzsteuersatz-Definition des Arbeitsangebotsfaktors
- Aktuelle Werte 2026 zutreffend:
  - RV-BBG 101.400 €, KV-BBG 69.750 €
  - RV 18,6 %, allgemeiner KV-Satz 14,6 % + Ø-Zusatzbeitrag 2,9 %
  - Regelsatz 563 €, Kindergeld 259 €, Mindestlohn 13,90 €

---

## Nachträge aus der Umsetzung (Phase 4)

### F-068 · schwer · W · Kinder je Haushalt ergeben das Doppelte der Kindergeldkinder
- **Fundstelle:** `js/rechner/verteilung.js` (vor Block 4b), `kg_quote`; `js/rechner/berechne.js`, `kg_auszahlung`
- **Beleg:** `const kg_quote = [0.80, 1.10, 1.20, 1.15, 1.05, 0.95, 0.85, 0.75, 0.65, 0.50, 0.35, 0.20];` · `const kg_auszahlung = 17 * params.kg * 12 / 1000;`
- **Begründung:**
  - Hochgerechnet mit den Haushaltszahlen ergibt `kg_quote` 36,5 Mio. Kinder. Die Staatsausgaben für Kindergeld werden mit 17 Mio. Kindern gerechnet.
  - Das Kindergeld in den Haushaltsnettos war dadurch um den Faktor 2,1 überhöht. Betroffen sind das Netto der unteren und mittleren Gruppen sowie Gini und Armutsquote.
- **Status:** In Block 4b behoben. Die Kinderzahlen je Gruppe sind auf 17 Mio. skaliert (`HH_STRUKTUR`).

### F-069 · schwer · T · D10b und D10c erhalten in der MwSt-Rechnung die Einkommensteuer von D10a
- **Fundstelle:** `js/rechner/berechne.js` (vor Block 4b), Abschnitt 4 (MwSt)
- **Beleg:** `const est_d = est_pro_dezil.find(x => x.d === d.d).est;`
- **Begründung:**
  - D10a, D10b und D10c haben dasselbe Feld `d: 10`. `find` liefert für alle drei den Eintrag von D10a.
  - Für D10b und D10c wurde die Einkommensteuer deshalb viel zu niedrig angesetzt, und Nettoeinkommen, Konsum und MwSt fielen zu hoch aus.
- **Status:** In Block 4b behoben. Die Zuordnung erfolgt jetzt über den Index.
