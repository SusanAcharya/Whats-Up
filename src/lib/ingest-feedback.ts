import { getBot } from "./bots";
import { titleCaseName } from "./notifications";
import type { IngestResult } from "./types";

export function ingestStatusText(result: IngestResult | null, ingesting: boolean): string | null {
  if (ingesting) return "Checking headlines…";
  if (!result) return null;

  const { stats, postedBotIds } = result;
  const { headlinesChecked, keywordMatched, gatePassed, posted } = stats;

  if (posted > 0) {
    const names = postedBotIds
      .map((id) => titleCaseName(getBot(id)?.name ?? id))
      .join(", ");
    return `${names} posted ${posted === 1 ? "a story" : `${posted} stories`}.`;
  }

  if (headlinesChecked === 0) {
    return "No feeds to check. Add filters or enable a bot.";
  }
  if (keywordMatched === 0) {
    return `Checked ${headlinesChecked} headlines · nothing matched your filters.`;
  }
  if (gatePassed === 0) {
    return `Checked ${headlinesChecked} headlines · ${keywordMatched} matched but none passed quality check.`;
  }
  return `Checked ${headlinesChecked} headlines · quiet for now. We only post when it's huge.`;
}
