"use client";

import { useEffect, useState } from "react";
import { BOT_IDS } from "@/lib/types";
import type { BotId, NotificationPrefs } from "@/lib/types";
import { getBot } from "@/lib/bots";
import {
  defaultNotificationPrefs,
  normalizeNotificationPrefs,
  titleCaseName,
} from "@/lib/notifications";
import { BotMark } from "./BotMark";
import { IconClose } from "./icons";

function Toggle({
  on,
  onChange,
  label,
  accent,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  accent?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="h-8 w-12 shrink-0 rounded-full p-0.5 transition"
      style={{ background: on ? (accent ?? "#fff") : "#2a2a2a" }}
    >
      <span
        className="block h-7 w-7 rounded-full transition"
        style={{
          transform: on ? "translateX(16px)" : "translateX(0)",
          background: on ? "#000" : "#fff",
        }}
      />
    </button>
  );
}

export function NotificationsScreen({
  open,
  enabledBots,
  initial,
  pushEnabled,
  saving,
  onClose,
  onSave,
  onEnablePush,
}: {
  open: boolean;
  enabledBots: BotId[];
  initial?: NotificationPrefs;
  pushEnabled?: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave: (prefs: NotificationPrefs) => Promise<void>;
  onEnablePush: () => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<NotificationPrefs>(
    initial ?? defaultNotificationPrefs(),
  );
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (open) setDraft(normalizeNotificationPrefs(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const bots = (enabledBots.length > 0 ? enabledBots : [...BOT_IDS]).filter(isKnown);

  function setBot(id: BotId, value: boolean) {
    setDraft((current) => ({
      ...current,
      bots: { ...current.bots, [id]: value },
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black">
      <header
        className="shrink-0 border-b border-white/8 px-4 pb-3"
        style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="display text-[11px] font-black italic text-rose-300">Settings</p>
            <h2 className="display mt-0.5 text-[24px] font-black leading-none tracking-tight">
              Notifications
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/12 text-white"
            aria-label="close"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 no-scrollbar">
        <p className="text-[14px] leading-6 text-[var(--muted)]">
          Alerts look like a DM from each bot. Timeline alerts are off by default.
        </p>

        {!pushEnabled ? (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3">
            <p className="text-[13px] leading-5 text-amber-100">
              System notifications are off. Turn them on to get alerts on your lock screen.
            </p>
            <button
              type="button"
              disabled={pushBusy}
              onClick={async () => {
                setPushBusy(true);
                try {
                  await onEnablePush();
                } finally {
                  setPushBusy(false);
                }
              }}
              className="mt-3 h-10 w-full rounded-full bg-white text-[13px] font-semibold text-black disabled:opacity-40"
            >
              {pushBusy ? "Asking…" : "Allow notifications"}
            </button>
          </div>
        ) : null}

        <section className="mt-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Group
          </p>
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3 py-3">
            <BotMark id="group" size="md" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">The timeline</p>
              <p className="text-[12px] text-white/40">Group chat alerts</p>
            </div>
            <Toggle
              label="timeline notifications"
              on={draft.timeline}
              onChange={(value) => setDraft((current) => ({ ...current, timeline: value }))}
              accent="#fb923c"
            />
          </div>
        </section>

        <section className="mt-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Direct messages
          </p>
          <div className="grid gap-2">
            {bots.map((id) => {
              const bot = getBot(id);
              const on = draft.bots[id] !== false;
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3 py-3"
                >
                  <BotMark id={id} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold" style={{ color: bot?.color ?? "#fff" }}>
                      {titleCaseName(bot?.name ?? id)}
                    </p>
                    <p className="truncate text-[12px] text-white/40">{bot?.handle}</p>
                  </div>
                  <Toggle
                    label={`${bot?.name ?? id} notifications`}
                    on={on}
                    onChange={(value) => setBot(id, value)}
                    accent={bot?.color}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div
        className="shrink-0 border-t border-white/8 bg-black/95 px-4 pt-3 backdrop-blur-xl"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 14px)" }}
      >
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            await onSave(normalizeNotificationPrefs(draft));
          }}
          className="h-12 w-full rounded-full bg-white text-[15px] font-semibold text-black disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save notifications"}
        </button>
      </div>
    </div>
  );
}

function isKnown(id: BotId): id is BotId {
  return BOT_IDS.includes(id);
}
