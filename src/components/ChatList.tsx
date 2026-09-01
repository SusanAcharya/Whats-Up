"use client";

import { GROUP_CHAT_ID, botFromChatId, getBot, hexAlpha } from "@/lib/bots";
import { titleCaseName } from "@/lib/notifications";
import { useStore } from "@/lib/store";
import type { Chat } from "@/lib/types";
import { BotMark } from "./BotMark";
import { IconRefresh, IconSettings } from "./icons";

function timeLabel(ts: number) {
  const delta = Date.now() - ts;
  if (delta < 60_000) return "now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChatRow({
  chat,
  on,
  onSelect,
}: {
  chat: Chat;
  on: boolean;
  onSelect: () => void;
}) {
  const bot = chat.type === "dm" ? getBot(chat.botId ?? "") ?? botFromChatId(chat.id) : undefined;
  const isGroup = chat.id === GROUP_CHAT_ID;
  const accent = isGroup ? "#f97316" : (bot?.color ?? "#fff");

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={isGroup ? "The timeline" : titleCaseName(bot?.name ?? chat.title)}
      className="flex w-full max-w-full items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition md:gap-3 md:rounded-2xl md:px-3 md:py-3"
      style={{
        background: on ? hexAlpha(accent, 0.12) : "rgba(255,255,255,0.02)",
        borderColor: on ? hexAlpha(accent, 0.45) : "rgba(255,255,255,0.06)",
      }}
    >
      <BotMark id={isGroup ? "group" : bot?.id} size="md" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span
            className="display truncate text-[17px] font-extrabold tracking-tight"
            style={{ color: on ? accent : "#fff7ed" }}
          >
            {isGroup ? "The timeline" : titleCaseName(bot?.name ?? chat.title)}
          </span>
          <span className="shrink-0 text-[11px] font-medium text-white/35">
            {timeLabel(chat.lastMessageAt)}
          </span>
        </span>
        <span className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate text-[13px] leading-snug text-white/45">
            {isGroup ? chat.lastMessage || "The big stuff lands here" : chat.lastMessage}
          </span>
          {chat.unread > 0 ? (
            <span
              className="grid min-w-5 shrink-0 place-items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold text-black"
              style={{ background: accent }}
            >
              {chat.unread}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

export function ChatList({
  onOpenSettings,
  statusText,
  onDismissStatus,
}: {
  onOpenSettings: () => void;
  statusText?: string | null;
  onDismissStatus?: () => void;
}) {
  const { chats, ingesting, ingest, selectChat, selectedChatId, profile, backend } = useStore();
  const members = profile?.enabledBots.length ?? 0;

  const visible = chats.filter((chat) => {
    if (chat.type !== "dm") return true;
    return chat.botId ? profile?.enabledBots.includes(chat.botId) : false;
  });
  const group = visible.filter((chat) => chat.id === GROUP_CHAT_ID);
  const dms = visible.filter((chat) => chat.id !== GROUP_CHAT_ID);

  return (
    <div className="chat-bg flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden">
      <header
        className="relative z-10 shrink-0 px-4 pb-2 md:px-5 md:pb-3"
        style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}
      >
        <p className="display text-[12px] font-black italic tracking-tight text-white/50 md:text-[13px]">
          What&apos;s Up
        </p>
        <h1 className="display mt-0.5 text-[26px] font-black leading-none tracking-tight md:mt-1 md:text-[34px]">
          Chats
        </h1>
        <p className="mt-1.5 text-[11px] text-[var(--muted)] md:mt-2 md:text-[12px]">
          {members} {members === 1 ? "bot" : "bots"} enabled
        </p>

        <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-xl border border-white/[0.08] bg-black/30 md:mt-4 md:rounded-2xl">
          <button
            type="button"
            onClick={() => ingest("manual")}
            className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 py-2 text-white/70 active:bg-white/[0.08]"
            aria-label="Refresh"
          >
            <IconRefresh className={`h-[17px] w-[17px] ${ingesting ? "animate-spin" : ""}`} />
            <span className="text-[10px] font-medium tracking-wide">Refresh</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 border-l border-white/[0.08] py-2 text-white/70 active:bg-white/[0.08]"
            aria-label="Settings"
          >
            <IconSettings className="h-[17px] w-[17px]" />
            <span className="text-[10px] font-medium tracking-wide">Settings</span>
          </button>
        </div>

        {statusText ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
            <p className="min-w-0 flex-1 text-[12px] leading-5 text-white/55">{statusText}</p>
            {!ingesting && onDismissStatus ? (
              <button
                type="button"
                onClick={onDismissStatus}
                className="shrink-0 text-[11px] text-white/35"
                aria-label="Dismiss"
              >
                ✕
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-1 no-scrollbar md:px-4 md:py-2">
        {group.length > 0 ? (
          <section className="mb-5">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
              Group
            </p>
            <div className="space-y-2">
              {group.map((chat) => (
                <ChatRow
                  key={chat.id}
                  chat={chat}
                  on={selectedChatId === chat.id}
                  onSelect={() => selectChat(chat.id)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {dms.length > 0 ? (
          <section>
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
              Direct
            </p>
            <div className="space-y-2">
              {dms.map((chat) => (
                <ChatRow
                  key={chat.id}
                  chat={chat}
                  on={selectedChatId === chat.id}
                  onSelect={() => selectChat(chat.id)}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <p className="relative z-10 shrink-0 border-t border-white/[0.06] px-4 py-2.5 text-center text-[10px] text-white/30 md:px-5 md:py-3 md:text-[11px]">
        {backend === "local" ? "This phone only." : "Synced · background checks every 15 min"}
      </p>
    </div>
  );
}
