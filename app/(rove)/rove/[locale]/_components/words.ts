import { getTranslations } from "next-intl/server";
import type { SearchWords } from "./search-form";

/** The kinds of vehicle a renter can pick (lib/vehicle-groups.ts kinds that businesses rent out). */
export const ROVE_KINDS = ["car", "scooter", "motorbike", "van", "atv", "ebike"] as const;

/** The search form's words, passed to it (Rove's client parts get no message bundle). */
export async function searchWords(): Promise<SearchWords> {
  const t = await getTranslations("directory");
  return {
    where: t("where"),
    wherePlaceholder: t("rv.wherePlaceholder"),
    from: t("rv.pickUp"),
    to: t("rv.dropOff"),
    kind: t("kind"),
    anyKind: t("anyKind"),
    monthly: t("rv.monthlyOpen"),
    search: t("search"),
    kinds: ROVE_KINDS.map((value) => ({ value, label: t(`kind_${value}`) }))
  };
}
