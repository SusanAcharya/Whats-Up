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

/** Guess pixel width from URL path/query (RSS thumbs are often 120–320). */
export function estimateImageWidth(url: string): number {
  try {
    const parsed = new URL(url);
    const q =
      parsed.searchParams.get("w") ||
      parsed.searchParams.get("width") ||
      parsed.searchParams.get("maxwidth");
    if (q && /^\d+$/.test(q)) return Number(q);

    const path = parsed.pathname.toLowerCase();
    const bbc = path.match(/\/news\/(\d{2,4})\//);
    if (bbc) return Number(bbc[1]);

    const sized = path.match(/(?:^|\/|_)(?:w|width)[_-]?(\d{2,4})(?:[._\-/]|$)/i);
    if (sized) return Number(sized[1]);

    const dim = path.match(/(\d{3,4})x(\d{2,4})/);
    if (dim) return Number(dim[1]);

    if (/thumb|thumbnail|tiny|small|xs\b|\/150\/|\/180\/|\/200\/|\/240\/|\/320\//i.test(path)) {
      return 240;
    }
    if (/\/480\/|\/640\/|medium/i.test(path)) return 640;
    if (/\/960\/|\/1024\/|\/1200\/|large|full|original/i.test(path)) return 1200;
  } catch {
    /* ignore */
  }
  return 800; // unknown — treat as decent unless proven otherwise
}

export function isLikelyLowRes(url: string): boolean {
  return estimateImageWidth(url) < 480;
}

/**
 * Rewrite known CDN size tokens to a larger variant (BBC ichef, query query params, etc.).
 */
export function upgradeImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    // BBC: ichef.bbci.co.uk/news/240/... → /news/976/...
    if (host.includes("bbci.co.uk") || host.includes("bbc.co.uk") || host.includes("bbc.com")) {
      parsed.pathname = parsed.pathname.replace(/\/news\/(\d{2,4})\//, (_, n) => {
        const width = Number(n);
        return `/news/${width < 800 ? 976 : width}/`;
      });
      return parsed.toString();
    }

    // Generic width query
    for (const key of ["w", "width", "maxwidth", "max_width"]) {
      const current = parsed.searchParams.get(key);
      if (current && /^\d+$/.test(current) && Number(current) < 900) {
        parsed.searchParams.set(key, "1200");
      }
    }

    // Common thumb path segments
    parsed.pathname = parsed.pathname
      .replace(/\/thumbnails?\//i, "/")
      .replace(/\/small\//i, "/large/")
      .replace(/_small\./i, "_large.")
      .replace(/_thumb\./i, ".")
      .replace(/-150x\d+/i, "")
      .replace(/-240x\d+/i, "")
      .replace(/-320x\d+/i, "");

    return parsed.toString();
  } catch {
    return url;
  }
}

export function pickBestImage(urls: Array<string | undefined | null>): string | undefined {
  const cleaned = urls
    .filter((url): url is string => Boolean(url && looksLikeImage(url)))
    .map((url) => upgradeImageUrl(url));
  if (cleaned.length === 0) return undefined;
  cleaned.sort((a, b) => estimateImageWidth(b) - estimateImageWidth(a));
  return cleaned[0];
}

export function imageFromRssItem(item: {
  enclosure?: { url?: string; type?: string; length?: string | number };
  mediaContent?:
    | { $?: { url?: string; width?: string; height?: string }; url?: string }
    | Array<{ $?: { url?: string; width?: string; height?: string } }>;
  mediaThumbnail?: { $?: { url?: string; width?: string }; url?: string };
  content?: string;
  "content:encoded"?: string;
}): string | undefined {
  const candidates: string[] = [];

  const enclosure = item.enclosure?.url;
  if (enclosure) candidates.push(enclosure);

  const media = item.mediaContent;
  if (Array.isArray(media)) {
    const ranked = [...media].sort(
      (a, b) => Number(b.$?.width ?? 0) - Number(a.$?.width ?? 0),
    );
    for (const row of ranked) {
      const url = row.$?.url;
      if (url) candidates.push(url);
    }
  } else if (media) {
    const url = media.$?.url || media.url;
    if (url) candidates.push(url);
  }

  const html = `${item.content ?? ""} ${item["content:encoded"] ?? ""}`;
  for (const match of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    candidates.push(match[1]);
  }

  // Thumbnails last — often tiny
  const thumb = item.mediaThumbnail?.$?.url || item.mediaThumbnail?.url;
  if (thumb) candidates.push(thumb);

  return pickBestImage(candidates);
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
      signal: AbortSignal.timeout(2500),
      redirect: "follow",
    });
    const finalUrl = response.url || url;
    if (!isGoogleNewsUrl(finalUrl)) return finalUrl;
    const html = (await response.text()).slice(0, 80_000);
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

function allMetaImages(html: string): string[] {
  const found: string[] = [];
  const props = ["og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"];
  for (const prop of props) {
    const value = metaContent(html, prop);
    if (value) found.push(value);
  }
  // Multiple og:image tags
  for (const match of html.matchAll(
    /<meta[^>]+property=["']og:image(?::url|:secure_url)?["'][^>]+content=["']([^"']+)["']/gi,
  )) {
    found.push(match[1]);
  }
  for (const match of html.matchAll(
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url|:secure_url)?["']/gi,
  )) {
    found.push(match[1]);
  }
  return found;
}

export async function fetchArticleMeta(
  url: string,
): Promise<{ imageUrl?: string; excerpt?: string; resolvedUrl?: string }> {
  try {
    const target = await resolveArticleUrl(url);
    const response = await fetch(target, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(2800),
      redirect: "follow",
    });
    if (!response.ok) return { resolvedUrl: target };
    const html = (await response.text()).slice(0, 100_000);
    const base = response.url || target;
    const images = allMetaImages(html)
      .map((image) => absolutize(image, base))
      .map((image) => upgradeImageUrl(image));
    const excerpt =
      metaContent(html, "og:description") ||
      metaContent(html, "twitter:description") ||
      metaName(html, "description") ||
      firstParagraph(html);
    return {
      imageUrl: pickBestImage(images),
      excerpt: excerpt ? decodeEntities(excerpt).slice(0, 420) : undefined,
      resolvedUrl: base,
    };
  } catch {
    return {};
  }
}

/**
 * Prefer upgraded RSS art. Only hit article HTML when the thumb is still tiny
 * or we have no excerpt/snippet for the summarizer.
 */
export async function enrichStories<
  T extends { url: string; imageUrl?: string; excerpt?: string; snippet?: string },
>(stories: T[]): Promise<T[]> {
  return Promise.all(
    stories.map(async (story) => {
      const rssImage = story.imageUrl ? upgradeImageUrl(story.imageUrl) : undefined;
      const hasCopy = Boolean(story.excerpt || story.snippet);
      const needsMeta = !rssImage || isLikelyLowRes(rssImage) || !hasCopy;
      if (!needsMeta) {
        return { ...story, imageUrl: rssImage };
      }
      // Skip Google News wrapper pages — resolution is slow and often fails.
      if (isGoogleNewsUrl(story.url) && rssImage && !isLikelyLowRes(rssImage) && hasCopy) {
        return { ...story, imageUrl: rssImage };
      }
      const meta = await fetchArticleMeta(story.url);
      const best = pickBestImage([meta.imageUrl, rssImage]);
      return {
        ...story,
        imageUrl: best || rssImage || story.imageUrl,
        excerpt: story.excerpt || meta.excerpt,
        ...(meta.resolvedUrl && isGoogleNewsUrl(story.url) ? { url: meta.resolvedUrl } : {}),
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
