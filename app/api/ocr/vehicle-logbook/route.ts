import { NextResponse } from "next/server";

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    registration_number: { type: ["string", "null"] },
    vin: { type: ["string", "null"] },
    make: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    year: { type: ["integer", "null"] },
    trim: { type: ["string", "null"] },
    color: { type: ["string", "null"] },
    engine_cc: { type: ["integer", "null"] },
    seating_capacity: { type: ["integer", "null"] },
    transmission: { type: ["string", "null"] },
    tax_expiry_date: { type: ["string", "null"] },
    porbor_expiry_date: { type: ["string", "null"] },
    insurance_expiry_date: { type: ["string", "null"] },
    notes: { type: ["string", "null"] },
    confidence: { type: "number" }
  },
  required: [
    "registration_number",
    "vin",
    "make",
    "model",
    "year",
    "trim",
    "color",
    "engine_cc",
    "seating_capacity",
    "transmission",
    "tax_expiry_date",
    "porbor_expiry_date",
    "insurance_expiry_date",
    "notes",
    "confidence"
  ]
};

function dataUrl(file: File, base64: string) {
  return `data:${file.type || "application/octet-stream"};base64,${base64}`;
}

function getOutputText(response: any) {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return "";
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set in .env.local." }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Upload a logbook image or PDF first." }, { status: 400 });
  }

  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only images and PDFs are supported for logbook OCR." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const base64 = bytes.toString("base64");
  const filePart =
    file.type === "application/pdf"
      ? {
          type: "input_file",
          filename: file.name || "vehicle-logbook.pdf",
          file_data: dataUrl(file, base64)
        }
      : {
          type: "input_image",
          image_url: dataUrl(file, base64),
          detail: "high"
        };

  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Extract vehicle registration/logbook fields from Thai blue books, car titles, registration books, and vehicle logbooks. Return JSON only. If a field is unreadable, return null. Dates must be ISO YYYY-MM-DD when possible. Preserve Thai registration text if shown."
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Read this vehicle title/logbook/blue book and extract fields for a fleet management vehicle form. Focus on registration number, VIN or chassis/frame number, make, model, year, color, engine size, and renewal dates."
            },
            filePart
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "vehicle_logbook_extraction",
          strict: true,
          schema: extractionSchema
        }
      },
      max_output_tokens: 1200
    })
  });

  const payload = await openaiResponse.json();

  if (!openaiResponse.ok) {
    return NextResponse.json({ error: payload.error?.message || "OpenAI OCR request failed." }, { status: openaiResponse.status });
  }

  const outputText = getOutputText(payload);

  if (!outputText) {
    return NextResponse.json({ error: "No OCR result was returned." }, { status: 502 });
  }

  try {
    return NextResponse.json({ extracted: JSON.parse(outputText) });
  } catch {
    return NextResponse.json({ error: "OCR result was not valid JSON.", raw: outputText }, { status: 502 });
  }
}
