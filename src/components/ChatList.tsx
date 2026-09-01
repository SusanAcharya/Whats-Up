"use client";

import { GROUP_CHAT_ID, botFromChatId, getBot } from "@/lib/bots";
import { TIMELINE_ACCENT } from "@/lib/design";
import { titleCaseName } from "@/lib/notifications";
import { useStore } from "@/lib/store";
import type { Chat } from "@/lib/types";
import { BotMark } from "./BotMark";
import { ListRowEnter } from "./motion";
import { MetaLabel, ScreenTitle, StatusBanner } from "./ui";
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
  active,
  onSelect,
  showSep,
}: {
  chat: Chat;
  active: boolean;
  onSelect: () => void;
  showSep: boolean;
}) {
  const bot = chat.type === "dm" ? getBot(chat.botId ?? "") ?? botFromChatId(chat.id) : undefined;
  const isGroup = chat.id === GROUP_CHAT_ID;
  const accent = isGroup ? TIMELINE_ACCENT : (bot?.color ?? "var(--ink)");

  return (
    <>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={`chat-row ${active ? "chat-row-active" : ""}`}
      >
        <BotMark id={isGroup ? "group" : bot?.id} size="md" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className="truncate text-[17px] font-semibold leading-tight"
              style={{ color: active ? accent : "var(--ink)" }}
            >
              {isGroup ? "The timeline" : titleCaseName(bot?.name ?? chat.title)}
            </span>
            <span className="tabular shrink-0 text-[13px] text-[var(--ink-faint)]">
              {timeLabel(chat.lastMessageAt)}
            </span>
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span
              className={`truncate text-[15px] leading-snug ${chat.unread > 0 ? "font-medium text-[var(--ink)]" : "text-[var(--ink-muted)]"}`}
            >
              {isGroup ? chat.lastMessage || "All bots, one feed" : chat.lastMessage}
            </span>
            {chat.unread > 0 ? (
              <span
                className="tabular grid min-h-[22px] min-w-[22px] shrink-0 place-items-center rounded-[var(--radius-full)] px-1.5 text-[11px] font-bold"
                style={{ background: accent, color: isGroup ? "#1a1008" : "#fff" }}
              >
                {chat.unread > 9 ? "9+" : chat.unread}
              </span>
            ) : null}
          </span>
        </span>
      </button>
      {showSep ? <div className="chat-row-sep" aria-hidden /> : null}
    </>
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
  const unreadTotal = visible.reduce((sum, chat) => sum + chat.unread, 0);
  const group = visible.filter((chat) => chat.id === GROUP_CHAT_ID);
  const dms = visible.filter((chat) => chat.id !== GROUP_CHAT_ID);
  const rows = [...group, ...dms];

  return (
    <div className="screen-panel flex h-full min-h-0 w-full flex-col overflow-hidden">
      <header className="app-header shrink-0 px-4 pb-3 md:px-4">
        <ScreenTitle>Chats</ScreenTitle>
        <MetaLabel>
          {members} {members === 1 ? "bot" : "bots"}
          {unreadTotal > 0 ? ` · ${unreadTotal} unread` : ""}
        </MetaLabel>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => ingest("manual")}
            className="btn-secondary min-h-[40px] flex-1 gap-2 text-[13px]"
          >
            <IconRefresh className={`inline h-4 w-4 ${ingesting ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="btn-secondary min-h-[40px] flex-1 gap-2 text-[13px]"
          >
            <IconSettings className="inline h-4 w-4" />
            Settings
          </button>
        </div>

        {statusText ? (
          <div className="mt-3">
            <StatusBanner text={statusText} ingesting={ingesting} onDismiss={onDismissStatus} />
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain no-scrollbar">
        {rows.map((chat, i) => (
          <ListRowEnter key={chat.id} index={i}>
            <ChatRow
              chat={chat}
              active={selectedChatId === chat.id}
              onSelect={() => selectChat(chat.id)}
              showSep={i < rows.length - 1}
            />
          </ListRowEnter>
        ))}
      </div>

      <p className="hairline-t shrink-0 px-4 py-2.5 text-center text-[11px] text-[var(--ink-faint)]">
        {backend === "local" ? "This phone only" : "Synced across devices"}
      </p>
    </div>
  );
}
