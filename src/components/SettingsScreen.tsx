"use client";

import { useState } from "react";
import { BOTS, getBot } from "@/lib/bots";
import {
  normalizeNotificationPrefs,
  titleCaseName,
} from "@/lib/notifications";
import { defaultPreferences } from "@/lib/preferences";
import { useStore } from "@/lib/store";
import type { BotId, NotificationPrefs, Preferences } from "@/lib/types";
import { BotMark } from "./BotMark";
import { IconClose } from "./icons";
import { PreferencesEditor } from "./Preferences";

type Tab = "alerts" | "filters" | "bots";

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

export function SettingsScreen({
  open,
  enabledBots,
  initialPrefs,
  initialNotifications,
  pushEnabled,
  prefsSaving,
  notifySaving,
  initialTab,
  onClose,
  onSavePrefs,
  onSaveNotifications,
  onEnablePush,
}: {
  open: boolean;
  enabledBots: BotId[];
  initialPrefs?: Preferences;
  initialNotifications?: NotificationPrefs;
  pushEnabled?: boolean;
  prefsSaving?: boolean;
  notifySaving?: boolean;
  initialTab?: Tab;
  onClose: () => void;
  onSavePrefs: (prefs: Preferences) => Promise<void>;
  onSaveNotifications: (prefs: NotificationPrefs) => Promise<void>;
  onEnablePush: () => Promise<boolean>;
}) {
  if (!open) return null;
  return (
    <SettingsPanel
      key={initialTab ?? "alerts"}
      enabledBots={enabledBots}
      initialPrefs={initialPrefs}
      initialNotifications={initialNotifications}
      pushEnabled={pushEnabled}
      prefsSaving={prefsSaving}
      notifySaving={notifySaving}
      initialTab={initialTab}
      onClose={onClose}
      onSavePrefs={onSavePrefs}
      onSaveNotifications={onSaveNotifications}
      onEnablePush={onEnablePush}
    />
  );
}

function SettingsPanel({
  enabledBots,
  initialPrefs,
  initialNotifications,
  pushEnabled,
  prefsSaving,
  notifySaving,
  initialTab,
  onClose,
  onSavePrefs,
  onSaveNotifications,
  onEnablePush,
}: {
  enabledBots: BotId[];
  initialPrefs?: Preferences;
  initialNotifications?: NotificationPrefs;
  pushEnabled?: boolean;
  prefsSaving?: boolean;
  notifySaving?: boolean;
  initialTab?: Tab;
  onClose: () => void;
  onSavePrefs: (prefs: Preferences) => Promise<void>;
  onSaveNotifications: (prefs: NotificationPrefs) => Promise<void>;
  onEnablePush: () => Promise<boolean>;
}) {
  const { toggleBot, profile } = useStore();
  const [tab, setTab] = useState<Tab>(initialTab ?? "alerts");
  const [prefsDraft, setPrefsDraft] = useState<Preferences>(initialPrefs ?? defaultPreferences());
  const [notifyDraft, setNotifyDraft] = useState<NotificationPrefs>(() =>
    normalizeNotificationPrefs(initialNotifications),
  );
  const [pushBusy, setPushBusy] = useState(false);

  const prefBots = enabledBots.length > 0 ? enabledBots : profile?.enabledBots ?? [];

  function setBotNotify(id: BotId, value: boolean) {
    setNotifyDraft((current) => ({
      ...current,
      bots: { ...current.bots, [id]: value },
    }));
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "alerts", label: "Alerts" },
    { id: "filters", label: "Filters" },
    { id: "bots", label: "Bots" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black">
      <header
        className="shrink-0 border-b border-white/8 px-4 pb-3"
        style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="display text-[11px] font-black italic text-rose-300">What&apos;s Up</p>
            <h2 className="display mt-0.5 text-[24px] font-black leading-none tracking-tight">
              Settings
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
        <div className="mt-3 flex gap-1 rounded-xl bg-white/[0.04] p-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition ${
                tab === item.id
                  ? "bg-white text-black"
                  : "text-white/50 active:text-white/70"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 no-scrollbar">
        {tab === "alerts" ? (
          <>
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
                  on={notifyDraft.timeline}
                  onChange={(value) =>
                    setNotifyDraft((current) => ({ ...current, timeline: value }))
                  }
                  accent="#fb923c"
                />
              </div>
            </section>
            <section className="mt-6">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
                Direct messages
              </p>
              <div className="grid gap-2">
                {prefBots.map((id) => {
                  const bot = getBot(id);
                  const on = notifyDraft.bots[id] !== false;
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
                        onChange={(value) => setBotNotify(id, value)}
                        accent={bot?.color}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : null}

        {tab === "filters" ? (
          <>
            <p className="text-[14px] leading-6 text-[var(--muted)]">
              Each bot only posts stories that match your keywords. Add a team, a ticker, a country
              — then save.
            </p>
            <PreferencesEditor
              value={prefsDraft}
              onChange={setPrefsDraft}
              botIds={prefBots}
            />
          </>
        ) : null}

        {tab === "bots" ? (
          <>
            <p className="mb-4 text-[14px] leading-6 text-[var(--muted)]">
              Toggle bots on or off. Only enabled bots check headlines and can DM you.
            </p>
            <div className="grid gap-2">
              {BOTS.map((bot) => {
                const on = profile?.enabledBots.includes(bot.id) ?? false;
                return (
                  <div
                    key={bot.id}
                    className="flex items-center gap-2.5 rounded-xl border px-2.5 py-2.5"
                    style={{
                      background: on ? bot.bubble : "#111",
                      borderColor: on ? bot.color : "rgba(255,255,255,0.08)",
                    }}
                  >
                    <BotMark id={bot.id} size="md" />
                    <div className="min-w-0 flex-1">
                      <p
                        className="display font-black tracking-tight"
                        style={{ color: on ? bot.color : "#fff7ed" }}
                      >
                        {titleCaseName(bot.name)}
                      </p>
                      <p className="text-[12px] leading-snug text-[var(--muted)]">
                        {bot.topic} · {bot.tagline}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleBot(bot.id as BotId, !on)}
                      className="h-8 w-12 shrink-0 rounded-full p-0.5"
                      style={{ background: on ? bot.color : "#2a2a2a" }}
                      aria-label={`${on ? "Remove" : "Add"} ${bot.name}`}
                    >
                      <span
                        className="block h-7 w-7 rounded-full transition"
                        style={{
                          transform: on ? "translateX(16px)" : "translateX(0)",
                          background: on ? "#000" : "#fff",
                        }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      {tab !== "bots" ? (
        <div
          className="shrink-0 border-t border-white/8 bg-black/95 px-4 pt-3 backdrop-blur-xl"
          style={{ paddingBottom: "calc(var(--safe-bottom) + 14px)" }}
        >
          <button
            type="button"
            disabled={tab === "filters" ? prefsSaving : notifySaving}
            onClick={async () => {
              if (tab === "filters") await onSavePrefs(prefsDraft);
              else await onSaveNotifications(normalizeNotificationPrefs(notifyDraft));
            }}
            className="h-12 w-full rounded-full bg-white text-[15px] font-semibold text-black disabled:opacity-40"
          >
            {tab === "filters"
              ? prefsSaving
                ? "Saving…"
                : "Save filters"
              : notifySaving
                ? "Saving…"
                : "Save alerts"}
          </button>
        </div>
      ) : (
        <div
          className="shrink-0 border-t border-white/8 bg-black/95 px-4 pt-3 backdrop-blur-xl"
          style={{ paddingBottom: "calc(var(--safe-bottom) + 14px)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full rounded-full border border-white/15 text-[15px] font-semibold text-white"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
