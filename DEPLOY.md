# Deploy **What's Up** on your phone (PWA + notifications)

You need **HTTPS** for install and push. `localhost` on a laptop is fine for dev; your phone needs a real URL.

---

## Option A — Deploy to Vercel (recommended)

### 1. Push the project to GitHub

If it is not on GitHub yet, create a repo and push. Do **not** commit `.env.local`.

### 2. Import on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo.
2. Framework: **Next.js** (auto-detected).
3. Add **Environment Variables** (same as your `.env.local`):

| Variable | Required for |
| --- | --- |
| `GROQ_API_KEY` | story summaries |
| `OPENROUTER_API_KEY` | AI fallback |
| `NEXT_PUBLIC_FIREBASE_*` (all 6) | auth + sync |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | push notifications |
| `VAPID_PRIVATE_KEY` | push notifications |
| `VAPID_SUBJECT` | push (e.g. `mailto:you@example.com`) |

4. Deploy. You get a URL like `https://whats-up-xyz.vercel.app`.

### 3. Allow the domain in Firebase

1. [Firebase Console](https://console.firebase.google.com) → project **update-me-app**.
2. **Authentication** → **Settings** → **Authorized domains** → add your Vercel hostname (e.g. `whats-up-xyz.vercel.app`).
3. No trailing slash, no `https://`.

Firestore rules are already deployed; chats stay under your anonymous user id.

### 4. Generate VAPID keys (if you have not)

On your laptop:

```bash
cd /Users/postgres/Documents/projects/update-me
npx web-push generate-vapid-keys
```

- Put **Public Key** in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Vercel + `.env.local`).
- Put **Private Key** in `VAPID_PRIVATE_KEY` (server only — never expose in the browser).
- Set `VAPID_SUBJECT=mailto:your@email.com`.

Redeploy on Vercel after adding VAPID vars.

---

## Option B — Quick test without deploy (tunnel)

Good for trying on your phone before Vercel:

```bash
# Terminal 1
npm run dev

# Terminal 2
npx cloudflared tunnel --url http://localhost:3000
```

Open the printed `https://….trycloudflare.com` link on your phone in **Safari**.

Add that hostname to Firebase **Authorized domains** too.

Tunnel URLs change each run unless you use a named Cloudflare tunnel.

---

## Install on iPhone

1. Open the **https** URL in **Safari** (not Chrome — Add to Home Screen works best in Safari).
2. Tap **Share** (square with arrow).
3. Tap **Add to Home Screen**.
4. Name it **What's Up** → **Add**.
5. Open the app from your home screen (standalone), not from a Safari tab.

iOS **16.4+** is required for web push on installed PWAs.

---

## Turn on notifications

1. Open **What's Up** from the home screen icon.
2. Complete onboarding (pick bots → set filters → **notifications** → start).
3. When iOS asks **Allow Notifications**, tap **Allow**.

Onboarding calls `enablePush()`, which:

- Registers the service worker (`/sw.js`).
- Subscribes with your **VAPID public key**.
- Saves the subscription to Firestore under `users/{uid}/push/current`.

When new stories post, each bot sends a **DM-style push** (if alerts are on for that bot). Timeline alerts are off by default.

### If notifications never appear

| Check | Fix |
| --- | --- |
| Opened from Safari tab, not home screen | Install PWA first |
| Denied notifications | iOS Settings → What's Up → Notifications → Allow |
| Missing VAPID keys on server | Set all three VAPID env vars and redeploy |
| Not on HTTPS | Use Vercel or Cloudflare tunnel |
| Groq/OpenRouter down | News may still post; push only fires when new items ingest |

---

## Install on Android

1. Open the **https** URL in Chrome.
2. Menu → **Install app** or **Add to Home screen**.
3. Allow notifications when prompted during onboarding.

Android web push generally works in Chrome without a separate “installed PWA” step, but installing still gives a better full-screen experience.

---

## Background ingest (Vercel Cron — optional)

**Vercel Hobby (free):** cron jobs can run **once per day** only. This project uses `0 9 * * *` — a daily headline check at **09:00 UTC** (~morning briefing). That fits the free tier.

**While the app is open:** the client still refreshes on launch and every 15 minutes in the background tab — no cron needed for that.

**Vercel Pro:** you can change `vercel.json` to run more often (e.g. `*/15 * * * *`).

### Setup (optional)

1. Firebase Console → Project settings → Service accounts → **Generate new private key**.
2. Vercel env var **`FIREBASE_SERVICE_ACCOUNT_JSON`** — paste the full JSON as one line.
3. **`CRON_SECRET`** — any long random string (`openssl rand -hex 32`). Vercel sends this as `Authorization: Bearer …` when invoking the cron.
4. Redeploy.

Without those vars, deploy still succeeds. The daily cron runs but skips server ingest (`firebase admin not configured`). Push on refresh / while app is open still works via the client.

### Disable cron entirely

Delete `vercel.json` or remove the `crons` array if you do not want daily server checks.

---

## After deploy checklist

- [ ] App loads at your HTTPS URL
- [ ] Onboarding completes; **the timeline** gets stories after **refresh**
- [ ] Chats sync (footer says “synced”, not “this phone only”)
- [ ] Home screen icon shows **wu**
- [ ] Notifications allowed; new story after refresh shows a banner (app in background)

---

## Local dev (laptop only)

```bash
npm install
npm run dev
```

Open http://localhost:3000 — push may work on localhost in some browsers; iPhone install still needs HTTPS.

See [README.md](./README.md) for day-to-day usage and [HOW_IT_WORKS.md](./HOW_IT_WORKS.md) for architecture.
