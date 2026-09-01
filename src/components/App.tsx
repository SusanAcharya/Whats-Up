"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BOT_IDS } from "@/lib/types";
import { useStore } from "@/lib/store";
import { ChatList } from "./ChatList";
import { ChatThread } from "./ChatThread";
import { MembersSheet } from "./MembersSheet";
import { Onboarding } from "./Onboarding";
import { PreferencesScreen } from "./Preferences";

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
  const { ready, profile, selectedChatId, ingest, savePreferences } = useStore();
  const [membersOpen, setMembersOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const showInstall = useShowIosInstall() && !installDismissed;
  const ingestRef = useRef(ingest);

  useEffect(() => {
    ingestRef.current = ingest;
  }, [ingest]);

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
        <p className="text-sm text-[var(--muted)]">opening the group chat...</p>
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

  const prefBots =
    profile.enabledBots.length > 0
      ? profile.enabledBots
      : BOT_IDS;

  return (
    <div className="app-shell relative mx-auto w-full bg-black md:grid md:max-w-5xl md:grid-cols-[280px_1fr]">
      <div
        className={`h-full min-h-0 ${selectedChatId ? "hidden md:block" : "block"}`}
      >
        <ChatList
          onOpenMembers={() => setMembersOpen(true)}
          onOpenPrefs={() => setPrefsOpen(true)}
        />
      </div>
      <div
        className={`h-full min-h-0 ${selectedChatId ? "block" : "hidden md:block"}`}
      >
        {selectedChatId ? (
          <ChatThread
            onOpenMembers={() => setMembersOpen(true)}
            onOpenPrefs={() => setPrefsOpen(true)}
          />
        ) : (
          <div className="chat-bg hidden h-full place-items-center px-8 text-center md:grid">
            <p className="display text-2xl font-black italic text-white/30 md:text-3xl">
              pick a chat. we keep it loud on purpose.
            </p>
          </div>
        )}
      </div>
      <MembersSheet open={membersOpen} onClose={() => setMembersOpen(false)} />
      <PreferencesScreen
        open={prefsOpen}
        botIds={[...prefBots]}
        initial={profile.preferences}
        saving={prefsSaving}
        onClose={() => setPrefsOpen(false)}
        onSave={async (next) => {
          setPrefsSaving(true);
          try {
            await savePreferences(next);
            setPrefsOpen(false);
          } finally {
            setPrefsSaving(false);
          }
        }}
      />
      {showInstall ? (
        <div className="fixed inset-x-3 bottom-[calc(var(--safe-bottom)+12px)] z-50 max-w-[430px] rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm md:hidden">
          <div className="flex items-start justify-between gap-3">
            <p>
              on iPhone: tap <b>Share</b> then <b>Add to Home Screen</b>. that&apos;s how it becomes an app
              and how notifications work.
            </p>
            <button type="button" onClick={() => setInstallDismissed(true)} className="shrink-0 text-white">
              ok
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
