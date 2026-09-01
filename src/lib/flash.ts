export type FlashKind = "now" | "soon" | "recent";

const PAST =
  /\b(recap|what happened|yesterday|last night|overnight recap|obituar|remembered as|final whistle from|post[- ]match analysis|opinion|what it means|the choices we make)\b/i;

const SOON =
  /\b(will|set to|expected to|scheduled|tonight|tomorrow|ahead of|to face|to announce|preview|kick[- ]?off|tips off|heads into|poised to|on track to)\b/i;

const NOW =
  /\b(breaking|just in|just now|live|ongoing|developing|this hour|this morning|currently|as we speak)\b/i;

const SKIP =
  /\b(all[- ]time|all time|#\d+|ranking|ranks the|schedule announced|announces 202[6-9] schedule|what we learned|best and worst|worst trades this decade)\b/i;

export function classifyFlash(text: string, publishedAt: number, now = Date.now()): FlashKind | null {
  const ageHours = (now - publishedAt) / 3_600_000;
  if (SKIP.test(text)) return null;
  if (ageHours > 24 && !SOON.test(text)) return null;
  if (ageHours > 36) return null;
  if (PAST.test(text) && !NOW.test(text) && !SOON.test(text) && ageHours > 4) return null;
  if (NOW.test(text) || ageHours <= 3) return "now";
  if (SOON.test(text) || ageHours <= 8) return "soon";
  return "recent";
}

export function flashScore(kind: FlashKind, publishedAt: number, now = Date.now()) {
  const ageHours = Math.max(0, (now - publishedAt) / 3_600_000);
  let score = kind === "now" ? 8 : kind === "soon" ? 6 : 3;
  if (ageHours < 2) score += 4;
  else if (ageHours < 6) score += 2;
  else if (ageHours > 18) score -= 2;
  return score;
}
