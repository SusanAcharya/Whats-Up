export const BOT_IDS = [
  "globie",
  "sporty",
  "techie",
  "popcorn",
  "stonks",
  "labrat",
  "pitch",
] as const;

export type BotId = (typeof BOT_IDS)[number];

export type ChatType = "group" | "dm";
export type MessageKind = "news" | "chat" | "system";

export type BotPref = {
  sports: string[];
  leagues: string[];
  teams: string[];
  topics: string[];
  keywords: string[];
};

export type Preferences = Record<BotId, BotPref>;

export type Bot = {
  id: BotId;
  name: string;
  handle: string;
  emoji: string;
  topic: string;
  color: string;
  bubble: string;
  tagline: string;
  vibe: string;
  feeds: string[];
  mustInclude?: string[];
  exclude?: string[];
  boost?: string[];
};

export type Chat = {
  id: string;
  type: ChatType;
  botId?: BotId;
  title: string;
  lastMessage: string;
  lastMessageAt: number;
  unread: number;
};

export type ChatMessage = {
  id: string;
  chatId: string;
  sender: "user" | BotId;
  text: string;
  createdAt: number;
  kind: MessageKind;
  articleUrl?: string;
  articleTitle?: string;
  imageUrl?: string;
  matchedKeywords?: string[];
  sources?: string[];
  flash?: "now" | "soon" | "recent";
};

export type UserProfile = {
  displayName: string;
  enabledBots: BotId[];
  onboarded: boolean;
  createdAt: number;
  lastIngestAt?: number;
  pushEnabled?: boolean;
  preferences: Preferences;
  notifications?: NotificationPrefs;
};

export type NotificationPrefs = {
  /** Group timeline pushes. Default false. */
  timeline: boolean;
  /** Per-bot DM-style pushes. Default true for each bot. */
  bots: Partial<Record<BotId, boolean>>;
};

export type IngestItem = {
  botId: BotId;
  groupText: string;
  dmText: string | null;
  sendDm: boolean;
  title: string;
  url: string;
  source: string;
  imageUrl?: string;
  matchedKeywords: string[];
  sources: string[];
  flash: "now" | "soon" | "recent";
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export type IngestStats = {
  headlinesChecked: number;
  keywordMatched: number;
  gatePassed: number;
  posted: number;
  skippedDuplicate: number;
};

export type IngestResult = {
  stats: IngestStats;
  postedBotIds: BotId[];
};
