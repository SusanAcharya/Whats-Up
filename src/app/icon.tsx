import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0c",
          color: "#ffffff",
          fontSize: 72,
          fontWeight: 600,
          letterSpacing: "-0.1em",
        }}
      >
        wu
      </div>
    ),
    size,
  );
}
