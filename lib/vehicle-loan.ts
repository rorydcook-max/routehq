/**
 * A vehicle loan (hire purchase), kept simple (Rory, 31 Oct 2026): the sale price, the down payment, the monthly
 * payment, the loan length and the months left. Everything else is worked out from those:
 *   borrowed        = sale price - down payment
 *   total repaid    = monthly payment x loan length
 *   total cost      = down payment + total repaid
 *   interest        = total cost - sale price
 *   flat rate / yr  = interest / borrowed / (loan length / 12)   (how Thai hire purchase is usually quoted)
 *   months left now = months left when saved, less the months since
 *   still to pay    = monthly payment x months left now
 * Stored in vehicles.metadata.finance.
 */

export type VehicleLoan = {
  sale_price?: number | null;
  down_payment?: number | null;
  monthly_payment?: number | null;
  term_months?: number | null;
  months_left?: number | null;
  /** The day "months left" was entered; it counts down from here. */
  months_left_as_of?: string | null;
  lender?: string | null;
  // Worked out on save, for older screens that read them.
  end_date?: string | null;
  outstanding_balance?: number | null;
};

export type LoanFigures = {
  borrowed: number | null;
  totalRepaid: number | null;
  totalCost: number | null;
  interest: number | null;
  flatRatePerYear: number | null;
  monthsLeftNow: number | null;
  stillToPay: number | null;
  endDate: string | null;
};

const num = (value: unknown) => {
  const n = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(n) ? null : n;
};

function monthsBetween(fromIso: string, to: Date) {
  const from = new Date(`${fromIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(from.getTime())) return 0;
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

function addMonths(fromIso: string, months: number) {
  const d = new Date(`${fromIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function hasLoan(loan: VehicleLoan | null | undefined) {
  if (!loan) return false;
  return Boolean(num(loan.monthly_payment) || num(loan.sale_price) || num(loan.term_months) || loan.lender || num(loan.outstanding_balance) || loan.end_date);
}

export function loanFigures(loan: VehicleLoan | null | undefined, today: Date = new Date()): LoanFigures {
  const sale = num(loan?.sale_price);
  const down = num(loan?.down_payment) ?? 0;
  const monthly = num(loan?.monthly_payment);
  const term = num(loan?.term_months);
  const left = num(loan?.months_left);

  const borrowed = sale !== null ? Math.max(0, sale - down) : null;
  const totalRepaid = monthly !== null && term !== null ? monthly * term : null;
  const totalCost = totalRepaid !== null ? down + totalRepaid : null;
  const interest = totalCost !== null && sale !== null ? totalCost - sale : null;
  const flatRatePerYear = interest !== null && borrowed && term ? (interest / borrowed / (term / 12)) * 100 : null;

  let monthsLeftNow: number | null = null;
  let endDate: string | null = loan?.end_date || null;
  if (left !== null) {
    const asOf = loan?.months_left_as_of || today.toISOString().slice(0, 10);
    monthsLeftNow = Math.max(0, left - monthsBetween(asOf, today));
    endDate = addMonths(asOf, left);
  }
  const stillToPay = monthly !== null && monthsLeftNow !== null ? monthly * monthsLeftNow : num(loan?.outstanding_balance);

  return { borrowed, totalRepaid, totalCost, interest, flatRatePerYear, monthsLeftNow, stillToPay, endDate };
}

/** The loan as saved from the add or edit form; keeps a lender typed in the old form. */
export function loanFromForm(formData: FormData, previous?: VehicleLoan | null): VehicleLoan {
  const read = (key: string) => {
    const raw = String(formData.get(key) ?? "").replace(/,/g, "").trim();
    return raw ? Math.max(0, Math.round(Number(raw))) || 0 : null;
  };
  const sale_price = read("loanSalePrice");
  const down_payment = read("loanDownPayment");
  const monthly_payment = read("loanMonthlyPayment");
  const term_months = read("loanTermMonths");
  let months_left = read("loanMonthsLeft");
  if (months_left !== null && term_months !== null) months_left = Math.min(months_left, term_months);
  // A brand-new loan: months left defaults to the full length.
  if (months_left === null && term_months !== null) months_left = term_months;

  if ([sale_price, down_payment, monthly_payment, term_months, months_left].every((v) => v === null)) return {};

  const today = new Date().toISOString().slice(0, 10);
  // Keep the date months left counts from, unless months left was changed.
  const sameLeft = previous && num(previous.months_left) === months_left && previous.months_left_as_of;
  const loan: VehicleLoan = {
    sale_price,
    down_payment,
    monthly_payment,
    term_months,
    months_left,
    months_left_as_of: months_left === null ? null : sameLeft ? previous!.months_left_as_of : today,
    lender: previous?.lender || null
  };
  const figures = loanFigures(loan);
  loan.end_date = figures.endDate;
  loan.outstanding_balance = figures.stillToPay;
  return loan;
}
