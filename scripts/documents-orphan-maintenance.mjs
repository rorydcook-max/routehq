import process from "node:process";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const DEV_PROJECT_REF = "adxwmzfbljlanfnxhsoa";
const PROD_PROJECT_REF = "loutrkhqnkslwapqxpkm";
const MIN_AGE_HOURS = 24;

loadEnv({ path: ".env.development.local" });

function argValue(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

function hasArg(name) {
  return process.argv.includes(`--${name}`);
}

function assertDevelopmentProject() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  if (!url.includes(DEV_PROJECT_REF) || url.includes(PROD_PROJECT_REF)) {
    throw new Error(`Refusing to run: active Supabase URL must be ${DEV_PROJECT_REF}.`);
  }
  if (hasArg("delete") && argValue("confirm-dev-project") !== DEV_PROJECT_REF) {
    throw new Error(`Deletion requires --confirm-dev-project=${DEV_PROJECT_REF}.`);
  }
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing development Supabase URL or service role key.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function isSafeRentalDocumentPath(organizationId, path) {
  const uuid = "[0-9a-fA-F-]{36}";
  const pattern = new RegExp(`^organizations/${organizationId}/rentals/${uuid}/rental-documents/${uuid}/versions/${uuid}/(?:draft|final)-[-A-Za-z0-9_]+\\.pdf$`);
  return (
    path.length <= 512 &&
    !path.startsWith("/") &&
    !path.includes("..") &&
    !path.includes("//") &&
    !path.includes("\\") &&
    !path.includes("://") &&
    !/%2e|%2f|%5c/i.test(path) &&
    pattern.test(path)
  );
}

async function listRecursive(supabase, bucket, prefix) {
  const results = [];
  async function walk(path) {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage.from(bucket).list(path, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" }
      });
      if (error) throw new Error(error.message);
      const entries = data || [];
      for (const entry of entries) {
        const childPath = path ? `${path}/${entry.name}` : entry.name;
        if (entry.id || entry.metadata || entry.updated_at || entry.created_at) {
          results.push({ ...entry, path: childPath });
        } else {
          await walk(childPath);
        }
      }
      if (entries.length < 100) break;
      offset += entries.length;
    }
  }
  await walk(prefix);
  return results;
}

async function referencedPdfPaths(supabase, organizationId) {
  const referenced = new Set();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("rental_document_versions")
      .select("pdf_storage_bucket,pdf_storage_path,draft_pdf_storage_bucket,draft_pdf_storage_path,final_pdf_storage_bucket,final_pdf_storage_path,status")
      .eq("organization_id", organizationId)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data || []) {
      for (const [bucketKey, pathKey] of [
        ["pdf_storage_bucket", "pdf_storage_path"],
        ["draft_pdf_storage_bucket", "draft_pdf_storage_path"],
        ["final_pdf_storage_bucket", "final_pdf_storage_path"]
      ]) {
        if (row[bucketKey] === "documents" && row[pathKey]) referenced.add(row[pathKey]);
      }
    }
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return referenced;
}

async function main() {
  assertDevelopmentProject();
  const organizationId = argValue("organization-id");
  if (!organizationId) throw new Error("Pass --organization-id=<development organization uuid>.");

  const deleteMode = hasArg("delete");
  const now = Date.now();
  const minAgeMs = MIN_AGE_HOURS * 60 * 60 * 1000;
  const supabase = createAdminClient();
  const prefix = `organizations/${organizationId}/rentals`;
  const [objects, referenced] = await Promise.all([
    listRecursive(supabase, "documents", prefix),
    referencedPdfPaths(supabase, organizationId)
  ]);

  const candidates = objects
    .filter((object) => isSafeRentalDocumentPath(organizationId, object.path))
    .filter((object) => !referenced.has(object.path))
    .map((object) => {
      const timestamp = Date.parse(object.updated_at || object.created_at || "");
      const ageHours = Number.isFinite(timestamp) ? (now - timestamp) / (60 * 60 * 1000) : 0;
      return { object, timestamp, ageHours };
    })
    .filter((entry) => Number.isFinite(entry.timestamp) && now - entry.timestamp >= minAgeMs)
    .map(({ object, ageHours }) => ({
      bucket: "documents",
      path: object.path,
      updated_at: object.updated_at || object.created_at || null,
      size: object.metadata?.size || object.metadata?.contentLength || null,
      reason: object.path.includes("/final-")
        ? "unreferenced_final_pdf_after_age_threshold"
        : "unreferenced_draft_pdf_after_age_threshold",
      ageHours: Math.round(ageHours * 10) / 10
    }));

  const report = {
    mode: deleteMode ? "delete" : "dry-run",
    projectRef: DEV_PROJECT_REF,
    organizationId,
    scannedObjectCount: objects.length,
    referencedPathCount: referenced.size,
    candidateCount: candidates.length,
    candidates
  };

  if (deleteMode && candidates.length) {
    const { error } = await supabase.storage.from("documents").remove(candidates.map((candidate) => candidate.path));
    if (error) throw new Error(error.message);
    report.deletedCount = candidates.length;
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
