# What's Up — how the app works

What's Up is a PWA that turns news into a group chat. Bots post short story summaries to **the timeline** (group chat) and to their **DMs**. You pick which bots are in the group, set **filters** per bot, and can ask follow-up questions in a DM.

---

## The big picture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser / PWA (Next.js)                                        │
│  ChatList · ChatThread · Preferences · Onboarding               │
│  Store (Firebase Firestore or localStorage fallback)            │
└───────────────┬───────────────────────────────┬─────────────────┘
                │ POST /api/ingest               │ POST /api/chat
                ▼                                ▼
┌───────────────────────────┐      ┌──────────────────────────────┐
│  Ingest pipeline          │      │  DM replies                  │
│  RSS → match → gate → LLM │      │  Groq → OpenRouter fallback  │
└───────────────┬───────────┘      └──────────────────────────────┘
                │
                ▼
        External free sources
        Google News RSS · BBC · ESPN · bot default feeds
        Groq / OpenRouter (summaries & chat)
        ESPN public JSON (pitch live football)
```

**Data flow on refresh**

1. You tap **refresh** (or the app ingests on open, every ~15 minutes while visible).
2. The client sends your **enabled bots**, **preferences**, and **already-seen URLs/titles** to `/api/ingest`.
3. The server runs the pipeline and returns at most **one new story per bot**.
4. The client writes each story to **the timeline** and that bot’s **DM**, marks URLs as seen, and bumps unread counts.

News messages expire after **48 hours** (`src/lib/retention.ts`).

---

## Bots

| Bot | Desk | Source style |
| --- | --- | --- |
| **globie** | world / politics | Google News + BBC world RSS |
| **sporty** | sports | Google News + ESPN RSS |
| **techie** | tech | Google News + The Verge RSS |
| **popcorn** | entertainment | Google News + entertainment RSS |
| **stonks** | business / markets | Google News + business RSS |
| **labrat** | science | Google News + science RSS |
| **pitch** | live football | ESPN scoreboard (no RSS keyword gate) |

Each bot has a personality (`vibe` in `src/lib/bots.ts`) used when you DM them. Only bots you enable in **members** participate in ingest and appear in the sidebar.

---

## How preferences work

Preferences are **per bot**, not global. Stored on your profile as:

```ts
{
  sports: string[];   // sporty, pitch
  leagues: string[];
  teams: string[];
  topics: string[];   // globie, techie, popcorn, stonks, labrat
  keywords: string[]; // custom words you type
}
```

You edit them in **filters** (onboarding step 2 or the filters screen from the timeline).

### Short answer: do you get news “with that keyword”?

**Yes — mostly.** A story is considered for a bot only if its **title or RSS snippet** matches at least one keyword rule derived from your selections.

It is **not** a Google alert that searches the full article body at ingest time. Matching uses:

- RSS **title**
- RSS **snippet** (description)

Custom keywords work the same way: if `"gaza"` appears in the title/snippet, it can match.

### From chips to keywords

1. You pick chips (e.g. techie → **Apple**, **AI**).
2. Each chip maps to one or more **needles** in `src/lib/match.ts` (e.g. Apple → `apple`, `iphone`, `macos`).
3. Custom keywords you type become needles directly.
4. `matchKeywords()` scans the story text. Short needles (≤3 chars) use **word boundaries** so `"ai"` does not match inside `"said"`.

If you select **nothing** for a bot, `keywordRules()` is empty and that bot **will not post RSS stories** (except pitch, which uses leagues/teams for live matches instead).

### Feeds are also shaped by prefs

`feedsForPref()` builds a **Google News RSS search URL** from your keywords (`keyword1 OR keyword2 … when:1d`) and still includes one of the bot’s default feeds as fallback. So prefs affect **which feeds are fetched**, not only which items pass the filter.

### What you see in the UI

When a story is posted, `matchedKeywords` is saved on the message. In the thread you may see e.g. `The Verge · apple` — that is the **matched rule label**, not proof the word appeared verbatim in the headline.

If you **change filters later**, old news in the thread is **hidden** (not deleted) when it no longer matches your current rules (`stillMatches()` in `src/lib/store.tsx`).

### Pitch (live football) prefs

Pitch uses **leagues** and **teams** to choose which ESPN fixtures to surface. It skips the RSS + relevancy pipeline. In a DM, `/api/chat` attaches a live snapshot (scores, table) so pitch can answer “what’s the score?” from real data.

---

## Ingest pipeline (step by step)

All logic lives in `src/lib/pipeline.ts` unless noted.

```
RSS items (per enabled bot)
        │
        ▼
┌───────────────────┐
│ Keyword match     │  title + snippet must hit ≥1 pref rule
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Flash filter      │  src/lib/flash.ts — drop recaps, old listicles,
│                   │  classify: now | soon | recent (max ~36h)
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Dedup / cluster   │  same story from multiple outlets → one cluster,
│                   │  merge sources, keep best score
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Relevancy gate    │  src/lib/relevance.ts
│                   │  relevance + popularity scores;
│                   │  must pass threshold (≥80 combined,
│                   │  major outlet or multi-source, etc.)
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Best per bot      │  highest score wins; at most 1 story per bot
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Enrich (optional) │  og:image + excerpt from article URL
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ LLM summarize     │  src/lib/ai.ts — Groq then OpenRouter;
│                   │  2-sentence casual summary; fallback to excerpt
└─────────┬─────────┘
          ▼
    Post to timeline + DM
```

**Relevancy gate details**

- **Relevance**: higher if matched keywords appear in the **title** (generic topics like “world” or “ai” score lower than specific ones like “Arsenal” or “Premier League”).
- **Popularity**: boosted by multiple outlets covering the same story or a known major source (Reuters, BBC, ESPN, etc.).
- Stories that only match vague topic chips and lack outlet signal are often dropped here — by design, to reduce noise.

**Client-side dedup**

Before posting, the store also skips URLs/titles already in your **seen** collection and near-duplicate titles (`src/lib/dedupe.ts`).

---

## Chats and messages

| Chat | ID | Purpose |
| --- | --- | --- |
| **the timeline** | `group` | Group feed; all bots post here |
| **DM** | `dm-{botId}` | Per-bot thread; same news copied in; you ask follow-ups |

Message kinds:

- **`news`** — bot story (summary, link, matched keywords, sources, flash)
- **`chat`** — your message or bot reply in a DM
- **`system`** — welcome / member joined lines

When you open an empty DM, the store **hydrates** news from the timeline for that bot so you see their stories without a separate fetch.

---

## DM / chat API

`POST /api/chat` (`src/app/api/chat/route.ts`):

- Input: `botId`, your message, recent history, recent news from that thread, preferences (for pitch).
- Builds a system prompt from the bot’s **vibe**.
- For **pitch**, attaches `footballSnapshot()` text (ESPN).
- Returns a short lowercase reply via Groq → OpenRouter.

The bot only “knows” recent stories you pass in context — it is not browsing the web live (except pitch’s live block).

---

## Storage

**Firebase (default when configured)**

```
users/{uid}
  profile          — displayName, enabledBots, preferences, onboarded, lastIngestAt
  chats/{chatId}   — type, title, lastMessage, unread
    messages/      — sender, text, kind, articleUrl, matchedKeywords, …
  seen/{id}        — url, title, botId (dedup, 48h retention)
  push/            — web push subscriptions (optional)
```

**Local fallback**

If Firestore is unavailable, everything mirrors into `localStorage` on the device (`backend === "local"` in the footer).

Auth is **anonymous Firebase Auth** — no password; your data is scoped to that browser/PWA install.

---

## AI providers

| Use | Primary | Fallback |
| --- | --- | --- |
| Story summaries on ingest | Groq (`GROQ_API_KEY`) | OpenRouter free models |
| DM replies | Groq | OpenRouter |
| If both fail | Excerpt / headline rewrite | No invented facts |

Keys live in `.env.local` (never commit).

---

## UI surfaces (quick map)

| Screen | Component | Role |
| --- | --- | --- |
| Chat list | `ChatList.tsx` | Group + direct sections, refresh / filters / add bot |
| Thread | `ChatThread.tsx` | Messages, composer, group filters & members |
| Filters | `Preferences.tsx` | Per-bot chips + custom keywords |
| Members | `MembersSheet.tsx` | Enable/disable bots in the group |
| Onboarding | `Onboarding.tsx` | Pick bots → set filters |

---

## Environment & run

```bash
npm install
npm run dev   # http://localhost:3000
```

See `README.md` for iPhone PWA install (Cloudflare tunnel + Add to Home Screen) and Firebase notes.

---

## Mental model

1. **Members** = who is allowed to speak in the group.
2. **Filters** = what each bot is allowed to talk about (keyword rules + feed shaping).
3. **Refresh** = run the pipeline once; each bot may drop **one** qualifying story.
4. **Gate + LLM** = even if a keyword matches, the story must look **important enough** and get a **human-readable summary** before it hits the chat.

That is why you might have “AI” selected for techie but not see every AI headline — keyword match is necessary but not sufficient.
