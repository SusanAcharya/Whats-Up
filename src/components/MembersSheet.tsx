"use client";

import { BOTS, getBot } from "@/lib/bots";
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
    <div className="absolute inset-0 z-30 flex flex-col bg-black/70" onClick={onClose}>
      <div
        className="mt-auto rounded-t-[28px] border-t border-white/10 bg-[#0a0a0a] px-4 pb-[calc(var(--safe-bottom)+16px)] pt-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="display text-[12px] font-black italic text-rose-300">members</p>
            <h2 className="display text-2xl font-black tracking-tight">who&apos;s in the chat</h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-white">
            done
          </button>
        </div>
        <div className="grid gap-2">
          {BOTS.map((bot) => {
            const on = profile?.enabledBots.includes(bot.id) ?? false;
            return (
              <div
                key={bot.id}
                className="flex items-center gap-3 rounded-2xl border px-3 py-3"
                style={{
                  background: on ? bot.bubble : "#111",
                  borderColor: on ? bot.color : "rgba(255,255,255,0.08)",
                }}
              >
                <BotMark id={bot.id} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="display font-black tracking-tight" style={{ color: on ? bot.color : "#fff7ed" }}>
                    {bot.name}
                  </p>
                  <p className="truncate text-sm text-[var(--muted)]">
                    {bot.topic} · {bot.tagline}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleBot(bot.id as BotId, !on)}
                  className="h-7 w-12 rounded-full p-0.5 transition"
                  style={{ background: on ? bot.color : "#2a2a2a" }}
                  aria-label={`${on ? "remove" : "add"} ${bot.name}`}
                >
                  <span
                    className="block h-6 w-6 rounded-full transition"
                    style={{
                      transform: on ? "translateX(20px)" : "translateX(0)",
                      background: on ? "#000" : "#fff",
                    }}
                  />
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-[var(--muted)]">
          {profile?.enabledBots.map((id) => getBot(id)?.name).join(", ") || "nobody yet"} · headlines only
        </p>
      </div>
    </div>
  );
}
