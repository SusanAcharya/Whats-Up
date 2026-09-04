import type { ChatMessage } from "@/lib/types";
import { isBotId } from "@/lib/bots";
import { isUsableArticleUrl, readHrefForMessage } from "@/lib/article-link";

export function storyClock(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function storyFlashLabel(flash?: ChatMessage["flash"]) {
  if (flash === "now") return "Breaking";
  if (flash === "soon") return "Upcoming";
  return null;
}

export function storySourceLabel(message: ChatMessage) {
  if (message.sources && message.sources.length > 1) {
    return `${message.sources[0]} +${message.sources.length - 1}`;
  }
  return message.sources?.[0] || "source";
}

/** Dedupe flash/news cards by bot + title so shared bad URLs don't collapse the deck. */
export function newsDedupeKey(row: {
  sender: string;
  articleTitle?: string;
  text?: string;
  articleUrl?: string;
  id?: string;
}) {
  const title = (row.articleTitle || row.text || "").trim().toLowerCase().slice(0, 120);
  if (title && isBotId(row.sender)) return `${row.sender}:${title}`;
  if (isUsableArticleUrl(row.articleUrl)) return row.articleUrl.toLowerCase();
  return (row.id || `${row.sender}:${row.articleUrl || ""}`).toLowerCase();
}

export async function shareStory(message: ChatMessage) {
  const title = message.articleTitle?.trim() || "Story from What's Up";
  const text = (message.summary || message.text).trim();
  const url = readHrefForMessage(message);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({
        title,
        text: text.slice(0, 280),
        ...(url ? { url } : {}),
      });
      return "shared" as const;
    }
    const clip = url || `${title}\n\n${text}`;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(clip);
      return "copied" as const;
    }
    return null;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    return null;
  }
}
