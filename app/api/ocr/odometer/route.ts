import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getCurrentMembership } from "@/lib/auth/roles";

export async function POST(request: Request) {
  try {
    // Staff only: each call costs money.
    if (!(await getCurrentMembership())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key is not configured." }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Upload an odometer photo." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type || "image/jpeg"};base64,${bytes.toString("base64")}`;
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You check photos taken at a vehicle handover. Return only JSON with: describes (a few words on what the photo actually shows), shows_odometer (true only if a dashboard odometer display with readable digits is visible), odometer_reading (integer, or null when shows_odometer is false), confidence (0 to 1), and note. If the photo is blank, a plain colour, blurred, or shows anything other than an odometer, shows_odometer is false, odometer_reading is null and confidence is 0. Never guess or make up a number."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Say what this photo shows. Only if it clearly shows an odometer, read the value in kilometres; with several numbers choose the main odometer, not the trip meter."
            },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ],
      temperature: 0
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
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
