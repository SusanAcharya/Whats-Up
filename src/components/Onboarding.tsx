"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BOTS } from "@/lib/bots";
import { defaultNotificationPrefs } from "@/lib/notifications";
import { defaultPreferences } from "@/lib/preferences";
import type { BotId, NotificationPrefs, Preferences } from "@/lib/types";
import { useStore } from "@/lib/store";
import { BotMark } from "./BotMark";
import { PreferencesEditor } from "./Preferences";
import { titleCaseName } from "@/lib/notifications";
import { MetaLabel, PrimaryButton, ScreenTitle, StepProgress, Toggle } from "./ui";
import { springSoft } from "./motion";

function OnboardingFooter({ children }: { children: ReactNode }) {
  return (
    <div className="app-footer hairline-t shrink-0 px-5 pt-3">
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
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="app-header shrink-0 px-5 pb-4">
        <p className="text-[13px] font-medium text-[var(--ink-faint)]">What&apos;s Up</p>
        <div className="mt-4">
          <StepProgress step={step} total={3} />
        </div>
        {step === 1 ? (
          <>
            <ScreenTitle>
              <span className="mt-4 block">Pick 2–3 bots</span>
            </ScreenTitle>
            <MetaLabel>
              <span className="mt-2 block">Each one texts you when something big happens in their world.</span>
            </MetaLabel>
          </>
        ) : step === 2 ? (
          <>
            <ScreenTitle>
              <span className="mt-4 block">Pick your topics</span>
            </ScreenTitle>
            <MetaLabel>
              <span className="mt-2 block">Sporty can be NBA, a league, a club. Add keywords any bot should watch.</span>
            </MetaLabel>
          </>
        ) : (
          <>
            <ScreenTitle>
              <span className="mt-4 block">Lock screen alerts</span>
            </ScreenTitle>
            <MetaLabel>
              <span className="mt-2 block">
                Each bot can ping you like a DM. Timeline alerts stay off unless you want them.
              </span>
            </MetaLabel>
          </>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={springSoft}
        >
      {step === 1 ? (
        <>
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5">
            <div className="grid gap-2 pb-4">
              {BOTS.map((bot) => {
                const on = picked.includes(bot.id);
                return (
                  <button
                    key={bot.id}
                    type="button"
                    onClick={() => toggle(bot.id)}
                    className="flex min-h-[72px] items-center gap-3 rounded-[var(--radius-md)] border px-3 py-3 text-left transition active:scale-[0.99]"
                    style={{
                      borderColor: on ? bot.color : "var(--hairline)",
                      background: on ? "var(--elevated)" : "transparent",
                    }}
                  >
                    <BotMark id={bot.id} size="md" />
                    <span className="min-w-0 flex-1">
                      <span
                        className="block text-[17px] font-semibold leading-tight"
                        style={{ color: on ? bot.color : "var(--ink)" }}
                      >
                        {titleCaseName(bot.name)}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-[var(--ink-muted)]">
                        {bot.topic} · {bot.tagline}
                      </span>
                    </span>
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-[var(--radius-full)] text-[11px] font-semibold"
                      style={{
                        background: on ? "var(--ink)" : "transparent",
                        color: on ? "var(--canvas)" : "var(--ink-faint)",
                        border: on ? "none" : "1.5px solid var(--hairline-strong)",
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
            <PrimaryButton disabled={picked.length === 0} onClick={() => setStep(2)}>
              Next · Topics{picked.length > 0 ? ` (${picked.length})` : ""}
            </PrimaryButton>
          </OnboardingFooter>
        </>
      ) : step === 2 ? (
        <>
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5">
            <PreferencesEditor value={prefs} onChange={setPrefs} botIds={picked} />
          </div>
          <OnboardingFooter>
            <div className="grid gap-2">
              <PrimaryButton onClick={() => setStep(3)}>Next · Notifications</PrimaryButton>
              <button type="button" onClick={() => setStep(1)} className="btn-secondary">
                Back
              </button>
            </div>
          </OnboardingFooter>
        </>
      ) : (
        <>
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pt-2">
            <div className="grid gap-2">
              {picked.map((id) => {
                const bot = BOTS.find((row) => row.id === id);
                const on = notifications.bots[id] !== false;
                return (
                  <div
                    key={id}
                    className="flex min-h-[72px] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--elevated)] px-3 py-3"
                  >
                    <BotMark id={id} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold" style={{ color: bot?.color }}>
                        {titleCaseName(bot?.name ?? id)}
                      </p>
                      <p className="text-[13px] text-[var(--ink-faint)]">DM-style alerts</p>
                    </div>
                    <Toggle
                      label={`${on ? "Disable" : "Enable"} ${bot?.name} alerts`}
                      on={on}
                      onChange={(value) =>
                        setNotifications((current) => ({
                          ...current,
                          bots: { ...current.bots, [id]: value },
                        }))
                      }
                      accent={bot?.color}
                    />
                  </div>
                );
              })}
            </div>
            <p className="mt-5 text-[13px] leading-relaxed text-[var(--ink-faint)]">
              We&apos;ll ask for notification permission next. Add to Home Screen on iPhone for the best experience.
            </p>
          </div>
          <OnboardingFooter>
            <div className="grid gap-2">
              <PrimaryButton disabled={picked.length === 0 || busy} onClick={finish}>
                {busy ? "Checking headlines…" : "Allow alerts & start"}
              </PrimaryButton>
              <button type="button" onClick={() => setStep(2)} className="btn-secondary">
                Back
              </button>
            </div>
          </OnboardingFooter>
        </>
      )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
