# Prüfbericht Kassensturz – Phase 2: Verbesserungsvorschläge

Bezug: `docs/pruefbericht.md` (Befunde F-001 … F-067).
Grundsatz: Fehler mit gemeinsamer Ursache werden gebündelt. Jeder Vorschlag behebt die Ursache, nicht nur das Symptom.
Vorgabe für den Rechenkern (nach Rücksprache): fachlich korrekter Umbau statt reiner Kalibrierung.

Kennzeichnung: **[QUELLE PRÜFEN]** markiert Parameter, deren Wert in Phase 4 vor dem Einbau gegen die Primärquelle verifiziert werden muss.

---

## Block A – Vorschläge zu den kritischen Befunden

### V-01 · Datenschutz: Drittanbieter nur nach Einwilligung, Fonts lokal, Erklärung korrigieren
- **Betroffene Befunde:** F-001 (zusätzlich teilweise F-067)
- **Ursache:** Drittanbieter-Ressourcen (Google Ads, Google Fonts) werden fest im `<head>` eingebunden. Die Datenschutzerklärung wurde nicht an den tatsächlichen Datenfluss angepasst.
- **Änderung:**

  1. Google-Ads-Tag entfernen (`index.html:132-139`). Falls Conversion-Tracking gewünscht ist, nur nach aktiver Einwilligung laden:

     ```html
     <!-- index.html: statt des bisherigen gtag-Blocks -->
     <div id="consent" hidden>
       <p>Wir möchten Google Ads Conversion-Tracking nutzen. Dabei werden Daten an Google übermittelt.
          <a href="impressum.html#datenschutz">Details</a></p>
       <button type="button" id="consent-yes">Zulassen</button>
       <button type="button" id="consent-no">Ablehnen</button>
     </div>
     <script>
       (function () {
         var KEY = 'ks_consent_ads';
         function load() {
           var s = document.createElement('script');
           s.async = true;
           s.src = 'https://www.googletagmanager.com/gtag/js?id=AW-18178856279';
           document.head.appendChild(s);
           window.dataLayer = window.dataLayer || [];
           window.gtag = function () { dataLayer.push(arguments); };
           gtag('js', new Date());
           gtag('config', 'AW-18178856279');
         }
         var v = null;
         try { v = localStorage.getItem(KEY); } catch (e) {}
         if (v === 'yes') return load();
         if (v === 'no') return;
         var box = document.getElementById('consent');
         box.hidden = false;
         document.getElementById('consent-yes').onclick = function () {
           try { localStorage.setItem(KEY, 'yes'); } catch (e) {}
           box.hidden = true; load();
         };
         document.getElementById('consent-no').onclick = function () {
           try { localStorage.setItem(KEY, 'no'); } catch (e) {}
           box.hidden = true;
         };
       })();
     </script>
     ```

  2. Google Fonts selbst hosten: WOFF2-Dateien für Fraunces, DM Sans und DM Mono (alle SIL OFL) nach `fonts/` legen. Anschließend die `<link … fonts.googleapis.com …>`- und `preconnect`-Zeilen in allen fünf HTML-Dateien entfernen und in `css/tokens.css` ergänzen:

     ```css
     @font-face { font-family: 'Fraunces'; src: url('../fonts/Fraunces-var.woff2') format('woff2');
                  font-weight: 400 800; font-display: swap; }
     @font-face { font-family: 'DM Sans';  src: url('../fonts/DMSans-var.woff2') format('woff2');
                  font-weight: 400 700; font-display: swap; }
     @font-face { font-family: 'DM Mono';  src: url('../fonts/DMMono-400.woff2') format('woff2');
                  font-weight: 400; font-display: swap; }
     @font-face { font-family: 'DM Mono';  src: url('../fonts/DMMono-500.woff2') format('woff2');
                  font-weight: 500; font-display: swap; }
     ```

  3. `impressum.html:109-115` an den tatsächlichen Datenfluss anpassen, etwa:

     > **Datenschutz.**
     > - Beim Aufruf verarbeitet unser Hosting-Anbieter Cloudflare technisch notwendige Daten (IP-Adresse, Zeitpunkt, angeforderte Datei).
     > - Einstellungen des Spiels werden ausschließlich lokal in Ihrem Browser (localStorage) gespeichert und nicht übertragen.
     > - Google Ads Conversion-Tracking wird nur nach Ihrer ausdrücklichen Einwilligung geladen (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG). Dabei werden Daten an Google Ireland Ltd. übermittelt. Die Einwilligung kann jederzeit durch Löschen der Website-Daten widerrufen werden.

     Die endgültige Formulierung sollte rechtlich geprüft werden.
- **Warum Ursachenbehebung:**
  - Ohne Einwilligung werden keine Daten mehr an Dritte übertragen: Die Fonts kommen von der eigenen Domain, der Ads-Tag lädt nur nach Opt-in.
  - Die Erklärung beschreibt danach den tatsächlichen Datenfluss.
  - Wird das Tracking nicht benötigt, ist Variante „nur entfernen“ die einfachste und sicherste.

---

### V-02 · Haushaltsmodell: zvE-Herleitung, Splitting, Soli, Äquivalenzgewichtung
- **Betroffene Befunde:** F-002, F-021, F-034, F-036 (zusätzlich Folgeeffekte auf F-022, F-035, F-056, F-057)
- **Ursache:**
  - Die Einheit „Dezil“ ist nur durch ein Bruttoeinkommen je Haushalt definiert, ohne Personenstruktur.
  - Daraus folgt, dass der Tarif auf das Haushaltsbrutto statt auf das zvE einer Veranlagung angewandt wird und Splitting fehlt (F-002).
  - Die Verteilungsmaße können nicht auf Äquivalenzeinkommen je Person rechnen (F-021).
  - Die Verhaltensreaktion trifft das gesamte Brutto (F-034), und der Soli fehlt (F-036).
- **Änderung:**

  1. `js/data.js`: Haushaltsstruktur je Dezil ergänzen und dokumentiert beziehen. `kinder` entspricht dem bisher in `verteilung.js` versteckten `kg_quote`; `erwachsene`, `paar_anteil`, `erwerbstaetige` sind **[QUELLE PRÜFEN]** (Destatis Mikrozensus 2024 bzw. EVS 2023, Haushalte nach Nettoeinkommensklassen).

     ```js
     // Haushaltsstruktur je Dezil — Quelle: Destatis Mikrozensus 2024 [QUELLE PRÜFEN: Tabelle/Abrufdatum eintragen]
     // erwachsene: Personen ≥ 18; kinder: Kindergeldkinder; paar_anteil: Anteil zusammenveranlagter Paare;
     // erwerbstaetige: Personen mit Arbeitnehmereinkünften (für Pauschbeträge)
     const HH_STRUKTUR = [
       // { erwachsene, kinder, paar_anteil, erwerbstaetige }  — 12 Einträge, Index = DEZILE[i].idx
     ];
     ```

  2. Neues Modul `js/rechner/haushalt.js` mit den Rechtsregeln, jeweils mit Norm:

     ```js
     // SPDX-License-Identifier: CC-BY-4.0
     import { estTarif } from './einkommensteuer.js';

     const AN_PAUSCHBETRAG = 1230;             // § 9a Satz 1 Nr. 1 Buchst. a EStG
     const SOLI_FREIGRENZE_2026 = 20350;       // § 3 Abs. 3 SolZG 1995 i.d.F. 2026 [QUELLE PRÜFEN]
     const SOLI_SATZ = 0.055, SOLI_MILDERUNG = 0.119; // § 4 SolZG 1995

     // Vorsorgeaufwendungen vereinfacht = AN-Anteil SV (§ 10 Abs. 1 Nr. 2, 3, 3a EStG; Höchstbeträge § 10 Abs. 3, 4)
     export function zvE(arbeit, sv_an, erwerbstaetige) {
       return Math.max(0, arbeit - AN_PAUSCHBETRAG * erwerbstaetige - sv_an);
     }

     // § 32a Abs. 1 (Grundtarif) bzw. Abs. 5 (Splittingverfahren); Dezil = Mischung aus Paaren und Alleinstehenden
     export function estHaushalt(zve, paar_anteil, t) {
       const grund  = estTarif(zve,     t.freibetrag, t.eingang, t.spitze, t.grenze);
       const split  = 2 * estTarif(zve / 2, t.freibetrag, t.eingang, t.spitze, t.grenze);
       return paar_anteil * split + (1 - paar_anteil) * grund;
     }

     export function soli(est, paar) {
       const fg = SOLI_FREIGRENZE_2026 * (paar ? 2 : 1);
       return est <= fg ? 0 : Math.min(SOLI_SATZ * est, SOLI_MILDERUNG * (est - fg));
     }

     // Neue OECD-Skala (Eurostat EU-SILC-Methodik): 1 + 0,5·(Erwachsene−1) + 0,3·Kinder
     export function aequivalenzgewicht(erwachsene, kinder) {
       return 1 + 0.5 * (erwachsene - 1) + 0.3 * kinder;
     }
     ```

  3. `js/rechner/berechne.js`, Abschnitt 2: Die ESt wird auf das zvE gerechnet. Die SV wird vorher berechnet, und die Verhaltensreaktion trifft nur das Arbeitseinkommen (F-034).

     ```diff
     -    return { ...d, labor_factor: lf, brutto_adj: d.brutto * lf, gs_neu, avoidance };
     +    const arbeit_adj  = d.brutto * (1 - d.kapital) * lf;   // Reaktion nur auf Arbeitseinkommen
     +    const kapital_adj = d.brutto * d.kapital;              // Kapital: eigene Elastizität (ELAST.capital_supply), s. V-03
     +    return { ...d, labor_factor: lf, arbeit_adj, kapital_adj, brutto_adj: arbeit_adj + kapital_adj, gs_neu, avoidance };
     ```

     ```js
     // Abschnitt 2 neu (Ausschnitt)
     const sv_an   = svArbeitnehmer(d.arbeit_adj, params);          // bisher in verteilung.js dupliziert → eine Funktion
     const zve_arb = zvE(d.arbeit_adj, sv_an, d.erwerbstaetige);
     const est_arbeit = estHaushalt(zve_arb, d.paar_anteil, params);
     const soli_arbeit = soli(est_arbeit / (d.paar_anteil > 0.5 ? 2 : 1), d.paar_anteil > 0.5)
                         * (d.paar_anteil > 0.5 ? 2 : 1);
     const est_kap = params.synthetisch
       ? Math.max(0, estHaushalt(zve_arb + d.kapital_adj, d.paar_anteil, params) - est_arbeit)
       : Math.max(0, d.kapital_adj - 1000 * d.erwachsene) * params.abgeltung / 100 * (1 + SOLI_SATZ); // § 20 Abs. 9, § 32d EStG
     ```

     Auch der Grenzsteuersatz für Arbeitsangebot, METR und DWL wird auf `zve_arb` statt auf das Brutto berechnet (gleiche Ursache).

  4. `js/rechner/verteilung.js`: Verteilungsmaße auf Äquivalenzeinkommen je Person (EU-SILC-Konvention).

     ```js
     function personenGewichte(dez) {
       return dez.map(d => ({ w: aequivalenzgewicht(d.erwachsene, d.kinder),
                              p: d.anzahl * (d.erwachsene + d.kinder) }));
     }
     function berechneGini(netto, dez) {
       const g = personenGewichte(dez);
       const pairs = netto.map((y, i) => ({ v: y / g[i].w, n: g[i].p })).sort((a, b) => a.v - b.v);
       // … restliche Trapezregel unverändert
     }
     // berechnePalma, berechneMedianGewichtet und S80/S20 (haushaltsspiel.js:323-337) analog
     // über dieselbe Hilfsfunktion; S80/S20 als eigene Funktion in verteilung.js statt Inline-Code.
     ```

  5. Offenlegung: Weil Gruppenmittelwerte verwendet werden, fehlt die Ungleichheit innerhalb der Gruppen. Das Modell-Gini liegt daher systematisch unter dem amtlichen Wert. In der KPI-Anzeige wird deshalb „Modell-Gini (12 Gruppen, äquivalenzgewichtet)“ ausgewiesen. Neben dem Modellwert steht die Veränderung zum Status quo als Hauptgröße. Der amtliche Benchmark wird nur als Kontext mit Hinweis auf die Nichtvergleichbarkeit gezeigt.
- **Warum Ursachenbehebung:**
  - Der Tarif wird auf die Größe angewandt, für die § 32a EStG definiert ist: das zvE einer Veranlagung, mit Splitting.
  - Die Verteilungsmaße werden auf die Einheit gerechnet, auf die sich alle amtlichen Vergleichswerte beziehen.
  - Die SV-Berechnung ist heute dreifach dupliziert (`berechne.js:159-162`, `verteilung.js:96-101`, `:153-154`) und wird in einer Funktion zusammengeführt. Damit können die Kopien nicht mehr auseinanderlaufen.

---

### V-03 · Status quo als Fixpunkt: Basiswerte aus `PRESETS.status_quo` ableiten, Bemessungsgrundlagen kalibrieren, Invarianten testen
- **Betroffene Befunde:** F-003, F-010, F-011, F-012 (zusätzlich F-035 Kalibrierung, F-013 Definition)
- **Ursache:**
  - Referenzwerte des Status quo sind an mehreren Stellen als Zahlen fest eingetragen (`12084`, `16.3`, `0.30`, `101400`, `18.6 + 2.6`, `17.5 + 3.6`), statt aus `PRESETS.status_quo` abgeleitet zu werden.
  - Die Bemessungsgrundlagen (Konsum, Gewinn, Erbmasse) werden nie gegen das Ist-Aufkommen abgeglichen.
  - Es gibt keinen automatischen Test, der prüft, dass der Status quo ein Fixpunkt ist.
- **Änderung:**

  1. Eine einzige Quelle für den Status quo in `berechne.js` und `verteilung.js`:

     ```js
     const SQ = PRESETS.status_quo;
     const sqGrenze = d => grenzsteuersatz(zveArbeitSQ(d), SQ.freibetrag, SQ.eingang, SQ.spitze, SQ.grenze);
     const belastungUnternehmen = p => (p.kst * (1 + 0.055) + (p.gewst_aus ? 0 : p.gewst)) / 100; // Soli auf KSt
     const investment_factor = 1 + ELAST.investment * (belastungUnternehmen(params) - belastungUnternehmen(SQ));
     const sv_ausgaben_delta = SV_AUSG.rv * (params.rv / SQ.rv - 1)
                             + SV_AUSG.kv * (params.kv / SQ.kv - 1)
                             + SV_AUSG.alpf * (params.alpf / SQ.alpf - 1);
     // berechneNettoSQ(d) := Netto aus derselben Funktion wie das Reformnetto, aufgerufen mit SQ
     ```

  2. Eigene Bemessungsgrundlagen statt eines gemeinsamen „gewinn“ (KSt und GewSt haben unterschiedliche Grundlagen: Hinzurechnungen, Personengesellschaften):

     ```js
     // data.js – aus Ist-Aufkommen und Status-quo-Satz abgeleitet (Quelle: BMF Kassenstatistik [QUELLE PRÜFEN])
     const BEMESSUNG = {
       kst:   BASIS_AUFKOMMEN.kst   / (PRESETS.status_quo.kst   / 100),   // ≈ 300 Mrd.
       gewst: BASIS_AUFKOMMEN.gewst / (PRESETS.status_quo.gewst / 100),   // ≈ 536 Mrd.
     };
     ```

  3. MwSt-Grundlage: Steuerfreie Umsätze nach § 4 UStG (v. a. Wohnungsmieten, Finanz- und Versicherungsleistungen, Gesundheit) werden aus dem Konsum herausgenommen:

     ```js
     // Anteile am Konsum je Dezil: Destatis EVS 2023 / VGR Konsumverwendung [QUELLE PRÜFEN]
     const KONSUM_STRUKTUR = { regel: [...], ermaessigt: [...], steuerfrei: [...] }; // je 12 Werte, Summe = 1
     ```

  4. Kalibrierung, offengelegt: Nach dem strukturellen Umbau (V-02, Punkte 2 und 3) bleibt für jede Steuer eine Restabweichung gegenüber dem Ist-Aufkommen. Sie wird durch einen einmal berechneten, im UI ausgewiesenen Faktor geschlossen. Relative Reformwirkungen bleiben dadurch erhalten.

     ```js
     // berechne.js – einmalig beim Laden
     const KALIB = (() => {
       const roh = berechneMechanisch(SQ);                  // ohne Kalibrierung, ohne Verhaltensreaktion
       return {
         est:  (BASIS_AUFKOMMEN.lohnsteuer + BASIS_AUFKOMMEN.estveranlagt) / roh.est,
         mwst:  BASIS_AUFKOMMEN.mwst      / roh.mwst,
         erb:   BASIS_AUFKOMMEN.erbschaft / roh.erb,
       };
     })();
     // Anwendung: rev.est = est_aufkommen * KALIB.est  usw.
     // Anzeige im Rechenweg-Panel: „Kalibrierfaktor ESt: 0,93 (Restabweichung Modell ↔ Kassenstatistik)“
     ```

     Akzeptanzkriterium: Nach V-02 muss jeder Faktor im Bereich 0,85–1,15 liegen. Liegt er außerhalb, ist das ein Hinweis auf einen verbliebenen Strukturfehler und kein Kalibrierfall.

  5. Invariantentest (neu, ohne Abhängigkeiten, lauffähig mit `node tests/status_quo.test.mjs`):

     ```js
     // tests/status_quo.test.mjs
     import assert from 'node:assert/strict';
     import { berechne } from '../js/rechner/berechne.js';
     import { PRESETS, BASIS_AUFKOMMEN } from '../js/data.js';

     const r = berechne(PRESETS.status_quo);
     const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

     r.hh_delta.delta.forEach((d, i) => near(d, 0, 0.5, `Netto-Δ Status quo, Gruppe ${i}`));
     near(r.avg_labor, 1, 1e-9, 'Arbeitsangebot SQ');
     near(r.investment_factor, 1, 1e-9, 'Investitionsfaktor SQ');
     near(r.sv_ausgaben_delta, 0, 1e-9, 'SV-Ausgaben-Δ SQ');
     near(r.rev.est, BASIS_AUFKOMMEN.lohnsteuer + BASIS_AUFKOMMEN.estveranlagt, 1, 'ESt SQ');
     near(r.rev.mwst, BASIS_AUFKOMMEN.mwst, 1, 'MwSt SQ');
     near(r.rev.kst,  BASIS_AUFKOMMEN.kst,  1, 'KSt SQ');
     near(r.rev.gewst, BASIS_AUFKOMMEN.gewst, 1, 'GewSt SQ');
     near(r.rev.erbschaft, BASIS_AUFKOMMEN.erbschaft, 1, 'ErbSt SQ');
     console.log('Status-quo-Invarianten: OK');
     ```
- **Warum Ursachenbehebung:**
  - Wenn es nur eine Quelle für den Status quo gibt, können Konstanten nicht mehr auseinanderlaufen. Die bisherigen Einzelfehler F-010, F-011 und F-012 sind drei Ausprägungen desselben Musters.
  - Der Test verhindert, dass sich das Muster bei künftigen Datenupdates wiederholt. Das ist wichtig, weil die Datenbasis ausdrücklich jährlich fortgeschrieben wird.

---

### V-04 · Status quo ohne Klimageld; Quelle korrigieren
- **Betroffene Befunde:** F-004, F-049
- **Ursache:** Das Preset „Status quo“ bildet eine Reformoption ab (Klimageld), und die Status-quo-Rechnung in `berechneNettoSQ` ignoriert das Flag und zahlt immer 70 % aus (`verteilung.js:160-162`).
- **Änderung:**

  ```diff
  // js/data.js – PRESETS.status_quo und PRESETS.koalition27
  -    co2: 65, klimageld: true,
  +    co2: 65, klimageld: false,   // 2026 kein Klimageld im geltenden Recht (BEHG; Einnahmen fließen in den KTF)
  ```

  ```diff
  // js/rechner/verteilung.js – berechneNettoSQ (bzw. nach V-03 die gemeinsame Nettofunktion)
  -  const klimageld_per_hh = sq_co2_auf * 0.7 * 1000 / total_hh_sq;
  +  const klimageld_per_hh = sq.klimageld ? sq_co2_auf * 0.7 * 1000 / total_hh_sq : 0;
  ```

  Tooltip `klimageld` (`data.js:456`): „Koalitionsvertrag 2025“ als Beleg entfernen. Stattdessen den Status angeben: „2026 nicht eingeführt; Reformoption“.
- **Warum Ursachenbehebung:** Der Referenzpunkt entspricht wieder dem geltenden Recht. Die Status-quo-Rechnung folgt demselben Flag wie jede Reformrechnung, was nach V-03 durch die gemeinsame Nettofunktion ohnehin erzwungen wird.

---

### V-05 · Klimamodul: TCRE korrekt, nur zusätzliche Emissionen, DICE-2023-Parameter
- **Betroffene Befunde:** F-005, F-027
- **Ursache:**
  - Die Einheitenumrechnung der TCRE ist falsch: „je 1.000 Gt“ wurde als „je Mt“ gelesen.
  - Kumuliert wird der Emissionsbestand statt der Abweichung vom Referenzpfad.
  - Der Schadensparameter stammt aus einer anderen DICE-Version als der zitierten.
- **Änderung (`js/rechner/transition.js`):**

  ```diff
  -const DICE_D2              = 0.00267; // DICE-Schadensparameter d₂ (Nordhaus 2023; kalibriert AR6)
  -const KLIMA_SENS_PER_MT    = 5e-4;  // °C je Mt kumulierter CO₂-Zusatz-Emissionen (vereinfacht)
  +// DICE-2023: Ω = γ·T², γ = 0,003467 (Barrage & Nordhaus 2024, PNAS 121(13), e2312030121)
  +const DICE_D2              = 0.003467;
  +// TCRE: 0,45 °C je 1.000 Gt CO₂ (IPCC AR6 WG1 SPM D.1.1) = 0,45 / 1.000.000 °C je Mt
  +const TCRE_GRAD_PRO_MT     = 0.45 / 1e6;
  ```

  ```diff
  -  const co2_kumulat_next = prevState.co2_kumulat + prevResult.emissionen * n;
  +  // nur Abweichung vom Status-quo-Emissionspfad (Zusatz- bzw. Minderemissionen durch die gewählte Politik)
  +  const co2_kumulat_next = prevState.co2_kumulat + (prevResult.emissionen - BASIS_MAKRO.emissions) * n;
  ```

  ```diff
  -  const delta_T  = co2_kumulat * KLIMA_SENS_PER_MT;
  +  const delta_T  = co2_kumulat * TCRE_GRAD_PRO_MT;
  ```

  Konsequenz, im UI offenzulegen: Die Temperaturwirkung nationaler Mehr- oder Minderemissionen liegt im Bereich von 10⁻⁴ bis 10⁻³ °C. Der BIP-Effekt über die DICE-Schadensfunktion ist damit vernachlässigbar. Das ist fachlich korrekt, denn Klimaschäden hängen von globalen Emissionen ab.

  Empfohlener Hinweistext: „Deutsche Emissionsänderungen wirken sich über das globale Klima nur minimal auf das deutsche BIP aus. Der Nutzen nationaler Klimapolitik liegt in ihrem Beitrag zu globalen Minderungspfaden und wird hier nicht abgebildet.“
- **Warum Ursachenbehebung:** Die physikalische Konstante stimmt dann mit der zitierten Quelle überein, die Kumulationsgröße mit dem Kommentar („Zusatz-Emissionen“) und der Schadensparameter mit der genannten Modellversion. Die Überzeichnung um drei Größenordnungen entfällt.

---

### V-06 · Schuldendynamik und Nominalrechnung konsistent
- **Betroffene Befunde:** F-006, F-008
- **Ursache:** Zwei Buchungslogiken existieren nebeneinander. `berechne()` bucht die Zinsen als Ausgabe im Saldo, die Transition verzinst den Schuldenstand zusätzlich. Außerdem wächst nur das BIP nominal, alle anderen Aggregate bleiben auf dem Stand von 2026.
- **Änderung:**

  1. Genau eine Zinsbuchung. Die Zinsen stecken im Saldo, die Schuld ändert sich nur um den Saldo (Budgetidentität):

     ```diff
     // js/rechner/transition.js
     -  const zins = ZINS_SCHULDEN + (prevState._zins_bonus || 0);
     -  const schuld_curr = prevState.schuldenquote / 100 * prevState.bip;
     -  const schuld_next = schuld_curr * Math.pow(1 + zins, n) - prevResult.saldo * n;
     +  // Budgetidentität: ΔSchuld = −Saldo; Zinsen sind bereits in prevResult.saldo (zinsen_dyn) enthalten.
     +  const schuld_curr = prevState.schuldenquote / 100 * prevState.bip;
     +  const schuld_next = schuld_curr - prevResult.saldo * n;
     ```

     ```diff
     // js/rechner/berechne.js – ein Effektivzins, Schock-Zuschlag hier statt in der Transition
     -  const zinsen_dyn = zustand
     -    ? (zustand.schuldenquote / 100 * zustand.bip) * zins_effektivrate
     -    : STAATSAUSGABEN.zinsen;
     +  const zins = zins_effektivrate + (zustand?._zins_bonus || 0) * ZINS_WEITERGABE;
     +  const zinsen_dyn = zustand
     +    ? (zustand.schuldenquote / 100 * zustand.bip) * zins
     +    : STAATSAUSGABEN.zinsen;
     ```

     `ZINS_WEITERGABE` ist der Anteil der Schuld, der innerhalb einer Periode zu neuen Zinsen refinanziert wird. Er ergibt sich aus der mittleren Restlaufzeit (Finanzagentur des Bundes) **[QUELLE PRÜFEN]**. Die Zins- und Schuldenbasis wird auf dieselbe Ebene gestellt (Gesamtstaat, Maastricht-Abgrenzung): `STAATSAUSGABEN.zinsen` muss dann ebenfalls der Zinsaufwand des Gesamtstaats sein, nicht der des Bundes (`data.js:50`) **[QUELLE PRÜFEN]**.

  2. Nominale Konsistenz. Alle nominalen Aggregate wachsen mit dem nominalen BIP-Pfad:

     ```js
     // berechne.js – am Anfang
     const nominal = zustand ? zustand.bip / BASIS_MAKRO.bip : 1.0;
     // Einkommen der Dezile, Lohnsumme, Konsum, Bemessungsgrundlagen und Ausgabenkategorien × nominal.
     // Tarifeckwerte bleiben nominal fix (bewusste Modellannahme „keine Tarifindexierung“, im UI offenlegen);
     // alternativ Tarifeckwerte ebenfalls × Preisindex, falls Indexierung angenommen wird.
     ```

     ```diff
     // transition.js
     -const BIP_WACHSTUM_NOMINAL = 0.015;  // Ø nominales BIP-Wachstum je Jahr (Bundesbank)
     +// Nominales Trendwachstum = Potenzialwachstum real + Zielinflation;
     +// Quelle: Projektion der Bundesregierung / Bundesbank-Projektion Juni 2026 [QUELLE PRÜFEN]
     +const BIP_WACHSTUM_NOMINAL = 0.03;
     ```

  3. Test ergänzen: Bei unveränderter Politik und Saldo = 0 muss die Schuldenquote genau mit dem Faktor 1/(1+g)ⁿ sinken.
- **Warum Ursachenbehebung:**
  - Die Schuldendynamik folgt der Budgetidentität, damit ist eine Doppelzählung strukturell ausgeschlossen.
  - Einnahmen, Ausgaben und Schuld liegen in derselben Preisbasis.
  - Die Annahme zur Tarifindexierung ist offengelegt statt implizit.

---

### V-07 · Regler bilden Preset-Werte exakt ab; Startwerte aus den Presets
- **Betroffene Befunde:** F-007, F-053 (zusätzlich HTML-Defaults aus F-026)
- **Ursache:**
  - Die Schrittweiten der Range-Inputs sind unabhängig von den gesetzlichen Werten gewählt, und HTML rundet stillschweigend.
  - `REF` wird aus `PRESETS` berechnet, die Anzeige dagegen aus dem DOM.
  - Die Startwerte im HTML und die Fallbacks in `setParams` sind eigene, veraltete Kopien.
- **Änderung:**

  1. Schrittweiten so wählen, dass alle Preset-Werte exakt darstellbar sind (`index.html`):

     ```diff
     -id="freibetrag" min="0" max="30000" step="500" value="12084"
     +id="freibetrag" min="0" max="30000" step="4" value="12348"
     -id="grenze" min="50000" max="500000" step="10000" value="277826"
     +id="grenze" min="50000" max="500000" step="1" value="277826"
     -id="bbg" min="40000" max="160000" step="5000" value="90000"
     +id="bbg" min="40000" max="160000" step="50" value="101400"
     -id="bg" min="0" max="1500" step="10" value="563"
     +id="bg" min="0" max="1500" step="1" value="563"
     -id="kg" min="0" max="500" step="5" value="255"
     +id="kg" min="0" max="500" step="1" value="259"
     ```

     Für die Bedienung mit großen Sprüngen: `keydown`-Handler für PageUp/PageDown mit ±500 (Freibetrag) bzw. ±10.000 (Grenze). Die Tastaturbedienbarkeit (Commit `e33f00a`) bleibt damit erhalten.

  2. `setParams` ohne eigene Fallbacks, stattdessen Status quo als Basis:

     ```diff
     -function setParams(p) {
     +function setParams(input) {
     +  const p = { ...PRESETS.status_quo, ...input };   // fehlende Felder = Status quo, nicht Reglermitte/90000
     ```

  3. Laufzeitprüfung (Entwicklungsschutz): Nach `setParams(preset)` wird `getParams()` mit dem Preset verglichen. Bei einer Abweichung erscheint eine Konsolenwarnung mit dem Feldnamen.

  4. Test in `tests/presets.test.mjs`: Für jedes Preset und jeden numerischen Parameter wird geprüft, dass der Wert innerhalb von min/max liegt und auf das Raster `(v − min) % step === 0` fällt. min/max/step werden aus `index.html` gelesen, wie in der Prüfung in Phase 1.
- **Warum Ursachenbehebung:**
  - Die DOM-Darstellung ist verlustfrei für alle definierten Presets, damit sind Anzeige und `REF` identisch.
  - Der Test verhindert, dass ein künftiges Datenupdate (z. B. Grundfreibetrag 2027) wieder auf einen nicht darstellbaren Wert fällt.

---

*Block B (schwere Befunde) und Block C (leichte Befunde) folgen nach Freigabe.*
