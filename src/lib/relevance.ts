const GENERIC_LABELS = new Set([
  "world",
  "conflict",
  "politics",
  "asia",
  "europe",
  "americas",
  "climate",
  "ai",
  "startups",
  "security",
  "movies",
  "tv",
  "music",
  "celebrity",
  "games",
  "macro",
  "markets",
  "big tech",
  "jobs / layoffs",
  "energy",
  "space",
  "health",
  "physics",
  "biology",
  "football / soccer",
  "nba",
  "nfl",
  "tennis",
  "formula 1",
  "cricket",
  "nba season",
  "nfl season",
]);

const MAJOR_OUTLETS = [
  "bbc",
  "reuters",
  "associated press",
  "ap news",
  "nytimes",
  "new york times",
  "washington post",
  "the guardian",
  "wsj",
  "wall street journal",
  "bloomberg",
  "cnn",
  "espn",
  "the athletic",
  "yahoo",
  "the verge",
  "techcrunch",
  "ars technica",
  "npr",
  "al jazeera",
  "financial times",
  "sky sports",
  "marca",
  "nature",
  "nasa",
  "wired",
  "axios",
  "politico",
  "nbc news",
  "abc news",
  "cbs news",
];

export function isGenericLabel(label: string) {
  return GENERIC_LABELS.has(label.trim().toLowerCase());
}

export function isMajorOutlet(source: string) {
  const value = source.toLowerCase();
  return MAJOR_OUTLETS.some((name) => value.includes(name));
}

export function rateStory(story: {
  title: string;
  snippet?: string;
  excerpt?: string;
  source: string;
  sources: string[];
  matchedKeywords: string[];
}): { relevance: number; popularity: number } {
  const title = story.title.toLowerCase();
  const body = `${story.snippet ?? ""} ${story.excerpt ?? ""}`.toLowerCase();
  let relevance = 0;
  for (const label of story.matchedKeywords) {
    const needle = label.toLowerCase();
    const generic = isGenericLabel(label);
    if (title.includes(needle)) relevance += generic ? 24 : 38;
    else if (body.includes(needle)) relevance += generic ? 10 : 18;
    else relevance += generic ? 4 : 8;
  }
  relevance = Math.min(100, relevance);

  const uniqueSources = new Set(story.sources.map((row) => row.toLowerCase()));
  let popularity = Math.min(72, Math.max(0, uniqueSources.size - 1) * 30);
  if ([...uniqueSources, story.source].some(isMajorOutlet)) popularity += 32;
  if (uniqueSources.size >= 3) popularity += 16;
  popularity = Math.min(100, popularity);

  return { relevance, popularity };
}

export function passesGate(story: {
  title: string;
  source: string;
  sources: string[];
  matchedKeywords: string[];
  relevance: number;
  popularity: number;
}): boolean {
  const specificHits = story.matchedKeywords.filter((label) => !isGenericLabel(label));
  const inTitleSpecific = specificHits.some((label) =>
    story.title.toLowerCase().includes(label.toLowerCase()),
  );
  const inTitle = story.matchedKeywords.some((label) =>
    story.title.toLowerCase().includes(label.toLowerCase()),
  );
  const relevant =
    specificHits.length > 0
      ? inTitleSpecific || story.relevance >= 50
      : inTitle && story.relevance >= 40;
  const popular =
    new Set(story.sources.map((row) => row.toLowerCase())).size >= 2 ||
    isMajorOutlet(story.source) ||
    story.sources.some(isMajorOutlet);
  return relevant && popular && story.relevance + story.popularity >= 80;
}
