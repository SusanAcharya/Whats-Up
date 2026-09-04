/** Shared JSX for PWA / OG / favicon app icons (ImageResponse) */

type Variant = "app" | "maskable";

/**
 * Bold chat-bubble mark for What's Up.
 * Designed to stay legible from 16–32px favicon → 512px home-screen icon.
 */
export function AppIconMark({
  size,
  variant = "app",
}: {
  size: number;
  variant?: Variant;
}) {
  const compact = size <= 48;
  const pad =
    variant === "maskable"
      ? Math.round(size * 0.18)
      : Math.round(size * (compact ? 0.06 : 0.1));
  const field = size - pad * 2;

  const bubbleW = Math.round(field * (compact ? 0.78 : 0.72));
  const bubbleH = Math.round(field * (compact ? 0.62 : 0.58));
  const bubbleR = Math.round(size * (compact ? 0.2 : 0.16));
  const bubbleLeft = Math.round((field - bubbleW) / 2);
  const bubbleTop = Math.round(field * (compact ? 0.16 : 0.14));

  const sat = Math.round(field * (compact ? 0.3 : 0.28));
  const satR = Math.round(sat * 0.42);
  const markSize = Math.round(size * (compact ? 0.48 : 0.36));
  const showSat = size >= 24;
  const showGlow = size >= 64;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0c",
      }}
    >
      <div
        style={{
          position: "relative",
          width: field,
          height: field,
          display: "flex",
        }}
      >
        {showGlow ? (
          <div
            style={{
              position: "absolute",
              left: Math.round(field * 0.12),
              top: Math.round(field * 0.18),
              width: Math.round(field * 0.76),
              height: Math.round(field * 0.64),
              borderRadius: Math.round(size * 0.28),
              background: "rgba(232, 149, 111, 0.22)",
              display: "flex",
            }}
          />
        ) : null}

        {/* Main coral bubble */}
        <div
          style={{
            position: "absolute",
            left: bubbleLeft,
            top: bubbleTop,
            width: bubbleW,
            height: bubbleH,
            borderRadius: bubbleR,
            background: compact
              ? "#e8956f"
              : "linear-gradient(160deg, #f0a57f 0%, #e8956f 45%, #d97850 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow:
              size >= 64
                ? `0 ${Math.max(2, size * 0.02)}px ${Math.max(8, size * 0.06)}px rgba(0,0,0,0.45)`
                : "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1a1008",
              fontSize: markSize,
              fontWeight: 800,
              letterSpacing: "-0.06em",
              lineHeight: 1,
            }}
          >
            ?
          </div>
        </div>

        {/* Tail */}
        {!compact ? (
          <div
            style={{
              position: "absolute",
              left: Math.round(bubbleLeft + bubbleW * 0.18),
              top: Math.round(bubbleTop + bubbleH - size * 0.04),
              width: Math.round(size * 0.11),
              height: Math.round(size * 0.11),
              background: "#d97850",
              transform: "rotate(45deg)",
              borderRadius: Math.round(size * 0.02),
              display: "flex",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              left: Math.round(bubbleLeft + bubbleW * 0.16),
              top: Math.round(bubbleTop + bubbleH - size * 0.05),
              width: Math.round(size * 0.14),
              height: Math.round(size * 0.14),
              background: "#e8956f",
              transform: "rotate(45deg)",
              display: "flex",
            }}
          />
        )}

        {/* Sky accent — group chat */}
        {showSat ? (
          <div
            style={{
              position: "absolute",
              right: Math.round(field * (compact ? 0 : 0.02)),
              top: Math.round(field * (compact ? 0.02 : 0.06)),
              width: sat,
              height: sat,
              borderRadius: satR,
              background: compact ? "#38bdf8" : "linear-gradient(145deg, #7dd3fc 0%, #38bdf8 55%, #0ea5e9 100%)",
              border: `${Math.max(1, Math.round(size * 0.02))}px solid #0a0a0c`,
              display: "flex",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
