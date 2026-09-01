"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "@/lib/store";
import { ingestStatusText } from "@/lib/ingest-feedback";
import { BotMark } from "./BotMark";
import { ChatList } from "./ChatList";
import { ChatThread } from "./ChatThread";
import { Onboarding } from "./Onboarding";
import { SettingsScreen } from "./SettingsScreen";
import { SlideFromRight, springSoft } from "./motion";

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

function LoadingShell() {
  return (
    <motion.div
      className="app-shell screen-canvas grid place-items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={springSoft}
    >
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springSoft, delay: 0.05 }}
      >
        <BotMark id="group" size="lg" />
        <p className="text-[15px] text-[var(--ink-muted)]">Opening your chats…</p>
      </motion.div>
    </motion.div>
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
    return <LoadingShell />;
  }

  if (!profile.onboarded) {
    return (
      <div className="app-shell screen-canvas">
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
    <div className="app-shell screen-canvas relative mx-auto w-full md:grid md:max-w-[960px] md:grid-cols-[320px_1fr] md:border-x md:border-[var(--hairline)]">
      <div className={`h-full min-h-0 ${selectedChatId ? "hidden md:block" : "block"}`}>
        <ChatList
          onOpenSettings={() => openSettings("alerts")}
          statusText={statusText}
          onDismissStatus={dismissIngestBanner}
        />
      </div>
      <div
        className={`h-full min-h-0 md:border-l md:border-[var(--hairline)] ${selectedChatId ? "block" : "hidden md:block"}`}
      >
        <AnimatePresence mode="wait">
          {selectedChatId ? (
            <SlideFromRight key={selectedChatId} className="h-full">
              <ChatThread onOpenSettings={openSettings} />
            </SlideFromRight>
          ) : (
            <motion.div
              key="empty"
              className="screen-canvas hidden h-full flex-col items-center justify-center px-8 text-center md:flex"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-4 flex -space-x-2">
                {profile.enabledBots.slice(0, 3).map((id) => (
                  <BotMark key={id} id={id} size="md" />
                ))}
              </div>
              <p className="text-[17px] font-semibold text-[var(--ink-muted)]">Pick a chat</p>
              <p className="mt-2 max-w-[260px] text-[15px] leading-relaxed text-[var(--ink-faint)]">
                Bots DM you when something matters. The timeline shows everything together.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
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
        <div className="fixed inset-x-0 bottom-[calc(var(--safe-bottom)+12px)] z-50 flex justify-center px-4 md:hidden">
          <div className="w-full max-w-[430px] rounded-[var(--radius-md)] border border-[var(--hairline-strong)] bg-[var(--elevated)] px-4 py-3.5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] leading-5 text-[var(--ink-muted)]">
                Tap <strong className="text-[var(--ink)]">Share</strong> then{" "}
                <strong className="text-[var(--ink)]">Add to Home Screen</strong> for notifications.
              </p>
              <button type="button" onClick={() => setInstallDismissed(true)} className="btn-icon h-8 w-8 shrink-0">
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
