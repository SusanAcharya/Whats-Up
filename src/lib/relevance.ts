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
  "ai",
  "football / soccer",
  "nba",
  "nfl",
  "tennis",
  "formula 1",
  "cricket",
  "mma",
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
  "forbes",
  "cnbc",
  "marketwatch",
  "business insider",
  "ft.com",
  "sciencenews",
  "scientific american",
  "new scientist",
  "space.com",
  "phys.org",
  "variety",
  "hollywood",
  "billboard",
  "hollywood",
  "deadline",
  "hollywood",
  "rolling stone",
  "google news",
];

export function isGenericLabel(label: string) {
  return GENERIC_LABELS.has(label.trim().toLowerCase());
}

export function isMajorOutlet(source: string) {
  const value = source.toLowerCase();
  return MAJOR_OUTLETS.some((name) => value.includes(name));
}

/** Host-looking sources from Google News titles (e.g. "Forbes", "CNET"). */
function looksLikePublisher(source: string) {
  const value = source.trim();
  if (value.length < 3) return false;
  if (isMajorOutlet(value)) return true;
  // "forbes.com", "BBC News", "The Verge"
  if (/\./.test(value)) return true;
  if (/^[A-Za-z0-9][A-Za-z0-9 &'.-]{2,40}$/.test(value)) return true;
  return false;
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
    if (title.includes(needle)) relevance += generic ? 28 : 38;
    else if (body.includes(needle)) relevance += generic ? 16 : 18;
    else relevance += generic ? 10 : 8;
  }
  relevance = Math.min(100, relevance);

  const uniqueSources = new Set(story.sources.map((row) => row.toLowerCase()));
  let popularity = Math.min(72, Math.max(0, uniqueSources.size - 1) * 30);
  if ([...uniqueSources, story.source].some(isMajorOutlet)) popularity += 32;
  else if (looksLikePublisher(story.source)) popularity += 24;
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
  if (story.matchedKeywords.length === 0) return false;
  const specificHits = story.matchedKeywords.filter((label) => !isGenericLabel(label));
  const inTitleSpecific = specificHits.some((label) =>
    story.title.toLowerCase().includes(label.toLowerCase()),
  );
  const inTitle = story.matchedKeywords.some((label) =>
    story.title.toLowerCase().includes(label.toLowerCase()),
  );
  // Generic topic chips rarely appear literally in headlines ("world", "macro").
  const relevant =
    specificHits.length > 0
      ? inTitleSpecific || story.relevance >= 36
      : inTitle || story.relevance >= 24;
  const popular =
    new Set(story.sources.map((row) => row.toLowerCase())).size >= 2 ||
    isMajorOutlet(story.source) ||
    story.sources.some(isMajorOutlet) ||
    looksLikePublisher(story.source);
  return relevant && popular && story.relevance + story.popularity >= 52;
}
