"use server";

import webpush from "web-push";

function vapidReady() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

export async function sendPushToSubscription(
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  },
  payload: { title: string; body: string; url?: string },
) {
  if (!vapidReady()) {
    return { success: false, error: "push is not configured" };
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: "/icon",
        url: payload.url || "/",
      }),
    );
    return { success: true };
  } catch (error) {
    console.error("push failed", error);
    return { success: false, error: "failed to send notification" };
  }
}
