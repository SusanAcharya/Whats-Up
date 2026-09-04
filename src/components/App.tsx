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
import { FlashDeck } from "./FlashDeck";
import { SlideFromRight } from "./motion";
import { AppLoadingSkeleton } from "./ui";

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

const PENDING_CHAT_KEY = "pendingChat";

function readPendingChat() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("chat") || sessionStorage.getItem(PENDING_CHAT_KEY);
}

function stashPendingChat(chat: string) {
  sessionStorage.setItem(PENDING_CHAT_KEY, chat);
}

function clearPendingChat() {
  sessionStorage.removeItem(PENDING_CHAT_KEY);
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
  const [settingsTab, setSettingsTab] = useState<"alerts" | "topics" | "bots">("alerts");
  const [flashOpen, setFlashOpen] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [notifySaving, setNotifySaving] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const showInstall = useShowIosInstall() && !installDismissed;
  const ingestRef = useRef(ingest);
  const selectChatRef = useRef(selectChat);

  useEffect(() => {
    ingestRef.current = ingest;
  }, [ingest]);

  useEffect(() => {
    selectChatRef.current = selectChat;
  }, [selectChat]);

  useEffect(() => {
    const pending = readPendingChat();
    if (pending) stashPendingChat(pending);
  }, []);

  useEffect(() => {
    if (!ready || !profile?.onboarded) return;

    const openPending = () => {
      const pending = readPendingChat();
      if (!pending) return;
      clearPendingChat();
      void selectChatRef.current(pending);
      window.history.replaceState({}, "", "/");
    };

    openPending();

    const onNavigate = (event: Event) => {
      const chat = (event as CustomEvent<{ chat: string }>).detail?.chat;
      if (!chat) return;
      clearPendingChat();
      void selectChatRef.current(chat);
      window.history.replaceState({}, "", "/");
    };

    window.addEventListener("whatsup-navigate", onNavigate);
    return () => window.removeEventListener("whatsup-navigate", onNavigate);
  }, [ready, profile?.onboarded]);

  useEffect(() => {
    if (!ready || !profile?.onboarded) return;
    void ingestRef.current("open");
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void ingestRef.current("open");
    }, 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [profile?.onboarded, ready]);

  if (!ready || !profile) {
    return <AppLoadingSkeleton />;
  }

  if (!profile.onboarded) {
    return (
      <div className="app-shell screen-canvas">
        <Onboarding />
      </div>
    );
  }

  const statusText = ingestStatusText(lastIngestResult, ingesting);

  function openSettings(tab: "alerts" | "topics" | "bots" = "alerts") {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }

  return (
    <div className="app-shell screen-canvas relative mx-auto w-full md:grid md:max-w-[960px] md:grid-cols-[320px_1fr] md:border-x md:border-[var(--hairline)]">
      <div className={`h-full min-h-0 ${selectedChatId ? "hidden md:block" : "block"}`}>
        <ChatList
          onOpenSettings={() => openSettings("alerts")}
          onOpenFlash={() => {
            setFlashKey((key) => key + 1);
            setFlashOpen(true);
          }}
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
      <FlashDeck
        key={flashKey}
        open={flashOpen}
        onClose={() => setFlashOpen(false)}
        onOpenTopics={() => {
          setFlashOpen(false);
          openSettings("topics");
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
