"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { getBot, isBotId } from "@/lib/bots";
import { titleCaseName } from "@/lib/notifications";
import { useStore } from "@/lib/store";
import type { BotId, ChatMessage } from "@/lib/types";
import { BotMark } from "./BotMark";
import { springSoft } from "./motion";
import { IconBack, IconHash, IconRefresh, IconShare } from "./icons";

async function shareStory(message: ChatMessage) {
  const title = message.articleTitle?.trim() || "Story from What's Up";
  const text = message.text.trim();
  const url = message.articleUrl;
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

function clock(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function FlashDeck({
  open,
  onClose,
  onOpenTopics,
}: {
  open: boolean;
  onClose: () => void;
  onOpenTopics: () => void;
}) {
  const { flashNews, ingest, ingesting, askBot, selectChat } = useStore();
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: 0 });
    function onScroll() {
      if (!el) return;
      const next = Math.round(el.scrollTop / Math.max(el.clientHeight, 1));
      setIndex(Math.min(Math.max(next, 0), Math.max(flashNews.length - 1, 0)));
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [open, flashNews.length]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[60] flex flex-col bg-[var(--canvas)]"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 18 }}
          transition={springSoft}
        >
          <header className="app-header absolute inset-x-0 top-0 z-20 flex items-center justify-between px-2 pb-2">
            <button type="button" onClick={onClose} className="btn-icon" aria-label="Back">
              <IconBack className="h-5 w-5" />
            </button>
            <div className="text-center">
              <p className="text-[15px] font-semibold tracking-[-0.02em]">Flash</p>
              <p className="tabular text-[11px] text-[var(--ink-faint)]">
                {flashNews.length > 0 ? `${index + 1} / ${flashNews.length}` : "empty"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void ingest("manual")}
              className="btn-icon"
              aria-label="Refresh"
            >
              <IconRefresh className={`h-[18px] w-[18px] ${ingesting ? "animate-spin" : ""}`} />
            </button>
          </header>

          {flashNews.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <p className="text-[18px] font-semibold text-[var(--ink)]">No cards yet</p>
              <p className="mt-2 max-w-[280px] text-[15px] leading-relaxed text-[var(--ink-muted)]">
                Check headlines, or add topics so bots know what to pull.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void ingest("manual")}
                  disabled={ingesting}
                  className="btn-secondary w-auto px-4"
                >
                  {ingesting ? "Checking…" : "Check now"}
                </button>
                <button type="button" onClick={onOpenTopics} className="btn-secondary w-auto gap-1.5 px-4">
                  <IconHash className="h-3.5 w-3.5" />
                  Topics
                </button>
              </div>
            </div>
          ) : (
            <div ref={scroller} className="flash-deck no-scrollbar">
              {flashNews.map((message, i) => (
                <FlashCard
                  key={message.id}
                  message={message}
                  active={i === index}
                  onAsk={(botId) => {
                    const snippet = message.text.slice(0, 120).trim();
                    askBot(botId, `What's the deal with this story? ${snippet}`);
                    onClose();
                  }}
                  onOpenDm={(botId) => {
                    selectChat(`dm-${botId}`);
                    onClose();
                  }}
                />
              ))}
            </div>
          )}

          {flashNews.length > 1 ? (
            <p className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--safe-bottom)+12px)] z-20 text-center text-[11px] text-[var(--ink-faint)]">
              Swipe up for next · down for previous
            </p>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function FlashCard({
  message,
  active,
  onAsk,
  onOpenDm,
}: {
  message: ChatMessage;
  active: boolean;
  onAsk: (botId: BotId) => void;
  onOpenDm: (botId: BotId) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const bot = isBotId(message.sender) ? getBot(message.sender) : undefined;
  const title = message.articleTitle?.trim();
  const body = message.text.trim();
  const showImage = Boolean(message.imageUrl && !imgFailed);
  const source =
    message.sources && message.sources.length > 1
      ? `${message.sources[0]} +${message.sources.length - 1}`
      : message.sources?.[0] || "source";
  const flash =
    message.flash === "now" ? "Breaking" : message.flash === "soon" ? "Upcoming" : null;

  return (
    <article className={`flash-slide ${active ? "flash-slide-active" : ""}`}>
      <div className="flash-card">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse at 30% 20%, ${bot?.color ?? "#e8956f"}33, transparent 55%), linear-gradient(160deg, #16161a, #0a0a0c)`,
              }}
            />
          )}
          <div className="flash-card-scrim" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-6 pt-24">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => bot?.id && onOpenDm(bot.id)}
                className="flex items-center gap-2 rounded-[var(--radius-full)] bg-black/35 px-2 py-1 backdrop-blur-sm"
              >
                <BotMark id={bot?.id} size="sm" />
                <span className="pr-1 text-[13px] font-semibold" style={{ color: bot?.color }}>
                  {titleCaseName(bot?.name ?? "bot")}
                </span>
              </button>
              {flash ? (
                <span className="rounded-[var(--radius-full)] bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/80">
                  {flash}
                </span>
              ) : null}
              <span className="tabular text-[11px] text-white/55">{clock(message.createdAt)}</span>
            </div>
            {title ? (
              <h2 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] text-white">
                {title}
              </h2>
            ) : null}
            <p
              className={`mt-3 text-[16px] leading-relaxed text-white/85 ${title ? "line-clamp-5" : "line-clamp-8"}`}
            >
              {body}
            </p>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.06em] text-white/45">
              {source}
            </p>
          </div>
        </div>

        <div className="flash-card-actions">
          <button
            type="button"
            onClick={async () => {
              const result = await shareStory(message);
              if (result === "copied") {
                setShareHint("Copied");
                window.setTimeout(() => setShareHint(null), 1600);
              }
            }}
            className="btn-secondary min-h-[44px] flex-1 gap-2"
          >
            <IconShare className="h-4 w-4" />
            {shareHint ?? "Share"}
          </button>
          {message.articleUrl ? (
            <a
              href={message.articleUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary min-h-[44px] flex-1"
            >
              Read
            </a>
          ) : null}
          {bot?.id ? (
            <button
              type="button"
              onClick={() => onAsk(bot.id)}
              className="btn-primary min-h-[44px] flex-1 text-[14px]"
            >
              Ask {titleCaseName(bot.name)}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
