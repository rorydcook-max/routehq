"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, Trash2 } from "lucide-react";
import { PendingButton } from "@/components/pending-button";

/**
 * Bulk actions for the fleet table. Hidden until at least one vehicle is
 * ticked, and deleting asks once more, because it can't be undone.
 */
export function FleetBulkActions({
  organizationId,
  archiveAction,
  deleteAction
}: {
  organizationId: string;
  archiveAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const t = useTranslations("fleet");
  const [count, setCount] = useState(0);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    function update() {
      const ticked = document.querySelectorAll<HTMLInputElement>('input[form="fleetBulkForm"][name="vehicleIds"]:checked').length;
      setCount(ticked);
      if (ticked === 0) setConfirming(false);
    }
    document.addEventListener("change", update);
    update();
    return () => document.removeEventListener("change", update);
  }, []);

  return (
    <form className={count > 0 ? "sticky top-3 z-20 mb-4 hidden rounded-xl border border-[var(--border)] bg-white px-4 py-3 shadow-[var(--shadow-md)] md:block" : "hidden"} id="fleetBulkForm">
      <input name="organizationId" type="hidden" value={organizationId} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-sm font-semibold text-[var(--foreground-secondary)]">{t("selected", { count })}</span>
        <PendingButton className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-[var(--foreground-secondary)] disabled:opacity-70" formAction={archiveAction} pendingLabel={t("archiving")} type="submit">
          <Archive size={16} />
          {t("archive")}
        </PendingButton>
        {confirming ? <span className="basis-full text-right text-sm font-semibold text-[var(--danger)] md:basis-auto">{t("bulkDeleteWarning", { count })}</span> : null}
        {confirming ? (
          <PendingButton className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--danger)] px-3 py-2 text-sm font-bold text-white disabled:opacity-70" formAction={deleteAction} pendingLabel={t("deleting")} type="submit">
            <Trash2 size={16} />
            {t("deleteForGood", { count })}
          </PendingButton>
        ) : (
          <button className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--danger-line)] bg-white px-3 py-2 text-sm font-bold text-[var(--danger)]" onClick={() => setConfirming(true)} type="button">
            <Trash2 size={16} />
            {t("delete")}
          </button>
        )}
      </div>
    </form>
  );
}

/** Row delete that asks for a second tap before deleting. */
export function ConfirmDeleteVehicleButton({
  vehicleId,
  organizationId,
  label,
  deleteAction,
  liveBookings = 0,
  canDeleteBookings = false
}: {
  vehicleId: string;
  organizationId: string;
  label: string;
  deleteAction: (formData: FormData) => void | Promise<void>;
  /** Current or upcoming bookings on this vehicle. */
  liveBookings?: number;
  /** Owner only: may delete those bookings together with the vehicle. */
  canDeleteBookings?: boolean;
}) {
  const t = useTranslations("fleet");
  const [confirming, setConfirming] = useState(false);
  // Deleting removes the vehicle with all its bookings and records, so only the owner can do it.
  const blocked = !canDeleteBookings;
  if (!confirming) {
    return (
      <button
        aria-label={t("deleteAria", { label })}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--danger-line)] bg-white text-[var(--danger)] hover:bg-[var(--danger-light)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
        disabled={blocked}
        onClick={() => setConfirming(true)}
        title={blocked ? t("noticeOwnerOnly") : t("deleteVehicle")}
        type="button"
      >
        <Trash2 size={16} />
      </button>
    );
  }
  {
    return (
      <form action={deleteAction} className="grid max-w-xs gap-2 rounded-xl border border-[var(--danger-line)] bg-[var(--danger-light)] p-3" role="alertdialog">
        <input name="vehicleId" type="hidden" value={vehicleId} />
        <input name="organizationId" type="hidden" value={organizationId} />
        <input name="deleteBookings" type="hidden" value="1" />
        <p className="text-xs font-semibold leading-snug text-[var(--danger)]">
          {liveBookings > 0 ? t("deleteWithBookings", { count: liveBookings }) : t("deleteVehicleConfirm")}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <PendingButton className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--danger)] px-3 text-xs font-bold text-white" pendingLabel="…" type="submit">
            {liveBookings > 0 ? t("deleteWithBookingsBtn") : t("delete")}
          </PendingButton>
          <button className="inline-flex h-8 items-center justify-center rounded-full border border-[var(--border)] bg-white px-3 text-xs font-semibold" onClick={() => setConfirming(false)} type="button">
            {t("keep")}
          </button>
        </div>
      </form>
    );
  }
}
