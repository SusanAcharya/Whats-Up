import { BOT_IDS, type BotId, type NotificationPrefs } from "./types";

export function defaultNotificationPrefs(): NotificationPrefs {
  return {
    timeline: false,
    bots: Object.fromEntries(BOT_IDS.map((id) => [id, true])) as Record<BotId, boolean>,
  };
}

export function normalizeNotificationPrefs(raw: unknown): NotificationPrefs {
  const defaults = defaultNotificationPrefs();
  if (!raw || typeof raw !== "object") return defaults;
  const input = raw as Partial<NotificationPrefs>;
  const bots = { ...defaults.bots };
  if (input.bots && typeof input.bots === "object") {
    for (const id of BOT_IDS) {
      if (typeof input.bots[id] === "boolean") bots[id] = input.bots[id]!;
    }
  }
  return {
    timeline: typeof input.timeline === "boolean" ? input.timeline : false,
    bots,
  };
}

/** Bot DMs notify by default; timeline is off unless explicitly enabled. */
export function shouldNotifyBot(prefs: NotificationPrefs | undefined, botId: BotId) {
  const normalized = prefs ?? defaultNotificationPrefs();
  return normalized.bots[botId] !== false;
}

export function shouldNotifyTimeline(prefs: NotificationPrefs | undefined) {
  return (prefs ?? defaultNotificationPrefs()).timeline === true;
}

export function titleCaseName(name: string) {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function sentenceCase(text: string) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
