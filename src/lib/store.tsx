"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  limit,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { auth, db, firebaseReady, requireDb } from "./firebase";
import { sendPushToSubscription } from "@/app/actions";
import { BOTS, GROUP_CHAT_ID, botFromChatId, dmChatId, getBot, isBotId } from "./bots";
import { isDuplicateTitle } from "./dedupe";
import { haystackOf, keywordRules, matchKeywords } from "./match";
import {
  defaultPreferences,
  normalizePreferences,
  prunePreferences,
} from "./preferences";
import {
  defaultNotificationPrefs,
  normalizeNotificationPrefs,
  shouldNotifyBot,
  shouldNotifyTimeline,
  titleCaseName,
} from "./notifications";
import { isFreshNews, newsCutoff } from "./retention";
import type {
  BotId,
  Chat,
  ChatMessage,
  IngestItem,
  IngestResult,
  IngestStats,
  MessageKind,
  NotificationPrefs,
  Preferences,
  UserProfile,
} from "./types";

type Backend = "firebase" | "local";

type LocalState = {
  uid: string;
  profile: UserProfile;
  chats: Chat[];
  messages: Record<string, ChatMessage[]>;
  seen: { id: string; url: string; botId: BotId; title?: string; createdAt?: number }[];
};

const LOCAL_KEY = "update-me-v1";

type StoreValue = {
  ready: boolean;
  backend: Backend;
  uid: string | null;
  profile: UserProfile | null;
  chats: Chat[];
  messages: ChatMessage[];
  flashNews: ChatMessage[];
  selectedChatId: string | null;
  ingesting: boolean;
  sending: boolean;
  error: string | null;
  lastIngestResult: IngestResult | null;
  selectChat: (id: string | null) => void;
  markAllRead: () => Promise<void>;
  messagesLoading: boolean;
  completeOnboarding: (
    bots: BotId[],
    preferences?: Preferences,
    notifications?: NotificationPrefs,
  ) => Promise<IngestResult | null>;
  toggleBot: (botId: BotId, enabled: boolean) => Promise<void>;
  ingest: (
    reason?: "open" | "manual" | "member",
    bots?: BotId[],
    prefs?: Preferences,
  ) => Promise<IngestResult | null>;
  sendMessage: (text: string) => Promise<void>;
  enablePush: () => Promise<boolean>;
  savePreferences: (next: Preferences) => Promise<void>;
  saveNotifications: (next: NotificationPrefs) => Promise<void>;
  dismissIngestBanner: () => void;
  askBot: (botId: BotId, draft?: string) => void;
  clearComposerSeed: () => void;
  composerSeed: { chatId: string; text: string } | null;
};

const StoreContext = createContext<StoreValue | null>(null);

function seenId(url: string) {
  try {
    return btoa(unescape(encodeURIComponent(url)))
      .replace(/[+/=]/g, "")
      .slice(0, 80);
  } catch {
    return `u${url.length}${Date.now()}`;
  }
}

function emptyLocal(): LocalState {
  const uid =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `local-${Date.now()}`;
  return {
    uid,
    profile: {
      displayName: "You",
      enabledBots: [],
      onboarded: false,
      createdAt: Date.now(),
      preferences: defaultPreferences(),
      notifications: defaultNotificationPrefs(),
    },
    chats: [
      {
        id: GROUP_CHAT_ID,
        type: "group",
        title: "The timeline",
        lastMessage: "add members and the news starts texting you",
        lastMessageAt: Date.now(),
        unread: 0,
      },
    ],
    messages: { [GROUP_CHAT_ID]: [] },
    seen: [],
  };
}

function readLocal(): LocalState {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) {
      const fresh = emptyLocal();
      localStorage.setItem(LOCAL_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw) as LocalState;
    return pruneLocalState({
      ...parsed,
      profile: {
        ...parsed.profile,
        preferences: normalizePreferences(parsed.profile?.preferences),
      },
    });
  } catch {
    return emptyLocal();
  }
}

function writeLocal(state: LocalState) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
}

function pruneLocalState(state: LocalState): LocalState {
  const cutoff = newsCutoff();
  const messages = Object.fromEntries(
    Object.entries(state.messages).map(([id, rows]) => [
      id,
      rows.filter((row) => row.kind !== "news" || row.createdAt >= cutoff),
    ]),
  );
  return {
    ...state,
    messages,
    seen: state.seen.filter((row) => (row.createdAt ?? Date.now()) >= cutoff),
  };
}

function stringList(value: unknown, max = 12): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows = value.map((item) => String(item).trim()).filter(Boolean).slice(0, max);
  return rows.length ? rows : undefined;
}

function stillMatches(message: ChatMessage, preferences?: UserProfile["preferences"]) {
  if (message.kind !== "news" || !preferences) return true;
  if (!isBotId(message.sender)) return true;
  if (!isFreshNews(message.createdAt)) return false;
  const pref = preferences[message.sender];
  const rules = keywordRules(message.sender, pref);
  if (rules.length === 0) return Boolean(message.matchedKeywords?.length);
  const text = haystackOf([message.articleTitle, message.text, ...(message.matchedKeywords ?? [])]);
  return matchKeywords(text, rules).length > 0;
}

/** Prefer title+bot so broken shared CDN URLs don't collapse the Flash deck. */
function newsDedupeKey(row: {
  sender: string;
  articleUrl?: string;
  articleTitle?: string;
  text?: string;
  id?: string;
}) {
  const title = (row.articleTitle || row.text || "").trim().toLowerCase().slice(0, 120);
  if (title) return `${row.sender}:${title}`;
  const url = (row.articleUrl || "").toLowerCase();
  if (url && !url.includes("googleusercontent.com") && !/=w\d{1,3}/i.test(url)) return url;
  return (row.id || `${row.sender}:${url}`).toLowerCase();
}

function millis(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object") {
    if ("toMillis" in value && typeof (value as { toMillis: () => number }).toMillis === "function") {
      return (value as { toMillis: () => number }).toMillis();
    }
    const seconds = (value as { seconds?: number; _seconds?: number }).seconds
      ?? (value as { _seconds?: number })._seconds;
    if (typeof seconds === "number") {
      const nanos =
        (value as { nanoseconds?: number; _nanoseconds?: number }).nanoseconds
        ?? (value as { _nanoseconds?: number })._nanoseconds
        ?? 0;
      return seconds * 1000 + Math.floor(nanos / 1e6);
    }
  }
  return Date.now();
}

function preview(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 400);
}

function messageFromDoc(chatId: string, id: string, data: Record<string, unknown>): ChatMessage {
  return {
    id,
    chatId,
    sender:
      data.sender === "user"
        ? "user"
        : typeof data.sender === "string" && isBotId(data.sender)
          ? data.sender
          : "globie",
    text: typeof data.text === "string" ? data.text : "",
    createdAt: millis(data.createdAt),
    kind: (data.kind ?? "chat") as MessageKind,
    articleUrl: typeof data.articleUrl === "string" ? data.articleUrl : undefined,
    articleTitle: typeof data.articleTitle === "string" ? data.articleTitle : undefined,
    summary: typeof data.summary === "string" ? data.summary : undefined,
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
    matchedKeywords: stringList(data.matchedKeywords),
    sources: stringList(data.sources),
    flash:
      data.flash === "now" || data.flash === "soon" || data.flash === "recent"
        ? data.flash
        : undefined,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [backend, setBackend] = useState<Backend>("local");
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messageMap, setMessageMap] = useState<Record<string, ChatMessage[]>>({});
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastIngestResult, setLastIngestResult] = useState<IngestResult | null>(null);
  const [composerSeed, setComposerSeed] = useState<{ chatId: string; text: string } | null>(null);
  const [hydratedChats, setHydratedChats] = useState<Set<string>>(() => new Set());
  const selectedRef = useRef<string | null>(null);
  const ingestingRef = useRef(false);
  const skipNextOpenIngestRef = useRef(false);
  const lastNewsRef = useRef<Record<string, { title: string; text: string }>>({});
  const hydratedDmRef = useRef(new Set<string>());
  const localRef = useRef<LocalState | null>(null);
  const pushSubRef = useRef<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
  } | null>(null);

  useEffect(() => {
    selectedRef.current = selectedChatId;
  }, [selectedChatId]);

  useEffect(() => {
    if (!ready || !profile?.pushEnabled) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        const json = sub?.toJSON();
        if (json?.endpoint && json.keys?.p256dh && json.keys?.auth) {
          pushSubRef.current = {
            endpoint: json.endpoint,
            keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          };
        }
      } catch {
        // push restore optional
      }
    })();
  }, [profile?.pushEnabled, ready]);

  const persistLocal = useCallback((next: LocalState) => {
    const pruned = pruneLocalState(next);
    localRef.current = pruned;
    writeLocal(pruned);
    setUid(pruned.uid);
    setProfile(pruned.profile);
    setChats(
      [...pruned.chats].sort((a, b) => b.lastMessageAt - a.lastMessageAt),
    );
    setMessageMap(pruned.messages);
    setHydratedChats((prev) => {
      const next = new Set(prev);
      for (const key of Object.keys(pruned.messages)) next.add(key);
      return next;
    });
  }, []);

  const ensureFirebaseUser = useCallback(async (user: User) => {
    const firestore = requireDb();
    const userRef = doc(firestore, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        displayName: "you",
        enabledBots: [],
        onboarded: false,
        createdAt: serverTimestamp(),
      });
    }
    const groupRef = doc(firestore, "users", user.uid, "chats", GROUP_CHAT_ID);
    const groupSnap = await getDoc(groupRef);
    if (!groupSnap.exists()) {
      await setDoc(groupRef, {
        type: "group",
        title: "the timeline",
        lastMessage: "add members and the news starts texting you",
        lastMessageAt: serverTimestamp(),
        unread: 0,
      });
    }
  }, []);

  useEffect(() => {
    let unsubAuth: (() => void) | undefined;
    let unsubUser: (() => void) | undefined;
    let unsubChats: (() => void) | undefined;

    async function startLocal() {
      const local = readLocal();
      persistLocal(local);
      setBackend("local");
      setReady(true);
    }

    async function startFirebase() {
      const firebaseAuth = auth;
      const firebaseDb = db;
      if (!firebaseAuth || !firebaseDb || !firebaseReady) {
        await startLocal();
        return;
      }
      unsubAuth = onAuthStateChanged(firebaseAuth, async (user) => {
        try {
          if (!user) {
            await signInAnonymously(firebaseAuth);
            return;
          }
          await ensureFirebaseUser(user);
          setBackend("firebase");
          setUid(user.uid);

          unsubUser?.();
          unsubChats?.();

          unsubUser = onSnapshot(doc(firebaseDb, "users", user.uid), (snap) => {
            const data = snap.data();
            if (!data) return;
            setProfile({
              displayName: data.displayName ?? "You",
              enabledBots: (data.enabledBots ?? []).filter(isBotId),
              onboarded: Boolean(data.onboarded),
              createdAt: millis(data.createdAt),
              lastIngestAt: data.lastIngestAt ? millis(data.lastIngestAt) : undefined,
              pushEnabled: Boolean(data.pushEnabled),
              preferences: normalizePreferences(data.preferences),
              notifications: normalizeNotificationPrefs(data.notifications),
            });
          });

          unsubChats = onSnapshot(
            query(
              collection(firebaseDb, "users", user.uid, "chats"),
              orderBy("lastMessageAt", "desc"),
            ),
            (snap) => {
              setChats(
                snap.docs.map((item) => {
                  const data = item.data();
                  return {
                    id: item.id,
                    type: data.type === "dm" ? "dm" : "group",
                    botId: isBotId(data.botId) ? data.botId : undefined,
                    title: data.title ?? "chat",
                    lastMessage: data.lastMessage ?? "",
                    lastMessageAt: millis(data.lastMessageAt),
                    unread: Number(data.unread ?? 0),
                  } satisfies Chat;
                }),
              );
            },
          );

          setReady(true);
        } catch (err) {
          console.warn("firebase start failed, using local", err);
          await startLocal();
        }
      });
    }

    startFirebase();

    return () => {
      unsubAuth?.();
      unsubUser?.();
      unsubChats?.();
    };
  }, [ensureFirebaseUser, persistLocal]);

  useEffect(() => {
    if (backend !== "firebase" || !uid || !db) return;
    const firestore = requireDb();
    const userId = uid;
    const MESSAGE_LIMIT = 300;
    const listen = (chatId: string) =>
      onSnapshot(
        query(
          collection(firestore, "users", userId, "chats", chatId, "messages"),
          orderBy("createdAt", "desc"),
          limit(MESSAGE_LIMIT),
        ),
        (snap) => {
          const rows = snap.docs
            .map((item) =>
              messageFromDoc(chatId, item.id, item.data() as Record<string, unknown>),
            )
            .reverse();
          if (chatId === GROUP_CHAT_ID) {
            for (const row of rows) {
              if (row.kind === "news" && isBotId(row.sender)) {
                lastNewsRef.current[row.sender] = {
                  title: row.articleTitle || "story",
                  text: row.text,
                };
              }
            }
          }
          setMessageMap((current) => ({ ...current, [chatId]: rows }));
          setHydratedChats((prev) => new Set(prev).add(chatId));
        },
        (err) => {
          console.warn(`messages listen failed ${chatId}`, err);
        },
      );

    // Warm every chat we know about so Flash stays in sync with bot DMs + timeline.
    const chatIds = new Set<string>([GROUP_CHAT_ID]);
    for (const chat of chats) chatIds.add(chat.id);
    for (const botId of profile?.enabledBots ?? []) chatIds.add(dmChatId(botId));
    if (selectedChatId) chatIds.add(selectedChatId);

    const unsubs = [...chatIds].map((chatId) => listen(chatId));
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [
    backend,
    uid,
    selectedChatId,
    // Stabilize array deps so we don't thrash listeners every profile snapshot.
    (profile?.enabledBots ?? []).join(","),
    chats.map((chat) => chat.id).join(","),
  ]);

  const selectChat = useCallback(
    async (id: string | null) => {
      setSelectedChatId(id);
      if (!id || !uid) return;
      if (backend === "local") {
        const local = localRef.current ?? readLocal();
        persistLocal({
          ...local,
          chats: local.chats.map((chat) =>
            chat.id === id ? { ...chat, unread: 0 } : chat,
          ),
        });
        return;
      }
      if (!db) return;
      try {
        await updateDoc(doc(db, "users", uid, "chats", id), { unread: 0 });
      } catch {
        /* chat may not exist yet */
      }
    },
    [backend, persistLocal, uid],
  );

  const markAllRead = useCallback(async () => {
    if (!uid) return;
    const unreadChats = chats.filter((chat) => chat.unread > 0);
    if (unreadChats.length === 0) return;
    if (backend === "local") {
      const local = localRef.current ?? readLocal();
      persistLocal({
        ...local,
        chats: local.chats.map((chat) => ({ ...chat, unread: 0 })),
      });
      return;
    }
    if (!db) return;
    const batch = writeBatch(db);
    for (const chat of unreadChats) {
      batch.update(doc(db, "users", uid, "chats", chat.id), { unread: 0 });
    }
    await batch.commit();
  }, [backend, chats, persistLocal, uid]);

  const addMessage = useCallback(
    async (input: {
      chatId: string;
      sender: "user" | BotId;
      text: string;
      kind: MessageKind;
      articleUrl?: string;
      articleTitle?: string;
      summary?: string;
      imageUrl?: string;
      matchedKeywords?: string[];
      sources?: string[];
      flash?: ChatMessage["flash"];
      bumpUnread?: boolean;
    }) => {
      const payload = {
        sender: input.sender,
        text: input.text.slice(0, 4000),
        kind: input.kind,
        ...(input.articleUrl ? { articleUrl: input.articleUrl.slice(0, 2000) } : {}),
        ...(input.articleTitle ? { articleTitle: input.articleTitle.slice(0, 300) } : {}),
        ...(input.summary ? { summary: input.summary.slice(0, 400) } : {}),
        ...(input.imageUrl ? { imageUrl: input.imageUrl.slice(0, 2000) } : {}),
        ...(input.matchedKeywords?.length
          ? { matchedKeywords: input.matchedKeywords.slice(0, 12) }
          : {}),
        ...(input.sources?.length ? { sources: input.sources.slice(0, 8) } : {}),
        ...(input.flash ? { flash: input.flash } : {}),
      };

      if (backend === "local") {
        const local = localRef.current ?? readLocal();
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          chatId: input.chatId,
          createdAt: Date.now(),
          ...payload,
          sender: payload.sender,
          text: payload.text,
          kind: payload.kind,
        };
        const unread =
          input.bumpUnread && selectedRef.current !== input.chatId
            ? (local.chats.find((chat) => chat.id === input.chatId)?.unread ?? 0) + 1
            : selectedRef.current === input.chatId
              ? 0
              : (local.chats.find((chat) => chat.id === input.chatId)?.unread ?? 0);
        persistLocal({
          ...local,
          messages: {
            ...local.messages,
            [input.chatId]: [...(local.messages[input.chatId] ?? []), message],
          },
          chats: local.chats.map((chat) =>
            chat.id === input.chatId
              ? {
                  ...chat,
                  lastMessage: preview(input.text),
                  lastMessageAt: message.createdAt,
                  unread,
                }
              : chat,
          ),
        });
        return;
      }

      if (!db || !uid) return;
      await addDoc(collection(db, "users", uid, "chats", input.chatId, "messages"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
      const chatRef = doc(db, "users", uid, "chats", input.chatId);
      const chatSnap = await getDoc(chatRef);
      const currentUnread = Number(chatSnap.data()?.unread ?? 0);
      const unread =
        input.bumpUnread && selectedRef.current !== input.chatId
          ? Math.min(currentUnread + 1, 9999)
          : selectedRef.current === input.chatId
            ? 0
            : currentUnread;
      await updateDoc(chatRef, {
        lastMessage: preview(input.text),
        lastMessageAt: serverTimestamp(),
        unread,
      });
    },
    [backend, persistLocal, uid],
  );

  const ensureDm = useCallback(
    async (botId: BotId) => {
      const bot = getBot(botId);
      if (!bot) return;
      const chatId = dmChatId(botId);
      if (backend === "local") {
        const local = localRef.current ?? readLocal();
        if (local.chats.some((chat) => chat.id === chatId)) return;
        persistLocal({
          ...local,
          chats: [
            ...local.chats,
            {
              id: chatId,
              type: "dm",
              botId,
              title: bot.name,
              lastMessage: `say hey to ${bot.name}`,
              lastMessageAt: Date.now(),
              unread: 0,
            },
          ],
          messages: { ...local.messages, [chatId]: local.messages[chatId] ?? [] },
        });
        return;
      }
      if (!db || !uid) return;
      const chatRef = doc(db, "users", uid, "chats", chatId);
      const snap = await getDoc(chatRef);
      if (snap.exists()) return;
      await setDoc(chatRef, {
        type: "dm",
        botId,
        title: bot.name,
        lastMessage: `say hey to ${bot.name}`,
        lastMessageAt: serverTimestamp(),
        unread: 0,
      });
    },
    [backend, persistLocal, uid],
  );

  useEffect(() => {
    if (!selectedChatId) return;
    const bot = botFromChatId(selectedChatId);
    if (!bot) return;
    const dmRows = messageMap[selectedChatId];
    const groupRows = messageMap[GROUP_CHAT_ID];
    if (!dmRows || !groupRows) return;
    if (hydratedDmRef.current.has(selectedChatId)) return;
    const existing = new Set(
      dmRows
        .map((row) => row.articleUrl)
        .filter((url): url is string => Boolean(url)),
    );
    const copies = groupRows.filter(
      (row) =>
        row.kind === "news" &&
        row.sender === bot.id &&
        row.articleUrl &&
        !existing.has(row.articleUrl),
    );
    hydratedDmRef.current.add(selectedChatId);
    if (copies.length === 0) return;
    void (async () => {
      await ensureDm(bot.id);
      for (const row of copies) {
        await addMessage({
          chatId: selectedChatId,
          sender: bot.id,
          text: row.text,
          kind: "news",
          articleUrl: row.articleUrl,
          articleTitle: row.articleTitle,
          summary: row.summary,
          imageUrl: row.imageUrl,
          matchedKeywords: row.matchedKeywords,
          sources: row.sources,
          flash: row.flash,
          bumpUnread: false,
        });
      }
    })();
  }, [addMessage, ensureDm, messageMap, selectedChatId]);

  const saveProfile = useCallback(
    async (next: Partial<UserProfile> & Pick<UserProfile, "enabledBots" | "onboarded" | "displayName">) => {
      if (backend === "local") {
        const local = localRef.current ?? readLocal();
        persistLocal({
          ...local,
          profile: { ...local.profile, ...next },
        });
        return;
      }
      if (!db || !uid) return;
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      const payload: Record<string, unknown> = {
        displayName: next.displayName,
        enabledBots: next.enabledBots,
        onboarded: next.onboarded,
      };
      if (next.lastIngestAt) payload.lastIngestAt = serverTimestamp();
      if (typeof next.pushEnabled === "boolean") payload.pushEnabled = next.pushEnabled;
      if (next.preferences) payload.preferences = next.preferences;
      if (next.notifications) payload.notifications = next.notifications;

      if (!snap.exists()) {
        await setDoc(userRef, { ...payload, createdAt: serverTimestamp() });
        return;
      }
      await updateDoc(userRef, payload);
    },
    [backend, persistLocal, uid],
  );

  const touchLastIngest = useCallback(async () => {
    if (backend === "local") {
      const local = localRef.current ?? readLocal();
      persistLocal({
        ...local,
        profile: { ...local.profile, lastIngestAt: Date.now() },
      });
      return;
    }
    if (!db || !uid) return;
    try {
      await updateDoc(doc(db, "users", uid), { lastIngestAt: serverTimestamp() });
    } catch {
      /* user doc may not exist yet */
    }
  }, [backend, persistLocal, uid]);

  const markSeen = useCallback(
    async (url: string, botId: BotId, title?: string) => {
      const id = seenId(url);
      if (backend === "local") {
        const local = localRef.current ?? readLocal();
        if (local.seen.some((row) => row.id === id)) return;
        persistLocal({
          ...local,
          seen: [...local.seen, { id, url, botId, title, createdAt: Date.now() }],
        });
        return;
      }
      if (!db || !uid) return;
      await setDoc(doc(db, "users", uid, "seen", id), {
        url,
        botId,
        createdAt: serverTimestamp(),
        ...(title ? { title: title.slice(0, 300) } : {}),
      });
    },
    [backend, persistLocal, uid],
  );

  const loadSeen = useCallback(async () => {
    const cutoff = newsCutoff();
    const fromMessages = Object.values(messageMap)
      .flat()
      .filter((row) => row.kind === "news" && row.createdAt >= cutoff)
      .map((row) => row.articleTitle)
      .filter((title): title is string => Boolean(title));
    if (backend === "local") {
      const local = pruneLocalState(localRef.current ?? readLocal());
      return {
        urls: local.seen.map((row) => row.url),
        titles: [...fromMessages, ...local.seen.map((row) => row.title).filter(Boolean)] as string[],
      };
    }
      if (!db || !uid) return { urls: [] as string[], titles: fromMessages };
    const snap = await getDocs(collection(db, "users", uid, "seen"));
    return {
      urls: snap.docs
        .filter((item) => millis(item.data().createdAt) >= cutoff)
        .map((item) => String(item.data().url ?? ""))
        .filter(Boolean),
      titles: [
        ...fromMessages,
        ...snap.docs
          .filter((item) => millis(item.data().createdAt) >= cutoff)
          .map((item) => String(item.data().title ?? ""))
          .filter(Boolean),
      ],
    };
  }, [backend, messageMap, uid]);

  const pruneExpired = useCallback(async () => {
    const cutoff = newsCutoff();
    if (backend === "local") {
      persistLocal(localRef.current ?? readLocal());
      return;
    }
    if (!db || !uid) return;
    const chatIds = chats.length > 0 ? chats.map((chat) => chat.id) : [GROUP_CHAT_ID];
    const refs: DocumentReference[] = [];
    for (const chatId of chatIds) {
      const snap = await getDocs(collection(db, "users", uid, "chats", chatId, "messages"));
      for (const item of snap.docs) {
        const data = item.data();
        if (data.kind === "news" && millis(data.createdAt) < cutoff) refs.push(item.ref);
      }
    }
    const seenSnap = await getDocs(collection(db, "users", uid, "seen"));
    for (const item of seenSnap.docs) {
      if (millis(item.data().createdAt) < cutoff) refs.push(item.ref);
    }
    for (let i = 0; i < refs.length; i += 400) {
      const batch = writeBatch(db);
      for (const ref of refs.slice(i, i + 400)) batch.delete(ref);
      await batch.commit();
    }
  }, [backend, chats, persistLocal, uid]);

  const ingest = useCallback(
    async (
      reason: "open" | "manual" | "member" = "manual",
      bots?: BotId[],
      prefs?: Preferences,
    ): Promise<IngestResult | null> => {
      if (ingestingRef.current) return null;
      if (reason === "open") {
        if (skipNextOpenIngestRef.current) {
          skipNextOpenIngestRef.current = false;
          return null;
        }
        const last = profile?.lastIngestAt;
        if (last && Date.now() - last < 2 * 60 * 1000) return null;
      }
      const enabled = bots ?? profile?.enabledBots ?? [];
      if (enabled.length === 0) return null;
      ingestingRef.current = true;
      setIngesting(true);
      setError(null);
      const emptyStats: IngestStats = {
        headlinesChecked: 0,
        keywordMatched: 0,
        gatePassed: 0,
        posted: 0,
        skippedDuplicate: 0,
      };
      try {
        // Don't block refresh on cleanup — prune in the background.
        void pruneExpired();
        const seen = await loadSeen();
        const preferences = prunePreferences(
          normalizePreferences(prefs ?? profile?.preferences),
        );
        const response = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bots: enabled,
            seenUrls: seen.urls,
            seenTitles: seen.titles,
            preferences,
          }),
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(`ingest failed (${response.status}) ${detail.slice(0, 160)}`);
        }
        const data = (await response.json()) as {
          items?: IngestItem[];
          stats?: IngestStats;
          error?: string;
        };
        if (data.error) throw new Error(data.error);
        const apiStats = data.stats ?? emptyStats;
        const posted: IngestItem[] = [];
        const skipped: IngestItem[] = [];
        const incoming = data.items ?? [];

        for (const item of incoming) {
          if (
            item.botId !== "pitch" &&
            isDuplicateTitle(item.title, [...seen.titles, ...posted.map((row) => row.title)])
          ) {
            skipped.push(item);
            continue;
          }
          posted.push(item);
        }

        const botsNeeded = [...new Set(posted.map((item) => item.botId))];
        await Promise.all(botsNeeded.map((botId) => ensureDm(botId)));

        if (backend === "local") {
          for (const item of posted) {
            const news = {
              sender: item.botId,
              text: item.groupText,
              kind: "news" as const,
              articleUrl: item.url,
              articleTitle: item.title,
              summary: item.summary,
              imageUrl: item.imageUrl,
              matchedKeywords: item.matchedKeywords,
              sources: item.sources,
              flash: item.flash,
            };
            await addMessage({
              ...news,
              chatId: GROUP_CHAT_ID,
              bumpUnread: reason !== "open" || selectedRef.current !== GROUP_CHAT_ID,
            });
            await addMessage({
              ...news,
              chatId: dmChatId(item.botId),
              bumpUnread: selectedRef.current !== dmChatId(item.botId),
            });
            await markSeen(item.url, item.botId, item.title);
            lastNewsRef.current[item.botId] = { title: item.title, text: item.groupText };
          }
          for (const item of skipped) {
            await markSeen(item.url, item.botId, item.title);
          }
        } else if (db && uid && (posted.length > 0 || skipped.length > 0)) {
          const firestore = db;
          const userId = uid;
          const batch = writeBatch(firestore);
          const chatTouches = new Map<
            string,
            { lastMessage: string; bump: number; clearUnread: boolean }
          >();

          const touchChat = (chatId: string, lastMessage: string, bump: boolean) => {
            const clearUnread = selectedRef.current === chatId;
            const prev = chatTouches.get(chatId);
            chatTouches.set(chatId, {
              lastMessage,
              bump: clearUnread ? 0 : (prev?.bump ?? 0) + (bump ? 1 : 0),
              clearUnread,
            });
          };

          for (const item of posted) {
            const payload = {
              sender: item.botId,
              text: item.groupText.slice(0, 4000),
              kind: "news" as const,
              articleUrl: item.url.slice(0, 2000),
              articleTitle: item.title.slice(0, 300),
              summary: (item.summary || item.groupText).slice(0, 400),
              ...(item.imageUrl ? { imageUrl: item.imageUrl.slice(0, 2000) } : {}),
              ...(item.matchedKeywords?.length
                ? { matchedKeywords: item.matchedKeywords.slice(0, 12) }
                : {}),
              ...(item.sources?.length ? { sources: item.sources.slice(0, 8) } : {}),
              ...(item.flash ? { flash: item.flash } : {}),
              createdAt: serverTimestamp(),
            };
            const groupId = GROUP_CHAT_ID;
            const dmId = dmChatId(item.botId);
            batch.set(doc(collection(firestore, "users", userId, "chats", groupId, "messages")), payload);
            batch.set(doc(collection(firestore, "users", userId, "chats", dmId, "messages")), payload);

            touchChat(
              groupId,
              preview(item.groupText),
              reason !== "open" || selectedRef.current !== groupId,
            );
            touchChat(dmId, preview(item.groupText), selectedRef.current !== dmId);

            batch.set(doc(firestore, "users", userId, "seen", seenId(item.url)), {
              url: item.url,
              botId: item.botId,
              createdAt: serverTimestamp(),
              title: item.title.slice(0, 300),
            });
            lastNewsRef.current[item.botId] = { title: item.title, text: item.groupText };
          }

          // One write per chat doc — Firestore rejects multiple updates to the same doc in a batch.
          for (const [chatId, touch] of chatTouches) {
            const update: Record<string, unknown> = {
              lastMessage: touch.lastMessage,
              lastMessageAt: serverTimestamp(),
            };
            if (touch.clearUnread) update.unread = 0;
            else if (touch.bump > 0) update.unread = increment(touch.bump);
            batch.set(doc(firestore, "users", userId, "chats", chatId), update, { merge: true });
          }

          for (const item of skipped) {
            batch.set(doc(firestore, "users", userId, "seen", seenId(item.url)), {
              url: item.url,
              botId: item.botId,
              createdAt: serverTimestamp(),
              title: item.title.slice(0, 300),
            });
          }
          await batch.commit();

          // Optimistic Flash/chat update — don't wait for every onSnapshot to land.
          const now = Date.now();
          setMessageMap((current) => {
            const next: Record<string, ChatMessage[]> = { ...current };
            for (const item of posted) {
              const base = {
                sender: item.botId,
                text: item.groupText,
                kind: "news" as const,
                createdAt: now,
                articleUrl: item.url,
                articleTitle: item.title,
                summary: item.summary || item.groupText,
                imageUrl: item.imageUrl,
                matchedKeywords: item.matchedKeywords,
                sources: item.sources,
                flash: item.flash,
              };
              const groupId = GROUP_CHAT_ID;
              const dmId = dmChatId(item.botId);
              const groupMsg: ChatMessage = {
                ...base,
                id: `optimistic-group-${newsDedupeKey({ sender: item.botId, articleTitle: item.title, articleUrl: item.url })}`,
                chatId: groupId,
              };
              const dmMsg: ChatMessage = {
                ...base,
                id: `optimistic-dm-${newsDedupeKey({ sender: item.botId, articleTitle: item.title, articleUrl: item.url })}`,
                chatId: dmId,
              };
              const merge = (chatId: string, msg: ChatMessage) => {
                const rows = next[chatId] ?? [];
                const key = newsDedupeKey(msg);
                if (rows.some((row) => newsDedupeKey(row) === key)) return;
                next[chatId] = [...rows, msg];
              };
              merge(groupId, groupMsg);
              merge(dmId, dmMsg);
            }
            return next;
          });
        }
        if (posted.length > 0 && profile?.pushEnabled && pushSubRef.current) {
          const sub = pushSubRef.current;
          const notify = normalizeNotificationPrefs(profile.notifications);
          for (const item of posted) {
            const bot = getBot(item.botId);
            const body = item.groupText.slice(0, 160);
            if (shouldNotifyBot(notify, item.botId)) {
              void sendPushToSubscription(sub, {
                title: titleCaseName(bot?.name ?? item.botId),
                body,
                url: `/?chat=${dmChatId(item.botId)}`,
              });
            } else if (shouldNotifyTimeline(notify)) {
              void sendPushToSubscription(sub, {
                title: "The timeline",
                body: `${titleCaseName(bot?.name ?? item.botId)}: ${body}`,
                url: `/?chat=${GROUP_CHAT_ID}`,
              });
            }
          }
        }
        await touchLastIngest();
        const result: IngestResult = {
          stats: {
            ...apiStats,
            posted: posted.length,
            skippedDuplicate: skipped.length,
          },
          postedBotIds: posted.map((item) => item.botId),
        };
        if (reason === "manual" || reason === "member") {
          setLastIngestResult(result);
        }
        return result;
      } catch (err) {
        console.error(err);
        const detail = err instanceof Error && err.message ? err.message : "";
        setError(
          detail && !/failed to fetch|networkerror/i.test(detail)
            ? `Couldn't grab the news. ${detail.slice(0, 120)}`
            : "Couldn't grab the news. Check your wifi and try again.",
        );
        return null;
      } finally {
        ingestingRef.current = false;
        setIngesting(false);
      }
    },
    [addMessage, backend, ensureDm, loadSeen, markSeen, profile, pruneExpired, touchLastIngest],
  );

  const dismissIngestBanner = useCallback(() => {
    setLastIngestResult(null);
  }, []);

  const clearComposerSeed = useCallback(() => {
    setComposerSeed(null);
  }, []);

  const askBot = useCallback(
    (botId: BotId, draft?: string) => {
      const chatId = dmChatId(botId);
      setComposerSeed({ chatId, text: draft ?? "What's the deal with this story?" });
      setSelectedChatId(chatId);
      if (!uid) return;
      if (backend === "local") {
        const local = localRef.current ?? readLocal();
        persistLocal({
          ...local,
          chats: local.chats.map((chat) =>
            chat.id === chatId ? { ...chat, unread: 0 } : chat,
          ),
        });
        return;
      }
      if (!db) return;
      void updateDoc(doc(db, "users", uid, "chats", chatId), { unread: 0 }).catch(() => undefined);
    },
    [backend, persistLocal, uid],
  );

  const completeOnboarding = useCallback(
    async (
      bots: BotId[],
      preferences?: Preferences,
      notifications?: NotificationPrefs,
    ): Promise<IngestResult | null> => {
      const unique = [...new Set(bots)];
      const nextPrefs = prunePreferences(
        normalizePreferences(preferences ?? profile?.preferences),
      );
      const nextNotifications = normalizeNotificationPrefs(
        notifications ?? profile?.notifications,
      );
      for (const botId of unique) {
        await ensureDm(botId);
      }
      if (unique.length > 0) {
        const names = unique.map((id) => titleCaseName(getBot(id)?.name ?? id)).filter(Boolean).join(", ");
        await addMessage({
          chatId: GROUP_CHAT_ID,
          sender: unique[0],
          text: `Welcome to the timeline. ${names} just hopped in. We'll only ping you when it's actually huge.`,
          kind: "system",
        });
      }
      await saveProfile({
        displayName: profile?.displayName ?? "You",
        enabledBots: unique,
        onboarded: true,
        createdAt: profile?.createdAt ?? Date.now(),
        preferences: nextPrefs,
        notifications: nextNotifications,
      });
      const result = await ingest("manual", unique, nextPrefs);
      if (result) setLastIngestResult(result);
      skipNextOpenIngestRef.current = true;
      const firstPosted = result?.postedBotIds[0];
      const openChat = firstPosted
        ? dmChatId(firstPosted)
        : unique[0]
          ? dmChatId(unique[0])
          : GROUP_CHAT_ID;
      setSelectedChatId(openChat);
      return result;
    },
    [addMessage, ensureDm, ingest, profile, saveProfile],
  );

  const savePreferences = useCallback(
    async (next: Preferences) => {
      if (!profile) return;
      const preferences = prunePreferences(normalizePreferences(next));
      await saveProfile({ ...profile, preferences });
      await ingest("manual", profile.enabledBots, preferences);
    },
    [ingest, profile, saveProfile],
  );

  const saveNotifications = useCallback(
    async (next: NotificationPrefs) => {
      if (!profile) return;
      const notifications = normalizeNotificationPrefs(next);
      await saveProfile({ ...profile, notifications });
    },
    [profile, saveProfile],
  );

  const toggleBot = useCallback(
    async (botId: BotId, enabled: boolean) => {
      if (!profile) return;
      const next = enabled
        ? [...new Set([...profile.enabledBots, botId])]
        : profile.enabledBots.filter((id) => id !== botId);
      const bot = getBot(botId);
      if (enabled) {
        await ensureDm(botId);
        await addMessage({
          chatId: GROUP_CHAT_ID,
          sender: botId,
          text: `${titleCaseName(bot?.name ?? botId)} hopped in. ${bot?.tagline}.`,
          kind: "system",
        });
      } else {
        await addMessage({
          chatId: GROUP_CHAT_ID,
          sender: botId,
          text: `${titleCaseName(bot?.name ?? botId)} left the chat. The lore will continue without them.`,
          kind: "system",
        });
      }
      await saveProfile({ ...profile, enabledBots: next });
      if (enabled) await ingest("member", [botId]);
    },
    [addMessage, ensureDm, ingest, profile, saveProfile],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !selectedChatId) return;
      const chat = chats.find((item) => item.id === selectedChatId);
      if (chat?.type === "group" || selectedChatId === GROUP_CHAT_ID) return;
      const botId =
        chat?.type === "dm" && chat.botId
          ? chat.botId
          : profile?.enabledBots[0] ?? BOTS[0].id;
      setSending(true);
      setError(null);
      try {
        await addMessage({
          chatId: selectedChatId,
          sender: "user",
          text: trimmed,
          kind: "chat",
        });
        const thread =
          backend === "local"
            ? (localRef.current?.messages[selectedChatId] ?? [])
            : (messageMap[selectedChatId] ?? []);
        const groupNews =
          backend === "local"
            ? (localRef.current?.messages[GROUP_CHAT_ID] ?? [])
            : (messageMap[GROUP_CHAT_ID] ?? []);
        const history = [...thread, { sender: "user" as const, text: trimmed }]
          .filter((row) => row.sender === "user" || row.sender === botId)
          .slice(-8)
          .map((row) => ({
            role: row.sender === "user" ? ("user" as const) : ("assistant" as const),
            content: row.text,
          }));
        const cached = lastNewsRef.current[botId];
        const newsContext = [
          ...(cached ? [{ title: cached.title, text: cached.text }] : []),
          ...[...groupNews, ...thread]
            .filter((row) => row.kind === "news" && row.sender === botId)
            .slice(-3)
            .map((row) => ({
              title: row.articleTitle || "story",
              text: row.text,
            })),
        ].slice(0, 4);
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            botId,
            message: trimmed,
            history,
            newsContext,
            preferences: profile?.preferences,
          }),
        });
        const data = (await response.json()) as { reply?: string; error?: string };
        await addMessage({
          chatId: selectedChatId,
          sender: botId,
          text: data.reply || data.error || "i blanked. say that again?",
          kind: "chat",
        });
      } catch (err) {
        console.error(err);
        setError("message didn't send. try again.");
      } finally {
        setSending(false);
      }
    },
    [addMessage, backend, chats, messageMap, profile, selectedChatId],
  );

  const enablePush = useCallback(async () => {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return false;

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const canPush =
        Boolean(key) &&
        "PushManager" in window &&
        (window.isSecureContext || location.hostname === "localhost");

      if (canPush && key) {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        await registration.update().catch(() => undefined);
        const ready = await navigator.serviceWorker.ready;
        const padding = "=".repeat((4 - (key.length % 4)) % 4);
        const base64 = (key + padding).replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(base64);
        const output = Uint8Array.from(raw, (char) => char.charCodeAt(0));
        try {
          const sub = await ready.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: output,
          });
          const json = sub.toJSON();
          if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
            pushSubRef.current = {
              endpoint: json.endpoint,
              keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
            };
            if (backend === "firebase" && db && uid) {
              await setDoc(doc(db, "users", uid, "push", "current"), {
                endpoint: json.endpoint,
                p256dh: json.keys.p256dh,
                auth: json.keys.auth,
                createdAt: serverTimestamp(),
              });
            }
          }
        } catch (err) {
          console.warn("push subscribe skipped", err);
        }
      }

      if (profile) await saveProfile({ ...profile, pushEnabled: true });
      return true;
    } catch (err) {
      console.warn("notifications skipped", err);
      return false;
    }
  }, [backend, profile, saveProfile, uid]);

  const value = useMemo<StoreValue>(
    () => {
      const messages = (selectedChatId ? (messageMap[selectedChatId] ?? []) : []).filter(
        (row) => stillMatches(row, profile?.preferences),
      );
      // Flash mirrors every news row loaded in chats (same pool the threads show).
      const flashByKey = new Map<string, ChatMessage>();
      for (const rows of Object.values(messageMap)) {
        for (const row of rows) {
          if (row.kind !== "news") continue;
          if (!isBotId(row.sender)) continue;
          const key = newsDedupeKey(row);
          const existing = flashByKey.get(key);
          if (!existing || row.createdAt > existing.createdAt) flashByKey.set(key, row);
        }
      }
      const flashNews = [...flashByKey.values()].sort((a, b) => b.createdAt - a.createdAt);
      return {
      ready,
      backend,
      uid,
      profile,
      chats,
      messages,
      flashNews,
      selectedChatId,
      ingesting,
      sending,
      error,
      lastIngestResult,
      selectChat,
      markAllRead,
      messagesLoading: Boolean(selectedChatId && !hydratedChats.has(selectedChatId)),
      completeOnboarding,
      toggleBot,
      ingest,
      sendMessage,
      enablePush,
      savePreferences,
      saveNotifications,
      dismissIngestBanner,
      askBot,
      clearComposerSeed,
      composerSeed,
    };
    },
    [
      ready,
      backend,
      uid,
      profile,
      chats,
      messageMap,
      selectedChatId,
      ingesting,
      sending,
      error,
      lastIngestResult,
      composerSeed,
      hydratedChats,
      selectChat,
      markAllRead,
      completeOnboarding,
      toggleBot,
      ingest,
      sendMessage,
      enablePush,
      savePreferences,
      saveNotifications,
      dismissIngestBanner,
      askBot,
      clearComposerSeed,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}
