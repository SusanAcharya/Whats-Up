export const NEWS_TTL_MS = 48 * 60 * 60 * 1000;

export function newsCutoff(now = Date.now()) {
  return now - NEWS_TTL_MS;
}

export function isFreshNews(createdAt: number, now = Date.now()) {
  return now - createdAt <= NEWS_TTL_MS;
}
