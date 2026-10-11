/** The partner network's shapes and price maths, with no server code behind them, so the browser can use them. */

export type PartnerVehicle = {
  vehicleId: string;
  organizationId: string;
  business: string;
  town: string;
  phone: string;
  make: string;
  model: string;
  year: number | null;
  plate: string;
  kind: string;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  deposit: number;
  currency: string;
};

export type ReferralRow = {
  id: string;
  direction: "sent" | "received";
  partner: string;
  customerName: string;
  customerPhone: string;
  vehicle: string;
  startDate: string | null;
  endDate: string | null;
  rentalId: string | null;
  rentalStatus: string | null;
  status: string;
  feePct: number;
  feeAmount: number | null;
  feeDueAt: string | null;
  feePaidAt: string | null;
  createdAt: string;
};

/** The rate the partner would charge for these dates, by the longest period that fits. */
export function priceFor(vehicle: Pick<PartnerVehicle, "dailyRate" | "weeklyRate" | "monthlyRate">, startDate: string, endDate: string | null) {
  const days = endDate ? Math.max(1, Math.round((new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / 86_400_000)) : null;
  if ((days === null || days >= 28) && vehicle.monthlyRate > 0) return { model: "monthly" as const, rate: vehicle.monthlyRate, days, total: days ? Math.round((vehicle.monthlyRate * days) / 30) : vehicle.monthlyRate };
  if (days !== null && days >= 7 && vehicle.weeklyRate > 0 && !vehicle.dailyRate) return { model: "weekly" as const, rate: vehicle.weeklyRate, days, total: Math.round((vehicle.weeklyRate * days) / 7) };
  if (vehicle.dailyRate > 0) return { model: "daily" as const, rate: vehicle.dailyRate, days, total: days ? vehicle.dailyRate * days : vehicle.dailyRate * 30 };
  if (vehicle.weeklyRate > 0) return { model: "weekly" as const, rate: vehicle.weeklyRate, days, total: days ? Math.round((vehicle.weeklyRate * days) / 7) : vehicle.weeklyRate * 4 };
  return { model: "monthly" as const, rate: vehicle.monthlyRate, days, total: vehicle.monthlyRate };
}
