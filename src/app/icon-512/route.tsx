import { ImageResponse } from "next/og";

export async function GET() {
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
          fontSize: 190,
          fontWeight: 600,
          letterSpacing: "-0.1em",
        }}
      >
        wu
      </div>
    ),
    { width: 512, height: 512 },
  );
}
