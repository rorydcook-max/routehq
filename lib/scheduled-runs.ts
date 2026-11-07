import { inBusinessTimeZone } from "@/lib/business-time-scope";
import { countryInfo, defaultTimeZone, orgCountry } from "@/lib/regional";

/**
 * Daily jobs on each business's own clock (Rory, 4 Nov 2026). Vercel Cron calls the two daily routes every hour
 * (vercel.json); each call works only for the businesses whose local time is the job's hour:
 *
 *   morning_summary     08:00 local  (app/api/line/daily-summary)
 *   customer_reminders  09:00 local  (app/api/cron/payment-status), after the summary as before
 *
 * A business is also taken up to CATCH_UP_HOURS later if the run at its hour never happened (a missed or failed
 * cron call), so a missed hour costs a late message, not a lost day. Each job runs once per business per local day:
 * the run is claimed first in scheduled_runs (organization_id, job, local_date), an insert that only one caller can
 * win. Until that table exists (supabase/migrations/0122_scheduled_runs.sql) only the exact hour counts.
 *
 * Plain functions apart from the store, so scripts/simulate-hourly-crons.ts can run them without a database.
 */

export type DailyJob = "morning_summary" | "customer_reminders";

/** The local hour each job runs at. */
export const JOB_HOURS: Record<DailyJob, number> = { morning_summary: 8, customer_reminders: 9 };

/** How many hours after its hour a business is still taken when the run at its hour was missed. */
export const CATCH_UP_HOURS = 3;

/** What a job needs to know about a business to place it on the clock. */
export type ScheduleOrg = { id: string; timezone?: string | null; country_code?: string | null; settings?: any };

function usableZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The business's time zone: the one saved on it, else its country's main zone, else Bangkok.
 * organizations.timezone defaults to Asia/Bangkok, so a business outside Thailand that never picked a zone still has
 * Bangkok saved; for a country whose zones don't include Bangkok that is read as "not chosen" and the country's
 * zone is used (a UK business gets Europe/London, a Greek one Europe/Athens).
 */
export function orgTimeZone(org: Pick<ScheduleOrg, "timezone" | "country_code" | "settings"> | null | undefined): string {
  const country = orgCountry(org);
  const saved = String(org?.timezone || "").trim();
  const info = countryInfo(country);
  if (saved && usableZone(saved) && !(saved === "Asia/Bangkok" && info && !info.zones.includes(saved))) return saved;
  return defaultTimeZone(country);
}

/** The date ("YYYY-MM-DD") and hour (0-23) at this instant on this zone's clock. */
export function localClock(zone: string, at: Date = new Date()): { date: string; hour: number; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  const hour = Number(get("hour")) % 24;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour, time: `${String(hour).padStart(2, "0")}:${get("minute")}` };
}

/** "2026-11-04" plus n days, on the calendar. */
export function addDaysIso(date: string, days: number): string {
  const instant = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) + days * 86_400_000;
  return new Date(instant).toISOString().slice(0, 10);
}

export type DueOrg<O extends ScheduleOrg> = { org: O; zone: string; localDate: string; localTime: string; exact: boolean };

/** The businesses this job is due for at this instant (their hour, or a catch-up hour after it). */
export function planDailyJob<O extends ScheduleOrg>(orgs: O[], job: DailyJob, at: Date = new Date()): DueOrg<O>[] {
  const target = JOB_HOURS[job];
  const due: DueOrg<O>[] = [];
  for (const org of orgs) {
    const zone = orgTimeZone(org);
    const clock = localClock(zone, at);
    const late = clock.hour - target;
    if (late < 0 || late >= CATCH_UP_HOURS) continue;
    due.push({ org, zone, localDate: clock.date, localTime: clock.time, exact: late === 0 });
  }
  return due;
}

/** Where claimed runs are kept. claim() returns the ids it won, or null when the store can't be used. */
export type RunStore = {
  claim(job: DailyJob, rows: Array<{ organizationId: string; localDate: string }>): Promise<Set<string> | null>;
  prune?(olderThanDays: number): Promise<void>;
};

/** scheduled_runs in the database (supabase/migrations/0122_scheduled_runs.sql). */
export function supabaseRunStore(supabase: any): RunStore {
  return {
    async claim(job, rows) {
      if (!rows.length) return new Set();
      const { data, error } = await supabase
        .from("scheduled_runs")
        .upsert(
          rows.map((row) => ({ organization_id: row.organizationId, job, local_date: row.localDate })),
          { onConflict: "organization_id,job,local_date", ignoreDuplicates: true }
        )
        .select("organization_id");
      if (error) {
        console.error("[scheduled-runs] claim failed; only businesses at their exact hour run", error.message);
        return null;
      }
      return new Set(((data || []) as Array<{ organization_id: string }>).map((row) => String(row.organization_id)));
    },
    async prune(olderThanDays) {
      await supabase.from("scheduled_runs").delete().lt("ran_at", new Date(Date.now() - olderThanDays * 86_400_000).toISOString());
    }
  };
}

/** In memory, for scripts and tests: the same once-per-day rule without a database. */
export function memoryRunStore(): RunStore & { claimed: Set<string> } {
  const claimed = new Set<string>();
  return {
    claimed,
    async claim(job, rows) {
      const won = new Set<string>();
      for (const row of rows) {
        const key = `${row.organizationId}|${job}|${row.localDate}`;
        if (claimed.has(key)) continue;
        claimed.add(key);
        won.add(row.organizationId);
      }
      return won;
    }
  };
}

export type JobGroup<O extends ScheduleOrg> = { zone: string; localDate: string; orgs: O[] };

/**
 * Claims today's run for every business the job is due for, then hands them to `work` a time zone at a time, inside
 * inBusinessTimeZone so dates computed anywhere below follow that clock. Businesses whose run was already claimed
 * today are left out. Returns who ran, for the route's response and the simulation.
 */
export async function runDailyJob<O extends ScheduleOrg>(input: {
  job: DailyJob;
  orgs: O[];
  store: RunStore;
  at?: Date;
  work: (group: JobGroup<O>) => Promise<void>;
}): Promise<{ ran: Array<{ id: string; zone: string; localDate: string; localTime: string }>; alreadyDone: number; guard: "claimed" | "exact-hour-only" }> {
  const due = planDailyJob(input.orgs, input.job, input.at);
  if (!due.length) return { ran: [], alreadyDone: 0, guard: "claimed" };
  const won = await input.store.claim(input.job, due.map((item) => ({ organizationId: item.org.id, localDate: item.localDate })));
  // Without the store, only the exact hour: one cron call per hour, so at most one run a day.
  const going = won ? due.filter((item) => won.has(item.org.id)) : due.filter((item) => item.exact);

  const groups = new Map<string, JobGroup<O>>();
  for (const item of going) {
    const key = `${item.zone}|${item.localDate}`;
    const group = groups.get(key) || { zone: item.zone, localDate: item.localDate, orgs: [] };
    group.orgs.push(item.org);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    await inBusinessTimeZone(group.zone, () => input.work(group)).catch((error: unknown) => {
      console.error(`[scheduled-runs] ${input.job} failed for ${group.zone}`, error instanceof Error ? error.message : error);
    });
  }
  return {
    ran: going.map((item) => ({ id: item.org.id, zone: item.zone, localDate: item.localDate, localTime: item.localTime })),
    alreadyDone: won ? due.length - going.length : 0,
    guard: won ? "claimed" : "exact-hour-only"
  };
}
