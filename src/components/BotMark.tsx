import type { ReactNode } from "react";
import type { BotId } from "@/lib/types";
import { getBot, hexAlpha } from "@/lib/bots";

const SIZES = { sm: 32, md: 44, lg: 58, xl: 76 } as const;

const TILT: Record<string, string> = {
  globie: "-8deg",
  sporty: "7deg",
  techie: "-5deg",
  popcorn: "8deg",
  stonks: "-7deg",
  labrat: "6deg",
  pitch: "-11deg",
  group: "4deg",
};

function Plate({
  fill,
  ring,
  children,
}: {
  fill: string;
  ring: string;
  children: ReactNode;
}) {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
      <path
        d="M8 26c-1 16 10 32 26 31 15-1 27-14 25-29S45 4 29 6 9 10 8 26z"
        fill={fill}
        stroke={ring}
        strokeWidth="3.5"
      />
      {children}
    </svg>
  );
}

function Globie() {
  return (
    <Plate fill="#1d4ed8" ring="#93c5fd">
      <circle cx="32" cy="30" r="16" fill="#38bdf8" stroke="#0f172a" strokeWidth="2" />
      <path d="M20 26c8-10 20-8 24 4-10 2-14 10-22 8z" fill="#15803d" />
      <path d="M22 36c6 8 18 8 22 0" fill="#166534" />
      <path d="M16 30h32M32 14v32" stroke="#0f172a" strokeWidth="1.6" fill="none" />
      <circle cx="26" cy="26" r="4.2" fill="#fff" />
      <circle cx="39" cy="26" r="4.2" fill="#fff" />
      <circle cx="27" cy="27" r="1.8" fill="#111" />
      <circle cx="40" cy="27" r="1.8" fill="#111" />
      <path d="M26 38c4 4 10 4 14 0" stroke="#111" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M12 14 6 7M52 15l7-8" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
    </Plate>
  );
}

function Sporty() {
  return (
    <Plate fill="#14532d" ring="#4ade80">
      <circle cx="32" cy="33" r="16" fill="#fafafa" stroke="#111" strokeWidth="2.4" />
      <path
        d="M32 17v32M16 33h32M20 22c8 6 16 6 24 0M20 44c8-6 16-6 24 0"
        stroke="#111"
        strokeWidth="2"
        fill="none"
      />
      <path d="M18 12h28l-4 9H22z" fill="#ef4444" stroke="#111" strokeWidth="1.6" />
      <path d="M24 10h16" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
    </Plate>
  );
}

function Techie() {
  return (
    <Plate fill="#164e63" ring="#67e8f9">
      <rect x="13" y="16" width="38" height="26" rx="4" fill="#0f172a" stroke="#67e8f9" strokeWidth="2.6" />
      <rect x="17" y="20" width="30" height="17" fill="#22d3ee" />
      <circle cx="27" cy="28" r="3.4" fill="#fff" />
      <circle cx="38" cy="28" r="3.4" fill="#fff" />
      <circle cx="28" cy="28.6" r="1.5" fill="#111" />
      <circle cx="39" cy="28.6" r="1.5" fill="#111" />
      <path d="M29 35h8" stroke="#111" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M22 42h20l3 8H19z" fill="#67e8f9" stroke="#111" strokeWidth="1.4" />
      <circle cx="48" cy="15" r="4.2" fill="#f472b6" stroke="#111" strokeWidth="1.4" />
    </Plate>
  );
}

function Popcorn() {
  return (
    <Plate fill="#7c2d12" ring="#fbbf24">
      <circle cx="22" cy="20" r="8" fill="#fde68a" stroke="#111" strokeWidth="1.6" />
      <circle cx="33" cy="14" r="9" fill="#fef3c7" stroke="#111" strokeWidth="1.6" />
      <circle cx="45" cy="21" r="8" fill="#facc15" stroke="#111" strokeWidth="1.6" />
      <circle cx="32" cy="24" r="7" fill="#fde047" stroke="#111" strokeWidth="1.6" />
      <circle cx="30" cy="16" r="2" fill="#111" />
      <circle cx="38" cy="17" r="2" fill="#111" />
      <path d="M30 22c3 3 8 3 11 0" stroke="#111" strokeWidth="1.8" fill="none" />
      <path d="M18 32h28l-4 20H22z" fill="#ef4444" stroke="#111" strokeWidth="2" />
      <path d="M22 38h20M22 45h20" stroke="#fff" strokeWidth="2.4" />
    </Plate>
  );
}

function Stonks() {
  return (
    <Plate fill="#064e3b" ring="#34d399">
      <path d="M14 46 26 32l8 8 16-22" stroke="#a7f3d0" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M42 16h12v12" stroke="#a7f3d0" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M30 22 40 6l6 8-10 4z" fill="#f59e0b" stroke="#111" strokeWidth="1.5" />
      <circle cx="40" cy="9" r="4" fill="#fde047" stroke="#111" strokeWidth="1.4" />
      <circle cx="18" cy="50" r="6" fill="#34d399" />
      <path d="M16 51h4M18 49v4" stroke="#064e3b" strokeWidth="2" />
    </Plate>
  );
}

function Labrat() {
  return (
    <Plate fill="#3b0764" ring="#e9d5ff">
      <path
        d="M24 14h16v12l10 20c0 8-8 12-18 12s-18-4-18-12l10-20z"
        fill="#c084fc"
        stroke="#111"
        strokeWidth="2"
      />
      <path d="M22 42c5 8 15 8 20 0" fill="#7c3aed" />
      <circle cx="28" cy="38" r="3.2" fill="#fff" />
      <circle cx="38" cy="38" r="3.2" fill="#fff" />
      <circle cx="28.6" cy="38.5" r="1.4" fill="#111" />
      <circle cx="38.6" cy="38.5" r="1.4" fill="#111" />
      <circle cx="20" cy="16" r="3.4" fill="#86efac" stroke="#111" strokeWidth="1.2" />
      <circle cx="46" cy="13" r="4.2" fill="#86efac" stroke="#111" strokeWidth="1.2" />
      <circle cx="40" cy="8" r="2.6" fill="#bbf7d0" />
    </Plate>
  );
}

function Pitch() {
  return (
    <Plate fill="#7f1d1d" ring="#fda4af">
      <circle cx="32" cy="26" r="12" fill="#111" stroke="#fda4af" strokeWidth="3" />
      <circle cx="32" cy="26" r="4" fill="#fb7185" />
      <path
        d="M32 14v-6M18 26h-6M46 26h6M21 16l-5-5M43 16l5-5"
        stroke="#fda4af"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="16" y="42" width="32" height="13" rx="6" fill="#ef4444" stroke="#111" strokeWidth="1.8" />
      <text x="32" y="52" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="800">
        LIVE
      </text>
    </Plate>
  );
}

function Group() {
  return (
    <Plate fill="#1c1917" ring="#fdba74">
      <rect x="10" y="16" width="26" height="18" rx="8" fill="#e8956f" stroke="#111" strokeWidth="2" />
      <rect x="26" y="26" width="28" height="18" rx="8" fill="#38bdf8" stroke="#111" strokeWidth="2" />
      <rect x="16" y="36" width="24" height="16" rx="8" fill="#facc15" stroke="#111" strokeWidth="2" />
      <text x="32" y="33" textAnchor="middle" fontSize="11" fill="#111" fontWeight="800">
        um
      </text>
    </Plate>
  );
}

const MARKS: Record<string, () => ReactNode> = {
  globie: Globie,
  sporty: Sporty,
  techie: Techie,
  popcorn: Popcorn,
  stonks: Stonks,
  labrat: Labrat,
  pitch: Pitch,
  group: Group,
};

export function BotMark({
  id,
  size = "md",
  className = "",
}: {
  id?: string | BotId;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const key = id && MARKS[id] ? id : "group";
  const Mark = MARKS[key];
  const bot = id ? getBot(id) : undefined;
  const px = SIZES[size];
  return (
    <span
      className={`bot-mark relative inline-grid shrink-0 place-items-center ${className}`}
      style={{
        width: px,
        height: px,
        transform: `rotate(${TILT[key] ?? "0deg"})`,
        filter: `drop-shadow(3px 4px 0 ${hexAlpha(bot?.color ?? "#fdba74", 0.55)})`,
      }}
    >
      <Mark />
    </span>
  );
}
