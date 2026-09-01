/** Shared JSX for PWA / OG app icons (ImageResponse) */

export function AppIconMark({ size }: { size: number }) {
  const pad = Math.round(size * 0.14);
  const bubbleH = Math.round(size * 0.28);
  const bubbleW = Math.round(size * 0.42);
  const r = Math.round(size * 0.12);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(145deg, #121214 0%, #0a0a0c 55%, #0e0e12 100%)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: size - pad * 2,
          height: size - pad * 2,
          display: "flex",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: Math.round(size * 0.08),
            width: bubbleW,
            height: bubbleH,
            borderRadius: r,
            background: "#e8956f",
            border: `${Math.max(2, size * 0.02)}px solid #1a1008`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 0,
            top: Math.round(size * 0.2),
            width: bubbleW,
            height: bubbleH,
            borderRadius: r,
            background: "#38bdf8",
            border: `${Math.max(2, size * 0.02)}px solid #0c1824`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: Math.round(size * 0.06),
            bottom: Math.round(size * 0.06),
            width: bubbleW * 0.92,
            height: bubbleH,
            borderRadius: r,
            background: "#facc15",
            border: `${Math.max(2, size * 0.02)}px solid #1a1408`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(size * 0.14),
            fontWeight: 800,
            color: "#1a1408",
            letterSpacing: "-0.04em",
          }}
        >
          up
        </div>
      </div>
    </div>
  );
}
