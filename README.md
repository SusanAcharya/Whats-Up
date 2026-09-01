# What's Up

A group chat that reads the news for you. Bots for global, sports, tech, entertainment, business, and science drop stories in gen-z, DM you the big ones, and you can text them back.

**Deploy on your phone:** see **[DEPLOY.md](./DEPLOY.md)** (Vercel, iPhone PWA install, notifications).

**How it works:** see **[HOW_IT_WORKS.md](./HOW_IT_WORKS.md)**.

It is a **PWA** (a website you can install on your iPhone like an app). Everything used here is free: Google News / BBC / ESPN / The Verge RSS (no API key), Groq + OpenRouter (free models), Firebase Spark (Auth + Firestore), and your laptop as the server.

---

## What you need

- This project folder
- Node.js (you already have it if `node -v` prints a version)
- A web browser (Safari on iPhone, Chrome/Safari on your computer)

Your API keys are already saved in a private file named `.env.local`. **Do not send that file to anyone** and **do not commit it to GitHub**.

---

## Run it on your computer

Open **Terminal**, paste these commands one at a time, and press Enter after each.

```bash
cd /Users/postgres/Documents/projects/update-me
npm install
npm run dev
```

Wait until you see something like `Local: http://localhost:3000`.

On your computer, open a browser and go to:

**http://localhost:3000**

You should see a screen that says *the news, but it texts you like a group chat.*

1. Tap the desks you want (globie, techie, sporty, …).
2. Tap **let's go**. Allow notifications if it asks.
3. Wait a few seconds. The group chat **the timeline** fills with stories.
4. Open a bot's DM from the chat list and ask a question like `why does this matter?`

If a bot is quiet, tap **catch me up** or **refresh**.

Stop the app later with `Ctrl + C` in Terminal.

---

## Put it on your iPhone (like a real app)

iPhone will only install a PWA and allow push notifications over **https**. `localhost` on your phone is not enough. Use a free tunnel:

1. Keep `npm run dev` running (leave that Terminal window open).
2. Open a **second** Terminal window and run:

```bash
npx -y cloudflared tunnel --url http://localhost:3000
```

3. It prints a URL like `https://random-words.trycloudflare.com`.
4. On your iPhone (same internet is fine, but not required), open that **https** link in **Safari**.
5. Tap the **Share** button (square with an arrow).
6. Tap **Add to Home Screen**, then **Add**.
7. Open **What's Up** from your home screen, not from Safari.

Notifications on iPhone only work after it is installed this way, and only on iOS 16.4+.

---

## How to test each feature

| What | How |
| --- | --- |
| Group chat | Home screen → **the timeline** |
| Add/remove members | **+** or **members**, flip the switches |
| DMs | A bot with a lime badge sent you a personal ping. Open that chat. |
| Ask follow-ups | In a DM, type `explain this like i'm 5` and send |
| Fresh news | **catch me up** / **refresh** |
| Push | Allow notifications, then wait for a DM, or background the app after a refresh |
| Install banner | On iPhone Safari (not home-screen yet) a tip appears at the bottom |

News comes from free RSS feeds (Google News, BBC, NPR, ESPN, The Verge, TechCrunch, NASA, ScienceDaily). No credit card. The AI rewrite uses Groq first, then OpenRouter if Groq is busy.

---

## Firebase (already wired)

This project uses the existing Firebase project **update-me-app**.

- Anonymous sign-in: you don't create a password. Your chats sync in that browser/PWA.
- If Firestore is unreachable, the app still works and saves on the device (`saving on this phone only` at the bottom of the chat list).

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure because every chat, message, and push subscription lives under `users/{yourAuthId}` and only that signed-in user can read or write it. You should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

---

## If something breaks

**Blank page / error in Terminal**
- Make sure you ran `npm run dev` inside `update-me`.
- Stop it with Ctrl+C and run `npm run dev` again.

**No news**
- Check your wifi.
- Tap **catch me up**.
- Groq has a daily free limit. The app should fall back to OpenRouter, then to a simple rewrite.

**iPhone won't install**
- You must use the `https://...trycloudflare.com` link in Safari, not Chrome.
- Use **Add to Home Screen**.

**No notifications on iPhone**
- Open the home-screen app (not the Safari tab).
- Allow notifications when asked.
- iOS only allows web push for installed PWAs.

---

## Privacy note

You pasted Groq and OpenRouter keys in chat. They live only in `.env.local` (git-ignored). If this folder is ever uploaded to a public GitHub repo, generate new keys on groq.com and openrouter.ai and replace the values in `.env.local`.
# Whats-Up
