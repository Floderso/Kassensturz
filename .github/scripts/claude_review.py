"""
Kassensturz · Claude Gutachter
Analysiert Pull Requests und Issues automatisch und postet eine Bewertung als Kommentar.
"""

import os
import json
import urllib.request
import urllib.error
import sys

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
GITHUB_TOKEN      = os.environ.get("GITHUB_TOKEN", "")
REPO              = os.environ.get("REPO", "")
EVENT_NAME        = os.environ.get("EVENT_NAME", "")

PR_NUMBER  = os.environ.get("PR_NUMBER", "")
PR_TITLE   = os.environ.get("PR_TITLE", "")
PR_BODY    = os.environ.get("PR_BODY", "") or "(kein Beschreibungstext)"

ISSUE_NUMBER = os.environ.get("ISSUE_NUMBER", "")
ISSUE_TITLE  = os.environ.get("ISSUE_TITLE", "")
ISSUE_BODY   = os.environ.get("ISSUE_BODY", "") or "(kein Beschreibungstext)"


# ── Kontext über das Projekt ──────────────────────────────────────────────────

PROJEKT_KONTEXT = """
Kassensturz ist ein interaktives Bildungsprojekt zur Simulation des deutschen Steuersystems
und Staatshaushalts (keine kommerzielle oder politische Organisation).

Aufbau:
- js/data.js           — alle Datenkonstanten (DEZILE, ELAST, ELAST_QUELLEN, BASIS_AUFKOMMEN)
- js/rechner/          — Berechnungsmodule mit FORMEL_QUELLEN_* Quellenmetadaten
  - einkommensteuer.js — § 32a EStG Formeltarif
  - verteilung.js      — Gini, Palma, Armutsrisikoquote
  - berechne.js        — Hauptsimulation
  - rente.js           — Rentenreform & GKV
- js/haushaltsspiel.js — UI & Render

Qualitätsansprüche:
1. Jede Zahlenwertänderung braucht eine belastbare Quelle (amtliche Statistik, Peer-Review, offiz. Bericht)
2. Formeln müssen mit dem Konzept in Konzept_Steuersimulation.md übereinstimmen
3. Lizenz CC BY 4.0 — Beiträge müssen damit kompatibel sein
4. Das Projekt ist ein Lernwerkzeug, kein Prognosemodell — keine Übergenauigkeit vortäuschen
"""


# ── Claude API aufrufen ───────────────────────────────────────────────────────

def claude(prompt: str) -> str:
    payload = json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 1200,
        "messages": [{"role": "user", "content": prompt}]
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())["content"][0]["text"]
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"Claude API Fehler {e.code}: {body}", file=sys.stderr)
        return f"_Claude Gutachten konnte nicht erstellt werden (API-Fehler {e.code})._"


# ── GitHub Kommentar posten ───────────────────────────────────────────────────

def post_comment(endpoint: str, body: str) -> None:
    payload = json.dumps({"body": body}).encode()
    req = urllib.request.Request(
        f"https://api.github.com/{endpoint}",
        data=payload,
        headers={
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
    )
    try:
        urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as e:
        print(f"GitHub API Fehler {e.code}: {e.read().decode()}", file=sys.stderr)


# ── Pull Request analysieren ──────────────────────────────────────────────────

def review_pr() -> None:
    # Diff einlesen
    try:
        with open("/tmp/diff.txt", encoding="utf-8") as f:
            diff = f.read(10_000)  # max ~10 KB
    except FileNotFoundError:
        diff = "(kein Diff verfügbar)"

    prompt = f"""
{PROJEKT_KONTEXT}

Ein Contributor hat folgenden Pull Request eingereicht. Deine Aufgabe: bewerte ihn für den
Projektbetreiber (Student, kein Programmierer) — klar, kurz, auf Deutsch.

PR-Titel: {PR_TITLE}
PR-Beschreibung: {PR_BODY}

Geänderter Code (Diff):
```
{diff}
```

Erstelle eine Bewertung in diesem Format:

## Was wurde geändert?
(2–4 Sätze, verständlich ohne Programmierkenntnisse)

## Quellen-Check
(Sind alle geänderten Zahlenwerte mit Quellen belegt? Wenn nein: welche fehlen konkret?)

## Plausibilitäts-Check
(Wirkt die Änderung inhaltlich sinnvoll? Gibt es Auffälligkeiten?)

## Fragen an den Contributor *(optional)*
(Konkrete Rückfragen, falls etwas unklar ist)

## Empfehlung
**ANNEHMEN** / **NACHFRAGEN** / **ABLEHNEN**
(1 Satz Begründung)

---
*Automatische Voranalyse durch Claude · Letzte Entscheidung liegt beim Maintainer*
"""
    review = claude(prompt)
    post_comment(
        f"repos/{REPO}/issues/{PR_NUMBER}/comments",
        review,
    )
    print(f"PR #{PR_NUMBER} bewertet.")


# ── Issue analysieren ─────────────────────────────────────────────────────────

def review_issue() -> None:
    prompt = f"""
{PROJEKT_KONTEXT}

Jemand hat ein neues Issue im Kassensturz-Projekt geöffnet. Analysiere es kurz für den
Projektbetreiber (Student, kein Programmierer) — klar, auf Deutsch.

Issue-Titel: {ISSUE_TITLE}
Issue-Inhalt: {ISSUE_BODY}

Erstelle eine Einschätzung in diesem Format:

## Worum geht es?
(1–2 Sätze, verständlich ohne Programmierkenntnisse)

## Art des Issues
Datenfehler / Quellenvorschlag / Featurewunsch / Frage / Sonstiges

## Was fehlt noch?
(Falls wichtige Informationen fehlen — z.B. Quelle, konkreter Wert — konkret benennen)

## Nächster Schritt für dich
(Was solltest du als Maintainer tun? Z.B. "Nach Quelle fragen", "Direkt umsetzbar", "Ablehnen weil...")

---
*Automatische Voranalyse durch Claude · Letzte Entscheidung liegt beim Maintainer*
"""
    review = claude(prompt)
    post_comment(
        f"repos/{REPO}/issues/{ISSUE_NUMBER}/comments",
        review,
    )
    print(f"Issue #{ISSUE_NUMBER} eingeschätzt.")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if not ANTHROPIC_API_KEY:
        print("ANTHROPIC_API_KEY nicht gesetzt.", file=sys.stderr)
        sys.exit(1)

    if EVENT_NAME == "pull_request":
        review_pr()
    elif EVENT_NAME == "issues":
        review_issue()
    else:
        print(f"Unbekanntes Event: {EVENT_NAME}", file=sys.stderr)
