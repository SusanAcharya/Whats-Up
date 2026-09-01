"use client";

import { useState, type ReactNode } from "react";
import { BOTS } from "@/lib/bots";
import { defaultPreferences } from "@/lib/preferences";
import type { BotId, Preferences } from "@/lib/types";
import { useStore } from "@/lib/store";
import { BotMark } from "./BotMark";
import { PreferencesEditor } from "./Preferences";
import { titleCaseName } from "@/lib/notifications";

function OnboardingFooter({
  children,
}: {
  children: ReactNode;
}) {
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
  const [step, setStep] = useState<1 | 2>(1);
  const [picked, setPicked] = useState<BotId[]>(["globie", "techie"]);
  const [prefs, setPrefs] = useState<Preferences>(
    profile?.preferences ?? defaultPreferences(),
  );
  const [busy, setBusy] = useState(false);

  function toggle(id: BotId) {
    setPicked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function start() {
    if (picked.length === 0 || busy) return;
    setBusy(true);
    try {
      await enablePush().catch(() => false);
      await completeOnboarding(picked, prefs);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-bg flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden">
      <div
        className="shrink-0 px-5 pt-[calc(var(--safe-top)+28px)]"
      >
        <p className="display text-[14px] font-black italic text-rose-300">What&apos;s Up</p>
        {step === 1 ? (
          <>
            <h1 className="display mt-4 text-[32px] font-black leading-[0.95] tracking-tight sm:text-[36px]">
              Only the news you&apos;d actually text about.
            </h1>
            <p className="mt-3 text-[15px] leading-6 text-[var(--muted)]">
              Pick desks. Then tell each one the keywords to watch — a team, a ticker, a country.
              Only those flashes come through.
            </p>
          </>
        ) : (
          <>
            <h1 className="display mt-4 text-[32px] font-black leading-[0.95] tracking-tight sm:text-[36px]">
              Tell them what to watch.
            </h1>
            <p className="mt-3 text-[15px] leading-6 text-[var(--muted)]">
              Sporty can be NBA, a league, a club. The others work the same way. Save when it looks
              right.
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
              next · Set filters
              {picked.length > 0 ? ` (${picked.length})` : ""}
            </button>
          </OnboardingFooter>
        </>
      ) : (
        <>
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pt-4">
            <PreferencesEditor value={prefs} onChange={setPrefs} botIds={picked} />
          </div>

          <OnboardingFooter>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={start}
                disabled={picked.length === 0 || busy}
                className="h-12 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40"
              >
                {busy ? "Catching you up…" : "Save preferences"}
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
      )}
    </div>
  );
}
