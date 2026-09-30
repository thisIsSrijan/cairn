import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Cairn: AI-Powered Data Intelligence Platform";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          backgroundColor: "#F3EFE6",
          color: "#1B1A17",
          border: "20px solid #EAE4D6",
          boxSizing: "border-box",
        }}
      >
        {/* Top Header: Brand mark + Type */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="7" y="43" width="50" height="14" rx="7" fill="#1B1A17" />
            <rect
              x="16"
              y="26"
              width="33"
              height="13"
              rx="6.5"
              fill="#1B1A17"
              transform="rotate(-3 32 32)"
            />
            <circle cx="33" cy="13" r="7" fill="#D9482B" />
          </svg>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                fontSize: 38,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "#1B1A17",
              }}
            >
              Cairn
            </div>
            <div
              style={{
                fontSize: 14,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "#5B574D",
                fontFamily: "monospace",
              }}
            >
              Field Ledger
            </div>
          </div>
        </div>

        {/* Center: Main Proposition */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: "#1B1A17",
            }}
          >
            Every cell carries its receipt.
          </div>
          <div
            style={{
              fontSize: 24,
              lineHeight: 1.4,
              color: "#5B574D",
              maxWidth: "900px",
            }}
          >
            AI-powered web data collection with verbatim evidence verification and provenance tracking.
          </div>
        </div>

        {/* Bottom Rule & Ledger Pipeline Trail */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 24,
            borderTop: "2px solid #D5CDB9",
            fontSize: 14,
            fontFamily: "monospace",
            color: "#5B574D",
            letterSpacing: "0.12em",
          }}
        >
          <div>DISCOVER : FETCH : EXTRACT : VALIDATE : DEDUPLICATE : VERIFY</div>
          <div style={{ color: "#D9482B", fontWeight: 700 }}>VERIFIED RECEPTACLE</div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
