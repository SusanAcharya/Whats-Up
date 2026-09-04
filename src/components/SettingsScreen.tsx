"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import { BOTS, getBot } from "@/lib/bots";
import { TIMELINE_ACCENT } from "@/lib/design";
import {
  normalizeNotificationPrefs,
  titleCaseName,
} from "@/lib/notifications";
import { defaultPreferences } from "@/lib/preferences";
import { useStore } from "@/lib/store";
import type { BotId, NotificationPrefs, Preferences } from "@/lib/types";
import { BotMark } from "./BotMark";
import { PreferencesEditor } from "./Preferences";
import { Backdrop, SheetPanel } from "./motion";
import {
  PrimaryButton,
  SegmentedControl,
  SheetHeader,
  Toggle,
} from "./ui";
import { IconBell, IconHash, IconPeople } from "./icons";

type Tab = "alerts" | "topics" | "bots";

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
  return (
    <AnimatePresence>
      {open ? (
        <>
          <Backdrop onClose={onClose} className="fixed inset-0 z-40 bg-black/50 md:bg-black/40" />
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
        </>
      ) : null}
    </AnimatePresence>
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
  const [botToast, setBotToast] = useState<string | null>(null);

  const prefBots = enabledBots.length > 0 ? enabledBots : profile?.enabledBots ?? [];

  async function handleBotToggle(id: BotId, on: boolean) {
    const bot = getBot(id);
    await toggleBot(id, !on);
    setBotToast(`${!on ? "Added" : "Removed"} ${titleCaseName(bot?.name ?? id)}`);
    window.setTimeout(() => setBotToast(null), 2000);
  }

  function setBotNotify(id: BotId, value: boolean) {
    setNotifyDraft((current) => ({
      ...current,
      bots: { ...current.bots, [id]: value },
    }));
  }

  const tabs: { id: Tab; label: ReactNode }[] = [
    {
      id: "alerts",
      label: (
        <span className="inline-flex items-center gap-1.5">
          <IconBell className="h-3.5 w-3.5" />
          Alerts
        </span>
      ),
    },
    {
      id: "topics",
      label: (
        <span className="inline-flex items-center gap-1.5">
          <IconHash className="h-3.5 w-3.5" />
          Topics
        </span>
      ),
    },
    {
      id: "bots",
      label: (
        <span className="inline-flex items-center gap-1.5">
          <IconPeople className="h-3.5 w-3.5" />
          Bots
        </span>
      ),
    },
  ];

  return (
    <SheetPanel className="screen-panel fixed inset-0 z-50 flex flex-col overflow-hidden md:inset-y-0 md:left-auto md:w-[380px] md:border-l md:border-[var(--hairline)]">
      <SheetHeader title="Settings" onClose={onClose}>
        <SegmentedControl tabs={tabs} active={tab} onChange={setTab} />
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 no-scrollbar">
        {botToast ? (
          <p className="mb-3 rounded-[var(--radius-md)] bg-[var(--elevated)] px-3 py-2 text-center text-[13px] text-[var(--ink-muted)]">
            {botToast}
          </p>
        ) : null}

        {tab === "alerts" ? (
          <>
            <p className="text-[15px] leading-relaxed text-[var(--ink-muted)]">
              Alerts look like a DM from each bot. Timeline alerts are off by default.
            </p>
            {!pushEnabled ? (
              <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--elevated)] px-4 py-3">
                <p className="text-[13px] leading-relaxed text-[var(--ink-muted)]">
                  System notifications are off. Turn them on for lock screen alerts.
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
                  className="btn-primary mt-3 min-h-[44px] text-[14px]"
                >
                  {pushBusy ? "Asking…" : "Allow notifications"}
                </button>
              </div>
            ) : null}
            <section className="mt-6">
              <p className="mb-2 text-[13px] font-medium text-[var(--ink-faint)]">Group</p>
              <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--elevated)] px-3 py-3">
                <BotMark id="group" size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">The timeline</p>
                  <p className="text-[13px] text-[var(--ink-faint)]">Group chat alerts</p>
                </div>
                <Toggle
                  label="timeline notifications"
                  on={notifyDraft.timeline}
                  onChange={(value) =>
                    setNotifyDraft((current) => ({ ...current, timeline: value }))
                  }
                  accent={TIMELINE_ACCENT}
                />
              </div>
            </section>
            <section className="mt-5">
              <p className="mb-2 text-[13px] font-medium text-[var(--ink-faint)]">Direct messages</p>
              <div className="grid gap-2">
                {prefBots.map((id) => {
                  const bot = getBot(id);
                  const on = notifyDraft.bots[id] !== false;
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--elevated)] px-3 py-3"
                    >
                      <BotMark id={id} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold" style={{ color: bot?.color ?? "var(--ink)" }}>
                          {titleCaseName(bot?.name ?? id)}
                        </p>
                        <p className="truncate text-[13px] text-[var(--ink-faint)]">{bot?.handle}</p>
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

        {tab === "topics" ? (
          <>
            <p className="text-[15px] leading-relaxed text-[var(--ink-muted)]">
              Add topics or keywords per bot. Saved words drive DMs and timeline posts — tap a chip
              to remove it.
            </p>
            <button
              type="button"
              onClick={() => {
                const defaults = defaultPreferences();
                setPrefsDraft((current) => {
                  const next = { ...current };
                  for (const id of prefBots) next[id] = { ...defaults[id] };
                  return next;
                });
              }}
              className="mt-3 mb-1 text-[13px] font-medium text-[#0a84ff] active:opacity-70"
            >
              Apply recommended topics
            </button>
            <PreferencesEditor value={prefsDraft} onChange={setPrefsDraft} botIds={prefBots} />
          </>
        ) : null}

        {tab === "bots" ? (
          <>
            <p className="mb-4 text-[15px] leading-relaxed text-[var(--ink-muted)]">
              Toggle bots on or off. Only enabled bots check headlines and can DM you.
            </p>
            <div className="grid gap-2">
              {BOTS.map((bot) => {
                const on = profile?.enabledBots.includes(bot.id) ?? false;
                return (
                  <div
                    key={bot.id}
                    className="flex items-center gap-2.5 rounded-[var(--radius-md)] border px-2.5 py-2.5"
                    style={{
                      background: on ? "var(--elevated)" : "transparent",
                      borderColor: on ? bot.color : "var(--hairline)",
                    }}
                  >
                    <BotMark id={bot.id} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold" style={{ color: on ? bot.color : "var(--ink)" }}>
                        {titleCaseName(bot.name)}
                      </p>
                      <p className="text-[12px] leading-snug text-[var(--ink-muted)]">
                        {bot.topic} · {bot.tagline}
                      </p>
                    </div>
                    <Toggle
                      label={`${on ? "Remove" : "Add"} ${bot.name}`}
                      on={on}
                      onChange={() => handleBotToggle(bot.id as BotId, on)}
                      accent={bot.color}
                    />
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      <div className="app-footer hairline-t shrink-0 px-4 pt-3">
        {tab !== "bots" ? (
          <PrimaryButton
            disabled={tab === "topics" ? prefsSaving : notifySaving}
            onClick={async () => {
              if (tab === "topics") await onSavePrefs(prefsDraft);
              else await onSaveNotifications(normalizeNotificationPrefs(notifyDraft));
            }}
          >
            {tab === "topics"
              ? prefsSaving
                ? "Saving…"
                : "Save topics"
              : notifySaving
                ? "Saving…"
                : "Save alerts"}
          </PrimaryButton>
        ) : (
          <button type="button" onClick={onClose} className="btn-secondary">
            Done
          </button>
        )}
      </div>
    </SheetPanel>
  );
}
