"use client";

import { useEffect, useMemo, useState } from "react";
import { getBot } from "@/lib/bots";
import {
  BOT_PREF_CONFIG,
  defaultPreferences,
  prunePref,
  sectionVisible,
} from "@/lib/preferences";
import type { BotId, BotPref, Preferences } from "@/lib/types";
import { BotMark } from "./BotMark";
import { IconClose } from "./icons";

function Chip({
  on,
  label,
  onClick,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-[13px] tracking-tight transition active:scale-[0.98] ${
        on
          ? "border-white bg-white text-black"
          : "border-white/15 bg-transparent text-white/70"
      }`}
    >
      {label}
    </button>
  );
}

function CustomAdd({
  onAdd,
  label,
}: {
  onAdd: (value: string) => void;
  label: string;
}) {
  const [text, setText] = useState("");

  function submit() {
    const value = text.trim();
    if (!value) return;
    onAdd(value);
    setText("");
  }

  return (
    <div className="mt-2 flex gap-2">
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="add your own"
        aria-label={label}
        className="h-11 min-w-0 flex-1 rounded-full border border-white/12 bg-white/4 px-4 text-[16px] outline-none placeholder:text-white/30"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!text.trim()}
        className="h-11 shrink-0 rounded-full border border-white/20 px-4 text-[13px] disabled:opacity-30"
      >
        add
      </button>
    </div>
  );
}

export function PreferencesEditor({
  value,
  onChange,
  botIds,
}: {
  value: Preferences;
  onChange: (next: Preferences) => void;
  botIds: BotId[];
}) {
  const configs = useMemo(
    () =>
      BOT_PREF_CONFIG.filter((row) => botIds.includes(row.botId)).sort(
        (a, b) => botIds.indexOf(a.botId) - botIds.indexOf(b.botId),
      ),
    [botIds],
  );

  function update(botId: BotId, nextPref: BotPref) {
    onChange({
      ...value,
      [botId]: prunePref(botId, nextPref),
    });
  }

  function toggle(botId: BotId, key: keyof BotPref, id: string) {
    const pref = value[botId];
    const list = pref[key];
    const nextList = list.includes(id)
      ? list.filter((item) => item !== id)
      : [...list, id];
    update(botId, { ...pref, [key]: nextList });
  }

  return (
    <div className="grid gap-6 pb-4 pt-2">
      {configs.map((config) => {
        const bot = getBot(config.botId);
        const pref = value[config.botId];
        return (
          <section key={config.botId} className="border-t border-white/8 pt-5 first:border-t-0 first:pt-0">
            <div className="mb-3 flex items-start gap-2.5">
              <BotMark id={bot?.id} size="sm" />
              <div className="min-w-0">
                <h3
                  className="display text-[16px] font-black tracking-tight md:text-[18px]"
                  style={{ color: bot?.color }}
                >
                  {bot?.name}
                </h3>
                <p className="mt-0.5 text-[12px] leading-snug text-[var(--muted)] md:text-[13px]">
                  {config.blurb}
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:gap-5">
              {config.sections.map((section, index) => {
                if (!sectionVisible(section, pref)) return null;
                const selected = pref[section.key];
                const customOnly = selected.filter(
                  (id) =>
                    !config.sections.some((row) =>
                      row.options.some((option) => option.id === id),
                    ),
                );
                const showCustomChips =
                  section.allowCustom &&
                  config.sections.find(
                    (row) => row.allowCustom && sectionVisible(row, pref),
                  ) === section;
                return (
                  <div key={`${config.botId}-${section.key}-${index}`}>
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">
                      {section.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {section.options.map((option) => (
                        <Chip
                          key={option.id}
                          on={selected.includes(option.id)}
                          label={option.label}
                          onClick={() => toggle(config.botId, section.key, option.id)}
                        />
                      ))}
                      {showCustomChips
                        ? customOnly.map((id) => (
                            <Chip
                              key={id}
                              on
                              label={id.replace(/-/g, " ")}
                              onClick={() => toggle(config.botId, section.key, id)}
                            />
                          ))
                        : null}
                    </div>
                    {section.allowCustom ? (
                      <CustomAdd
                        label={`add ${section.label.toLowerCase()} for ${bot?.name ?? config.botId}`}
                        onAdd={(raw) => {
                          const id = raw.toLowerCase().replace(/\s+/g, "-").slice(0, 40);
                          if (!id || selected.includes(id)) return;
                          update(config.botId, {
                            ...pref,
                            [section.key]: [...selected, id],
                          });
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">
                  Keywords
                </p>
                <p className="mb-2 text-[12px] leading-5 text-[var(--muted)]">
                  Only stories that hit these words make the feed.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(pref.keywords ?? []).map((word) => (
                    <Chip
                      key={word}
                      on
                      label={word}
                      onClick={() => toggle(config.botId, "keywords", word)}
                    />
                  ))}
                </div>
                <CustomAdd
                  label={`add keyword for ${bot?.name ?? config.botId}`}
                  onAdd={(raw) => {
                    const word = raw.trim().toLowerCase().slice(0, 40);
                    if (!word || (pref.keywords ?? []).includes(word)) return;
                    update(config.botId, {
                      ...pref,
                      keywords: [...(pref.keywords ?? []), word],
                    });
                  }}
                />
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function PreferencesScreen({
  open,
  botIds,
  initial,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  botIds: BotId[];
  initial?: Preferences;
  saving?: boolean;
  onClose: () => void;
  onSave: (prefs: Preferences) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Preferences>(initial ?? defaultPreferences());

  useEffect(() => {
    if (open) setDraft(initial ?? defaultPreferences());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black">
      <header
        className="shrink-0 border-b border-white/8 px-4 pb-3 md:px-5 md:pb-4"
        style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="display text-[11px] font-black italic text-rose-300 md:text-[12px]">
              filters
            </p>
            <h2 className="display mt-0.5 text-[24px] font-black leading-none tracking-tight md:mt-1 md:text-[28px]">
              preferences
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/12 text-white active:bg-white/[0.08]"
            aria-label="close"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-2 no-scrollbar md:px-5">
        <p className="pt-2 text-[14px] leading-6 text-[var(--muted)] md:pt-4">
          Each desk only posts stories that match your keywords. Add a team, a ticker, a country — then save.
        </p>
        <PreferencesEditor value={draft} onChange={setDraft} botIds={botIds} />
      </div>
      <div
        className="shrink-0 border-t border-white/8 bg-black/95 px-4 pt-3 backdrop-blur-xl md:px-5"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 14px)" }}
      >
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            await onSave(draft);
          }}
          className="h-12 w-full rounded-full bg-white text-[15px] font-semibold text-black disabled:opacity-40"
        >
          {saving ? "saving..." : "save preferences"}
        </button>
      </div>
    </div>
  );
}
