import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const logDir = path.join(rootDir, "logs");
const errorLogPath = path.join(logDir, "trim-catalog-errors.log");

dotenv.config({ path: path.join(rootDir, ".env.local") });

const preferredMakeOrder = [
  "Toyota",
  "Honda",
  "Ford",
  "Isuzu",
  "Mitsubishi",
  "Mazda",
  "Suzuki",
  "MG",
  "Nissan",
  "Hyundai",
  "Kia"
];

const motorcycleCategories = new Set(["motorcycle", "scooter"]);
const allowedTransmissions = new Set(["Automatic", "Manual", "CVT", "DCT", "Automatic/Manual"]);
const allowedFuelTypes = new Set(["petrol", "diesel", "hybrid", "plug-in hybrid", "electric", "petrol/hybrid"]);
const allowedDrivetrains = new Set(["FWD", "RWD", "AWD", "4WD", "RWD/4WD"]);
const electricFuelTypes = new Set(["electric", "plug-in hybrid"]);

function parseArgs(argv) {
  const args = {
    dryRun: false,
    market: "TH",
    skipExisting: false,
    refreshExisting: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (arg === "--skip-existing") {
      args.skipExisting = true;
      continue;
    }

    if (arg === "--refresh-existing") {
      args.refreshExisting = true;
      continue;
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    const valueParts = [];
    let valueIndex = index + 1;

    while (valueIndex < argv.length && !argv[valueIndex].startsWith("--")) {
      valueParts.push(argv[valueIndex]);
      valueIndex += 1;
    }

    if (valueParts.length === 0) {
      throw new Error(`Missing value for ${arg}`);
    }

    args[key] = valueParts.join(" ");
    index = valueIndex - 1;
  }

  if (args.model && !args.make) {
    throw new Error("--model requires --make.");
  }

  if (args.limit) {
    const parsedLimit = Number(args.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      throw new Error("--limit must be a positive integer.");
    }
    args.limit = parsedLimit;
  }

  return args;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function appendErrorLog(message, rawPayload) {
  await fs.mkdir(logDir, { recursive: true });
  const entry = [
    `\n[${new Date().toISOString()}] ${message}`,
    rawPayload ? (typeof rawPayload === "string" ? rawPayload : JSON.stringify(rawPayload, null, 2)) : ""
  ].join("\n");
  await fs.appendFile(errorLogPath, `${entry}\n`, "utf8");
}

function buildPrompt({ makeName, modelName, categoryCode, market }) {
  const marketLine = market === "TH" ? "Thailand (TH)" : market;

  return `You are a vehicle data specialist with expert knowledge of cars and motorcycles sold in Thailand.

Generate complete, accurate trim data for every variant of the following vehicle sold in Thailand from 2005 to present:
Make: ${makeName}
Model: ${modelName}
Category: ${categoryCode}
Market: ${marketLine}

Return ONLY a JSON object with a "trims" array. No explanation, no markdown. Example structure:
{"trims": [{"name": "WildTrak 2.0L Bi-Turbo 4x4 10AT", "year_from": 2018, "year_to": 2021, "engine_cc": 2000, "transmission": "Automatic", "fuel_type": "diesel", "seating_capacity": 5, "drivetrain": "4WD", "confidence_score": 0.95}]}

EV example:
{"trims": [{"name": "eDrive40 76.6kWh RWD", "year_from": 2022, "year_to": null, "engine_cc": null, "transmission": "Automatic", "fuel_type": "electric", "seating_capacity": 5, "drivetrain": "RWD", "confidence_score": 0.9}]}

Rules:
- Each object is ONE specific purchasable variant with full spec in the name
- Include all generations as separate year ranges
- name must include trim level + engine + drivetrain e.g. "XLT 2.2L 4x2 6AT" not just "XLT"
- For electric vehicles, name must include battery size or grade + drivetrain, e.g. "eDrive40 76.6kWh RWD"; never use "0L", "0.0L", or "1AT" in EV trim names
- For plug-in hybrids, use the PHEV/plug-in hybrid grade and drivetrain; engine_cc may be null if not confidently known
- transmission: "Automatic", "Manual", "CVT", "DCT", or "Automatic/Manual"
- fuel_type: "petrol", "diesel", "hybrid", "plug-in hybrid", "electric", or "petrol/hybrid"
- drivetrain: "FWD", "RWD", "AWD", "4WD", or "RWD/4WD"
- year_to: null if still in production
- engine_cc: integer only for combustion and hybrid vehicles (2000 not 1998); for electric and plug-in hybrid vehicles, use null if no combustion engine displacement applies or is not confidently known
- confidence_score: 0.0 to 1.0 reflecting your certainty about this specific trim existing in Thailand
- Thai market only — exclude trims not sold in Thailand
- For motorcycles: seating_capacity is 1 or 2, drivetrain is "RWD"`;
}

function safeJsonParse(content) {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(content.slice(start, end + 1));
    }
    throw new Error("Response was not valid JSON.");
  }
}

function normaliseTrim(trim, categoryCode) {
  const name = String(trim.name || "").trim();
  const yearFrom = Number(trim.year_from);
  const yearTo = trim.year_to === null || trim.year_to === undefined || trim.year_to === "" ? null : Number(trim.year_to);
  const engineCc = trim.engine_cc === null || trim.engine_cc === undefined || trim.engine_cc === "" ? null : Math.round(Number(trim.engine_cc));
  const transmission = String(trim.transmission || "").trim();
  const fuelType = String(trim.fuel_type || "").trim();
  const normalizedEngineCc = electricFuelTypes.has(fuelType) && (!Number.isFinite(engineCc) || engineCc <= 0) ? null : engineCc;
  const seatingCapacity = trim.seating_capacity === null || trim.seating_capacity === undefined || trim.seating_capacity === "" ? null : Number(trim.seating_capacity);
  const drivetrain = String(trim.drivetrain || "").trim();
  const confidenceScore = Number(trim.confidence_score);

  return {
    name,
    year_from: yearFrom,
    year_to: Number.isFinite(yearTo) ? yearTo : null,
    engine_cc: Number.isFinite(normalizedEngineCc) ? normalizedEngineCc : null,
    transmission,
    fuel_type: fuelType,
    seating_capacity: Number.isFinite(seatingCapacity) ? seatingCapacity : motorcycleCategories.has(categoryCode) ? 2 : null,
    drivetrain: drivetrain || (motorcycleCategories.has(categoryCode) ? "RWD" : null),
    confidence_score: Number.isFinite(confidenceScore) ? Math.max(0, Math.min(1, confidenceScore)) : null
  };
}

function validateTrim(trim, categoryCode) {
  const reasons = [];
  if (!trim.name || trim.name.length < 8) {
    reasons.push("name is too short");
  }

  const genericNames = new Set(["wildtrak", "xlt", "xl", "ranger trims", "ranger"]);
  if (genericNames.has(trim.name.toLowerCase())) {
    reasons.push("name is too generic");
  }

  const hasSpecInName = /\d/.test(trim.name) || /\b(EV|HEV|PHEV|Hybrid|Electric)\b/i.test(trim.name);
  if (!hasSpecInName) {
    reasons.push("name lacks engine, EV, or drivetrain spec");
  }

  if (!Number.isInteger(trim.year_from) || trim.year_from < 2005) {
    reasons.push("year_from must be an integer from 2005 onward");
  }

  if (trim.year_to !== null && (!Number.isInteger(trim.year_to) || trim.year_to < trim.year_from)) {
    reasons.push("year_to is invalid");
  }

  const isElectricOrPlugInHybrid = electricFuelTypes.has(trim.fuel_type);
  if (isElectricOrPlugInHybrid) {
    if (/\b0(?:\.0)?L\b/i.test(trim.name)) {
      reasons.push("EV/PHEV trim name must not include 0L");
    }
  } else if (!Number.isInteger(trim.engine_cc) || trim.engine_cc < 1) {
    reasons.push("engine_cc must be a positive integer for non-EV trims");
  }

  if (!allowedTransmissions.has(trim.transmission)) {
    reasons.push(`unsupported transmission: ${trim.transmission}`);
  }

  if (!allowedFuelTypes.has(trim.fuel_type)) {
    reasons.push(`unsupported fuel_type: ${trim.fuel_type}`);
  }

  if (!allowedDrivetrains.has(trim.drivetrain || "")) {
    reasons.push(`unsupported drivetrain: ${trim.drivetrain}`);
  }

  if (motorcycleCategories.has(categoryCode) && ![1, 2].includes(trim.seating_capacity || 0)) {
    reasons.push("motorcycle seating_capacity must be 1 or 2");
  }

  return reasons;
}

async function getOpenAITrims(client, model, target) {
  const prompt = buildPrompt(target);
  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.1
  });

  const rawContent = completion.choices?.[0]?.message?.content || "";
  const parsed = safeJsonParse(rawContent);

  if (!Array.isArray(parsed.trims)) {
    throw new Error("OpenAI JSON response did not include a trims array.");
  }

  return {
    rawPayload: parsed,
    trims: parsed.trims
  };
}

async function withRetry(task) {
  try {
    return await task();
  } catch (firstError) {
    await sleep(2000);
    try {
      return await task();
    } catch (secondError) {
      secondError.cause = firstError;
      throw secondError;
    }
  }
}

async function loadTargets(supabase, args) {
  let makesQuery = supabase.from("vehicle_makes").select("id, name, slug, is_active").eq("is_active", true);
  if (args.make) {
    makesQuery = makesQuery.ilike("name", args.make);
  }

  const { data: makes, error: makesError } = await makesQuery;
  if (makesError) {
    throw new Error(makesError.message);
  }

  const makeById = new Map((makes || []).map((make) => [make.id, make]));
  let modelsQuery = supabase
    .from("vehicle_models")
    .select("id, make_id, name, category_code, body_type, is_active")
    .eq("is_active", true)
    .in("make_id", Array.from(makeById.keys()));

  if (args.model) {
    modelsQuery = modelsQuery.ilike("name", args.model);
  }

  if (args.category) {
    modelsQuery = modelsQuery.eq("category_code", args.category);
  }

  const { data: models, error: modelsError } = await modelsQuery;
  if (modelsError) {
    throw new Error(modelsError.message);
  }

  const priorityIndex = new Map(preferredMakeOrder.map((make, index) => [make, index]));
  const targets = (models || [])
    .map((model) => ({
      makeId: model.make_id,
      makeName: makeById.get(model.make_id)?.name || "Unknown",
      modelId: model.id,
      modelName: model.name,
      categoryCode: model.category_code,
      market: args.market
    }))
    .sort((left, right) => {
      const leftIsMoto = motorcycleCategories.has(left.categoryCode) ? 1 : 0;
      const rightIsMoto = motorcycleCategories.has(right.categoryCode) ? 1 : 0;
      if (leftIsMoto !== rightIsMoto) {
        return leftIsMoto - rightIsMoto;
      }

      const leftPriority = priorityIndex.has(left.makeName) ? priorityIndex.get(left.makeName) : 999;
      const rightPriority = priorityIndex.has(right.makeName) ? priorityIndex.get(right.makeName) : 999;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return `${left.makeName} ${left.modelName}`.localeCompare(`${right.makeName} ${right.modelName}`);
    });

  return args.limit ? targets.slice(0, args.limit) : targets;
}

async function upsertTrim(supabase, target, trim, rawPayload, options = {}) {
  const { data: existing, error: existingError } = await supabase
    .from("vehicle_trims")
    .select("id, source, verification_status")
    .eq("model_id", target.modelId)
    .eq("name", trim.name)
    .eq("year_from", trim.year_from)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    if (!options.refreshExisting) {
      return { action: "skipped_existing" };
    }

    if (existing.source === "manual" || existing.verification_status === "verified") {
      return { action: "skipped_verified" };
    }
  }

  const row = {
    model_id: target.modelId,
    name: trim.name,
    year_from: trim.year_from,
    year_to: trim.year_to,
    engine_cc: trim.engine_cc,
    transmission: trim.transmission,
    fuel_type: trim.fuel_type,
    seating_capacity: trim.seating_capacity,
    drivetrain: trim.drivetrain,
    source: "ai_generated",
    verification_status: "pending_review",
    confidence_score: trim.confidence_score,
    raw_ai_payload: rawPayload,
    is_active: true
  };

  if (existing?.id) {
    const { error } = await supabase.from("vehicle_trims").update(row).eq("id", existing.id);
    if (error) {
      throw new Error(error.message);
    }
    return { action: "updated" };
  }

  const { error } = await supabase.from("vehicle_trims").insert(row);
  if (error) {
    throw new Error(error.message);
  }

  return { action: "inserted" };
}

async function modelHasExistingTrims(supabase, target) {
  const { data, error } = await supabase
    .from("vehicle_trims")
    .select("id")
    .eq("model_id", target.modelId)
    .eq("source", "ai_generated")
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).length > 0;
}

async function deactivateInvalidEvTrims(supabase, target) {
  const { error } = await supabase
    .from("vehicle_trims")
    .update({
      is_active: false,
      verification_status: "rejected"
    })
    .eq("model_id", target.modelId)
    .eq("source", "ai_generated")
    .in("fuel_type", Array.from(electricFuelTypes))
    .ilike("name", "%0L%");

  if (error) {
    throw new Error(error.message);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = requiredEnv("OPENAI_API_KEY");
  const model = process.env.OPENAI_TRIM_CATALOG_MODEL || "gpt-4o";
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  const openai = new OpenAI({ apiKey });
  const targets = await loadTargets(supabase, args);

  let processed = 0;
  let inserted = 0;
  let failures = 0;
  let skippedExisting = 0;
  let skippedTrimMatches = 0;

  console.log(`Trim catalog model: ${model}`);
  console.log(`Mode: ${args.dryRun ? "dry-run" : "insert"}`);
  console.log(`Skip existing models: ${args.skipExisting ? "yes" : "no"}`);
  console.log(`Refresh existing trim matches: ${args.refreshExisting ? "yes" : "no"}`);
  console.log(`Models queued: ${targets.length}`);

  for (const target of targets) {
    processed += 1;
    const label = `${target.makeName} ${target.modelName} (${target.categoryCode})`;
    console.log(`\n[${processed}/${targets.length}] ${label}`);

    try {
      if (args.skipExisting && (await modelHasExistingTrims(supabase, target))) {
        skippedExisting += 1;
        console.log("Skipped because this model already has AI-generated trim rows.");
        continue;
      }

      if (args.refreshExisting) {
        await deactivateInvalidEvTrims(supabase, target);
      }

      const result = await withRetry(() => getOpenAITrims(openai, model, target));
      const validTrims = [];

      for (const rawTrim of result.trims) {
        const trim = normaliseTrim(rawTrim, target.categoryCode);
        const validationErrors = validateTrim(trim, target.categoryCode);
        if (validationErrors.length > 0) {
          await appendErrorLog(`${label}: rejected trim "${trim.name || "unnamed"}" - ${validationErrors.join(", ")}`, rawTrim);
          continue;
        }
        validTrims.push(trim);
      }

      console.log(`Generated ${validTrims.length} valid trims`);
      if (args.dryRun) {
        console.log(JSON.stringify({ trims: validTrims }, null, 2));
      } else {
        for (const trim of validTrims) {
          const { action } = await upsertTrim(supabase, target, trim, result.rawPayload, {
            refreshExisting: args.refreshExisting
          });
          if (action === "inserted" || action === "updated") {
            inserted += 1;
          }
          if (action === "skipped_existing" || action === "skipped_verified") {
            skippedTrimMatches += 1;
          }
        }
        console.log(`Saved new/updated trim candidates for review. Existing exact matches skipped.`);
      }
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      await appendErrorLog(`${label}: ${message}`, error?.rawResponse || error?.message || error);
    }

    await sleep(500);
  }

  console.log("\nSummary");
  console.log(`Total models processed: ${processed}`);
  console.log(`Total models skipped with existing trims: ${skippedExisting}`);
  console.log(`Total trims inserted/updated: ${inserted}`);
  console.log(`Total exact trim matches skipped: ${skippedTrimMatches}`);
  console.log(`Total failures: ${failures}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  await appendErrorLog(`Fatal error: ${message}`, error);
  process.exit(1);
});
