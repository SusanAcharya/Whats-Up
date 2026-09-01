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
import { isFreshNews, newsCutoff } from "./retention";
import type {
  BotId,
  Chat,
  ChatMessage,
  IngestItem,
  MessageKind,
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
  selectedChatId: string | null;
  ingesting: boolean;
  sending: boolean;
  error: string | null;
  selectChat: (id: string | null) => void;
  completeOnboarding: (bots: BotId[], preferences?: Preferences) => Promise<void>;
  toggleBot: (botId: BotId, enabled: boolean) => Promise<void>;
  ingest: (
    reason?: "open" | "manual" | "member",
    bots?: BotId[],
    prefs?: Preferences,
  ) => Promise<number>;
  sendMessage: (text: string) => Promise<void>;
  enablePush: () => Promise<boolean>;
  savePreferences: (next: Preferences) => Promise<void>;
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
      displayName: "you",
      enabledBots: [],
      onboarded: false,
      createdAt: Date.now(),
      preferences: defaultPreferences(),
    },
    chats: [
      {
        id: GROUP_CHAT_ID,
        type: "group",
        title: "the timeline",
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

function millis(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as { toMillis: () => number }).toMillis();
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
  const selectedRef = useRef<string | null>(null);
  const ingestingRef = useRef(false);
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
              displayName: data.displayName ?? "you",
              enabledBots: (data.enabledBots ?? []).filter(isBotId),
              onboarded: Boolean(data.onboarded),
              createdAt: millis(data.createdAt),
              lastIngestAt: data.lastIngestAt ? millis(data.lastIngestAt) : undefined,
              pushEnabled: Boolean(data.pushEnabled),
              preferences: normalizePreferences(data.preferences),
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
    const listen = (chatId: string) =>
      onSnapshot(
        query(
          collection(db, "users", uid, "chats", chatId, "messages"),
          orderBy("createdAt", "asc"),
        ),
        (snap) => {
          const rows = snap.docs.map((item) =>
            messageFromDoc(chatId, item.id, item.data() as Record<string, unknown>),
          );
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
        },
      );
    const unsubGroup = listen(GROUP_CHAT_ID);
    const unsubSelected =
      selectedChatId && selectedChatId !== GROUP_CHAT_ID ? listen(selectedChatId) : undefined;
    return () => {
      unsubGroup();
      unsubSelected?.();
    };
  }, [backend, uid, selectedChatId]);

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

  const addMessage = useCallback(
    async (input: {
      chatId: string;
      sender: "user" | BotId;
      text: string;
      kind: MessageKind;
      articleUrl?: string;
      articleTitle?: string;
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
    ) => {
      if (ingestingRef.current) return 0;
      const enabled = bots ?? profile?.enabledBots ?? [];
      if (enabled.length === 0) return 0;
      ingestingRef.current = true;
      setIngesting(true);
      setError(null);
      try {
        await pruneExpired();
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
        if (!response.ok) throw new Error("ingest failed");
        const data = (await response.json()) as { items?: IngestItem[] };
        const posted: IngestItem[] = [];
        for (const item of data.items ?? []) {
          if (
            item.botId !== "pitch" &&
            isDuplicateTitle(item.title, [...seen.titles, ...posted.map((row) => row.title)])
          ) {
            await markSeen(item.url, item.botId, item.title);
            continue;
          }
          await ensureDm(item.botId);
          const news = {
            sender: item.botId,
            text: item.groupText,
            kind: "news" as const,
            articleUrl: item.url,
            articleTitle: item.title,
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
          lastNewsRef.current[item.botId] = { title: item.title, text: item.groupText };
          posted.push(item);
          await markSeen(item.url, item.botId, item.title);
        }
        if (posted.length > 0 && profile?.pushEnabled && pushSubRef.current) {
          const sub = pushSubRef.current;
          if (posted.length === 1) {
            const item = posted[0];
            const bot = getBot(item.botId);
            void sendPushToSubscription(sub, {
              title: bot?.name ?? "what's up",
              body: item.groupText.slice(0, 160),
            });
          } else {
            void sendPushToSubscription(sub, {
              title: "what's up",
              body: `${posted.length} new stories on the timeline`,
            });
          }
        }
        await touchLastIngest();
        return posted.length;
      } catch (err) {
        console.error(err);
        setError("couldn't grab the news. check your wifi and try again.");
        return 0;
      } finally {
        ingestingRef.current = false;
        setIngesting(false);
      }
    },
    [addMessage, ensureDm, loadSeen, markSeen, profile, pruneExpired, touchLastIngest],
  );

  const completeOnboarding = useCallback(
    async (bots: BotId[], preferences?: Preferences) => {
      const unique = [...new Set(bots)];
      const nextPrefs = prunePreferences(
        normalizePreferences(preferences ?? profile?.preferences),
      );
      for (const botId of unique) {
        await ensureDm(botId);
      }
      if (unique.length > 0) {
        const names = unique.map((id) => getBot(id)?.name).filter(Boolean).join(", ");
        await addMessage({
          chatId: GROUP_CHAT_ID,
          sender: unique[0],
          text: `welcome to the timeline. ${names} just hopped in. we'll only ping you when it's actually huge.`,
          kind: "system",
        });
      }
      await saveProfile({
        displayName: profile?.displayName ?? "you",
        enabledBots: unique,
        onboarded: true,
        createdAt: profile?.createdAt ?? Date.now(),
        preferences: nextPrefs,
      });
      await ingest("open", unique, nextPrefs);
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
          text: `${bot?.name} hopped in. ${bot?.tagline}.`,
          kind: "system",
        });
      } else {
        await addMessage({
          chatId: GROUP_CHAT_ID,
          sender: botId,
          text: `${bot?.name} left the chat. the lore will continue without them.`,
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
      return {
      ready,
      backend,
      uid,
      profile,
      chats,
      messages,
      selectedChatId,
      ingesting,
      sending,
      error,
      selectChat,
      completeOnboarding,
      toggleBot,
      ingest,
      sendMessage,
      enablePush,
      savePreferences,
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
      selectChat,
      completeOnboarding,
      toggleBot,
      ingest,
      sendMessage,
      enablePush,
      savePreferences,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}
