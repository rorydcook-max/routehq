"use server";

import { getLocale } from "next-intl/server";
import { EMAIL_PATTERN, formText, requestIpHash } from "@/lib/site/request-hash";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { alertTeam } from "@/lib/support";
import { CONTACT_FLEETS, CONTACT_TOPICS, type ContactState } from "@/lib/contact";

/**
 * The website's contact form (/contact). Saved with the service role (contact_messages has no insert policy), then the
 * team is alerted the same way as a Help message. A filled-in honeypot pretends to succeed and saves nothing; more than
 * five messages an hour from one address are turned away. The address is kept only as a salted hash.
 */

const LIMITS = { name: 120, email: 200, phone: 40, business: 120, message: 4000 } as const;
const PER_HOUR = 5;
const EMAIL = EMAIL_PATTERN;
const text = formText;
const ipHash = requestIpHash;

export async function sendContactMessage(previous: ContactState, formData: FormData): Promise<ContactState> {
  const n = (previous?.n || 0) + 1;
  const values = {
    name: text(formData, "name", LIMITS.name),
    email: text(formData, "email", LIMITS.email),
    phone: text(formData, "phone", LIMITS.phone),
    business: text(formData, "business", LIMITS.business),
    fleet: String(formData.get("fleet") || ""),
    topic: String(formData.get("topic") || ""),
    message: text(formData, "message", LIMITS.message)
  };
  // A bot filled the field people never see: say thanks, keep nothing.
  if (String(formData.get("website") || "").trim()) return { n, status: "sent" };
  if (!values.name || !values.email || !values.message) return { n, status: "error", error: "required", values };
  if (!EMAIL.test(values.email)) return { n, status: "error", error: "email", values };
  const fleet = (CONTACT_FLEETS as readonly string[]).includes(values.fleet) ? values.fleet : null;
  const topic = (CONTACT_TOPICS as readonly string[]).includes(values.topic) ? values.topic : "general";

  try {
    const db = createSupabaseAdminClient() as any;
    const hash = await ipHash();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await db.from("contact_messages").select("id", { count: "exact", head: true }).eq("ip_hash", hash).gte("created_at", since);
    if ((count || 0) >= PER_HOUR) return { n, status: "error", error: "tooMany", values };
    const locale = await getLocale().catch(() => null);
    const { data, error } = await db
      .from("contact_messages")
      .insert({
        name: values.name,
        email: values.email,
        phone: values.phone || null,
        business: values.business || null,
        fleet,
        topic,
        message: values.message,
        locale,
        ip_hash: hash
      })
      .select("id")
      .single();
    if (error || !data) return { n, status: "error", error: "failed", values };
    await alertTeam(`Website message from ${values.name}${values.business ? ` (${values.business})` : ""} · ${topic}: ${values.message.slice(0, 200)}`, `contact-${data.id}`, "/platform/messages");
    return { n, status: "sent" };
  } catch {
    return { n, status: "error", error: "failed", values };
  }
}
