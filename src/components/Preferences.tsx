"use client";

import { useMemo, useState } from "react";
import { getBot } from "@/lib/bots";
import { titleCaseName } from "@/lib/notifications";
import {
  BOT_PREF_CONFIG,
  prunePref,
  sectionVisible,
} from "@/lib/preferences";
import type { BotId, BotPref, Preferences } from "@/lib/types";
import { BotMark } from "./BotMark";

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
      className={`min-h-[36px] rounded-[var(--radius-full)] border px-3 py-1.5 text-[13px] transition active:scale-[0.98] ${
        on
          ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
          : "border-[var(--hairline)] bg-transparent text-[var(--ink-muted)]"
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
        className="h-11 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--elevated)] px-3 text-[16px] outline-none placeholder:text-[var(--ink-faint)]"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!text.trim()}
        className="btn-secondary w-auto shrink-0 px-4 text-[13px]"
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
          <section key={config.botId} className="hairline-t pt-5 first:border-t-0 first:pt-0">
            <div className="mb-3 flex items-start gap-2.5">
              <BotMark id={bot?.id} size="sm" />
              <div className="min-w-0">
                <h3 className="text-[17px] font-semibold" style={{ color: bot?.color }}>
                  {titleCaseName(bot?.name ?? config.botId)}
                </h3>
                <p className="mt-0.5 text-[13px] leading-snug text-[var(--ink-muted)]">{config.blurb}</p>
              </div>
            </div>
            <div className="grid gap-4">
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
                    <p className="mb-2 text-[13px] font-medium text-[var(--ink-faint)]">{section.label}</p>
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
                <p className="mb-2 text-[13px] font-medium text-[var(--ink-faint)]">Keywords</p>
                <p className="mb-2 text-[13px] leading-relaxed text-[var(--ink-muted)]">
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
