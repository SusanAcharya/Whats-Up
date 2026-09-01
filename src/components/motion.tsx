"use client";

import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type HTMLMotionProps,
  type Transition,
} from "motion/react";
import type { ReactNode } from "react";

export { motion, AnimatePresence, useReducedMotion };

export const spring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 32,
};

export const springSoft: Transition = {
  type: "spring",
  stiffness: 280,
  damping: 28,
};

export function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ ...springSoft, delay }}
    >
      {children}
    </motion.div>
  );
}

export function SlideFromRight({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={spring}
    >
      {children}
    </motion.div>
  );
}

export function SheetPanel({
  children,
  className,
  ...props
}: HTMLMotionProps<"div"> & { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, x: "100%" }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduce ? undefined : { opacity: 0, x: "100%" }}
      transition={spring}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function Backdrop({
  onClose,
  className,
}: {
  onClose: () => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      aria-label="Close"
      onClick={onClose}
      className={className}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduce ? undefined : { opacity: 0 }}
      transition={{ duration: 0.2 }}
    />
  );
}

export function MessageEnter({
  children,
  index = 0,
  className,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...springSoft, delay: Math.min(index * 0.03, 0.15) }}
    >
      {children}
    </motion.div>
  );
}

export function ListRowEnter({
  children,
  index,
  className,
}: {
  children: ReactNode;
  index: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...springSoft, delay: index * 0.04 }}
    >
      {children}
    </motion.div>
  );
}

export function ExpandHeight({ children, open }: { children: ReactNode; open: boolean }) {
  const reduce = useReducedMotion();
  if (reduce) return open ? <div>{children}</div> : null;
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={springSoft}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
