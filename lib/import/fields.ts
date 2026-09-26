/**
 * The RouteHQ fields a spreadsheet column can be imported into. One list feeds
 * both the AI mapping prompt and the manual mapping dropdown, so they can't
 * drift apart.
 */

export type ImportFieldGroup = "Vehicle" | "Compliance" | "Finance" | "Current rental" | "Customer" | "Rental" | "Transaction";

export type ImportField = { key: string; label: string; group: ImportFieldGroup };

export const IMPORT_FIELDS: ImportField[] = [
  { key: "registration_number", label: "Registration plate", group: "Vehicle" },
  { key: "make", label: "Make", group: "Vehicle" },
  { key: "model", label: "Model", group: "Vehicle" },
  { key: "trim", label: "Trim / variant", group: "Vehicle" },
  { key: "vehicle_name", label: "Make and model in one column", group: "Vehicle" },
  { key: "year", label: "Year", group: "Vehicle" },
  { key: "color", label: "Colour", group: "Vehicle" },
  { key: "transmission", label: "Transmission", group: "Vehicle" },
  { key: "engine_cc", label: "Engine size", group: "Vehicle" },
  { key: "fuel_type", label: "Fuel type", group: "Vehicle" },
  { key: "seating_capacity", label: "Seats", group: "Vehicle" },
  { key: "drivetrain", label: "Drivetrain", group: "Vehicle" },
  { key: "body_type", label: "Body type", group: "Vehicle" },
  { key: "vin", label: "VIN / chassis number", group: "Vehicle" },
  { key: "current_mileage", label: "Current mileage (km)", group: "Vehicle" },
  { key: "daily_rate", label: "List price per day", group: "Vehicle" },
  { key: "weekly_rate", label: "List price per week", group: "Vehicle" },
  { key: "monthly_rate", label: "List price per month", group: "Vehicle" },
  { key: "gps_tracker_url", label: "GPS tracker link", group: "Vehicle" },
  { key: "notes", label: "Notes", group: "Vehicle" },

  { key: "tax_expiry_date", label: "Road tax expiry", group: "Compliance" },
  { key: "tax_cost", label: "Road tax cost", group: "Compliance" },
  { key: "porbor_expiry_date", label: "Compulsory insurance (Por Ror Bor) expiry", group: "Compliance" },
  { key: "porbor_cost", label: "Compulsory insurance cost", group: "Compliance" },
  { key: "insurance_expiry_date", label: "Insurance expiry", group: "Compliance" },
  { key: "insurance_cost", label: "Insurance cost", group: "Compliance" },
  { key: "insurance_sum_insured", label: "Sum insured", group: "Compliance" },
  { key: "insurance_excess", label: "Insurance excess", group: "Compliance" },
  { key: "last_service_date", label: "Last service date", group: "Compliance" },
  { key: "next_service_date", label: "Next service date", group: "Compliance" },

  { key: "purchase_date", label: "Purchase date", group: "Finance" },
  { key: "purchase_price", label: "Purchase price", group: "Finance" },
  { key: "purchase_mileage", label: "Mileage at purchase", group: "Finance" },
  { key: "estimated_value", label: "Current value", group: "Finance" },
  { key: "finance_lender", label: "Finance lender", group: "Finance" },
  { key: "finance_monthly_payment", label: "Finance payment per month", group: "Finance" },
  { key: "finance_outstanding", label: "Finance still owed", group: "Finance" },
  { key: "finance_end_date", label: "Finance end date", group: "Finance" },

  { key: "customer_name", label: "Renter name", group: "Current rental" },
  { key: "phone", label: "Renter phone", group: "Current rental" },
  { key: "email", label: "Renter email", group: "Current rental" },
  { key: "start_date", label: "Rented from", group: "Current rental" },
  { key: "end_date", label: "Rented to", group: "Current rental" },
  { key: "rental_rate", label: "Rent per month", group: "Current rental" },
  { key: "deposit_amount", label: "Deposit", group: "Current rental" },
  { key: "mileage_at_start", label: "Mileage when rented", group: "Current rental" },
  { key: "next_payment_date", label: "Next payment due", group: "Current rental" },

  { key: "full_name", label: "Customer name", group: "Customer" },
  { key: "nationality", label: "Nationality", group: "Customer" },
  { key: "passport_number", label: "Passport number", group: "Customer" },
  { key: "driving_licence_number", label: "Driving licence number", group: "Customer" },

  { key: "vehicle_registration", label: "Vehicle plate (for a rental or payment)", group: "Rental" },

  { key: "date", label: "Date", group: "Transaction" },
  { key: "type", label: "Type (rent, fuel, repair...)", group: "Transaction" },
  { key: "amount", label: "Amount", group: "Transaction" }
];

export const IMPORT_FIELD_KEYS = new Set(IMPORT_FIELDS.map((field) => field.key));

export const IMPORT_FIELD_GROUPS: ImportFieldGroup[] = ["Vehicle", "Compliance", "Finance", "Current rental", "Customer", "Rental", "Transaction"];

/** Keys the AI prompt lists, per kind of sheet. */
export function importFieldKeys(groups: ImportFieldGroup[]) {
  return IMPORT_FIELDS.filter((field) => groups.includes(field.group)).map((field) => field.key);
}
