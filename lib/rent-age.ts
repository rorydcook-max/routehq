/**
 * Moving a known rent to a vehicle of another age or mileage (Rory, 2 Nov 2026: his 2017 Yaris rents for ฿11,000;
 * a 2022 with low mileage would be ฿13,000-14,000). About 4.5% a year newer or older, and about 1.5% for every
 * 20,000 km less or more, together at most 25% either way, to the nearest 100.
 */
export const RENT_PER_YEAR = 0.045;
export const RENT_PER_20K_KM = 0.015;

export function rentForAge(
  rent: number,
  from: { year?: number | null; mileage?: number | null },
  to: { year?: number | null; mileage?: number | null },
  round = 100
) {
  if (!(rent > 0)) return 0;
  let shift = 0;
  if (from.year && to.year) shift += (to.year - from.year) * RENT_PER_YEAR;
  if (from.mileage && to.mileage) shift += ((from.mileage - to.mileage) / 20000) * RENT_PER_20K_KM;
  shift = Math.max(-0.25, Math.min(0.25, shift));
  return Math.round((rent * (1 + shift)) / round) * round;
}
