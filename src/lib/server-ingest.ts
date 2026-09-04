import { FieldValue } from "firebase-admin/firestore";
import { sendPushToSubscription } from "@/app/actions";
import { summarizeFlashes } from "@/lib/ai";
import { GROUP_CHAT_ID, dmChatId, getBot, isBotId } from "@/lib/bots";
import { isDuplicateTitle } from "@/lib/dedupe";
import {
  defaultNotificationPrefs,
  normalizeNotificationPrefs,
  shouldNotifyBot,
  shouldNotifyTimeline,
  titleCaseName,
} from "@/lib/notifications";
import { adminReady, getAdminDb, millis } from "@/lib/firebase-admin";
import { collectFlashes } from "@/lib/pipeline";
import { normalizePreferences, prunePreferences } from "@/lib/preferences";
import type { BotId, IngestItem, UserProfile } from "@/lib/types";

function preview(text: string) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
}

function seenId(url: string) {
  try {
    return Buffer.from(url, "utf8")
      .toString("base64")
      .replace(/[+/=]/g, "")
      .slice(0, 80);
  } catch {
    return `u${url.length}${Date.now()}`;
  }
}

async function loadSeen(uid: string) {
  const db = getAdminDb();
  const snap = await db.collection("users").doc(uid).collection("seen").get();
  const urls: string[] = [];
  const titles: string[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (typeof data.url === "string") urls.push(data.url);
    if (typeof data.title === "string") titles.push(data.title);
  }
  return { urls: urls.slice(0, 400), titles: titles.slice(0, 200) };
}

async function markSeen(uid: string, url: string, botId: BotId, title?: string) {
  const db = getAdminDb();
  await db
    .collection("users")
    .doc(uid)
    .collection("seen")
    .doc(seenId(url))
    .set({
      url: url.slice(0, 2000),
      botId,
      ...(title ? { title: title.slice(0, 300) } : {}),
      createdAt: FieldValue.serverTimestamp(),
    });
}

async function ensureDm(uid: string, botId: BotId) {
  const bot = getBot(botId);
  if (!bot) return;
  const db = getAdminDb();
  const chatId = dmChatId(botId);
  const chatRef = db.collection("users").doc(uid).collection("chats").doc(chatId);
  const snap = await chatRef.get();
  if (snap.exists) return;
  await chatRef.set({
    type: "dm",
    botId,
    title: bot.name,
    lastMessage: `Say hey to ${bot.name}`,
    lastMessageAt: FieldValue.serverTimestamp(),
    unread: 0,
  });
}

async function addNewsMessage(
  uid: string,
  chatId: string,
  item: IngestItem,
  bumpUnread: boolean,
) {
  const db = getAdminDb();
  const chatRef = db.collection("users").doc(uid).collection("chats").doc(chatId);
  const messagesRef = chatRef.collection("messages");
  const payload = {
    sender: item.botId,
    text: item.groupText.slice(0, 4000),
    kind: "news",
    articleUrl: item.url.slice(0, 2000),
    articleTitle: item.title.slice(0, 300),
    summary: (item.summary || item.groupText).slice(0, 400),
    matchedKeywords: item.matchedKeywords.slice(0, 12),
    sources: item.sources.slice(0, 8),
    flash: item.flash,
    createdAt: FieldValue.serverTimestamp(),
    ...(item.imageUrl ? { imageUrl: item.imageUrl.slice(0, 2000) } : {}),
  };
  await messagesRef.add(payload);
  const chatSnap = await chatRef.get();
  const currentUnread = Number(chatSnap.data()?.unread ?? 0);
  await chatRef.update({
    lastMessage: preview(item.groupText),
    lastMessageAt: FieldValue.serverTimestamp(),
    unread: bumpUnread ? Math.min(currentUnread + 1, 9999) : currentUnread,
  });
}

export type UserIngestOutcome = {
  uid: string;
  posted: number;
  error?: string;
};

export async function ingestForUser(uid: string, profile: UserProfile): Promise<UserIngestOutcome> {
  const enabled = profile.enabledBots.filter(isBotId);
  if (enabled.length === 0) return { uid, posted: 0 };

  try {
    const seen = await loadSeen(uid);
    const preferences = prunePreferences(normalizePreferences(profile.preferences));
    const { stories } = await collectFlashes(
      enabled,
      seen.urls,
      seen.titles,
      preferences,
    );
    const items = await summarizeFlashes(stories);
    const posted: IngestItem[] = [];

    for (const item of items) {
      if (
        item.botId !== "pitch" &&
        isDuplicateTitle(item.title, [...seen.titles, ...posted.map((row) => row.title)])
      ) {
        await markSeen(uid, item.url, item.botId, item.title);
        continue;
      }
      await ensureDm(uid, item.botId);
      await addNewsMessage(uid, GROUP_CHAT_ID, item, true);
      await addNewsMessage(uid, dmChatId(item.botId), item, true);
      posted.push(item);
      await markSeen(uid, item.url, item.botId, item.title);
    }

    if (posted.length > 0) {
      const db = getAdminDb();
      const pushSnap = await db.collection("users").doc(uid).collection("push").doc("current").get();
      const pushData = pushSnap.data();
      if (profile.pushEnabled && pushData?.endpoint && pushData?.p256dh && pushData?.auth) {
        const sub = {
          endpoint: String(pushData.endpoint),
          keys: {
            p256dh: String(pushData.p256dh),
            auth: String(pushData.auth),
          },
        };
        const notify = normalizeNotificationPrefs(profile.notifications);
        for (const item of posted) {
          const bot = getBot(item.botId);
          const body = item.groupText.slice(0, 160);
          if (shouldNotifyBot(notify, item.botId)) {
            await sendPushToSubscription(sub, {
              title: titleCaseName(bot?.name ?? item.botId),
              body,
              url: `/?chat=${dmChatId(item.botId)}`,
            });
          } else if (shouldNotifyTimeline(notify)) {
            await sendPushToSubscription(sub, {
              title: "The timeline",
              body: `${titleCaseName(bot?.name ?? item.botId)}: ${body}`,
              url: `/?chat=${GROUP_CHAT_ID}`,
            });
          }
        }
      }
    }

    await getAdminDb().collection("users").doc(uid).update({
      lastIngestAt: FieldValue.serverTimestamp(),
    });

    return {
      uid,
      posted: posted.length,
    };
  } catch (error) {
    console.error(`cron ingest failed for ${uid}`, error);
    return {
      uid,
      posted: 0,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}

export async function runCronIngest(): Promise<{
  processed: number;
  posted: number;
  skipped: boolean;
  reason?: string;
}> {
  if (!adminReady()) {
    return { processed: 0, posted: 0, skipped: true, reason: "firebase admin not configured" };
  }

  const db = getAdminDb();
  const usersSnap = await db.collection("users").where("onboarded", "==", true).get();
  let processed = 0;
  let posted = 0;

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const profile: UserProfile = {
      displayName: data.displayName ?? "You",
      enabledBots: (data.enabledBots ?? []).filter(isBotId),
      onboarded: true,
      createdAt: millis(data.createdAt),
      lastIngestAt: data.lastIngestAt ? millis(data.lastIngestAt) : undefined,
      pushEnabled: Boolean(data.pushEnabled),
      preferences: normalizePreferences(data.preferences),
      notifications: normalizeNotificationPrefs(data.notifications ?? defaultNotificationPrefs()),
    };
    if (profile.enabledBots.length === 0) continue;
    const outcome = await ingestForUser(userDoc.id, profile);
    processed += 1;
    posted += outcome.posted;
  }

  return { processed, posted, skipped: false };
}
