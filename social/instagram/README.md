# Instagram Automation — Setup-Anleitung

## 1. Instagram API-Zugang einrichten

### Schritt 1 — Meta Developer App erstellen
1. Gehe zu [developers.facebook.com](https://developers.facebook.com)
2. Klicke „Meine Apps" → „App erstellen"
3. App-Typ: **Business**
4. Gib einen App-Namen ein (z.B. „Kassensturz Automation")
5. Füge das Produkt **„Instagram Graph API"** hinzu

### Schritt 2 — Access Token generieren
1. Im Developer Dashboard: **Tools → Graph API Explorer**
2. Wähle deine App aus
3. Klicke „Generate Access Token" und melde dich an
4. Wähle die Berechtigungen:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
5. Kopiere den **User Access Token** (kurzlebig, ~1 Stunde)

### Schritt 3 — Long-Lived Token erstellen (60 Tage gültig)
Öffne diese URL im Browser (App-ID und App-Secret findest du im Developer Dashboard unter „Einstellungen → Allgemein"):

```
https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=DEINE_APP_ID&client_secret=DEIN_APP_SECRET&fb_exchange_token=DEIN_KURZLEBIGER_TOKEN
```

Das Ergebnis enthält `access_token` — das ist dein **Long-Lived Token** (60 Tage).

### Schritt 4 — Instagram Account ID herausfinden
```
https://graph.facebook.com/me/accounts?access_token=DEIN_LONG_LIVED_TOKEN
```
→ Notiere die `id` deiner Facebook-Seite.

```
https://graph.facebook.com/DEINE_PAGE_ID?fields=instagram_business_account&access_token=DEIN_TOKEN
```
→ Das `id` unter `instagram_business_account` ist deine **IG_ACCOUNT_ID**.

---

## 2. GitHub Secrets hinterlegen

Gehe zu: **GitHub Repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name         | Wert                          |
|---------------------|-------------------------------|
| `IG_ACCESS_TOKEN`   | Dein Long-Lived Token         |
| `IG_ACCOUNT_ID`     | Deine numerische IG-Account-ID|

---

## 3. Posts planen

Bearbeite `schedule.json`. Felder pro Post:

| Feld             | Beschreibung                                             |
|------------------|----------------------------------------------------------|
| `id`             | Eindeutiger Name (z.B. `post-003`)                       |
| `status`         | `"pending"` = noch nicht gepostet                        |
| `scheduled_for`  | ISO-Datum: `"2026-05-20T10:00:00"` (UTC)                 |
| `caption`        | Text des Posts inkl. Hashtags                            |
| `image_url`      | Öffentlich zugängliche Bild-URL (z.B. GitHub Raw-URL)    |
| `type`           | `"feed"` (Beitrag im Feed)                               |

### Bilder hosten
Lege Bilder in `social/instagram/images/` ab — über GitHub Pages oder die Raw-URL sind sie öffentlich zugänglich:
```
https://raw.githubusercontent.com/Floderso/Kassensturz/main/social/instagram/images/dein-bild.png
```

---

## 4. Automation testen

**Manuell auslösen:** GitHub → Actions → „Instagram Auto-Post" → „Run workflow"

**Token erneuern (alle ~50 Tage):**
Den Long-Lived Token erneut durch den Exchange-Schritt schicken und in den GitHub Secrets aktualisieren.

---

## Lokale Ausführung (optional)

```bash
# .env Datei anlegen (wird nicht ins Repo committet)
echo "IG_ACCESS_TOKEN=dein_token" > social/instagram/.env
echo "IG_ACCOUNT_ID=deine_id"    >> social/instagram/.env

# Skript ausführen
node social/instagram/post.mjs
```
