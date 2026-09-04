const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

function looksLikeImage(url: string) {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return false;
    if (parsed.hostname.includes("google.com") && parsed.pathname.includes("/rss/")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function imageFromRssItem(item: {
  enclosure?: { url?: string; type?: string };
  mediaContent?: { $?: { url?: string }; url?: string } | Array<{ $?: { url?: string } }>;
  mediaThumbnail?: { $?: { url?: string }; url?: string };
  content?: string;
  "content:encoded"?: string;
}): string | undefined {
  const enclosure = item.enclosure?.url;
  if (enclosure && looksLikeImage(enclosure)) return enclosure;
  const media = item.mediaContent;
  const mediaUrl = Array.isArray(media)
    ? media[0]?.$?.url
    : media?.$?.url || media?.url;
  if (mediaUrl && looksLikeImage(mediaUrl)) return mediaUrl;
  const thumb = item.mediaThumbnail?.$?.url || item.mediaThumbnail?.url;
  if (thumb && looksLikeImage(thumb)) return thumb;
  const html = `${item.content ?? ""} ${item["content:encoded"] ?? ""}`;
  const img = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  if (img && looksLikeImage(img)) return img;
  return undefined;
}

/** Prefer a publisher URL when Google News wraps the story. */
export function publisherUrlFromRss(item: {
  link?: string;
  content?: string;
  contentSnippet?: string;
  "content:encoded"?: string;
}): string | undefined {
  const html = `${item.content ?? ""} ${item["content:encoded"] ?? ""} ${item.contentSnippet ?? ""}`;
  const anchors = [...html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)].map((m) => m[1]);
  for (const href of anchors) {
    try {
      const host = new URL(href).hostname.replace(/^www\./, "");
      if (host.includes("google.com") || host.includes("gstatic.com")) continue;
      return href;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function isGoogleNewsUrl(url: string) {
  try {
    const host = new URL(url).hostname;
    return host.includes("news.google.") || host === "news.google.com";
  } catch {
    return false;
  }
}

async function resolveArticleUrl(url: string): Promise<string> {
  if (!isGoogleNewsUrl(url)) return url;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(4500),
      redirect: "follow",
    });
    const finalUrl = response.url || url;
    if (!isGoogleNewsUrl(finalUrl)) return finalUrl;
    const html = (await response.text()).slice(0, 120_000);
    const candidates = [
      html.match(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*data-n-au/i)?.[1],
      html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)?.[1],
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i)?.[1],
      ...[...html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)].map((m) => m[1]),
    ].filter(Boolean) as string[];
    for (const href of candidates) {
      try {
        const host = new URL(href).hostname.replace(/^www\./, "");
        if (host.includes("google.com") || host.includes("gstatic.com")) continue;
        return href;
      } catch {
        /* ignore */
      }
    }
    return finalUrl;
  } catch {
    return url;
  }
}

export async function fetchArticleMeta(url: string): Promise<{ imageUrl?: string; excerpt?: string; resolvedUrl?: string }> {
  try {
    const target = await resolveArticleUrl(url);
    const response = await fetch(target, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });
    if (!response.ok) return { resolvedUrl: target };
    const html = (await response.text()).slice(0, 120_000);
    const image =
      metaContent(html, "og:image") ||
      metaContent(html, "twitter:image") ||
      metaContent(html, "og:image:secure_url");
    const excerpt =
      metaContent(html, "og:description") ||
      metaContent(html, "twitter:description") ||
      metaName(html, "description") ||
      firstParagraph(html);
    const absoluteImage = image ? absolutize(image, response.url || target) : undefined;
    return {
      imageUrl: absoluteImage && looksLikeImage(absoluteImage) ? absoluteImage : undefined,
      excerpt: excerpt ? decodeEntities(excerpt).slice(0, 420) : undefined,
      resolvedUrl: response.url || target,
    };
  } catch {
    return {};
  }
}

export async function enrichStories<T extends { url: string; imageUrl?: string; excerpt?: string }>(
  stories: T[],
): Promise<T[]> {
  return Promise.all(
    stories.map(async (story) => {
      if (story.imageUrl) return story;
      const meta = await fetchArticleMeta(story.url);
      return {
        ...story,
        imageUrl: story.imageUrl || meta.imageUrl,
        excerpt: story.excerpt || meta.excerpt,
        ...(meta.resolvedUrl && !story.imageUrl ? { url: meta.resolvedUrl } : {}),
      };
    }),
  );
}

function absolutize(maybeRelative: string, base: string) {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

function metaContent(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    html.match(new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`, "i"))?.[1]
  );
}

function metaName(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    html.match(new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["']`, "i"))?.[1]
  );
}

function firstParagraph(html: string) {
  const matches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) ?? [];
  for (const block of matches) {
    const text = decodeEntities(block.replace(/<[^>]+>/g, " ")).trim();
    if (text.length >= 80 && text.length <= 500 && !/cookie|subscribe|sign in/i.test(text)) {
      return text;
    }
  }
  return undefined;
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}
