const STOP = new Set([
  "the",
  "a",
  "an",
  "of",
  "in",
  "on",
  "to",
  "for",
  "with",
  "from",
  "after",
  "into",
  "over",
  "and",
  "but",
  "its",
  "his",
  "her",
  "their",
  "your",
  "our",
  "has",
  "have",
  "had",
  "was",
  "were",
  "are",
  "been",
  "being",
  "will",
  "just",
  "about",
  "which",
  "that",
  "this",
  "with",
  "from",
  "star",
  "says",
  "say",
  "said",
  "title",
  "team",
  "national",
]);

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/lionel messi/g, "messi")
    .replace(/\bsoccer\b/g, "football")
    .replace(/\bpremier league\b/g, "epl")
    .replace(/\bfifa world cup\b/g, "worldcup")
    .replace(/\bworld cup\b/g, "worldcup")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleTokens(title: string): Set<string> {
  return new Set(
    normalize(title)
      .split(" ")
      .filter((word) => word.length > 3 && !STOP.has(word)),
  );
}

export function titlesOverlap(a: string, b: string): boolean {
  const left = titleTokens(a);
  const right = titleTokens(b);
  if (left.size === 0 || right.size === 0) return false;
  let overlap = 0;
  for (const word of left) {
    if (right.has(word)) overlap += 1;
  }
  const smaller = Math.min(left.size, right.size);
  return overlap >= 3 || overlap / smaller >= 0.55;
}

export function isDuplicateTitle(title: string, seen: string[]): boolean {
  return seen.some((item) => titlesOverlap(title, item));
}