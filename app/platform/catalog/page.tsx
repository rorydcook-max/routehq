import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { Badge, SectionHeader } from "@/components/ui";
import {
  approveVehicleCatalogSubmission,
  createVehicleMake,
  createVehicleModel,
  createVehicleTrim,
  mergeVehicleCatalogResearch,
  researchVehicleCatalogSubmission,
  rejectVehicleCatalogSubmission
} from "@/app/actions/settings";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { requirePlatformAdmin } from "@/lib/admin";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminHeader } from "../admin-nav";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]";

type VehicleMakeSetting = {
  id: string;
  name: string;
  slug: string;
  origin_country: string | null;
  logo_url: string | null;
  sort_order: number;
  is_active: boolean;
};

type VehicleModelSetting = {
  id: string;
  make_id: string;
  name: string;
  category_code: string;
  body_type: string | null;
  is_active: boolean;
};

type VehicleTrimSetting = {
  id: string;
  model_id: string;
  name: string;
  year_from: number;
  year_to: number | null;
  engine_cc: number | null;
  transmission: string | null;
  fuel_type: string | null;
  seating_capacity: number | null;
  drivetrain: string | null;
  created_at: string;
};

type VehicleCatalogSubmissionSetting = {
  id: string;
  status: string;
  make_name: string;
  model_name: string | null;
  trim_name: string | null;
  category_code: string | null;
  year_from: number | null;
  year_to: number | null;
  notes: string | null;
  research_status: string | null;
  research_payload: any;
  created_at: string;
};

function candidateLabel(candidate: any) {
  return [candidate?.make, candidate?.model, candidate?.trim].filter(Boolean).join(" ");
}

function candidateSpecs(candidate: any) {
  return [
    candidate?.year_from ? `${candidate.year_from}${candidate.year_to ? `-${candidate.year_to}` : "+"}` : null,
    candidate?.engine_cc ? `${candidate.engine_cc}cc` : null,
    candidate?.transmission,
    candidate?.fuel_type,
    candidate?.drivetrain
  ]
    .filter(Boolean)
    .join(" / ");
}


/** RouteHQ admin console: the shared makes, models and trims every business picks from, and operators' suggestions. */
export default async function AdminCatalogPage() {
  await requirePlatformAdmin();
  const supabase = (await createSupabaseServerClient()) as any;
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const [categories, { data: vehicleMakes }, { data: vehicleModels }, { data: recentTrims }, catalogSubmissionsResult] = await Promise.all([
    getVehicleCategories(organization.id),
    supabase.from("vehicle_makes").select("id, name, slug, origin_country, logo_url, sort_order, is_active").eq("is_active", true).order("sort_order", { ascending: true }).order("name", { ascending: true }),
    supabase.from("vehicle_models").select("id, make_id, name, category_code, body_type, is_active").eq("is_active", true).order("name", { ascending: true }),
    supabase.from("vehicle_trims").select("id, model_id, name, year_from, year_to, engine_cc, transmission, fuel_type, seating_capacity, drivetrain, created_at").eq("is_active", true).order("created_at", { ascending: false }).limit(12),
    supabase.from("vehicle_catalog_submissions").select("id, status, make_name, model_name, trim_name, category_code, year_from, year_to, notes, research_status, research_payload, created_at").order("created_at", { ascending: false }).limit(20)
  ]);
  const typedVehicleMakes = (vehicleMakes || []) as VehicleMakeSetting[];
  const typedVehicleModels = (vehicleModels || []) as VehicleModelSetting[];
  const typedRecentTrims = (recentTrims || []) as VehicleTrimSetting[];
  const typedCatalogSubmissions = (catalogSubmissionsResult.data || []) as VehicleCatalogSubmissionSetting[];
  const waiting = typedCatalogSubmissions.filter((submission) => submission.status === "pending_review").length;
  const makeMap = new Map<string, VehicleMakeSetting>(typedVehicleMakes.map((make) => [make.id, make]));
  const modelMap = new Map<string, VehicleModelSetting>(typedVehicleModels.map((model) => [model.id, model]));

  return (
    <AppShell userEmail={userEmail}>
      <AdminHeader
        active="/platform/catalog"
        subtitle={waiting > 0 ? `${waiting} suggestion${waiting === 1 ? "" : "s"} from operators waiting for review. The makes, models and trims every business picks from.` : "The makes, models and trims every business picks from, and operators' suggestions."}
        title="Vehicle catalogue"
      />
      <div className="card p-4">
          <div className="mt-3">
            <div className="rounded-lg border border-[var(--border)] bg-white p-3">
              <SectionHeader eyebrow="Review queue" title="Recent suggestions" />
              <p className="mt-2 text-xs text-[var(--muted)]">
                These are captured automatically when an operator saves a vehicle using a custom make, model, or trim.
              </p>
              <div className="mt-4 space-y-3">
                {typedCatalogSubmissions.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">No catalog suggestions yet.</p>
                ) : (
                  typedCatalogSubmissions.map((submission) => (
                    <div className="rounded-lg border border-[var(--border)] p-3" key={submission.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-[var(--foreground)]">
                            {[submission.make_name, submission.model_name, submission.trim_name].filter(Boolean).join(" ")}
                          </p>
                          <p className="text-sm text-[var(--muted)]">
                            {[submission.category_code, submission.year_from ? `${submission.year_from}${submission.year_to ? `-${submission.year_to}` : "+"}` : null]
                              .filter(Boolean)
                              .join(" / ") || "Details pending"}
                          </p>
                        </div>
                        <Badge tone={submission.status === "pending_review" ? "amber" : "green"}>{submission.status.replace(/_/g, " ")}</Badge>
                      </div>
                      {submission.notes ? <p className="mt-2 text-xs text-[var(--muted)]">{submission.notes}</p> : null}
                      {submission.status === "pending_review" ? (
                        <div className="mt-3 space-y-3">
                          <form action={researchVehicleCatalogSubmission} className="rounded-lg border border-[var(--info-line)] bg-[var(--info-light)] p-3">
                            <input name="submissionId" type="hidden" value={submission.id} />
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-bold text-[var(--foreground)]">AI catalog research</p>
                                <p className="text-sm text-[var(--muted)]">Searches for likely matches, misspellings, and related missing trims. Nothing is added automatically.</p>
                              </div>
                              <PendingButton className="rounded-lg bg-[var(--info)] px-4 py-2 text-sm font-bold text-white" pendingLabel="Researching..." type="submit">
                                Research with AI
                              </PendingButton>
                            </div>
                          </form>

                          {submission.research_status === "failed" ? (
                            <div className="rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] p-3 text-sm text-[var(--danger)]">
                              <p className="font-bold">Research failed</p>
                              <p className="mt-1">
                                {submission.research_payload?.error || "Check API quota, model access, or try again."}
                              </p>
                            </div>
                          ) : null}

                          {submission.research_payload ? (
                            <div className="rounded-lg border border-[var(--info-line)] bg-white p-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="text-sm font-bold text-[var(--foreground)]">Research result</p>
                                  <p className="mt-1 text-sm text-[var(--muted)]">{submission.research_payload.summary || "No summary returned."}</p>
                                </div>
                                <Badge tone={submission.research_payload.status === "found" ? "green" : submission.research_payload.status === "not_found" ? "red" : "amber"}>
                                  {submission.research_payload.review_recommendation || submission.research_payload.status || "review"}
                                </Badge>
                              </div>

                              {Array.isArray(submission.research_payload.likely_matches) && submission.research_payload.likely_matches.length > 0 ? (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold uppercase text-[var(--primary)]">Likely matches</p>
                                  <div className="mt-2 space-y-2">
                                    {submission.research_payload.likely_matches.slice(0, 4).map((candidate: any, index: number) => (
                                      <div className="rounded-lg border border-[var(--border)] p-3" key={`${candidateLabel(candidate)}-${index}`}>
                                        <p className="font-bold text-[var(--foreground)]">{candidateLabel(candidate) || "Candidate vehicle"}</p>
                                        <p className="text-sm text-[var(--muted)]">{candidateSpecs(candidate) || candidate.rationale || "Specs pending"}</p>
                                        {Array.isArray(candidate.source_urls) && candidate.source_urls.length > 0 ? (
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            {candidate.source_urls.slice(0, 3).map((url: string) => (
                                              <a className="text-xs font-bold text-[var(--info)]" href={url} key={url} rel="noreferrer" target="_blank">
                                                Source
                                              </a>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {Array.isArray(submission.research_payload.missing_related_trims) && submission.research_payload.missing_related_trims.length > 0 ? (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold uppercase text-[var(--primary)]">Related trims to consider adding</p>
                                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                    {submission.research_payload.missing_related_trims.slice(0, 8).map((candidate: any, index: number) => (
                                      <div className="rounded-lg border border-[var(--border)] p-3" key={`${candidateLabel(candidate)}-related-${index}`}>
                                        <p className="font-bold text-[var(--foreground)]">{candidateLabel(candidate) || "Related trim"}</p>
                                        <p className="text-sm text-[var(--muted)]">{candidateSpecs(candidate) || "Specs pending"}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {((Array.isArray(submission.research_payload.likely_matches) && submission.research_payload.likely_matches.length > 0) ||
                                (Array.isArray(submission.research_payload.missing_related_trims) && submission.research_payload.missing_related_trims.length > 0)) ? (
                                <form action={mergeVehicleCatalogResearch} className="mt-3 rounded-lg border border-[var(--success-line)] bg-[var(--success-light)] p-3">
                                  <input name="submissionId" type="hidden" value={submission.id} />
                                  <p className="text-sm font-bold text-[var(--success)]">Merge researched candidates</p>
                                  <p className="mt-1 text-sm text-[var(--muted)]">
                                    Adds the AI-researched candidates to the global catalog as verified admin-reviewed data.
                                  </p>
                                  <PendingButton className="mt-3 w-full rounded-lg bg-[var(--success)] px-3 py-2 text-sm font-bold text-white" pendingLabel="Adding..." type="submit">
                                    Add AI candidates to global catalog
                                  </PendingButton>
                                </form>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="grid gap-3 lg:grid-cols-2">
                          <form action={approveVehicleCatalogSubmission} className="rounded-lg border border-[var(--success-line)] bg-[var(--success-light)] p-3">
                            <input name="submissionId" type="hidden" value={submission.id} />
                            <label className="block">
                              <span className="text-xs font-semibold uppercase text-[var(--success)]">Approval note</span>
                              <input className={inputClass} name="curatorNotes" placeholder="Verified from manufacturer source" />
                            </label>
                            <PendingButton className="mt-3 w-full rounded-lg bg-[var(--success)] px-3 py-2 text-sm font-bold text-white" pendingLabel="Adding..." type="submit">
                              Add to global catalog
                            </PendingButton>
                          </form>
                          <form action={rejectVehicleCatalogSubmission} className="rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] p-3">
                            <input name="submissionId" type="hidden" value={submission.id} />
                            <label className="block">
                              <span className="text-xs font-semibold uppercase text-[var(--danger)]">Rejection note</span>
                              <input className={inputClass} name="curatorNotes" placeholder="Duplicate, unclear, or incorrect" />
                            </label>
                            <PendingButton className="mt-3 w-full rounded-lg bg-[var(--danger)] px-3 py-2 text-sm font-bold text-white" pendingLabel="Rejecting..." type="submit">
                              Reject suggestion
                            </PendingButton>
                          </form>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            <form action={createVehicleMake} className="rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
              <p className="text-sm font-semibold uppercase text-[var(--primary)]">New make</p>
              <label className="mt-4 block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Make name</span>
                <input className={inputClass} name="name" placeholder="Chery" required />
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Origin country</span>
                  <input className={inputClass} maxLength={2} name="originCountry" placeholder="CN" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Sort order</span>
                  <input className={inputClass} min="0" name="sortOrder" placeholder="1000" type="number" />
                </label>
              </div>
              <label className="mt-3 block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Logo URL</span>
                <input className={inputClass} name="logoUrl" placeholder="https://..." type="url" />
              </label>
              <PendingButton className="primary-action mt-4 w-full sm:w-auto" pendingLabel="Adding..." type="submit">
                Add make
              </PendingButton>
            </form>

            <form action={createVehicleModel} className="rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
              <p className="text-sm font-semibold uppercase text-[var(--primary)]">New model</p>
              <label className="mt-4 block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Make</span>
                <select className={inputClass} name="makeId" required>
                  <option value="">Select make</option>
                  {typedVehicleMakes.map((make) => (
                    <option key={make.id} value={make.id}>
                      {make.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Model name</span>
                <input className={inputClass} name="name" placeholder="Yaris Cross" required />
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Category</span>
                  <select className={inputClass} name="categoryCode" required>
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.code}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Body type</span>
                  <input className={inputClass} name="bodyType" placeholder="SUV" />
                </label>
              </div>
              <PendingButton className="primary-action mt-4 w-full sm:w-auto" pendingLabel="Adding..." type="submit">
                Add model
              </PendingButton>
            </form>

            <form action={createVehicleTrim} className="rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
              <p className="text-sm font-semibold uppercase text-[var(--primary)]">New trim</p>
              <label className="mt-4 block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Model</span>
                <select className={inputClass} name="modelId" required>
                  <option value="">Select model</option>
                  {typedVehicleModels.map((model) => {
                    const make = makeMap.get(model.make_id);
                    return (
                      <option key={model.id} value={model.id}>
                        {make?.name || "Make"} {model.name} ({model.category_code})
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="mt-3 block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Trim name</span>
                <input className={inputClass} name="name" placeholder="Premium HEV" required />
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Year from</span>
                  <input className={inputClass} min="1900" name="yearFrom" placeholder="2024" required type="number" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Year to</span>
                  <input className={inputClass} min="1900" name="yearTo" placeholder="Optional" type="number" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Engine CC</span>
                  <input className={inputClass} min="0" name="engineCc" type="number" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Seats</span>
                  <input className={inputClass} min="0" name="seatingCapacity" type="number" />
                </label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Transmission</span>
                  <input className={inputClass} name="transmission" placeholder="Automatic" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Fuel type</span>
                  <input className={inputClass} name="fuelType" placeholder="hybrid" />
                </label>
              </div>
              <label className="mt-3 block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Drivetrain</span>
                <input className={inputClass} name="drivetrain" placeholder="FWD" />
              </label>
              <PendingButton className="primary-action mt-4 w-full sm:w-auto" pendingLabel="Adding..." type="submit">
                Add trim
              </PendingButton>
            </form>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-lg border border-[var(--border)] bg-white p-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">Active makes</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {typedVehicleMakes.slice(0, 28).map((make) => (
                  <Badge key={make.id} tone="blue">
                    {make.name}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-white p-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">Recent trims</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {typedRecentTrims.map((trim) => {
                  const model = modelMap.get(trim.model_id);
                  const make = model ? makeMap.get(model.make_id) : null;
                  return (
                    <div className="rounded-lg border border-[var(--border)] p-3" key={trim.id}>
                      <p className="font-bold text-[var(--foreground)]">
                        {make?.name || "Make"} {model?.name || "Model"}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        {trim.name} / {trim.year_from}
                        {trim.year_to ? `-${trim.year_to}` : "+"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
      </div>
    </AppShell>
  );
}
