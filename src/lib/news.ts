import Parser from "rss-parser";
import type { BotId } from "./types";
import { imageFromRssItem } from "./images";

const parser = new Parser({
  timeout: 8000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; WhatsUp/1.0; +https://github.com/update-me)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

export type RawStory = {
  botId: BotId;
  title: string;
  url: string;
  source: string;
  snippet: string;
  publishedAt: number;
  imageUrl?: string;
};

function cleanTitle(title: string): { title: string; source?: string } {
  const trimmed = title.replace(/\s+/g, " ").trim();
  const parts = trimmed.split(" - ");
  if (parts.length >= 2) {
    const source = parts.pop()!.trim();
    return { title: parts.join(" - ").trim(), source };
  }
  return { title: trimmed };
}

function hostName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the internet";
  }
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchFeed(url: string, botId: BotId): Promise<RawStory[]> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const xml = await response.text();
    const feed = await parser.parseString(xml);
    const sourceName = feed.title || hostName(url);

    return (feed.items ?? [])
      .map((item) => {
        const rawTitle = item.title?.trim();
        const link = (item.link || item.guid || "").trim();
        if (!rawTitle || !link) return null;
        const parsed = cleanTitle(rawTitle);
        const html = `${item.content || ""} ${(item as { contentEncoded?: string }).contentEncoded || ""}`;
        const snippet = stripHtml(item.contentSnippet || html).slice(0, 480);
        const imageUrl = imageFromRssItem({
          enclosure: item.enclosure,
          mediaContent: (item as { mediaContent?: never }).mediaContent,
          mediaThumbnail: (item as { mediaThumbnail?: never }).mediaThumbnail,
          content: item.content,
          "content:encoded": (item as { contentEncoded?: string }).contentEncoded,
        });
        const story: RawStory = {
          botId,
          title: parsed.title,
          url: link,
          source: parsed.source || sourceName,
          snippet,
          publishedAt: item.isoDate ? Date.parse(item.isoDate) : Date.now(),
        };
        if (imageUrl) story.imageUrl = imageUrl;
        return story;
      })
      .filter((story): story is RawStory => story !== null);
  } catch (error) {
    console.warn(`feed failed ${url}`, error);
    return [];
  }
}
