"use client";

import { BOTS, getBot } from "@/lib/bots";
import { titleCaseName } from "@/lib/notifications";
import type { BotId } from "@/lib/types";
import { useStore } from "@/lib/store";
import { BotMark } from "./BotMark";

export function MembersSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { profile, toggleBot } = useStore();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70" onClick={onClose}>
      <div
        className="flex max-h-[88dvh] flex-col rounded-t-[24px] border-t border-white/10 bg-[#0a0a0a]"
        onClick={(event) => event.stopPropagation()}
        style={{ paddingBottom: "calc(var(--safe-bottom) + 12px)" }}
      >
        <div className="shrink-0 px-4 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="display text-[11px] font-black italic text-rose-300">Members</p>
              <h2 className="display text-[22px] font-black leading-none tracking-tight md:text-2xl">
                Who&apos;s in the chat
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-2 text-sm text-white active:opacity-70"
            >
              Done
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 no-scrollbar">
          <div className="grid gap-2 pb-2">
            {BOTS.map((bot) => {
              const on = profile?.enabledBots.includes(bot.id) ?? false;
              return (
                <div
                  key={bot.id}
                  className="flex items-center gap-2.5 rounded-xl border px-2.5 py-2.5 md:gap-3 md:rounded-2xl md:px-3 md:py-3"
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
                    <p className="text-[12px] leading-snug text-[var(--muted)] md:text-sm">
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
        </div>
        <p className="shrink-0 px-4 pt-2 text-center text-[11px] text-[var(--muted)]">
          {profile?.enabledBots.map((id) => titleCaseName(getBot(id)?.name ?? id)).join(", ") ||
            "Nobody yet"}{" "}
          · headlines only
        </p>
      </div>
    </div>
  );
}
