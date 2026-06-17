import { NextResponse } from "next/server";
import { googleSheetToSpreadsheetInput, isGoogleSheetsUrl, parseSpreadsheetFile } from "@/lib/import/spreadsheet";

function getOutputText(payload: any) {
  return payload.choices?.[0]?.message?.content || "";
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set in .env.local." }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const sheetUrl = String(formData.get("sheetUrl") || "").trim();
  const importType = String(formData.get("importType") || "mixed");

  if ((!(file instanceof File) || file.size === 0) && !sheetUrl) {
    return NextResponse.json({ error: "Upload a spreadsheet or paste a public Google Sheets link first." }, { status: 400 });
  }

  let sheets;
  try {
    const spreadsheetInput = sheetUrl
      ? await googleSheetToSpreadsheetInput(sheetUrl)
      : file instanceof File
        ? file
        : null;

    if (!spreadsheetInput) {
      return NextResponse.json({ error: "Upload a spreadsheet or paste a public Google Sheets link first." }, { status: 400 });
    }

    if (sheetUrl && !isGoogleSheetsUrl(sheetUrl)) {
      return NextResponse.json({ error: "Only public Google Sheets links are supported." }, { status: 400 });
    }

    sheets = await parseSpreadsheetFile(spreadsheetInput);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to parse spreadsheet." }, { status: 400 });
  }

  if (sheets.length === 0) {
    return NextResponse.json({ error: "No readable rows were found in this spreadsheet." }, { status: 400 });
  }

  const sheetSummary = sheets.map((sheet) => ({
    sheet_name: sheet.sheetName,
    headers: sheet.headers,
    sample_rows: sheet.sampleRows
  }));

  const prompt = `You are a data import assistant for FleetOS, a vehicle rental management platform.

A user has uploaded a spreadsheet to import their rental business data. Analyze the column headers and sample data below and map each column to the appropriate FleetOS field.

Requested import type: ${importType}

FleetOS vehicle fields: registration_number, make, model, trim, year, color, transmission, engine_cc, fuel_type, seating_capacity, drivetrain, body_type, vin, purchase_date, purchase_price, purchase_mileage, current_mileage, estimated_value, daily_rate, weekly_rate, monthly_rate, tax_expiry_date, tax_cost, insurance_expiry_date, insurance_cost, insurance_sum_insured, porbor_expiry_date, porbor_cost, next_service_date, finance_lender, finance_monthly_payment, finance_outstanding, finance_end_date, gps_tracker_url, notes, vehicle, vehicle_name, description

FleetOS customer fields: full_name, phone, email, nationality, passport_number, driving_licence_number, emergency_contact_name, emergency_contact_phone

FleetOS rental fields: vehicle_registration, customer_name, start_date, end_date, monthly_rate, deposit_amount, mileage_at_start, mileage_at_end, next_payment_date

FleetOS transaction fields: vehicle_registration, date, type, amount, notes

Sheet data: ${JSON.stringify(sheetSummary)}

Important: sheet_name must exactly match one of the provided sheet_name values.

Return ONLY a JSON object. No explanation. Structure:
{
  "detected_data_types": ["vehicles", "rentals"],
  "sheets": [
    {
      "sheet_name": "Master",
      "primary_data_type": "vehicles",
      "confidence": 0.95,
      "column_mappings": [
        {
          "source_column": "License Plate",
          "fleetos_field": "registration_number",
          "confidence": 0.99,
          "sample_values": ["4ขผ8612", "ขษ5168"]
        }
      ],
      "unmapped_columns": ["Full Spec Sheet"]
    }
  ],
  "import_summary": "Found 6 vehicles across 1 sheet with compliance dates, finance details, and rental information."
}`;

  const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMPORT_MODEL || "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Return strict JSON only. Do not include markdown or commentary."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    })
  });

  const payload = await openaiResponse.json();

  if (!openaiResponse.ok) {
    return NextResponse.json({ error: payload.error?.message || "OpenAI import analysis failed." }, { status: openaiResponse.status });
  }

  try {
    const analysis = JSON.parse(getOutputText(payload));
    return NextResponse.json({
      analysis,
      parsed: {
        sheets: sheets.map((sheet) => ({
          sheet_name: sheet.sheetName,
          headers: sheet.headers,
          row_count: sheet.rows.length,
          sample_rows: sheet.sampleRows
        }))
      }
    });
  } catch {
    return NextResponse.json({ error: "OpenAI returned invalid JSON.", raw: getOutputText(payload) }, { status: 502 });
  }
}
