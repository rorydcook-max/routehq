import { said } from "@/lib/i18n/server-text";
import { NextResponse } from "next/server";
import { readFileAsJson, visionProvider } from "@/lib/ai-vision";
import { getCurrentMembership } from "@/lib/auth/roles";

/** A date on paperwork that runs out: Gregorian, fixing a Buddhist year, from a year ago to three years ahead. */
function paperExpiry(value: unknown) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  let year = Number(match[1]);
  if (year > 2400) year -= 543;
  const iso = `${year}-${match[2]}-${match[3]}`;
  const time = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(time)) return null;
  const days = (time - Date.now()) / 86_400_000;
  return days < -400 || days > 1200 ? null : iso;
}

/**
 * The new policy, Por Ror Bor certificate, road tax receipt or tax disc, photographed after renewing:
 * the new expiry date and what it cost come back to fill in the renewal.
 */
export async function POST(request: Request) {
  try {
    if (!(await getCurrentMembership())) return NextResponse.json({ error: await said("Sign in first.") }, { status: 401 });
    if (!visionProvider(false)) return NextResponse.json({ error: await said("Photo reading is not set up.") }, { status: 400 });
    const formData = await request.formData();
    const file = formData.get("file");
    const expected = String(formData.get("type") || "");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: await said("Choose a photo of the document.") }, { status: 400 });
    if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: await said("That file is too large. Use a photo under 12 MB.") }, { status: 400 });

    const raw = await readFileAsJson({
      system:
        "You read Thai vehicle paperwork after a renewal: compulsory insurance (พ.ร.บ., Por Ror Bor) certificates, voluntary insurance policies (ประกันภัยรถยนต์ ชั้น 1/2/3), road tax receipts and tax discs (ป้ายภาษี / เครื่องหมายแสดงการเสียภาษี). " +
        "Return JSON with: kind (porbor, insurance, tax, or null when it is none of these), expiry_date (when the cover or tax runs out, yyyy-mm-dd Gregorian; Thai documents often use the Buddhist year, subtract 543; null if not readable), " +
        "cost (the total paid in baht including stamp duty and VAT, number, or null), provider (insurer or office name, or null), policy_number (or null), plate (number plate on it, or null), confidence (0 to 1). Never guess a date or number.",
      prompt: `Read this document.${expected ? ` It should be: ${expected}.` : ""}`,
      bytes: Buffer.from(await file.arrayBuffer()),
      mediaType: file.type || "image/jpeg",
      maxTokens: 400,
      personal: false
    });
    const cost = Number(raw.cost);
    return NextResponse.json({
      kind: ["porbor", "insurance", "tax"].includes(String(raw.kind)) ? String(raw.kind) : null,
      expiryDate: paperExpiry(raw.expiry_date),
      cost: Number.isFinite(cost) && cost > 0 && cost < 1_000_000 ? Math.round(cost * 100) / 100 : null,
      provider: typeof raw.provider === "string" ? raw.provider.slice(0, 80) : null,
      policyNumber: typeof raw.policy_number === "string" ? raw.policy_number.slice(0, 60) : null,
      plate: typeof raw.plate === "string" ? raw.plate.slice(0, 20) : null
    });
  } catch (error) {
    console.error("[ocr/renewal]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: await said("The document could not be read. Type the date in.") }, { status: 502 });
  }
}
