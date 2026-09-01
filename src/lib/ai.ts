import type { BotId, IngestItem } from "./types";
import { getBot } from "./bots";
import { titleTokens } from "./dedupe";
import type { FlashStory } from "./pipeline";

const GROQ_MODELS = [
  "groq/compound-mini",
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-20b",
];

const OPENROUTER_MODELS = [
  "openrouter/free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-nano-9b-v2:free",
];

type ChatTurn = { role: "system" | "user" | "assistant"; content: string };

function stripThink(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function extractJson(text: string): unknown {
  const trimmed = stripThink(text);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : trimmed;
  const start = raw.indexOf("{") >= 0 ? raw.indexOf("{") : raw.indexOf("[");
  const end = raw.lastIndexOf("}") >= 0 ? raw.lastIndexOf("}") : raw.lastIndexOf("]");
  if (start < 0 || end < start) {
    throw new Error("No JSON in model response");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

async function groqComplete(messages: ChatTurn[], temperature = 0.7): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("missing groq key");

  let lastError = "groq failed";
  for (const model of GROQ_MODELS) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: 1600,
        messages,
      }),
    });
    if (!response.ok) {
      lastError = await response.text();
      continue;
    }
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = stripThink(data.choices?.[0]?.message?.content ?? "");
    if (content) return content;
  }
  throw new Error(lastError);
}

async function openRouterComplete(messages: ChatTurn[], temperature = 0.7): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("missing openrouter key");

  let lastError = "openrouter failed";
  for (const model of OPENROUTER_MODELS) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "What's Up",
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: 1600,
        messages,
      }),
    });
    if (!response.ok) {
      lastError = await response.text();
      continue;
    }
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = stripThink(data.choices?.[0]?.message?.content ?? "");
    if (content) return content;
  }
  throw new Error(lastError);
}

export async function complete(messages: ChatTurn[], temperature = 0.7): Promise<string> {
  try {
    return await groqComplete(messages, temperature);
  } catch (error) {
    console.warn("Groq unavailable, trying OpenRouter", error);
    return await openRouterComplete(messages, temperature);
  }
}

function fallbackText(story: FlashStory) {
  const title = plainify(story.title.replace(/\s+/g, " ").trim());
  const excerpt = plainify((story.excerpt || story.snippet || "").replace(/\s+/g, " ").trim());
  const firstSentence =
    excerpt.split(/(?<=[.!?])\s+/).find((row) => row.length > 25 && !tooLikeTitle(row, title)) ?? "";

  if (firstSentence) {
    return sentenceCase(trimSummary(firstSentence, 200));
  }

  const gist = plainHeadline(title);
  const tag = story.matchedKeywords[0];
  if (tag) {
    return `${gist} Good to know if you follow ${tag}.`;
  }
  return `${gist} Worth a quick look.`;
}

function plainHeadline(title: string) {
  const words = title.trim().split(/\s+/);
  const soft = new Set([
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "is", "are", "was", "were",
    "has", "have", "says", "said", "will", "be", "by", "as", "it", "its", "with", "from", "that", "this",
  ]);
  const out = words.map((word, index) => {
    if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    if (soft.has(word.toLowerCase())) return word.toLowerCase();
    if (word === word.toUpperCase() && word.length <= 5) return word;
    if (/^[A-Z][a-z]+/.test(word) && word.length > 2) return word;
    return word.toLowerCase();
  });
  return sentenceCase(trimSummary(out.join(" ").replace(/[?!.]+$/, ""), 150));
}

async function summarizeOneSimple(story: FlashStory): Promise<string | null> {
  const system = `Explain news in plain English for a group chat.

Write exactly 1-2 short sentences (under 200 characters total).
- Say what happened in simple words.
- Optional second sentence: why a normal person might care.
- No jargon, no hype, no headline copy, no invented facts.
- Proper sentence case.`;

  try {
    const raw = await complete(
      [
        { role: "system", content: system },
        {
          role: "user",
          content: `TITLE: ${story.title}\nEXCERPT: ${story.excerpt || story.snippet || "(none)"}`,
        },
      ],
      0.2,
    );
    const text = trimSummary(stripThink(raw).replace(/^["']|["']$/g, ""), 220);
    if (!text || text.length < 20) return null;
    return sentenceCase(text);
  } catch {
    return null;
  }
}

function plainify(text: string) {
  return text
    .replace(/\([^)]{20,}\)/g, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function trimSummary(text: string, maxChars = 220) {
  const cleaned = plainify(cleanVoice(text));
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  let out = sentences.slice(0, 2).join(" ");
  if (out.length <= maxChars) return out;
  out = sentences[0] ?? out;
  if (out.length <= maxChars) return out;
  const cut = out.slice(0, maxChars - 1).replace(/\s+\S*$/, "");
  return `${cut}…`;
}

function sentenceCase(text: string) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function tooLikeTitle(text: string, title: string) {
  const a = text.trim().toLowerCase();
  const b = title.trim().toLowerCase();
  if (a === b) return true;
  if (a.length <= b.length * 1.15 && (a.startsWith(b.slice(0, Math.min(b.length, 40))) || b.startsWith(a))) {
    return true;
  }
  const left = titleTokens(text);
  const right = titleTokens(title);
  if (left.size === 0 || right.size === 0) return false;
  let overlap = 0;
  for (const word of left) {
    if (right.has(word)) overlap += 1;
  }
  const smaller = Math.min(left.size, right.size);
  const ratio = overlap / smaller;
  return ratio >= 0.9 && text.length < title.length * 1.25;
}

function cleanVoice(text: string) {
  return text
    .replace(/^[🌍⚽💻🎬📈🧪]\s*/u, "")
    .replace(/^yo this one actually matters:\s*/i, "")
    .replace(/^no because\s+/i, "")
    .replace(/^okay wait\.?\s*/i, "")
    .replace(/\s*is actually insane\.?$/i, "")
    .replace(/\s*not a drill\.?$/i, "")
    .trim();
}

export async function summarizeFlashes(stories: FlashStory[]): Promise<IngestItem[]> {
  if (stories.length === 0) return [];

  const system = `You explain news the way you'd text a friend — short and simple.

Each story already passed a filter. Your job: make the gist obvious in plain English.

Rules:
- 1-2 short sentences. Aim for under 200 characters total.
- Use simple words. No jargon. If a term is needed, explain it in plain language.
- Sentence 1: what happened (one main fact). Sentence 2 (optional): why it matters in everyday terms.
- Proper sentence case. Sound human, not like a newspaper or lawyer.
- Do not copy or lightly rewrite the TITLE.
- Never invent facts. Use TITLE + EXCERPT only.
- No "breaking:", no emoji, no hype ("insane", "massive", "unprecedented").
- keep:false for rankings, schedules, listicles, or fluff with no real news.

Good:
- Apple says OpenAI destroyed evidence in their court case. Could affect how AI companies handle legal requests.
- The Fed kept interest rates the same. Borrowing costs stay put for now.

Bad:
- Long sentences with multiple clauses and insider terms
- Restating the headline
- Explaining every detail — pick the one thing that matters

Return JSON only:
{"items":[{"index":0,"keep":true,"groupText":"Apple says OpenAI destroyed evidence in their court case. Could affect how AI companies handle legal requests."}]}`;

  const user = stories
    .map(
      (story, index) =>
        `[${index}] bot=${story.botId} flash=${story.flash} relevance=${story.relevance} popularity=${story.popularity} matched=${story.matchedKeywords.join(", ")} sources=${story.sources.join(" | ")}\nTITLE: ${story.title}\nEXCERPT: ${story.excerpt || story.snippet || "(none)"}`,
    )
    .join("\n\n");

  const toItem = (story: FlashStory, text: string, strict = true): IngestItem | null => {
    const summary = sentenceCase(trimSummary(text));
    if (!summary || summary.length < 20) return null;
    if (strict && tooLikeTitle(summary, story.title)) return null;
    return {
      botId: story.botId,
      groupText: summary.slice(0, 280),
      dmText: null,
      sendDm: false,
      title: story.title,
      url: story.url,
      source: story.source,
      imageUrl: story.imageUrl,
      matchedKeywords: story.matchedKeywords,
      sources: story.sources,
      flash: story.flash,
    };
  };

  try {
    const raw = await complete(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      0.25,
    );
    const parsed = extractJson(raw) as {
      items?: {
        index?: number;
        keep?: boolean;
        groupText?: string;
      }[];
    };

    const kept: IngestItem[] = [];
    const usedBot = new Set<BotId>();
    for (const row of parsed.items ?? []) {
      if (typeof row.index !== "number") continue;
      const story = stories[row.index];
      if (!story || usedBot.has(story.botId) || row.keep === false) continue;
      const item = toItem(story, row.groupText ?? "");
      if (!item) continue;
      usedBot.add(story.botId);
      kept.push(item);
    }
    if (kept.length > 0) return kept;
    console.warn("summarize produced no usable text, trying simple per-story");
  } catch (error) {
    console.warn("curate fallback", error);
  }

  const simple = await Promise.all(
    stories.map(async (story) => {
      const text = (await summarizeOneSimple(story)) ?? fallbackText(story);
      return toItem(story, text, false);
    }),
  );
  return simple.filter((item): item is IngestItem => Boolean(item)).slice(0, 4);
}

export async function botReply(input: {
  botId: BotId;
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
  newsContext: { title: string; text: string }[];
  liveContext?: string;
}): Promise<string> {
  const bot = getBot(input.botId);
  if (!bot) return "Wait, who am I supposed to be right now?";

  const news =
    input.newsContext.length === 0
      ? "No recent stories in this thread yet."
      : input.newsContext
          .slice(0, 5)
          .map((story) => `- ${story.title}: ${story.text}`)
          .join("\n");

  const live = input.liveContext?.trim();
  const system = `${bot.vibe}

You're texting a friend in iMessage. 2-4 short sentences, casual, proper sentence case (capitalize the first letter of each sentence).
Don't use catchphrases. Don't say "no because" or "actually insane" or "yo this one actually matters".
${live ? "Answer from LIVE DATA first. Never invent a score or table position." : "Stay on the stories you were given. If you don't know, say so."}`;

  try {
    const reply = await complete([
      { role: "system", content: system },
      {
        role: "user",
        content: live
          ? `LIVE DATA (trust this over memory):\n${live}\n\nRecent posts:\n${news}`
          : `Recent stories you posted:\n${news}`,
      },
      ...input.history.slice(-8),
      { role: "user", content: input.message },
    ]);
    return stripThink(reply).slice(0, 1200);
  } catch (error) {
    console.warn("chat fallback", error);
    return "Wifi in my brain just lagged. Ask me again in a sec.";
  }
}