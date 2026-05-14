// Instagram Graph API — automatischer Post-Publisher
// Läuft via GitHub Actions (täglich) oder manuell: node social/instagram/post.mjs
//
// Benötigte Umgebungsvariablen (GitHub Secrets oder .env):
//   IG_ACCESS_TOKEN   — Long-Lived User Access Token (60 Tage, siehe README)
//   IG_ACCOUNT_ID     — Numerische Instagram Business Account ID

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

const TOKEN      = process.env.IG_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.IG_ACCOUNT_ID;

if (!TOKEN || !ACCOUNT_ID) {
  console.error('Fehlende Umgebungsvariablen: IG_ACCESS_TOKEN und IG_ACCOUNT_ID müssen gesetzt sein.');
  process.exit(1);
}

const SCHEDULE_PATH = join(__dir, 'schedule.json');
const schedule = JSON.parse(readFileSync(SCHEDULE_PATH, 'utf8'));

const now = new Date();

// Nächsten fälligen Post finden
const post = schedule.find(p =>
  p.status === 'pending' && new Date(p.scheduled_for) <= now
);

if (!post) {
  console.log('Kein Post fällig. Nächster geplanter Post:', nextScheduled(schedule));
  process.exit(0);
}

console.log(`Poste: ${post.id} — ${post.caption.slice(0, 60)}...`);

// Schritt 1: Media Container erstellen
const containerRes = await fetch(
  `https://graph.facebook.com/v19.0/${ACCOUNT_ID}/media`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: post.image_url,
      caption:   post.caption,
      access_token: TOKEN,
    }),
  }
);
const container = await containerRes.json();

if (!container.id) {
  console.error('Fehler beim Erstellen des Media Containers:', JSON.stringify(container));
  process.exit(1);
}

// Schritt 2: Container veröffentlichen
const publishRes = await fetch(
  `https://graph.facebook.com/v19.0/${ACCOUNT_ID}/media_publish`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id:  container.id,
      access_token: TOKEN,
    }),
  }
);
const published = await publishRes.json();

if (!published.id) {
  console.error('Fehler beim Veröffentlichen:', JSON.stringify(published));
  process.exit(1);
}

// Status in schedule.json auf "published" setzen
post.status     = 'published';
post.published_at = now.toISOString();
post.ig_post_id   = published.id;
writeFileSync(SCHEDULE_PATH, JSON.stringify(schedule, null, 2));

console.log(`✓ Erfolgreich gepostet. Instagram Post ID: ${published.id}`);

function nextScheduled(schedule) {
  const pending = schedule
    .filter(p => p.status === 'pending')
    .sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for));
  return pending[0]?.scheduled_for ?? 'keiner geplant';
}
