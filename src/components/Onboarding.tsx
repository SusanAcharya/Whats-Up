"use client";

import { useState } from "react";
import { BOTS } from "@/lib/bots";
import { defaultPreferences } from "@/lib/preferences";
import type { BotId, Preferences } from "@/lib/types";
import { useStore } from "@/lib/store";
import { BotMark } from "./BotMark";
import { PreferencesEditor } from "./Preferences";

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
    <div className="chat-bg mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden px-5 pb-8 pt-[calc(var(--safe-top)+28px)]">
      <p className="display text-[14px] font-black italic text-rose-300">what&apos;s up</p>
      {step === 1 ? (
        <>
          <h1 className="display mt-4 text-[36px] font-black tracking-tight leading-[0.95]">
            only the news you&apos;d actually text about.
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-[var(--muted)]">
            pick desks. then tell each one the keywords to watch — a team, a ticker, a country. only those flashes come through.
          </p>

          <div className="no-scrollbar mt-6 min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-2 pb-4">
            {BOTS.map((bot) => {
              const on = picked.includes(bot.id);
              return (
                <button
                  key={bot.id}
                  type="button"
                  onClick={() => toggle(bot.id)}
                  className="flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition"
                  style={{
                    borderColor: on ? bot.color : "rgba(255,255,255,0.1)",
                    background: on ? bot.bubble : "transparent",
                  }}
                >
                  <BotMark id={bot.id} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="display block text-[16px] font-black tracking-tight" style={{ color: on ? bot.color : "#fff7ed" }}>
                      {bot.name}
                    </span>
                    <span className="block truncate text-sm text-[var(--muted)]">
                      {bot.topic} · {bot.tagline}
                    </span>
                  </span>
                  <span
                    className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold"
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

          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={picked.length === 0}
            className="mt-4 h-12 shrink-0 rounded-full bg-white text-sm font-medium text-black disabled:opacity-30"
          >
            next · set filters
          </button>
        </>
      ) : (
        <>
          <h1 className="display mt-4 text-[36px] font-black tracking-tight leading-[0.95]">
            tell them what to watch.
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-[var(--muted)]">
            sporty can be NBA, a league, a club. the others work the same way. save when it looks right.
          </p>
          <div className="no-scrollbar mt-2 min-h-0 flex-1 overflow-y-auto pb-4">
            <PreferencesEditor value={prefs} onChange={setPrefs} botIds={picked} />
          </div>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={start}
              disabled={picked.length === 0 || busy}
              className="h-12 rounded-full bg-white text-sm font-medium text-black disabled:opacity-40"
            >
              {busy ? "catching you up..." : "save preferences"}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="h-10 text-sm text-[var(--muted)]"
            >
              back
            </button>
          </div>
        </>
      )}
    </div>
  );
}
