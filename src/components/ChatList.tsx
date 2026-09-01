"use client";

import { GROUP_CHAT_ID, botFromChatId, getBot, hexAlpha } from "@/lib/bots";
import { titleCaseName } from "@/lib/notifications";
import { useStore } from "@/lib/store";
import type { Chat } from "@/lib/types";
import { BotMark } from "./BotMark";
import { IconBell, IconPlus, IconRefresh, IconSliders } from "./icons";

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
  onOpenMembers,
  onOpenPrefs,
  onOpenNotifications,
}: {
  onOpenMembers: () => void;
  onOpenPrefs: () => void;
  onOpenNotifications: () => void;
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
        <p className="display text-[12px] font-black italic tracking-tight text-rose-300 md:text-[13px]">
          What&apos;s Up
        </p>
        <h1 className="display mt-0.5 text-[26px] font-black leading-none tracking-tight md:mt-1 md:text-[34px]">
          Chats
        </h1>
        <p className="mt-1.5 text-[11px] text-[var(--muted)] md:mt-2 md:text-[12px]">
          {members} {members === 1 ? "loudmouth" : "loudmouths"} in the group
        </p>

        <div className="mt-3 grid grid-cols-4 overflow-hidden rounded-xl border border-white/[0.08] bg-black/30 md:mt-4 md:rounded-2xl">
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
            onClick={onOpenPrefs}
            className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 border-l border-white/[0.08] py-2 text-white/70 active:bg-white/[0.08]"
            aria-label="Filters"
          >
            <IconSliders className="h-[17px] w-[17px]" />
            <span className="text-[10px] font-medium tracking-wide">Filters</span>
          </button>
          <button
            type="button"
            onClick={onOpenNotifications}
            className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 border-l border-white/[0.08] py-2 text-white/70 active:bg-white/[0.08]"
            aria-label="Notifications"
          >
            <IconBell className="h-[17px] w-[17px]" />
            <span className="text-[10px] font-medium tracking-wide">Alerts</span>
          </button>
          <button
            type="button"
            onClick={onOpenMembers}
            className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 border-l border-white/[0.08] bg-[#fde047]/10 py-2 text-[#fde047] active:bg-[#fde047]/18"
            aria-label="Add members"
          >
            <IconPlus className="h-[17px] w-[17px]" />
            <span className="text-[10px] font-semibold tracking-wide">Add bot</span>
          </button>
        </div>
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
        {backend === "local" ? "This phone only. Chaotic on purpose." : "Synced · only the important pings"}
      </p>
    </div>
  );
}
