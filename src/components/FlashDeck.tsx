"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { dmChatId, getBot, isBotId } from "@/lib/bots";
import { titleCaseName } from "@/lib/notifications";
import { useStore } from "@/lib/store";
import type { BotId, ChatMessage } from "@/lib/types";
import { BotMark } from "./BotMark";
import { springSoft } from "./motion";
import { IconBack, IconChat, IconHash, IconLink, IconRefresh, IconShare } from "./icons";
import { useHiResStoryImage } from "@/lib/use-hires-image";

async function shareStory(message: ChatMessage) {
  const title = message.articleTitle?.trim() || "Story from What's Up";
  const text = (message.summary || message.text).trim();
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

function useStoryImage(message: ChatMessage, active: boolean) {
  return useHiResStoryImage(message.articleUrl, message.imageUrl, active);
}

function newsKey(row: ChatMessage) {
  return (row.articleUrl || `${row.sender}:${row.articleTitle || row.text}` || row.id).toLowerCase();
}

/**
 * Flash must stay locked to whatever the chats already show.
 * Merge global flashNews with the open thread's live `messages`.
 */
function buildFlashCards(
  flashNews: ChatMessage[],
  threadMessages: ChatMessage[],
  filterBot: BotId | null,
) {
  const map = new Map<string, ChatMessage>();
  const consider = (row: ChatMessage) => {
    if (row.kind !== "news") return;
    if (!isBotId(row.sender)) return;
    if (filterBot && row.sender !== filterBot) return;
    const key = newsKey(row);
    const existing = map.get(key);
    if (!existing || row.createdAt > existing.createdAt) map.set(key, row);
  };
  for (const row of flashNews) consider(row);
  for (const row of threadMessages) consider(row);
  return [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function FlashDeck({
  open,
  botId: initialBotId = null,
  onClose,
  onOpenTopics,
}: {
  open: boolean;
  botId?: BotId | null;
  onClose: () => void;
  onOpenTopics: () => void;
}) {
  const { flashNews, messages, ingest, ingesting, askBot, selectChat, profile } = useStore();
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [filterBot, setFilterBot] = useState<BotId | null>(initialBotId ?? null);
  const enabledBots = profile?.enabledBots ?? [];

  // Keep filter in sync when reopening Flash for a different bot.
  useEffect(() => {
    if (!open) return;
    setFilterBot(initialBotId ?? null);
    setIndex(0);
    scroller.current?.scrollTo({ top: 0 });
  }, [open, initialBotId]);

  const cards = useMemo(
    () => buildFlashCards(flashNews, messages, filterBot),
    [flashNews, messages, filterBot],
  );
  const filterBotMeta = filterBot ? getBot(filterBot) : null;

  useEffect(() => {
    if (!open) return;
    const el = scroller.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      const next = Math.round(el.scrollTop / Math.max(el.clientHeight, 1));
      setIndex(Math.min(Math.max(next, 0), Math.max(cards.length - 1, 0)));
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [open, cards.length, filterBot]);

  function pickBot(next: BotId | null) {
    setFilterBot(next);
    setIndex(0);
    scroller.current?.scrollTo({ top: 0 });
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="flash-shell"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={springSoft}
        >
          <header className="absolute inset-x-0 top-0 z-30 px-2 pb-2 pt-[var(--safe-top)]">
            <div className="flex items-center justify-between">
              <button type="button" onClick={onClose} className="btn-icon bg-black/30 backdrop-blur-sm" aria-label="Back">
                <IconBack className="h-5 w-5" />
              </button>
              <div className="rounded-[var(--radius-full)] bg-black/35 px-3 py-1 text-center backdrop-blur-sm">
                <p className="text-[13px] font-semibold tracking-[-0.02em]">
                  {filterBotMeta ? titleCaseName(filterBotMeta.name) : "Flash"}
                </p>
                <p className="tabular text-[10px] text-white/60">
                  {cards.length > 0 ? `${index + 1} / ${cards.length}` : "empty"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void ingest("manual")}
                className="btn-icon bg-black/30 backdrop-blur-sm"
                aria-label="Refresh"
              >
                <IconRefresh className={`h-[18px] w-[18px] ${ingesting ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="mt-2 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => pickBot(null)}
                className={`shrink-0 rounded-[var(--radius-full)] px-3 py-1.5 text-[12px] font-semibold backdrop-blur-sm ${
                  filterBot === null ? "bg-white text-black" : "bg-black/40 text-white/85"
                }`}
              >
                All
              </button>
              {enabledBots.map((id) => {
                const bot = getBot(id);
                const on = filterBot === id;
                const count = buildFlashCards(flashNews, messages, id).length;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => pickBot(id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-[var(--radius-full)] px-2.5 py-1.5 text-[12px] font-semibold backdrop-blur-sm ${
                      on ? "bg-white text-black" : "bg-black/40 text-white/85"
                    }`}
                  >
                    <BotMark id={id} size="sm" />
                    {titleCaseName(bot?.name ?? id)}
                    <span className={`tabular text-[10px] ${on ? "text-black/50" : "text-white/45"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </header>

          {cards.length === 0 ? (
            <div className="relative z-10 flex h-full flex-col items-center justify-center px-8 text-center">
              {filterBotMeta ? <BotMark id={filterBotMeta.id} size="lg" /> : null}
              <p className="mt-4 text-[18px] font-semibold text-[var(--ink)]">
                {filterBotMeta
                  ? `No cards from ${titleCaseName(filterBotMeta.name)}`
                  : "No cards yet"}
              </p>
              <p className="mt-2 max-w-[280px] text-[15px] leading-relaxed text-[var(--ink-muted)]">
                {filterBotMeta
                  ? "Open this bot’s chat first, or check headlines."
                  : "Open a chat with news, then come back — Flash mirrors your threads."}
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
                {filterBot ? (
                  <button type="button" onClick={() => pickBot(null)} className="btn-secondary w-auto px-4">
                    Show all
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div ref={scroller} className="flash-deck no-scrollbar">
              {cards.map((message, i) => (
                <FlashCard
                  key={`${newsKey(message)}-${i}`}
                  message={message}
                  active={i === index}
                  onAsk={(botId) => {
                    const snippet = message.text.slice(0, 120).trim();
                    askBot(botId, `What's the deal with this story? ${snippet}`);
                    onClose();
                  }}
                  onOpenDm={(botId) => {
                    selectChat(dmChatId(botId));
                    onClose();
                  }}
                />
              ))}
            </div>
          )}
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
  const [shareHint, setShareHint] = useState<string | null>(null);
  const bot = isBotId(message.sender) ? getBot(message.sender) : undefined;
  const title = message.articleTitle?.trim();
  const body = (message.summary || message.text).trim();
  const { imageUrl, onError } = useStoryImage(message, active);
  const showImage = Boolean(imageUrl);
  const source =
    message.sources && message.sources.length > 1
      ? `${message.sources[0]} +${message.sources.length - 1}`
      : message.sources?.[0] || "source";
  const flash =
    message.flash === "now" ? "Breaking" : message.flash === "soon" ? "Upcoming" : null;
  const askLabel = titleCaseName(bot?.name ?? "bot");

  return (
    <article className={`flash-slide ${active ? "flash-slide-active" : ""}`}>
      <div className="flash-card relative">
        <div className="absolute inset-0 overflow-hidden">
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              onError={onError}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background: `radial-gradient(ellipse at 30% 20%, ${bot?.color ?? "#e8956f"}44, transparent 55%), linear-gradient(160deg, #1a1a1e, #0a0a0c)`,
              }}
            />
          )}
          <div className="flash-card-scrim" aria-hidden />
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[calc(var(--safe-bottom)+20px)] pr-[76px] pt-28">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => bot?.id && onOpenDm(bot.id)}
              className="flex items-center gap-2 rounded-[var(--radius-full)] bg-black/40 px-2 py-1 backdrop-blur-sm"
            >
              <BotMark id={bot?.id} size="sm" />
              <span className="pr-1 text-[13px] font-semibold text-white">{askLabel}</span>
            </button>
            {flash ? (
              <span className="rounded-[var(--radius-full)] bg-white/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/85">
                {flash}
              </span>
            ) : null}
            <span className="tabular text-[11px] text-white/55">{clock(message.createdAt)}</span>
          </div>
          {title ? (
            <h2 className="text-[24px] font-semibold leading-[1.15] tracking-[-0.03em] text-white drop-shadow-sm">
              {title}
            </h2>
          ) : null}
          <p
            className={`mt-2.5 text-[15px] leading-relaxed text-white/88 ${title ? "line-clamp-4" : "line-clamp-7"}`}
          >
            {body}
          </p>
          <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.06em] text-white/45">
            {source}
          </p>
        </div>

        <div className="flash-side-rail">
          <button
            type="button"
            className="flash-side-btn"
            aria-label="Share"
            onClick={async () => {
              const result = await shareStory(message);
              if (result === "copied") {
                setShareHint("Copied");
                window.setTimeout(() => setShareHint(null), 1400);
              }
            }}
          >
            <span className="flash-side-icon">
              <IconShare className="h-6 w-6" />
            </span>
            <span className="flash-side-label">{shareHint ?? "Share"}</span>
          </button>

          {message.articleUrl ? (
            <a
              href={message.articleUrl}
              target="_blank"
              rel="noreferrer"
              className="flash-side-btn"
              aria-label="Read article"
            >
              <span className="flash-side-icon">
                <IconLink className="h-6 w-6" />
              </span>
              <span className="flash-side-label">Read</span>
            </a>
          ) : null}

          {bot?.id ? (
            <button
              type="button"
              className="flash-side-btn"
              aria-label={`Ask ${askLabel}`}
              onClick={() => onAsk(bot.id)}
            >
              <span className="flash-side-icon">
                <IconChat className="h-6 w-6" />
              </span>
              <span className="flash-side-label">Ask</span>
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
