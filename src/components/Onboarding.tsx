"use client";

import { useState, type ReactNode } from "react";
import { BOTS } from "@/lib/bots";
import { defaultNotificationPrefs } from "@/lib/notifications";
import { defaultPreferences } from "@/lib/preferences";
import type { BotId, NotificationPrefs, Preferences } from "@/lib/types";
import { useStore } from "@/lib/store";
import { BotMark } from "./BotMark";
import { PreferencesEditor } from "./Preferences";
import { titleCaseName } from "@/lib/notifications";

function OnboardingFooter({ children }: { children: ReactNode }) {
  return (
    <div
      className="shrink-0 border-t border-white/[0.08] bg-[#07040a]/95 px-5 pt-3 backdrop-blur-xl"
      style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}
    >
      {children}
    </div>
  );
}

export function Onboarding() {
  const { completeOnboarding, enablePush, profile } = useStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [picked, setPicked] = useState<BotId[]>(["globie", "techie"]);
  const [prefs, setPrefs] = useState<Preferences>(
    profile?.preferences ?? defaultPreferences(),
  );
  const [notifications, setNotifications] = useState<NotificationPrefs>(
    profile?.notifications ?? defaultNotificationPrefs(),
  );
  const [busy, setBusy] = useState(false);

  function toggle(id: BotId) {
    setPicked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function finish() {
    if (picked.length === 0 || busy) return;
    setBusy(true);
    try {
      await enablePush().catch(() => false);
      await completeOnboarding(picked, prefs, notifications);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-bg flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-[calc(var(--safe-top)+28px)]">
        <p className="display text-[14px] font-black italic text-white/50">What&apos;s Up</p>
        <p className="mt-2 text-[11px] font-medium text-white/30">
          Step {step} of 3
        </p>
        {step === 1 ? (
          <>
            <h1 className="display mt-3 text-[32px] font-black leading-[0.95] tracking-tight sm:text-[36px]">
              Pick 2–3 bots to start.
            </h1>
            <p className="mt-3 text-[15px] leading-6 text-[var(--muted)]">
              Each one texts you directly when something big happens in their world.
            </p>
          </>
        ) : step === 2 ? (
          <>
            <h1 className="display mt-3 text-[32px] font-black leading-[0.95] tracking-tight sm:text-[36px]">
              Tell them what to watch.
            </h1>
            <p className="mt-3 text-[15px] leading-6 text-[var(--muted)]">
              Sporty can be NBA, a league, a club. The others work the same way.
            </p>
          </>
        ) : (
          <>
            <h1 className="display mt-3 text-[32px] font-black leading-[0.95] tracking-tight sm:text-[36px]">
              Get pinged like a DM.
            </h1>
            <p className="mt-3 text-[15px] leading-6 text-[var(--muted)]">
              Each bot can text your lock screen when they post. Timeline alerts stay off unless
              you want them.
            </p>
          </>
        )}
      </div>

      {step === 1 ? (
        <>
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pt-5">
            <div className="grid gap-2.5 pb-4">
              {BOTS.map((bot) => {
                const on = picked.includes(bot.id);
                return (
                  <button
                    key={bot.id}
                    type="button"
                    onClick={() => toggle(bot.id)}
                    className="flex items-center gap-3 rounded-2xl border px-3 py-3.5 text-left transition"
                    style={{
                      borderColor: on ? bot.color : "rgba(255,255,255,0.1)",
                      background: on ? bot.bubble : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <BotMark id={bot.id} size="md" />
                    <span className="min-w-0 flex-1">
                      <span
                        className="display block text-[16px] font-black tracking-tight"
                        style={{ color: on ? bot.color : "#fff7ed" }}
                      >
                        {titleCaseName(bot.name)}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-[var(--muted)]">
                        {bot.topic} · {bot.tagline}
                      </span>
                    </span>
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold"
                      style={{
                        background: on ? "#fff" : "transparent",
                        color: on ? "#000" : "#737373",
                        border: on ? "none" : "1px solid rgba(255,255,255,0.2)",
                      }}
                    >
                      {on ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <OnboardingFooter>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={picked.length === 0}
              className="h-12 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-30"
            >
              Next · Set filters
              {picked.length > 0 ? ` (${picked.length})` : ""}
            </button>
          </OnboardingFooter>
        </>
      ) : step === 2 ? (
        <>
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pt-4">
            <PreferencesEditor value={prefs} onChange={setPrefs} botIds={picked} />
          </div>
          <OnboardingFooter>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="h-12 w-full rounded-full bg-white text-sm font-semibold text-black"
              >
                Next · Notifications
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-10 w-full text-sm text-[var(--muted)]"
              >
                Back
              </button>
            </div>
          </OnboardingFooter>
        </>
      ) : (
        <>
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pt-5">
            <div className="grid gap-2">
              {picked.map((id) => {
                const bot = BOTS.find((row) => row.id === id);
                const on = notifications.bots[id] !== false;
                return (
                  <div
                    key={id}
                    className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3 py-3"
                  >
                    <BotMark id={id} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold" style={{ color: bot?.color }}>
                        {titleCaseName(bot?.name ?? id)}
                      </p>
                      <p className="text-[12px] text-white/40">DM-style alerts</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setNotifications((current) => ({
                          ...current,
                          bots: { ...current.bots, [id]: !on },
                        }))
                      }
                      className="h-8 w-12 shrink-0 rounded-full p-0.5"
                      style={{ background: on ? (bot?.color ?? "#fff") : "#2a2a2a" }}
                      aria-label={`${on ? "Disable" : "Enable"} ${bot?.name} alerts`}
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
            <p className="mt-5 text-[13px] leading-5 text-white/40">
              We&apos;ll ask for notification permission next. Add to Home Screen on iPhone for
              the best experience.
            </p>
          </div>
          <OnboardingFooter>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={finish}
                disabled={picked.length === 0 || busy}
                className="h-12 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40"
              >
                {busy ? "Checking headlines…" : "Allow alerts & start"}
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="h-10 w-full text-sm text-[var(--muted)]"
              >
                Back
              </button>
            </div>
          </OnboardingFooter>
        </>
      )}
    </div>
  );
}
