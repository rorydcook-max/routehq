/** The website's contact form: the choices it offers, shared by the form, its server action and the admin console. */

export const CONTACT_FLEETS = ["1-5", "6-20", "21-50", "50+"] as const;
export const CONTACT_TOPICS = ["general", "import", "pricing", "partner", "other"] as const;

/** Admin console labels (English only, like the rest of the console). */
export const CONTACT_FLEET_LABEL: Record<string, string> = { "1-5": "1–5 vehicles", "6-20": "6–20 vehicles", "21-50": "21–50 vehicles", "50+": "More than 50" };
export const CONTACT_TOPIC_LABEL: Record<string, string> = { general: "General question", import: "Moving in", pricing: "Plans and pricing", partner: "Partnership", other: "Something else" };

export type ContactValues = { name: string; email: string; phone: string; business: string; fleet: string; topic: string; message: string };

export type ContactState = {
  /** Counts submissions, so the fields are drawn again with what was typed after a failed send. */
  n: number;
  status?: "sent" | "error";
  error?: "required" | "email" | "tooMany" | "failed";
  values?: ContactValues;
};
