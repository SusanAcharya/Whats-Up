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
import { IconHash } from "./icons";

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

function KeywordComposer({
  onAdd,
  placeholder,
  accent,
}: {
  onAdd: (value: string) => void;
  placeholder: string;
  accent?: string;
}) {
  const [text, setText] = useState("");

  function submit() {
    const value = text.trim();
    if (!value) return;
    onAdd(value);
    setText("");
  }

  return (
    <div
      className="flex items-center gap-2 rounded-[var(--radius-md)] border p-1.5"
      style={{
        borderColor: accent ? `${accent}55` : "var(--hairline)",
        background: "var(--elevated)",
      }}
    >
      <span
        className="grid h-10 w-9 shrink-0 place-items-center text-[var(--ink-faint)]"
        aria-hidden
      >
        <IconHash className="h-4 w-4" />
      </span>
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="h-10 min-w-0 flex-1 bg-transparent px-1 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
        style={{ width: 0 }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={!text.trim()}
        className="h-10 shrink-0 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3.5 text-[13px] font-semibold text-[var(--ink)] disabled:opacity-35"
      >
        Save
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

  function addKeyword(botId: BotId, raw: string) {
    const word = raw.trim().toLowerCase().slice(0, 40);
    const pref = value[botId];
    if (!word || (pref.keywords ?? []).includes(word)) return;
    update(botId, {
      ...pref,
      keywords: [...(pref.keywords ?? []), word],
    });
  }

  return (
    <div className="grid gap-6 pb-4 pt-2">
      {configs.map((config) => {
        const bot = getBot(config.botId);
        const pref = value[config.botId];
        const keywords = pref.keywords ?? [];
        return (
          <section key={config.botId} className="hairline-t pt-5 first:border-t-0 first:pt-0">
            <div className="mb-4 flex items-start gap-2.5">
              <BotMark id={bot?.id} size="sm" />
              <div className="min-w-0">
                <h3 className="text-[17px] font-semibold" style={{ color: bot?.color }}>
                  {titleCaseName(bot?.name ?? config.botId)}
                </h3>
                <p className="mt-0.5 text-[13px] leading-snug text-[var(--ink-muted)]">{config.blurb}</p>
              </div>
            </div>

            <div className="mb-5 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--panel)] p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <IconHash className="h-3.5 w-3.5 text-[var(--ink-faint)]" />
                <p className="text-[13px] font-semibold text-[var(--ink)]">Your topics</p>
              </div>
              <p className="mb-3 text-[13px] leading-relaxed text-[var(--ink-muted)]">
                Add words or phrases. {titleCaseName(bot?.name ?? "This bot")} will DM and post when
                headlines hit them.
              </p>
              <KeywordComposer
                accent={bot?.color}
                placeholder={`e.g. nvidia, gaza, arsenal…`}
                onAdd={(raw) => addKeyword(config.botId, raw)}
              />
              {keywords.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {keywords.map((word) => (
                    <Chip
                      key={word}
                      on
                      label={word}
                      onClick={() => toggle(config.botId, "keywords", word)}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[12px] text-[var(--ink-faint)]">No custom topics yet.</p>
              )}
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
                      <div className="mt-2">
                        <KeywordComposer
                          placeholder={`add custom ${section.label.toLowerCase()}`}
                          onAdd={(raw) => {
                            const id = raw.toLowerCase().replace(/\s+/g, "-").slice(0, 40);
                            if (!id || selected.includes(id)) return;
                            update(config.botId, {
                              ...pref,
                              [section.key]: [...selected, id],
                            });
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
