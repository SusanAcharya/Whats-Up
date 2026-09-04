"use client";

import { useEffect, useRef, useState } from "react";
import { isLikelyLowRes, upgradeImageUrl } from "@/lib/images";

/**
 * Prefer stored art, upgrade CDN thumbs, and fetch article OG image when the
 * saved URL looks like a tiny RSS thumbnail.
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
    const needsUpgrade = !displayUrl || isLikelyLowRes(displayUrl);
    if (!needsUpgrade) return;
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
          // Keep whichever estimates larger
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
