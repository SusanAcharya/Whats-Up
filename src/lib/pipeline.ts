import { getBot } from "./bots";
import { titlesOverlap } from "./dedupe";
import { classifyFlash, flashScore, type FlashKind } from "./flash";
import {
  lineForMatch,
  matchesForPref,
  storyText,
  type LiveMatch,
} from "./football";
import { enrichStories } from "./images";
import { haystackOf, keywordRules, matchKeywords } from "./match";
import { fetchFeed, type RawStory } from "./news";
import { feedsForPref } from "./preferences";
import { passesGate, rateStory } from "./relevance";
import type { BotId, BotPref, IngestStats, Preferences } from "./types";

export type FlashStory = RawStory & {
  score: number;
  matchedKeywords: string[];
  sources: string[];
  flash: FlashKind;
  relevance: number;
  popularity: number;
  excerpt?: string;
};

async function pitchFlashes(pref: BotPref, seen: Set<string>): Promise<FlashStory[]> {
  const matches = await matchesForPref(pref);
  const rank = (status: LiveMatch["status"]) => (status === "in" ? 0 : status === "post" ? 1 : 2);
  const sorted = [...matches].sort((a, b) => rank(a.status) - rank(b.status) || a.start - b.start);
  const flashes: FlashStory[] = [];
  for (const match of sorted.slice(0, 3)) {
    const url = `${match.url}#${match.status}-${match.home.score}-${match.away.score}`;
    const title = lineForMatch(match);
    if (seen.has(url)) continue;
    const flash = match.status === "in" ? "now" : match.status === "pre" ? "soon" : "recent";
    flashes.push({
      botId: "pitch",
      title,
      url,
      source: "ESPN",
      snippet: storyText(match),
      excerpt: storyText(match),
      publishedAt: match.status === "pre" ? match.start : Date.now(),
      imageUrl: match.logo,
      score: match.status === "in" ? 40 : 20,
      matchedKeywords: [match.league, match.home.short, match.away.short],
      sources: ["ESPN"],
      flash,
      relevance: 90,
      popularity: 90,
    });
  }
  return flashes;
}

function clusterStories(stories: FlashStory[]): FlashStory[] {
  const clusters: FlashStory[] = [];
  for (const story of stories) {
    const twin = clusters.findIndex(
      (row) => titlesOverlap(row.title, story.title) || row.url === story.url,
    );
    if (twin < 0) {
      clusters.push({ ...story, sources: [story.source] });
      continue;
    }
    const current = clusters[twin];
    const sources = [...new Set([...current.sources, story.source])];
    const better =
      story.score > current.score ||
      (story.score === current.score && story.publishedAt > current.publishedAt) ||
      (!current.imageUrl && Boolean(story.imageUrl));
    const merged = {
      ...(better ? story : current),
      sources,
      matchedKeywords: [...new Set([...current.matchedKeywords, ...story.matchedKeywords])],
    };
    const rated = rateStory(merged);
    clusters[twin] = {
      ...merged,
      ...rated,
      score: flashScore(merged.flash, merged.publishedAt) + rated.relevance + rated.popularity,
    };
  }
  return clusters;
}

export type CollectResult = {
  stories: FlashStory[];
  stats: IngestStats;
};

export async function collectFlashes(
  botIds: BotId[],
  seenUrls: string[],
  seenTitles: string[],
  preferences: Preferences,
): Promise<CollectResult> {
  const seen = new Set(seenUrls);
  const stats: IngestStats = {
    headlinesChecked: 0,
    keywordMatched: 0,
    gatePassed: 0,
    posted: 0,
    skippedDuplicate: 0,
  };

  const collected = await Promise.all(
    botIds.map(async (botId) => {
      const bot = getBot(botId);
      const pref = preferences[botId];
      if (!bot || !pref) return [] as FlashStory[];
      if (botId === "pitch") {
        const pitch = await pitchFlashes(pref, seen);
        stats.headlinesChecked += pitch.length;
        stats.keywordMatched += pitch.length;
        stats.gatePassed += pitch.length;
        return pitch;
      }
      const rules = keywordRules(botId, pref);
      if (rules.length === 0) return [];
      const feedList = feedsForPref(botId, pref, bot.feeds);
      const items = (await Promise.all(feedList.map((feed) => fetchFeed(feed, botId)))).flat();
      stats.headlinesChecked += items.length;
      const flashes: FlashStory[] = [];
      for (const story of items) {
        if (seen.has(story.url)) continue;
        if (seenTitles.some((title) => titlesOverlap(title, story.title))) continue;
        const text = haystackOf([story.title, story.snippet]);
        const matchedKeywords = matchKeywords(text, rules);
        if (matchedKeywords.length === 0) continue;
        stats.keywordMatched += 1;
        const flash = classifyFlash(text, story.publishedAt);
        if (!flash) continue;
        const rated = rateStory({ ...story, matchedKeywords, sources: [story.source] });
        flashes.push({
          ...story,
          matchedKeywords,
          sources: [story.source],
          flash,
          ...rated,
          score: flashScore(flash, story.publishedAt) + rated.relevance + rated.popularity,
        });
      }
      return flashes;
    }),
  );

  const clustered = clusterStories(collected.flat());
  const gated = clustered.filter((story) => {
    if (story.botId === "pitch") return true;
    const pass = passesGate(story);
    if (pass) stats.gatePassed += 1;
    return pass;
  });
  const bestByBot = new Map<BotId, FlashStory>();
  for (const story of gated) {
    const current = bestByBot.get(story.botId);
    if (!current || story.score > current.score) bestByBot.set(story.botId, story);
  }

  const winners = [...bestByBot.values()].sort((a, b) => b.score - a.score);
  const enriched = await enrichStories(winners);
  stats.posted = enriched.length;
  return { stories: enriched, stats };
}
