# What's Up

News as a group chat. Pick bots, set filters, and they DM you when something actually matters.

**Deploy:** see **[DEPLOY.md](./DEPLOY.md)** (Vercel, iPhone PWA, notifications, background cron).

**Architecture:** see **[HOW_IT_WORKS.md](./HOW_IT_WORKS.md)**.

Live: **https://whats-up-nasus.vercel.app**

---

## Run locally

```bash
cd /Users/postgres/Documents/projects/update-me
npm install
npm run dev
```

Open **http://localhost:3000**

### Onboarding (3 steps)

1. Pick 2–3 bots (Globie, Techie, Sporty, …)
2. Set filters — teams, topics, keywords
3. Choose DM-style alerts → **Allow alerts & start**

After setup you'll land in the first bot's DM with a refresh status banner.

---

## How to test each feature

| What | How |
| --- | --- |
| Timeline | **The timeline** — read-only feed of all bot stories |
| DMs | Open a bot under **Direct** — ask follow-ups here |
| Settings | **Settings** → Alerts / Filters / Bots tabs |
| Refresh feedback | Tap **Refresh** — banner shows checked count + result |
| Why this story? | On any news card → expand matched keywords |
| Ask a bot | On timeline cards → **Ask Techie** (etc.) |
| Push | Allow notifications in onboarding or Settings → Alerts |
| Background push | Optional: daily cron on Vercel Hobby (see DEPLOY.md) |

News from RSS (Google News, BBC, ESPN, The Verge, …). Summaries via Groq → OpenRouter fallback.

---

## Firebase

Project: **update-me-app**. Anonymous auth — no password. Chats sync per browser/PWA.

If Firestore is down, footer shows **This phone only.**

---

## If something breaks

**No news after refresh**
- Check the status banner — it explains why (filters too narrow, quality gate, etc.)
- Open Settings → Filters and broaden keywords
- Tap Refresh again

**No notifications**
- iPhone: must use **Add to Home Screen** PWA, not Safari tab
- Settings → Alerts → Allow notifications

**Build fails on Vercel**
- Check env vars in `.env.example` are all set

---

## Privacy

API keys live in `.env.local` (git-ignored). Never commit that file.
