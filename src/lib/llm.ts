/**
 * Shared LLM transport — token-efficient by design.
 *
 * Rules:
 * - Never call Groq Compound (agentic) models for chat/ingest — they burn TPD fast.
 * - One small model, tight max_tokens, no multi-model retries on 429.
 * - Circuit-break Groq after rate limits so we don't keep “requesting” tokens.
 */

export type ChatTurn = { role: "system" | "user" | "assistant"; content: string };
export type LlmPurpose = "ingest" | "chat";

/** Cheap chat model — not Compound, not 70B. */
const GROQ_MODEL = "openai/gpt-oss-20b";

const OPENROUTER_MODELS = [
  "openai/gpt-oss-20b:free",
  "google/gemma-2-9b-it:free",
];

const MAX_OUT: Record<LlmPurpose, number> = {
  ingest: 650,
  chat: 220,
};

/** In-process cooldown after Groq 429 (survives warm serverless invocations). */
let groqCoolUntil = 0;

export function groqIsCooling(): boolean {
  return Date.now() < groqCoolUntil;
}

export function groqCoolRemainingMs(): number {
  return Math.max(0, groqCoolUntil - Date.now());
}

function stripThink(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export function stripLlmThink(text: string) {
  return stripThink(text);
}

function isRateLimitBody(body: string) {
  return /rate_limit|tokens per day|TPD|429/i.test(body);
}

function coolFromError(body: string) {
  const mins = body.match(/try again in (\d+)m([\d.]+)s/i);
  if (mins) {
    groqCoolUntil = Date.now() + (Number(mins[1]) * 60 + Number(mins[2])) * 1000;
    return;
  }
  const secs = body.match(/try again in ([\d.]+)s/i);
  if (secs) {
    groqCoolUntil = Date.now() + Number(secs[1]) * 1000;
    return;
  }
  // Default: don't hammer for 20 minutes
  groqCoolUntil = Date.now() + 20 * 60 * 1000;
}

async function groqComplete(
  messages: ChatTurn[],
  maxTokens: number,
  temperature: number,
): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("missing groq key");
  if (groqIsCooling()) {
    throw new Error(`groq cooling ${Math.ceil(groqCoolRemainingMs() / 1000)}s`);
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature,
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429 || isRateLimitBody(body)) {
      coolFromError(body);
      throw new Error(body);
    }
    throw new Error(body || `groq ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = stripThink(data.choices?.[0]?.message?.content ?? "");
  if (!content) throw new Error("groq empty");
  return content;
}

async function openRouterComplete(
  messages: ChatTurn[],
  maxTokens: number,
  temperature: number,
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("missing openrouter key");

  let lastError = "openrouter failed";
  for (const model of OPENROUTER_MODELS) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://whats-up-nasus.vercel.app",
        "X-Title": "What's Up",
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages,
      }),
    });
    if (!response.ok) {
      lastError = await response.text();
      // Don't burn the whole free-model list on shared rate limits
      if (response.status === 429 || isRateLimitBody(lastError)) break;
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

export type LlmResult = {
  text: string;
  provider: "groq" | "openrouter";
};

/**
 * Complete with budgeted output tokens.
 * Prefer Groq when not cooling; otherwise OpenRouter; never multi-retry Groq on 429.
 */
export async function llmComplete(
  messages: ChatTurn[],
  opts: { purpose: LlmPurpose; temperature?: number },
): Promise<LlmResult> {
  const maxTokens = MAX_OUT[opts.purpose];
  const temperature = opts.temperature ?? 0.5;

  if (process.env.GROQ_API_KEY && !groqIsCooling()) {
    try {
      const text = await groqComplete(messages, maxTokens, temperature);
      return { text, provider: "groq" };
    } catch (error) {
      console.warn("Groq skip → OpenRouter", groqIsCooling() ? `(cooling ${Math.ceil(groqCoolRemainingMs() / 1000)}s)` : error);
    }
  }

  const text = await openRouterComplete(messages, maxTokens, temperature);
  return { text, provider: "openrouter" };
}

/** Rough token estimate for logging / gates (chars/4). */
export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}
