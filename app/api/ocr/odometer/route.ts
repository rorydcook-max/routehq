import { NextResponse } from "next/server";
import { readFileAsJson, visionProvider } from "@/lib/ai-vision";
import { getCurrentMembership } from "@/lib/auth/roles";

export async function POST(request: Request) {
  try {
    // Staff only: each call costs money.
    if (!(await getCurrentMembership())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    if (!visionProvider()) {
      return NextResponse.json({ error: "Photo reading is not set up." }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Upload an odometer photo." }, { status: 400 });
    }

    const parsed = await readFileAsJson({
      system:
        "You check photos taken at a vehicle handover. Return JSON with: describes (a few words on what the photo actually shows), shows_odometer (true only if a dashboard odometer display with readable digits is visible), odometer_reading (integer, or null when shows_odometer is false), confidence (0 to 1), and note. If the photo is blank, a plain colour, blurred, or shows anything other than an odometer, shows_odometer is false, odometer_reading is null and confidence is 0. Never guess or make up a number.",
      prompt: "Say what this photo shows. Only if it clearly shows an odometer, read the value in kilometres; with several numbers choose the main odometer, not the trip meter.",
      bytes: Buffer.from(await file.arrayBuffer()),
      mediaType: file.type || "image/jpeg",
      maxTokens: 300
    });
    const seen = parsed.shows_odometer === true && typeof parsed.odometer_reading === "number";
    return NextResponse.json({
      odometer_reading: seen ? parsed.odometer_reading : null,
      confidence: seen && typeof parsed.confidence === "number" ? parsed.confidence : 0,
      note: typeof parsed.note === "string" ? parsed.note : ""
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Odometer OCR failed." },
      { status: 500 }
    );
  }
}
