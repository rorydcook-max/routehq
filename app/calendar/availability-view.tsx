import Link from "next/link";
import type { Route } from "next";
import { VehicleKindIcon } from "@/components/vehicle-kind-icon";
import type { AvailabilityBooking, AvailabilityVehicle } from "@/lib/calendar";
import { kindFromCategory, kindLabel, type VehicleKind } from "@/lib/vehicle-groups";
import { ScrollToToday } from "./scroll-to-today";

const barClasses: Record<AvailabilityBooking["state"], string> = {
  out: "bg-[var(--primary)] text-white",
  booked: "border border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]",
  late: "bg-[var(--danger)] text-white",
  returned: "bg-[var(--panel-secondary)] text-[var(--muted)] border border-[var(--border)]"
};

const stateWords: Record<AvailabilityBooking["state"], string> = {
  out: "On rent",
  booked: "Booked",
  late: "Late back",
  returned: "Returned"
};

const KIND_ORDER: VehicleKind[] = ["car", "van", "motorbike", "scooter", "ebike", "atv", "other"];
const DAY_WIDTH = 30;
/** Vehicle names are pinned on the left: narrower on a phone so more days fit. */
const LABEL_WIDTH = 112;
const LABEL_CLASS = "w-[112px] sm:w-[168px]";

function dayOf(iso: string) {
  return Number(iso.slice(8, 10));
}

/**
 * The month as one row per vehicle: coloured bars are bookings, white space is
 * a vehicle sitting free. Scrolls sideways on a phone with the names pinned.
 */
export function AvailabilityView({ vehicles, month, today }: { vehicles: AvailabilityVehicle[]; month: string; today: string }) {
  const [year, monthIndex] = month.split("-").map(Number);
  const dayCount = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, "0")}`;
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    return { date, day: index + 1, letter: "SMTWTFS"[weekday], weekend: weekday === 0 || weekday === 6 };
  });
  const showsToday = today.slice(0, 7) === month;
  const freeToday = showsToday ? vehicles.filter((vehicle) => !vehicle.inShop && !vehicle.bookings.some((b) => b.state !== "returned" && b.from <= today && b.to >= today)).length : null;
  const columns = `repeat(${dayCount}, minmax(${DAY_WIDTH}px, 1fr))`;

  const groups = KIND_ORDER.map((kind) => ({ kind, list: vehicles.filter((vehicle) => kindFromCategory(vehicle.category) === kind) })).filter((group) => group.list.length > 0);

  if (vehicles.length === 0) {
    return (
      <div className="empty-state">
        <p className="text-lg font-semibold text-[var(--foreground)]">No vehicles yet</p>
        <p className="mt-2 text-sm text-[var(--muted)]">Add a vehicle and its bookings will show here.</p>
      </div>
    );
  }

  return (
    <div className="content-section">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {freeToday === null ? `${vehicles.length} vehicles` : `${freeToday} of ${vehicles.length} free today`}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--foreground-secondary)]">
          {(["out", "booked", "late", "returned"] as const).map((state) => (
            <span className="inline-flex items-center gap-1.5" key={state}>
              <span className={`h-3 w-5 rounded ${barClasses[state]}`} />
              {stateWords[state]}
            </span>
          ))}
        </div>
      </div>

      {showsToday ? <ScrollToToday targetId="availability-today" /> : null}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]" data-scroller data-sticky={LABEL_WIDTH}>
        <div style={{ minWidth: LABEL_WIDTH + dayCount * DAY_WIDTH }}>
          <div className="flex border-b border-[var(--border)] bg-[var(--panel-secondary)]">
            <div className={`sticky left-0 z-20 shrink-0 bg-[var(--panel-secondary)] ${LABEL_CLASS}`} />
            <div className="grid flex-1" style={{ gridTemplateColumns: columns }}>
              {days.map((cell) => (
                <div className={`py-1 text-center text-[10px] leading-tight ${cell.date === today ? "bg-[var(--primary)] font-semibold text-white" : cell.weekend ? "text-[var(--muted)]" : "text-[var(--foreground-secondary)]"}`} id={cell.date === today ? "availability-today" : undefined} key={cell.date}>
                  <div>{cell.letter}</div>
                  <div className="text-xs font-semibold">{cell.day}</div>
                </div>
              ))}
            </div>
          </div>

          {groups.map((group) => (
            <div key={group.kind}>
              {groups.length > 1 ? (
                <div className="flex border-b border-[var(--border)] bg-white">
                  <p className="sticky left-0 z-20 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    {kindLabel(group.kind, group.list.length)}
                  </p>
                </div>
              ) : null}
              {group.list.map((vehicle) => (
                <div className="flex border-b border-[var(--border)] last:border-b-0" key={vehicle.id}>
                  <Link className={`sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-[var(--border)] bg-white px-2.5 py-1.5 hover:bg-[var(--panel-secondary)] ${LABEL_CLASS}`} href={`/fleet/${vehicle.id}` as Route}>
                    <span className="hidden sm:block">
                      <VehicleKindIcon kind={group.kind} size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-[var(--foreground)]">{vehicle.name}</span>
                      <span className="block truncate text-[11px] text-[var(--muted)]">{vehicle.inShop ? "In the shop" : vehicle.plate}</span>
                    </span>
                  </Link>
                  <div className="relative grid h-11 flex-1 items-center" style={{ gridTemplateColumns: columns }}>
                    {days.map((cell) => (
                      <Link
                        aria-label={`Book ${vehicle.name} from ${cell.day}`}
                        className={`h-full border-r border-[var(--border)] last:border-r-0 hover:bg-[var(--primary-light)] ${cell.date === today ? "bg-[var(--primary-light)]" : cell.weekend ? "bg-[var(--panel-secondary)]" : ""}`}
                        href={`/bookings/new?vehicleId=${vehicle.id}` as Route}
                        key={cell.date}
                        style={{ gridColumn: cell.day, gridRow: 1 }}
                        title={`Free · tap to book ${vehicle.name}`}
                      />
                    ))}
                    {vehicle.bookings.map((booking) => (
                      <Link
                        className={`z-10 mx-0.5 flex h-7 items-center overflow-hidden px-1.5 text-[11px] font-semibold ${barClasses[booking.state]} ${booking.startsBefore ? "rounded-l-none" : "rounded-l-md"} ${booking.runsOn ? "rounded-r-none" : "rounded-r-md"}`}
                        href={`/bookings/${booking.id}` as Route}
                        key={booking.id}
                        style={{ gridColumn: `${dayOf(booking.from)} / ${dayOf(booking.to) + 1}`, gridRow: 1 }}
                        title={`${booking.customer} · ${stateWords[booking.state]}`}
                      >
                        <span className="truncate">{booking.customer}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">Tap a booking to open it, or an empty day to book that vehicle.</p>
    </div>
  );
}
