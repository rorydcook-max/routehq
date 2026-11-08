import { getTranslations } from "next-intl/server";
import { DESTINATIONS } from "@/lib/rove/destinations";
import { liveDestinations, loadMarket } from "@/lib/rove/market";
import type { SearchWords } from "./search-form";

/** The kinds of vehicle a renter can pick (lib/vehicle-groups.ts kinds that businesses rent out). */
export const ROVE_KINDS = ["car", "scooter", "motorbike", "van", "atv", "ebike"] as const;

/** The example places in rv.wherePlaceholder ("Try Algarve, Maui or Bali"), in the order the sentence names them. */
const EXAMPLES = ["Algarve", "Maui", "Bali"];

/**
 * The search box's example places (task perf, 8 Nov 2026): three places with live listings, put in place of the
 * sentence's own examples, so it never suggests somewhere with nothing to book (those pages aren't indexed). With fewer
 * than three such places, or a language that spells the examples its own way, the plain "City or island".
 */
async function wherePlaceholder(sentence: string, plain: string) {
  const { vehicles } = await loadMarket();
  const live = liveDestinations(DESTINATIONS, vehicles).slice(0, 3).map((row) => row.destination.name);
  if (live.length < 3 || !EXAMPLES.every((name) => sentence.includes(name))) return plain;
  return EXAMPLES.reduce((text, name, index) => text.replace(name, live[index]), sentence);
}

/** The search form's words, passed to it (Rove's client parts get no message bundle). */
export async function searchWords(): Promise<SearchWords> {
  const t = await getTranslations("directory");
  return {
    where: t("where"),
    wherePlaceholder: await wherePlaceholder(t("rv.wherePlaceholder"), t("wherePlaceholder")),
    from: t("rv.pickUp"),
    to: t("rv.dropOff"),
    start: t("rv.startDate"),
    kind: t("kind"),
    anyKind: t("anyKind"),
    modeLabel: t("rv.modeLabel"),
    modeDates: t("rv.modeDates"),
    modeMonthly: t("rv.modeMonthly"),
    monthlyNote: t("rv.monthlyNote"),
    search: t("search"),
    kinds: ROVE_KINDS.map((value) => ({ value, label: t(`kind_${value}`) }))
  };
}
