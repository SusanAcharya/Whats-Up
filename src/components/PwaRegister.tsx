"use client";

import { useEffect } from "react";

const PENDING_CHAT_KEY = "pendingChat";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => {
        console.warn("service worker skipped", error);
      });

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "NAVIGATE" || !event.data.url) return;
      try {
        const url = new URL(event.data.url, window.location.origin);
        const chat = url.searchParams.get("chat");
        if (!chat) return;
        sessionStorage.setItem(PENDING_CHAT_KEY, chat);
        window.dispatchEvent(new CustomEvent("whatsup-navigate", { detail: { chat } }));
      } catch {
        // ignore malformed push targets
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  return null;
}
