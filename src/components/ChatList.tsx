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
  const { chats, ingesting, ingest, selectChat, selectedChatId, profile, backend, markAllRead } =
    useStore();
  const members = profile?.enabledBots.length ?? 0;

  const visible = chats.filter((chat) => {
    if (chat.type !== "dm") return true;
    return chat.botId ? profile?.enabledBots.includes(chat.botId) : false;
  });
  const unreadTotal = visible.reduce((sum, chat) => sum + chat.unread, 0);
  const group = visible.filter((chat) => chat.id === GROUP_CHAT_ID);
  const dms = visible.filter((chat) => chat.id !== GROUP_CHAT_ID);
  const rows = [...group, ...dms];
  const quiet =
    members > 0 &&
    dms.every((chat) => !chat.lastMessage?.trim()) &&
    group.every(
      (chat) =>
        !chat.lastMessage?.trim() || chat.lastMessage.toLowerCase().includes("add members"),
    );

  return (
    <div className="screen-panel flex h-full min-h-0 w-full flex-col overflow-hidden">
      <header className="app-header shrink-0 px-4 pb-3 md:px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <ScreenTitle>What&apos;s Up</ScreenTitle>
            <MetaLabel>
              {members} {members === 1 ? "bot" : "bots"}
              {unreadTotal > 0 ? ` · ${unreadTotal} unread` : ""}
            </MetaLabel>
            {unreadTotal > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="mt-1 text-[13px] font-medium text-[#0a84ff] active:opacity-70"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => ingest("manual")}
              className="btn-icon"
              aria-label="Refresh"
            >
              <IconRefresh className={`h-[18px] w-[18px] ${ingesting ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="btn-icon"
              aria-label="Settings"
            >
              <IconSettings className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        {statusText ? (
          <div className="mt-3">
            <StatusBanner text={statusText} ingesting={ingesting} onDismiss={onDismissStatus} />
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain no-scrollbar">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 pt-16 text-center">
            <p className="text-[16px] font-medium text-[var(--ink-muted)]">No chats yet</p>
            <p className="mt-2 max-w-[240px] text-[14px] leading-relaxed text-[var(--ink-faint)]">
              Add bots in Settings and they&apos;ll start texting when something matters.
            </p>
            <button type="button" onClick={onOpenSettings} className="btn-secondary mt-5 w-auto px-4">
              Add bots
            </button>
          </div>
        ) : (
          <>
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
            {quiet && members > 0 ? (
              <div className="mx-4 mt-6 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--elevated)] px-4 py-3.5">
                <p className="text-[14px] font-medium text-[var(--ink)]">Waiting on the wire</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-faint)]">
                  Pull to refresh, or broaden filters if it&apos;s been quiet for a while.
                </p>
                <button
                  type="button"
                  onClick={() => ingest("manual")}
                  disabled={ingesting}
                  className="mt-3 text-[13px] font-medium text-[#0a84ff] active:opacity-70"
                >
                  {ingesting ? "Checking…" : "Check now"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <p className="hairline-t shrink-0 px-4 py-2.5 text-center text-[11px] text-[var(--ink-faint)]">
        {backend === "local" ? "This phone only" : "Synced across devices"}
      </p>
    </div>
  );
}
