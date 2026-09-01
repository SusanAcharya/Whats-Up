"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";
import { ingestStatusText } from "@/lib/ingest-feedback";
import { ChatList } from "./ChatList";
import { ChatThread } from "./ChatThread";
import { Onboarding } from "./Onboarding";
import { SettingsScreen } from "./SettingsScreen";

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone))
  );
}

function useShowIosInstall() {
  return useSyncExternalStore(
    () => () => {},
    () => isIos() && !isStandalone(),
    () => false,
  );
}

export function App() {
  const {
    ready,
    profile,
    selectedChatId,
    selectChat,
    ingest,
    savePreferences,
    saveNotifications,
    enablePush,
    lastIngestResult,
    dismissIngestBanner,
    ingesting,
  } = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"alerts" | "filters" | "bots">("alerts");
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [notifySaving, setNotifySaving] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const showInstall = useShowIosInstall() && !installDismissed;
  const ingestRef = useRef(ingest);

  useEffect(() => {
    ingestRef.current = ingest;
  }, [ingest]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const chat = new URLSearchParams(window.location.search).get("chat");
    if (chat) {
      void selectChat(chat);
      window.history.replaceState({}, "", "/");
    }
  }, [selectChat]);

  useEffect(() => {
    if (!ready || !profile?.onboarded) return;
    void ingestRef.current("open");
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void ingestRef.current("open");
    }, 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [profile?.onboarded, ready]);

  if (!ready || !profile) {
    return (
      <div className="app-shell grid place-items-center">
        <p className="text-sm text-[var(--muted)]">Opening the group chat…</p>
      </div>
    );
  }

  if (!profile.onboarded) {
    return (
      <div className="app-shell">
        <Onboarding />
      </div>
    );
  }

  const statusText = ingestStatusText(lastIngestResult, ingesting);

  function openSettings(tab: "alerts" | "filters" | "bots" = "alerts") {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }

  return (
    <div className="app-shell relative mx-auto w-full bg-black md:grid md:max-w-5xl md:grid-cols-[280px_1fr]">
      <div
        className={`h-full min-h-0 ${selectedChatId ? "hidden md:block" : "block"}`}
      >
        <ChatList
          onOpenSettings={() => openSettings("alerts")}
          statusText={statusText}
          onDismissStatus={dismissIngestBanner}
        />
      </div>
      <div
        className={`h-full min-h-0 ${selectedChatId ? "block" : "hidden md:block"}`}
      >
        {selectedChatId ? (
          <ChatThread
            onOpenSettings={openSettings}
            statusText={statusText}
            onDismissStatus={dismissIngestBanner}
          />
        ) : (
          <div className="chat-bg hidden h-full place-items-center px-8 text-center md:grid">
            <p className="display text-2xl font-black italic text-white/30 md:text-3xl">
              Pick a chat. We keep it loud on purpose.
            </p>
          </div>
        )}
      </div>
      <SettingsScreen
        open={settingsOpen}
        enabledBots={profile.enabledBots}
        initialPrefs={profile.preferences}
        initialNotifications={profile.notifications}
        pushEnabled={profile.pushEnabled}
        prefsSaving={prefsSaving}
        notifySaving={notifySaving}
        initialTab={settingsTab}
        onClose={() => setSettingsOpen(false)}
        onEnablePush={enablePush}
        onSavePrefs={async (next) => {
          setPrefsSaving(true);
          try {
            await savePreferences(next);
            setSettingsOpen(false);
          } finally {
            setPrefsSaving(false);
          }
        }}
        onSaveNotifications={async (next) => {
          setNotifySaving(true);
          try {
            await saveNotifications(next);
            setSettingsOpen(false);
          } finally {
            setNotifySaving(false);
          }
        }}
      />
      {showInstall ? (
        <div className="fixed inset-x-3 bottom-[calc(var(--safe-bottom)+12px)] z-50 max-w-[430px] rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm md:hidden">
          <div className="flex items-start justify-between gap-3">
            <p>
              On iPhone: tap <b>Share</b> then <b>Add to Home Screen</b>. That&apos;s how it becomes an app
              and how notifications work.
            </p>
            <button type="button" onClick={() => setInstallDismissed(true)} className="shrink-0 text-white">
              OK
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
