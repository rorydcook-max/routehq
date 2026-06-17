import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
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
            "You read vehicle odometer photos. Return only JSON with odometer_reading as an integer or null, confidence from 0 to 1, and note."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Read the odometer value in kilometers from this image. If there are multiple numbers, choose the main odometer, not trip meter."
            },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ],
      temperature: 0
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    return NextResponse.json({
      odometer_reading: typeof parsed.odometer_reading === "number" ? parsed.odometer_reading : null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      note: typeof parsed.note === "string" ? parsed.note : ""
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Odometer OCR failed." },
      { status: 500 }
    );
  }
}
