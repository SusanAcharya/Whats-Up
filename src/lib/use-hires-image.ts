"use client";

import { useEffect, useRef, useState } from "react";
import { isLikelyLowRes, upgradeImageUrl } from "@/lib/images";

function isGoogleNewsArticle(url?: string) {
  if (!url) return false;
  try {
    return new URL(url).hostname.includes("news.google.");
  } catch {
    return false;
  }
}

/**
 * Prefer stored art, upgrade CDN thumbs client-side.
 * Only hit /api/meta when art is missing — and skip expensive Google News
 * decode when we already have a usable (even low-res) thumb.
 */
export function useHiResStoryImage(
  articleUrl: string | undefined,
  storedImage: string | undefined,
  enabled = true,
) {
  const initial = storedImage ? upgradeImageUrl(storedImage) : undefined;
  const [displayUrl, setDisplayUrl] = useState(initial);
  const [failed, setFailed] = useState(false);
  const tried = useRef<string | null>(null);

  useEffect(() => {
    const next = storedImage ? upgradeImageUrl(storedImage) : undefined;
    setDisplayUrl(next);
    setFailed(false);
    tried.current = null;
  }, [articleUrl, storedImage]);

  useEffect(() => {
    if (!enabled || failed || !articleUrl) return;
    // Already have cover art — don't re-fetch OG (ingest already enriched when possible).
    if (displayUrl && !isLikelyLowRes(displayUrl)) return;
    // Google News decode is costly; only attempt when we have zero image.
    if (displayUrl && isGoogleNewsArticle(articleUrl)) return;
    if (tried.current === articleUrl) return;
    tried.current = articleUrl;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/meta?url=${encodeURIComponent(articleUrl)}`);
        if (!response.ok) return;
        const data = (await response.json()) as { imageUrl?: string | null };
        if (cancelled || !data.imageUrl) return;
        const upgraded = upgradeImageUrl(data.imageUrl);
        setDisplayUrl((current) => {
          if (!current) return upgraded;
          return isLikelyLowRes(current) ? upgraded : current;
        });
      } catch {
        /* keep current */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [articleUrl, displayUrl, enabled, failed]);

  return {
    imageUrl: failed ? undefined : displayUrl,
    onError: () => setFailed(true),
  };
}
