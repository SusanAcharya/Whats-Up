import { allOptionsFor, keywordsForPref } from "./preferences";
import type { BotId, BotPref } from "./types";

export type KeywordRule = {
  label: string;
  needles: string[];
};

export function keywordRules(botId: BotId, pref: BotPref): KeywordRule[] {
  const options = allOptionsFor(botId);
  const rules: KeywordRule[] = [];
  const selected = [...pref.sports, ...pref.leagues, ...pref.topics, ...pref.teams];
  for (const id of selected) {
    const option = options.find((row) => row.id === id);
    const label = option?.label ?? id.replace(/-/g, " ");
    const needles = (option?.keywords ?? [label]).map((word) => word.toLowerCase());
    rules.push({ label, needles });
  }
  for (const word of pref.keywords ?? []) {
    const needle = word.trim().toLowerCase();
    if (!needle) continue;
    rules.push({ label: word.trim(), needles: [needle] });
  }
  if (botId === "sporty" && pref.sports.includes("soccer")) {
    const soccer = rules.find((row) => row.label.toLowerCase().includes("soccer"));
    if (soccer) {
      soccer.needles = [...new Set([...soccer.needles, ...keywordsForPref(botId, pref)])];
    }
  }
  return rules;
}

export function haystackOf(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function hasNeedle(text: string, needle: string) {
  if (needle.length < 2) return false;
  if (needle.length <= 3) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(text);
  }
  return text.includes(needle);
}

export function matchKeywords(text: string, rules: KeywordRule[]): string[] {
  if (rules.length === 0) return [];
  const hits: string[] = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    if (!rule.needles.some((needle) => hasNeedle(text, needle))) continue;
    const key = rule.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(rule.label);
  }
  return hits.slice(0, 8);
}
