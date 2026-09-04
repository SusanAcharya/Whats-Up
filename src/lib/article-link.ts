import { looksLikeArticleUrl } from "@/lib/images";

export function isUsableArticleUrl(url?: string | null): url is string {
  return Boolean(url && looksLikeArticleUrl(url));
}

/**
 * Href for the Read action. Never send users to CDN favicons / thumbnails
 * that were wrongly stored as articleUrl.
 */
export function readHrefForMessage(message: {
  articleUrl?: string;
  articleTitle?: string;
  sources?: string[];
}): string | undefined {
  if (isUsableArticleUrl(message.articleUrl)) return message.articleUrl;
  const title = message.articleTitle?.trim();
  if (!title) return undefined;
  const source = message.sources?.[0]?.trim();
  const query = source ? `${title} ${source}` : title;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
