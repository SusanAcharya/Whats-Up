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
  const excerpt = (story.excerpt || story.snippet || "").replace(/\s+/g, " ").trim();
  const sentences = excerpt.split(/(?<=[.!?])\s+/).filter((row) => row.length > 20);
  const summary = sentences.slice(0, 2).join(" ");
  if (summary.length >= 40 && !(tooLikeTitle(summary, story.title) && summary.length < story.title.length + 30)) {
    return sentenceCase(summary);
  }
  const title = story.title.replace(/\s+/g, " ").trim();
  const source = story.sources[0] || story.source || "the wires";
  const why = story.matchedKeywords.slice(0, 2).join(", ");
  if (excerpt.length >= 40 && !tooLikeTitle(excerpt, title)) {
    return sentenceCase(`${title}. ${excerpt.slice(0, 220)}`.replace(/\s+/g, " ").trim());
  }
  return sentenceCase(`${title}. ${source} has the latest${why ? ` — ${why}` : ""}.`);
}

function sentenceCase(text: string) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function tooLikeTitle(text: string, title: string) {
  const left = titleTokens(text);
  const right = titleTokens(title);
  if (left.size === 0 || right.size === 0) {
    return text.trim().toLowerCase() === title.trim().toLowerCase();
  }
  let overlap = 0;
  for (const word of left) {
    if (right.has(word)) overlap += 1;
  }
  const smaller = Math.min(left.size, right.size);
  return overlap / smaller >= 0.72;
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

  const system = `You are a wire editor writing a news flash for a group chat.

Each story already passed a relevancy + popularity gate. Write a REAL summary, not the headline.

Rules:
- 2 sentences. Sentence 1: what is happening, with the key fact/number/name. Sentence 2: why it matters or what happens next.
- Proper sentence case (capitalize the first letter). Casual and precise — not formal newspaper voice.
- Do not copy or lightly rewrite the TITLE.
- Never invent facts. Use TITLE + EXCERPT. If the excerpt is thin, still write two sentences from the facts in the title — do not paste the headline.
- keep:false only for rankings, schedules, listicles, or stories with no real development.

Good:
- Rui Hachimura is staying in LA after the deadline talks collapsed. That leaves the Lakers' wing rotation as-is heading into the last stretch.
- Traders now expect the Fed to hold at 2pm. A cut this late would have been the surprise.

Bad:
- restating the headline
- all-lowercase texting slang
- "breaking:"

Return JSON only:
{"items":[{"index":0,"keep":true,"groupText":"Rui Hachimura is staying in LA after the deadline talks collapsed. That leaves the Lakers' wing rotation as-is heading into the last stretch."}]}`;

  const user = stories
    .map(
      (story, index) =>
        `[${index}] bot=${story.botId} flash=${story.flash} relevance=${story.relevance} popularity=${story.popularity} matched=${story.matchedKeywords.join(", ")} sources=${story.sources.join(" | ")}\nTITLE: ${story.title}\nEXCERPT: ${story.excerpt || story.snippet || "(none)"}`,
    )
    .join("\n\n");

  const toItem = (story: FlashStory, text: string, strict = true): IngestItem | null => {
    const summary = sentenceCase(cleanVoice(text));
    if (!summary || summary.length < 24) return null;
    if (strict && tooLikeTitle(summary, story.title)) return null;
    return {
      botId: story.botId,
      groupText: summary.slice(0, 500),
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
      0.35,
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
    console.warn("summarize produced no usable text, using excerpts");
  } catch (error) {
    console.warn("curate fallback", error);
  }

  return stories
    .map((story) => toItem(story, fallbackText(story), false))
    .filter((item): item is IngestItem => Boolean(item))
    .slice(0, 4);
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