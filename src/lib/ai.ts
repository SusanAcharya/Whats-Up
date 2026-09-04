import type { BotId, IngestItem } from "./types";
import { getBot } from "./bots";
import { titleTokens } from "./dedupe";
import { estimateTokens, llmComplete, stripLlmThink, type ChatTurn } from "./llm";
import type { FlashStory } from "./pipeline";

/** Cap how many stories pay for an LLM rewrite per ingest. */
const LLM_STORY_CAP = 4;
/** Skip LLM when local excerpt already makes a decent blurb. */
const LOCAL_EXCERPT_MIN = 60;

function extractJson(text: string): unknown {
  const trimmed = stripLlmThink(text);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : trimmed;
  const start = raw.indexOf("{") >= 0 ? raw.indexOf("{") : raw.indexOf("[");
  const end = raw.lastIndexOf("}") >= 0 ? raw.lastIndexOf("}") : raw.lastIndexOf("]");
  if (start < 0 || end < start) {
    throw new Error("No JSON in model response");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function fallbackText(story: FlashStory) {
  const title = plainify(story.title.replace(/\s+/g, " ").trim());
  const excerpt = plainify((story.excerpt || story.snippet || "").replace(/\s+/g, " ").trim());
  const firstSentence =
    excerpt.split(/(?<=[.!?])\s+/).find((row) => row.length > 25 && !tooLikeTitle(row, title)) ?? "";

  if (firstSentence) {
    return ensurePeriod(sentenceCase(trimSummary(firstSentence, 200)));
  }
  return ensurePeriod(plainHeadline(title));
}

function ensurePeriod(text: string) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return trimmed;
  if (/[.!?…]$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

function plainHeadline(title: string) {
  const cleaned = title
    .replace(/\s*[|–—]\s*/g, " — ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(/\s+/);
  const soft = new Set([
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "is", "are", "was", "were",
    "has", "have", "says", "said", "will", "be", "by", "as", "it", "its", "with", "from", "that", "this",
  ]);
  const out = words.map((word, index) => {
    if (word === "—" || word === "-" || word === "|") return word;
    const lower = word.toLowerCase();
    if (index === 0 || (index > 0 && words[index - 1] === "—")) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    if (soft.has(lower)) return lower;
    if (word === word.toUpperCase() && word.length <= 5) return word;
    if (/^[A-Z][a-z]+/.test(word) && word.length > 2) return word;
    return lower;
  });
  return sentenceCase(trimSummary(out.join(" ").replace(/\s+[?!.]+$/, ""), 150));
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
    .replace(/\s*is actually insane\.?$/i, "")
    .replace(/\s*not a drill\.?$/i, "")
    .replace(/^[—–-]\s+/, "")
    .replace(/\s+Good to know if you follow\s+\S+\.?$/i, ".")
    .replace(/\s+Worth a quick look\.?$/i, ".")
    .trim();
}

function normalizeGroupText(text: string) {
  let out = cleanVoice(text).replace(/\s+/g, " ").trim();
  out = out.replace(/^[—–-]\s+/, "");
  out = out.replace(/\s+([.!?])/g, "$1");
  if (!out) return out;
  return sentenceCase(out);
}

function fallbackFriendText(story: FlashStory, clean: string) {
  const fact = ensurePeriod(clean).replace(/\.$/, "");
  const lower = `${fact.charAt(0).toLowerCase()}${fact.slice(1)}`;
  const variants = [
    ensurePeriod(sentenceCase(fact)),
    `wait — ${lower}.`,
    `lowkey ${lower}.`,
    `ngl ${lower}.`,
  ];
  return trimSummary(variants[Math.abs(story.title.length) % variants.length], 280);
}

function toItem(
  story: FlashStory,
  friendText: string,
  summaryText: string,
  strict = true,
): IngestItem | null {
  const friend = normalizeGroupText(friendText);
  const summary = sentenceCase(trimSummary(summaryText || friendText));
  const chat = friend.length >= 12 ? friend : summary;
  if (!chat || chat.length < 12) return null;
  if (!summary || summary.length < 16) return null;
  if (strict && tooLikeTitle(chat, story.title) && tooLikeTitle(summary, story.title)) {
    return null;
  }
  return {
    botId: story.botId,
    groupText: chat.slice(0, 320),
    summary: summary.slice(0, 280),
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
}

function localItem(story: FlashStory): IngestItem | null {
  const clean = fallbackText(story);
  return toItem(story, fallbackFriendText(story, clean), clean, false);
}

function hasStrongLocalCopy(story: FlashStory) {
  const excerpt = plainify((story.excerpt || story.snippet || "").trim());
  if (excerpt.length < LOCAL_EXCERPT_MIN) return false;
  return !tooLikeTitle(excerpt.slice(0, 120), story.title);
}

/**
 * Pick a tiny set of stories that benefit most from LLM voice.
 * Everything else ships on free local copy.
 */
function pickForLlm(stories: FlashStory[]): FlashStory[] {
  const ranked = [...stories].sort((a, b) => {
    const flashRank = (f: FlashStory["flash"]) => (f === "now" ? 0 : f === "soon" ? 1 : 2);
    const need = Number(hasStrongLocalCopy(a)) - Number(hasStrongLocalCopy(b)); // prefer weak local
    if (need) return need;
    const flash = flashRank(a.flash) - flashRank(b.flash);
    if (flash) return flash;
    return b.score - a.score;
  });
  return ranked.slice(0, LLM_STORY_CAP);
}

const INGEST_SYSTEM = `JSON only. For each story return groupText + summary.
groupText: casual friend iMessage <180 chars. Not the title. No hashtags/emoji spam. Facts from TITLE/EXCERPT only.
summary: 1 clean sentence, no slang.
keep:false for fluff/listicles.
{"items":[{"i":0,"keep":true,"groupText":"ngl chelsea dumped like 39 players and banked over £500m","summary":"Chelsea sold or loaned 39 players this summer for over £500 million."}]}`;

/**
 * Local-first ingest:
 * 1) Build free local blurbs for every story
 * 2) Optionally rewrite at most LLM_STORY_CAP via one small LLM call
 * 3) On any LLM failure / rate limit → keep local (never block posting)
 */
export async function summarizeFlashes(stories: FlashStory[]): Promise<IngestItem[]> {
  if (stories.length === 0) return [];

  const locals = new Map<string, IngestItem>();
  const usedByBot = new Map<BotId, number>();
  const MAX_PER_BOT = 3;

  for (const story of stories) {
    const count = usedByBot.get(story.botId) ?? 0;
    if (count >= MAX_PER_BOT) continue;
    const item = localItem(story);
    if (!item) continue;
    locals.set(story.url, item);
    usedByBot.set(story.botId, count + 1);
  }

  const candidates = pickForLlm(stories.filter((story) => locals.has(story.url))).filter(
    (story) => !hasStrongLocalCopy(story),
  );

  if (candidates.length === 0) {
    return [...locals.values()];
  }

  const user = candidates
    .map((story, index) => {
      const excerpt = plainify(story.excerpt || story.snippet || "").slice(0, 160);
      return `[${index}] ${story.title}\n${excerpt || "(no excerpt)"}`;
    })
    .join("\n\n");

  const promptTokens = estimateTokens(INGEST_SYSTEM + user);
  if (promptTokens > 1800) {
    console.warn("ingest prompt too large, skipping LLM", promptTokens);
    return [...locals.values()];
  }

  try {
    const { text, provider } = await llmComplete(
      [
        { role: "system", content: INGEST_SYSTEM },
        { role: "user", content: user },
      ],
      { purpose: "ingest", temperature: 0.4 },
    );
    const parsed = extractJson(text) as {
      items?: { i?: number; index?: number; keep?: boolean; groupText?: string; summary?: string }[];
    };

    let upgraded = 0;
    for (const row of parsed.items ?? []) {
      const idx = typeof row.i === "number" ? row.i : row.index;
      if (typeof idx !== "number") continue;
      const story = candidates[idx];
      if (!story || row.keep === false) continue;
      const next = toItem(story, row.groupText ?? "", row.summary ?? row.groupText ?? "");
      if (!next) continue;
      locals.set(story.url, next);
      upgraded += 1;
    }
    console.info(`ingest LLM (${provider}): upgraded ${upgraded}/${candidates.length}, local ${locals.size}`);
  } catch (error) {
    console.warn("ingest LLM skipped, using local copy", error);
  }

  return [...locals.values()];
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
      ? "None yet."
      : input.newsContext
          .slice(0, 3)
          .map((story) => `- ${story.title.slice(0, 80)}: ${story.text.slice(0, 120)}`)
          .join("\n");

  const live = input.liveContext?.trim().slice(0, 600);
  // Keep vibe short — long persona dumps burn input tokens every reply.
  const vibe = bot.vibe.length > 280 ? `${bot.vibe.slice(0, 277)}…` : bot.vibe;
  const system = `${vibe}

Reply like iMessage: 2-3 short sentences, sentence case. No catchphrases. ${
    live ? "Trust LIVE DATA for scores." : "Only use the stories given."
  }`;

  const turns: ChatTurn[] = [
    { role: "system", content: system },
    {
      role: "user",
      content: live
        ? `LIVE:\n${live}\n\nRecent:\n${news}`
        : `Recent:\n${news}`,
    },
    ...input.history.slice(-4).map((row) => ({
      role: row.role,
      content: row.content.slice(0, 400),
    })),
    { role: "user", content: input.message.slice(0, 500) },
  ];

  try {
    const { text } = await llmComplete(turns, { purpose: "chat", temperature: 0.55 });
    return stripLlmThink(text).slice(0, 900);
  } catch (error) {
    console.warn("chat fallback", error);
    return "Wifi in my brain just lagged. Ask me again in a sec.";
  }
}
