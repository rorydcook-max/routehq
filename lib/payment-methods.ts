import { businessCountry } from "@/lib/business-units";
import { orgCountry } from "@/lib/regional";

/**
 * Payment methods that only exist in some countries (sites-global, Rory 7 Nov 2026: RoveHQ serves rental businesses
 * worldwide). PromptPay is Thailand's QR payment, so it is offered only to businesses in Thailand: in the payment
 * settings, the booking link and customer portal, handover, refunds, extra charges and the booking form. A business
 * elsewhere that saved PromptPay details keeps them; the option is just not shown. Safe to import from the browser.
 */

/** Whether a business in this country can offer PromptPay. Unknown country: yes (nothing is hidden by mistake). */
export function promptPayAllowed(country: string | null | undefined) {
  const code = String(country || "").trim().toUpperCase();
  return !code || code === "TH";
}

/** For a loaded organization row (country_code, else its main location's country). */
export function organizationOffersPromptPay(organization: unknown) {
  return promptPayAllowed(orgCountry(organization));
}

/** For the signed-in business, anywhere (recorded per request on the server and by the app's root layout in the browser). */
export function businessOffersPromptPay() {
  return promptPayAllowed(businessCountry());
}

/**
 * A list of method codes without PromptPay when the business can't offer it. `keep` is a method already recorded
 * (editing an old payment that was made by PromptPay still shows it).
 */
export function methodsFor<T extends string>(methods: readonly T[], allowed: boolean = businessOffersPromptPay(), keep?: string | null): T[] {
  return methods.filter((method) => method !== "promptpay" || allowed || keep === "promptpay");
}
