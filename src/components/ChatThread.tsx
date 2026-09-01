"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { GROUP_CHAT_ID, getBot, hexAlpha } from "@/lib/bots";
import { useStore } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";
import { BotMark } from "./BotMark";
import { IconBack, IconPeople, IconRefresh, IconSend, IconSliders } from "./icons";

const CHAT_CLUSTER_MS = 90_000;

function clock(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function dayLabel(ts: number) {
  const date = new Date(ts);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "yesterday";
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
  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
}

export function ChatThread({
  onOpenMembers,
  onOpenPrefs,
}: {
  onOpenMembers: () => void;
  onOpenPrefs: () => void;
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
  } = useStore();
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const chat = chats.find((item) => item.id === selectedChatId);
  const bot = chat?.type === "dm" ? getBot(chat.botId ?? "") : undefined;
  const isGroup = selectedChatId === GROUP_CHAT_ID;
  const memberBots = (profile?.enabledBots ?? []).map(getBot).filter(Boolean);
  const accent = isGroup ? "#fb923c" : (bot?.color ?? "#fff7ed");

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending, ingesting]);

  useEffect(() => {
    grow(composer.current);
  }, [draft]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft;
    setDraft("");
    await sendMessage(text);
  }

  return (
    <section
      className="thread-bg flex h-full min-h-0 flex-col"
      style={{ ["--thread-accent" as string]: hexAlpha(accent, 0.18) }}
    >
      <header
        className="relative z-10 flex items-center gap-2 border-b border-white/[0.06] bg-black/40 px-2 pb-2.5 backdrop-blur-xl"
        style={{ paddingTop: "calc(var(--safe-top) + 8px)" }}
      >
        <button
          type="button"
          onClick={() => selectChat(null)}
          className="grid h-9 w-9 place-items-center rounded-full text-white/80 hover:bg-white/[0.08]"
          aria-label="back"
        >
          <IconBack className="h-5 w-5" />
        </button>
        {isGroup ? (
          <div className="flex -space-x-2.5">
            {memberBots.slice(0, 3).map((member) => (
              <BotMark key={member!.id} id={member!.id} size="sm" />
            ))}
          </div>
        ) : (
          <BotMark id={bot?.id} size="sm" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold leading-tight" style={{ color: accent }}>
            {isGroup ? "the timeline" : bot?.name ?? chat?.title}
          </p>
          <p className="truncate text-[11px] text-white/40">
            {ingesting
              ? "catching up..."
              : isGroup
                ? `${memberBots.length} in the group`
                : bot?.handle}
          </p>
        </div>
        {isGroup ? (
          <button
            type="button"
            onClick={onOpenPrefs}
            className="grid h-9 w-9 place-items-center rounded-full text-white/55 hover:bg-white/[0.08] hover:text-white/80"
            aria-label="filters"
          >
            <IconSliders className="h-4 w-4" />
          </button>
        ) : null}
        {isGroup ? (
          <button
            type="button"
            onClick={onOpenMembers}
            className="grid h-9 w-9 place-items-center rounded-full text-white/55 hover:bg-white/[0.08] hover:text-white/80"
            aria-label="members"
          >
            <IconPeople className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => ingest("manual")}
          className="grid h-9 w-9 place-items-center rounded-full text-white/55 hover:bg-white/[0.08] hover:text-white/80"
          aria-label="refresh"
        >
          <IconRefresh className={`h-4 w-4 ${ingesting ? "animate-spin" : ""}`} />
        </button>
      </header>

      <div ref={scroller} className="relative z-10 no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center px-8 pt-24 text-center">
            {isGroup ? (
              <div className="mb-4 flex -space-x-3">
                {memberBots.slice(0, 4).map((member) => (
                  <BotMark key={member!.id} id={member!.id} size="md" />
                ))}
              </div>
            ) : (
              <div className="mb-4">
                <BotMark id={bot?.id} size="lg" />
              </div>
            )}
            <p className="text-[15px] text-white/55">
              {isGroup
                ? "quiet on purpose. we only text when it's actually huge."
                : bot?.id === "pitch"
                  ? "ask for a live score, the table, or who's kickoff next."
                  : `ask ${bot?.name} anything about a story they dropped.`}
            </p>
          </div>
        ) : null}
        {messages.map((message, index) => (
          <Row
            key={message.id}
            message={message}
            prev={messages[index - 1]}
            next={messages[index + 1]}
            isGroup={isGroup}
          />
        ))}
        {sending || ingesting ? (
          <div className="message-block mt-4 flex items-end gap-2.5 pl-0.5">
            <span className="opacity-40">
              <BotMark id={isGroup ? memberBots[0]?.id : bot?.id} size="sm" />
            </span>
            <div className="typing flex h-9 items-center gap-1 rounded-[18px] bg-white/[0.06] px-3.5 text-white/40">
              <span>●</span>
              <span>●</span>
              <span>●</span>
            </div>
          </div>
        ) : null}
        {error ? <p className="mt-3 text-center text-xs text-white/45">{error}</p> : null}
      </div>

      <form
        onSubmit={onSubmit}
        className="relative z-10 flex items-end gap-2 border-t border-white/[0.06] bg-black/50 px-3 pt-2.5 backdrop-blur-xl"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 10px)" }}
      >
        <textarea
          ref={composer}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendMessage(draft);
              setDraft("");
            }
          }}
          rows={1}
          placeholder={isGroup ? "Message the timeline" : `Message ${bot?.name ?? "them"}`}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-[22px] border-0 bg-white/[0.08] px-4 py-2.5 text-[15px] leading-5 text-white outline-none placeholder:text-white/30"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-black transition disabled:bg-white/10 disabled:text-white/25"
          style={{ background: draft.trim() ? accent : undefined }}
          aria-label="send"
        >
          <IconSend className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}

function Row({
  message,
  prev,
  next,
  isGroup,
}: {
  message: ChatMessage;
  prev?: ChatMessage;
  next?: ChatMessage;
  isGroup: boolean;
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
      <div className="message-block">
        {showDay ? <DayChip ts={message.createdAt} /> : null}
        <p className="mx-auto my-2 max-w-[22rem] rounded-full bg-white/[0.04] px-3.5 py-1.5 text-center text-[11px] leading-4 text-white/40">
          {message.text}
        </p>
      </div>
    );
  }

  if (message.kind === "news") {
    const title = message.articleTitle?.trim();
    const body = message.text.trim();
    const showTitle = Boolean(title && !sameCopy(title, body));
    const sourceLabel =
      message.sources && message.sources.length > 1
        ? `${message.sources[0]} +${message.sources.length - 1}`
        : message.sources?.[0] || "source";
    const flash =
      message.flash === "now" ? "breaking" : message.flash === "soon" ? "upcoming" : null;

    return (
      <article className="message-block mt-6 border-b border-white/[0.05] pb-6 last:mb-0 last:border-b-0 last:pb-0">
        {showDay ? <DayChip ts={message.createdAt} /> : null}
        {showGap ? <MessageGap /> : null}
        <div className="flex gap-3">
          <span className="mt-0.5 shrink-0">
            <BotMark id={author?.id} size="sm" />
          </span>
          <div className="min-w-0 flex-1">
            <header className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {isGroup ? (
                <span className="text-[13px] font-semibold" style={{ color: author?.color }}>
                  {author?.name}
                </span>
              ) : null}
              {flash ? (
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
                  {flash}
                </span>
              ) : null}
              <span className="text-[11px] text-white/30">{clock(message.createdAt)}</span>
            </header>
            <div
              className="overflow-hidden rounded-[14px] border border-white/[0.08]"
              style={{
                background: author?.bubble ?? "#1a1418",
                boxShadow: `inset 3px 0 0 ${author?.color ?? "rgba(255,255,255,0.35)"}`,
              }}
            >
              <div className="px-4 py-3.5 text-[15px] leading-[1.52] text-[#f4f4f5]">
                <p className="whitespace-pre-wrap">{body}</p>
              </div>
              {message.articleUrl ? (
                <a
                  href={message.articleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block border-t border-white/[0.08] bg-black/30 px-4 py-3 transition hover:bg-black/40"
                >
                  <span className="block truncate text-[11px] font-medium text-white/40">
                    {sourceLabel}
                    {message.matchedKeywords?.[0] ? ` · ${message.matchedKeywords[0]}` : ""}
                  </span>
                  {showTitle ? (
                    <span className="mt-1.5 block text-[13px] font-medium leading-snug text-white/92">
                      {title}
                    </span>
                  ) : null}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    );
  }

  const radius = mine
    ? withNext
      ? "18px 18px 8px 18px"
      : "18px 18px 5px 18px"
    : withNext
      ? "18px 18px 18px 8px"
      : "18px 18px 18px 5px";

  return (
    <div className={`message-block ${withPrev ? "mt-1" : "mt-4 first:mt-0"}`}>
      {showDay ? <DayChip ts={message.createdAt} /> : null}
      {showGap ? <MessageGap /> : null}
      <div className={`flex ${mine ? "justify-end" : "justify-start"} items-end gap-2.5`}>
        {!mine ? (
          <span className={`shrink-0 ${withPrev ? "invisible" : ""}`}>
            <BotMark id={author?.id} size="sm" />
          </span>
        ) : null}
        <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
          {!mine && isGroup && !withPrev ? (
            <p className="mb-1 text-[12px] font-medium" style={{ color: author?.color }}>
              {author?.name}
            </p>
          ) : null}
          <div
            className="px-3.5 py-2.5 text-[15px] leading-[1.45]"
            style={{
              background: mine ? "#e8e4dc" : (author?.bubble ?? "#1a1418"),
              color: mine ? "#16120c" : "#f4f4f5",
              borderRadius: radius,
            }}
          >
            <p className="whitespace-pre-wrap">
              {message.text}
              {!withNext ? (
                <span className={`msg-time ${mine ? "text-black/35" : "text-white/28"}`}>
                  {clock(message.createdAt)}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageGap() {
  return <div className="my-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" aria-hidden />;
}

function sameCopy(title: string, body: string) {
  const a = title.toLowerCase().replace(/\W+/g, " ").trim();
  const b = body.toLowerCase().replace(/\W+/g, " ").trim();
  return !a || b.startsWith(a) || a.startsWith(b.slice(0, a.length));
}

function DayChip({ ts }: { ts: number }) {
  return (
    <p className="my-4 text-center text-[11px] font-medium tracking-wide text-white/30">
      {dayLabel(ts)}
    </p>
  );
}
