import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  const secret = process.env.LINE_CHANNEL_SECRET ?? "";
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  if (expected !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { events?: unknown[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = Array.isArray(payload.events) ? payload.events : [];

  for (const event of events) {
    const e = event as Record<string, unknown>;
    const source = e.source as Record<string, unknown> | undefined;
    const userId = source?.userId;

    if (e.type === "follow") {
      console.log("[LINE webhook] follow event — userId:", userId);
    } else if (e.type === "message") {
      const message = e.message as Record<string, unknown> | undefined;
      console.log("[LINE webhook] message event — userId:", userId, "message:", message);
    }
  }

  return NextResponse.json({ ok: true });
}
