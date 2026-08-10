import { ImageResponse } from "next/og";

/**
 * The share card. Generated rather than a checked-in PNG so the ward can edit
 * the wording here without opening a design tool — most visitors arrive from a
 * link pasted into GroupMe, so this is the first thing they see.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Provo YSA 147th Ward";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fdfaf5",
          color: "#2f2a24",
          fontFamily: "sans-serif",
          padding: 80,
        }}
      >
        <div style={{ fontSize: 76, fontWeight: 700, textAlign: "center" }}>
          Provo YSA 147th Ward
        </div>
        <div style={{ fontSize: 36, color: "#6b6157", marginTop: 24 }}>
          Events, groups, and what&apos;s happening
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 48 }}>
          {[
            ["#d4f0e0", "#0f5c3a"],
            ["#e5ddf8", "#4a3690"],
            ["#fde3d0", "#8a4212"],
            ["#d6e9fb", "#134d7d"],
          ].map(([background, border]) => (
            <div
              key={background}
              style={{
                width: 88,
                height: 20,
                borderRadius: 999,
                backgroundColor: background,
                border: `2px solid ${border}`,
              }}
            />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
