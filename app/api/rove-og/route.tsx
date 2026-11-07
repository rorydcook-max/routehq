import { ImageResponse } from "next/og";

/**
 * rove.rent's share picture (1200 x 630) for link previews and search results: the page's title on Rove's road
 * (the asphalt band with its yellow centre line). /api/rove-og?title=…&subtitle=… (lib/rove/seo.ts roveOgImage).
 */
export const runtime = "edge";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const title = String(params.get("title") || "Rent from the people who live there").slice(0, 90);
  const subtitle = String(params.get("subtitle") || "").slice(0, 120);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f5f7f4", color: "#13313a", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", padding: "64px 72px 0", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 700 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#06b6b6" }} />
            Rove
          </div>
          <div style={{ display: "flex", marginTop: 40, fontSize: title.length > 48 ? 58 : 72, fontWeight: 800, lineHeight: 1.04, letterSpacing: -1.5, maxWidth: 1000 }}>{title}</div>
          {subtitle ? <div style={{ display: "flex", marginTop: 22, fontSize: 28, color: "#50676d", maxWidth: 980, lineHeight: 1.3 }}>{subtitle}</div> : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", height: 120, background: "#273338", padding: "0 0" }}>
          <div style={{ display: "flex", width: "100%", gap: 40 }}>
            {Array.from({ length: 14 }, (_, index) => (
              <div key={index} style={{ width: 56, height: 8, background: "#f5b92e", flexShrink: 0 }} />
            ))}
          </div>
        </div>
        <div style={{ position: "absolute", right: 72, top: 70, display: "flex", fontSize: 26, color: "#50676d", fontWeight: 700 }}>rove.rent</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "cache-control": "public, max-age=86400, s-maxage=604800" } }
  );
}
