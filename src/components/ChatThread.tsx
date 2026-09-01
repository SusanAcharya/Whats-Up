"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { GROUP_CHAT_ID, getBot } from "@/lib/bots";
import { TIMELINE_ACCENT, USER_BUBBLE } from "@/lib/design";
import { titleCaseName } from "@/lib/notifications";
import { useStore } from "@/lib/store";
import type { BotId, ChatMessage } from "@/lib/types";
import { BotMark } from "./BotMark";
import { ExpandHeight, MessageEnter, spring, springSoft } from "./motion";
import { MessageListSkeleton } from "./ui";
import { IconBack, IconRefresh, IconSend, IconSettings } from "./icons";

const CHAT_CLUSTER_MS = 90_000;

function clock(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function dayLabel(ts: number) {
  const date = new Date(ts);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function sameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function chatClustered(a?: ChatMessage, b?: ChatMessage) {
  if (!a || !b) return false;
  if (a.kind !== "chat" || b.kind !== "chat") return false;
  return (
    a.sender === b.sender &&
    sameDay(a.createdAt, b.createdAt) &&
    Math.abs(a.createdAt - b.createdAt) < CHAT_CLUSTER_MS
  );
}

function grow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
}

function bubbleRadius(mine: boolean, withPrev: boolean, withNext: boolean) {
  if (mine) {
    if (withPrev && withNext) return "18px 18px 6px 18px";
    if (withPrev) return "18px 6px 6px 18px";
    if (withNext) return "18px 18px 6px 18px";
    return "18px 18px 4px 18px";
  }
  if (withPrev && withNext) return "18px 18px 18px 6px";
  if (withPrev) return "6px 18px 18px 6px";
  if (withNext) return "18px 18px 18px 6px";
  return "18px 18px 18px 4px";
}

function usePullToRefresh(onRefresh: () => void, enabled: boolean) {
  const [pull, setPull] = useState(0);
  const startY = useRef(0);
  const triggered = useRef(false);

  function onTouchStart(event: React.TouchEvent) {
    if (!enabled) return;
    const el = event.currentTarget as HTMLElement;
    if (el.scrollTop <= 0) {
      startY.current = event.touches[0].clientY;
      triggered.current = false;
    }
  }

  function onTouchMove(event: React.TouchEvent) {
    if (!enabled) return;
    const el = event.currentTarget as HTMLElement;
    if (el.scrollTop > 0) {
      setPull(0);
      return;
    }
    const delta = Math.max(0, event.touches[0].clientY - startY.current);
    setPull(Math.min(delta, 80));
    if (delta >= 64 && !triggered.current) {
      triggered.current = true;
      setPull(0);
      onRefresh();
    }
  }

  function onTouchEnd() {
    setPull(0);
    triggered.current = false;
  }

  return { pull, handlers: { onTouchStart, onTouchMove, onTouchEnd } };
}

const QUICK_REPLIES = ["Why does this matter?", "Explain simply", "What happens next?"];

export function ChatThread({
  onOpenSettings,
}: {
  onOpenSettings: (tab?: "alerts" | "filters" | "bots") => void;
}) {
  const {
    chats,
    messages,
    selectedChatId,
    selectChat,
    sendMessage,
    sending,
    ingesting,
    ingest,
    error,
    profile,
    askBot,
    composerSeed,
    clearComposerSeed,
    messagesLoading,
  } = useStore();
  const scroller = useRef<HTMLDivElement>(null);
  const chat = chats.find((item) => item.id === selectedChatId);
  const bot = chat?.type === "dm" ? getBot(chat.botId ?? "") : undefined;
  const isGroup = selectedChatId === GROUP_CHAT_ID;
  const memberBots = (profile?.enabledBots ?? []).map(getBot).filter(Boolean);
  const accent = isGroup ? TIMELINE_ACCENT : (bot?.color ?? "var(--ink)");
  const seedText =
    composerSeed?.chatId === selectedChatId ? composerSeed.text : undefined;

  const { pull, handlers: pullHandlers } = usePullToRefresh(() => ingest("manual"), !ingesting);

  const lastBotNews = !isGroup
    ? [...messages].reverse().find((row) => row.kind === "news" && row.sender !== "user")
    : undefined;

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending, ingesting]);

  return (
    <section className="screen-canvas flex h-full min-h-0 w-full flex-col overflow-hidden">
      <header className="app-header hairline-b flex shrink-0 items-center gap-1 px-1 pb-2 md:px-2">
        <button type="button" onClick={() => selectChat(null)} className="btn-icon md:hidden" aria-label="Back">
          <IconBack className="h-5 w-5" />
        </button>
        {isGroup ? (
          <div className="flex -space-x-2 pl-1">
            {memberBots.slice(0, 3).map((member) => (
              <BotMark key={member!.id} id={member!.id} size="sm" />
            ))}
          </div>
        ) : (
          <BotMark id={bot?.id} size="sm" />
        )}
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-[17px] font-semibold leading-tight" style={{ color: accent }}>
            {isGroup ? "The timeline" : titleCaseName(bot?.name ?? chat?.title ?? "")}
          </p>
          <p className="truncate text-[13px] text-[var(--ink-faint)]">
            {ingesting
              ? "Checking headlines…"
              : isGroup
                ? `${memberBots.length} bots · read only`
                : bot?.handle}
          </p>
        </div>
        <button type="button" onClick={() => onOpenSettings("filters")} className="btn-icon" aria-label="Settings">
          <IconSettings className="h-[18px] w-[18px]" />
        </button>
        <button type="button" onClick={() => ingest("manual")} className="btn-icon" aria-label="Refresh">
          <IconRefresh className={`h-[18px] w-[18px] ${ingesting ? "animate-spin" : ""}`} />
        </button>
      </header>

      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-2 no-scrollbar md:px-4 md:py-3"
        {...pullHandlers}
      >
        <PullHint pull={pull} ingesting={ingesting} />

        {messagesLoading ? (
          <div className="pointer-events-none py-2 opacity-90">
            <MessageListSkeleton />
          </div>
        ) : null}

        {!messagesLoading && messages.length === 0 ? (
          <EmptyState
            isGroup={isGroup}
            bot={bot}
            memberBots={memberBots}
            ingesting={ingesting}
            onRefresh={() => ingest("manual")}
            onSettings={() => onOpenSettings("filters")}
          />
        ) : null}

        {!messagesLoading
          ? messages.map((message, index) => (
              <Row
                key={message.id}
                index={index}
                message={message}
                prev={messages[index - 1]}
                next={messages[index + 1]}
                isGroup={isGroup}
                onAskBot={(botId, msg) => {
                  const snippet = msg.text.slice(0, 120).trim();
                  askBot(botId, `What's the deal with this story? ${snippet}`);
                }}
              />
            ))
          : null}

        <AnimatePresence>
          {sending || ingesting ? (
            <motion.div
              key="typing"
              className="mt-3 flex items-end gap-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={springSoft}
            >
              <span className="opacity-50">
                <BotMark id={isGroup ? memberBots[0]?.id : bot?.id} size="sm" />
              </span>
              <div className="typing flex h-9 min-w-[52px] items-center justify-center gap-1 rounded-[var(--radius-bubble)] bg-[var(--elevated)] px-3.5 text-lg leading-none text-[var(--ink-faint)]">
                <span>·</span>
                <span>·</span>
                <span>·</span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {error ? <p className="mt-3 text-center text-[13px] text-[var(--ink-faint)]">{error}</p> : null}
      </div>

      {!isGroup ? (
        <DmComposer
          key={`${selectedChatId ?? "none"}-${seedText ?? ""}`}
          botName={titleCaseName(bot?.name ?? "them")}
          initialDraft={seedText ?? ""}
          lastBotNews={Boolean(lastBotNews)}
          sending={sending}
          onSubmit={sendMessage}
          onSeedConsumed={clearComposerSeed}
        />
      ) : (
        <div className="app-footer hairline-t shrink-0 px-4 py-2.5 text-center">
          <p className="text-[12px] text-[var(--ink-faint)]">Tap a story for the link · Ask bots in their DMs</p>
        </div>
      )}
    </section>
  );
}

function PullHint({ pull, ingesting }: { pull: number; ingesting: boolean }) {
  if (pull <= 6 && !ingesting) return null;
  const ready = pull >= 64;
  return (
    <div className="pull-indicator">
      {ingesting ? (
        <motion.div
          className="pull-ring animate-spin"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        />
      ) : (
        <motion.div
          className="pull-ring"
          style={{ rotate: `${(pull / 64) * 180}deg`, opacity: Math.min(pull / 64, 1) }}
          animate={{ scale: ready ? 1.08 : 1 }}
          transition={springSoft}
        />
      )}
      <p className="mt-1 text-[11px] text-[var(--ink-faint)]">
        {ingesting ? "Refreshing…" : ready ? "Release" : "Pull down"}
      </p>
    </div>
  );
}

function EmptyState({
  isGroup,
  bot,
  memberBots,
  ingesting,
  onRefresh,
  onSettings,
}: {
  isGroup: boolean;
  bot: ReturnType<typeof getBot> | undefined;
  memberBots: (ReturnType<typeof getBot> | undefined)[];
  ingesting: boolean;
  onRefresh: () => void;
  onSettings: () => void;
}) {
  return (
    <motion.div
      className="flex flex-col items-center px-6 pt-20 text-center"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
    >
      {isGroup ? (
        <div className="mb-4 flex -space-x-2">
          {memberBots.slice(0, 4).map((member, i) => (
            <motion.div
              key={member!.id}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...springSoft, delay: i * 0.06 }}
            >
              <BotMark id={member!.id} size="md" />
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div className="mb-4" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
          <BotMark id={bot?.id} size="lg" />
        </motion.div>
      )}
      <p className="max-w-[280px] text-[16px] leading-relaxed text-[var(--ink-muted)]">
        {isGroup
          ? "Quiet on purpose. We only post when it's actually huge."
          : bot?.id === "pitch"
            ? "Ask for a live score, the table, or who's kickoff next."
            : `Ask ${titleCaseName(bot?.name ?? "them")} about any story they drop.`}
      </p>
      {isGroup ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={onRefresh} disabled={ingesting} className="btn-secondary w-auto px-4">
            {ingesting ? "Checking…" : "Check now"}
          </button>
          <button type="button" onClick={onSettings} className="btn-secondary w-auto px-4">
            Broaden filters
          </button>
        </div>
      ) : null}
    </motion.div>
  );
}

function DmComposer({
  botName,
  initialDraft,
  lastBotNews,
  sending,
  onSubmit,
  onSeedConsumed,
}: {
  botName: string;
  initialDraft: string;
  lastBotNews: boolean;
  sending: boolean;
  onSubmit: (text: string) => Promise<void>;
  onSeedConsumed: () => void;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const composer = useRef<HTMLTextAreaElement>(null);
  const showQuickReplies = lastBotNews && !draft.trim();
  const canSend = Boolean(draft.trim()) && !sending;

  useEffect(() => {
    if (initialDraft) onSeedConsumed();
    grow(composer.current);
    if (initialDraft) composer.current?.focus();
  }, [initialDraft, onSeedConsumed]);

  useEffect(() => {
    grow(composer.current);
  }, [draft]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await onSubmit(text);
  }

  return (
    <form onSubmit={submit} className="app-footer hairline-t shrink-0 px-3 pt-2 md:px-4">
      <AnimatePresence>
        {showQuickReplies ? (
          <motion.div
            className="mb-2 flex gap-2 overflow-x-auto pb-0.5 no-scrollbar"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={springSoft}
          >
            {QUICK_REPLIES.map((label, i) => (
              <motion.button
                key={label}
                type="button"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...springSoft, delay: i * 0.05 }}
                onClick={() => {
                  setDraft(label);
                  composer.current?.focus();
                }}
                className="shrink-0 rounded-[var(--radius-full)] border border-[var(--hairline)] bg-[var(--elevated)] px-3 py-2 text-[13px] text-[var(--ink-muted)] active:scale-[0.97]"
              >
                {label}
              </motion.button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="composer-field flex items-end gap-2 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--elevated)] p-1.5 pl-3">
        <textarea
          ref={composer}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void onSubmit(draft.trim());
              setDraft("");
            }
          }}
          rows={1}
          placeholder={`Message ${botName}`}
          className="max-h-[120px] min-h-[40px] flex-1 resize-none border-0 bg-transparent py-2 text-[16px] leading-[1.45] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
        />
        <motion.button
          type="submit"
          disabled={!canSend}
          className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-[var(--radius-full)]"
          animate={{
            scale: canSend ? 1 : 0.92,
            backgroundColor: canSend ? USER_BUBBLE.bg : "rgba(255,255,255,0.06)",
          }}
          whileTap={canSend ? { scale: 0.88 } : undefined}
          transition={spring}
          style={{ color: canSend ? USER_BUBBLE.text : "var(--ink-faint)" }}
          aria-label="Send"
        >
          <IconSend className="h-[17px] w-[17px]" />
        </motion.button>
      </div>
    </form>
  );
}

function Row({
  message,
  index,
  prev,
  next,
  isGroup,
  onAskBot,
}: {
  message: ChatMessage;
  index: number;
  prev?: ChatMessage;
  next?: ChatMessage;
  isGroup: boolean;
  onAskBot: (botId: BotId, message: ChatMessage) => void;
}) {
  const showDay = !prev || !sameDay(prev.createdAt, message.createdAt);
  const mine = message.sender === "user";
  const author = mine ? null : getBot(message.sender);
  const isNews = message.kind === "news";
  const withPrev = !showDay && !isNews && chatClustered(prev, message);
  const withNext = !isNews && chatClustered(message, next);
  const showGap = !withPrev && prev && !showDay;

  if (message.kind === "system") {
    return (
      <MessageEnter index={index}>
        {showDay ? <DayChip ts={message.createdAt} /> : null}
        <p className="my-3 text-center">
          <span className="day-pill">{message.text}</span>
        </p>
      </MessageEnter>
    );
  }

  if (message.kind === "news") {
    return (
      <NewsCard
        index={index}
        message={message}
        author={author ?? undefined}
        isGroup={isGroup}
        showDay={showDay}
        showGap={Boolean(showGap)}
        onAskBot={onAskBot}
      />
    );
  }

  const radius = bubbleRadius(mine, withPrev, withNext);

  return (
    <MessageEnter index={index} className={withPrev ? "mt-0.5" : "mt-3 first:mt-0"}>
      {showDay ? <DayChip ts={message.createdAt} /> : null}
      {showGap ? <div className="my-3" aria-hidden /> : null}
      <div className={`flex ${mine ? "justify-end" : "justify-start"} items-end gap-2`}>
        {!mine ? (
          <span className={`w-8 shrink-0 ${withPrev ? "invisible" : ""}`}>
            {!withPrev ? <BotMark id={author?.id} size="sm" /> : null}
          </span>
        ) : null}
        <div className={`max-w-[min(82%,320px)] ${mine ? "items-end" : "items-start"} flex flex-col`}>
          {!mine && isGroup && !withPrev ? (
            <p className="mb-1 px-1 text-[12px] font-medium" style={{ color: author?.color }}>
              {titleCaseName(author?.name ?? "")}
            </p>
          ) : null}
          <div
            className={`bubble ${mine ? "bubble-sent" : "bubble-received"}`}
            style={{
              background: mine ? undefined : (author?.bubble ?? "var(--elevated)"),
              color: mine ? undefined : "var(--ink)",
              borderRadius: radius,
            }}
          >
            <p className="whitespace-pre-wrap">
              {message.text}
              {!withNext ? <span className="msg-time">{clock(message.createdAt)}</span> : null}
            </p>
          </div>
        </div>
      </div>
    </MessageEnter>
  );
}

function NewsCard({
  message,
  index,
  author,
  isGroup,
  showDay,
  showGap,
  onAskBot,
}: {
  message: ChatMessage;
  index: number;
  author: ReturnType<typeof getBot> | undefined;
  isGroup: boolean;
  showDay: boolean;
  showGap: boolean;
  onAskBot: (botId: BotId, message: ChatMessage) => void;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const title = message.articleTitle?.trim();
  const body = message.text.trim();
  const showTitle = Boolean(title && !sameCopy(title, body));
  const sourceLabel =
    message.sources && message.sources.length > 1
      ? `${message.sources[0]} +${message.sources.length - 1}`
      : message.sources?.[0] || "source";
  const flash =
    message.flash === "now" ? "Breaking" : message.flash === "soon" ? "Upcoming" : null;
  const keywords = message.matchedKeywords ?? [];
  const botId = author?.id;

  return (
    <MessageEnter index={index} className="mt-4">
      {showDay ? <DayChip ts={message.createdAt} /> : null}
      {showGap ? <div className="my-3" aria-hidden /> : null}
      <div className="flex gap-2.5">
        <BotMark id={author?.id} size="sm" />
        <div className="min-w-0 flex-1">
          <header className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {isGroup ? (
              <span className="text-[13px] font-semibold" style={{ color: author?.color }}>
                {titleCaseName(author?.name ?? "")}
              </span>
            ) : null}
            {flash ? (
              <span
                className="rounded-[var(--radius-full)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ background: "var(--elevated)", color: "var(--ink-faint)" }}
              >
                {flash}
              </span>
            ) : null}
            <span className="tabular text-[11px] text-[var(--ink-faint)]">{clock(message.createdAt)}</span>
          </header>
          <motion.div
            className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--hairline)]"
            style={{
              background: author?.bubble ?? "var(--elevated)",
              boxShadow: `inset 3px 0 0 ${author?.color ?? "var(--ink-faint)"}`,
            }}
            whileTap={{ scale: 0.995 }}
            transition={springSoft}
          >
            <div className="bubble-news px-3.5 py-3 text-[var(--ink)]">
              <p className="whitespace-pre-wrap">{body}</p>
            </div>
            {message.articleUrl ? (
              <a
                href={message.articleUrl}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between gap-2 hairline-t bg-[var(--panel)] px-3.5 py-3 transition active:bg-[var(--elevated)]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
                    {sourceLabel}
                  </span>
                  {showTitle ? (
                    <span className="mt-1 block text-[14px] font-medium leading-snug text-[var(--ink)] group-active:text-white">
                      {title}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-[var(--ink-faint)]" aria-hidden>
                  →
                </span>
              </a>
            ) : null}
          </motion.div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {keywords.length > 0 ? (
              <button
                type="button"
                onClick={() => setWhyOpen((open) => !open)}
                className="text-[12px] text-[var(--ink-faint)] underline-offset-2 hover:text-[var(--ink-muted)] hover:underline"
              >
                {whyOpen ? "Hide" : "Why this story?"}
              </button>
            ) : null}
            {isGroup && botId ? (
              <button
                type="button"
                onClick={() => onAskBot(botId, message)}
                className="rounded-[var(--radius-full)] border border-[var(--hairline)] px-2.5 py-1 text-[12px] text-[var(--ink-muted)] active:scale-[0.97]"
              >
                Ask {titleCaseName(author?.name ?? "")}
              </button>
            ) : null}
          </div>
          <ExpandHeight open={whyOpen && keywords.length > 0}>
            <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--elevated)] px-3 py-2.5">
              <p className="text-[11px] font-medium text-[var(--ink-faint)]">Matched your filters</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {keywords.map((word) => (
                  <span
                    key={word}
                    className="rounded-[var(--radius-full)] bg-[var(--panel)] px-2 py-0.5 text-[11px] text-[var(--ink-muted)]"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          </ExpandHeight>
        </div>
      </div>
    </MessageEnter>
  );
}

function sameCopy(title: string, body: string) {
  const a = title.toLowerCase().replace(/\W+/g, " ").trim();
  const b = body.toLowerCase().replace(/\W+/g, " ").trim();
  return !a || b.startsWith(a) || a.startsWith(b.slice(0, a.length));
}

function DayChip({ ts }: { ts: number }) {
  return (
    <p className="flex justify-center">
      <span className="day-pill">{dayLabel(ts)}</span>
    </p>
  );
}
