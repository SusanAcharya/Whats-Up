"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { IconClose } from "../icons";
import { springSoft } from "../motion";

export function ScreenTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)]">
      {children}
    </h1>
  );
}

export function MetaLabel({ children }: { children: ReactNode }) {
  return <p className="text-[13px] text-[var(--ink-faint)]">{children}</p>;
}

export function StatusBanner({
  text,
  ingesting,
  onDismiss,
}: {
  text: string;
  ingesting?: boolean;
  onDismiss?: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--elevated)] px-3 py-2.5">
      {ingesting ? (
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--ink-faint)]" />
      ) : null}
      <p className="min-w-0 flex-1 text-[13px] leading-5 text-[var(--ink-muted)]">{text}</p>
      {!ingesting && onDismiss ? (
        <button type="button" onClick={onDismiss} className="btn-icon h-8 w-8" aria-label="Dismiss">
          <IconClose className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function Toggle({
  on,
  onChange,
  label,
  accent,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  accent?: string;
}) {
  const track = on ? (accent ?? "var(--sent)") : "rgba(255,255,255,0.14)";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="h-[31px] w-[51px] shrink-0 rounded-[var(--radius-full)] p-[2px] transition-colors duration-200"
      style={{ background: track }}
    >
      <span
        className="block h-[27px] w-[27px] rounded-[var(--radius-full)] bg-white shadow-sm transition-transform duration-200"
        style={{ transform: on ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

export function PrimaryButton({
  children,
  disabled,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className="btn-primary">
      {children}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: ReactNode }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="segmented relative">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`segmented-btn relative z-10 ${active === tab.id ? "segmented-btn-active" : ""}`}
        >
          {active === tab.id ? (
            <motion.span
              layoutId="segment-pill"
              className="absolute inset-0 rounded-[calc(var(--radius-md)-3px)] bg-[var(--panel)]"
              transition={springSoft}
            />
          ) : null}
          <span className="relative">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

export function SheetHeader({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <header className="app-header hairline-b shrink-0 px-4 pb-3 md:px-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-[var(--ink)]">{title}</h2>
        <button type="button" onClick={onClose} className="btn-icon" aria-label="Close">
          <IconClose className="h-[18px] w-[18px]" />
        </button>
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </header>
  );
}

export function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-[3px] flex-1 rounded-[var(--radius-full)] transition-colors"
          style={{ background: i < step ? "var(--ink)" : "var(--elevated)" }}
        />
      ))}
    </div>
  );
}

export { ChatListSkeleton, ThreadSkeleton, AppLoadingSkeleton, MessageListSkeleton } from "./Skeleton";
