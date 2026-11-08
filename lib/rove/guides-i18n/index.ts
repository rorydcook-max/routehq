import type { GuideTranslations } from "./blocks";
import de from "./de";
import el from "./el";
import es from "./es";
import fil from "./fil";
import fr from "./fr";
import he from "./he";
import hi from "./hi";
import hr from "./hr";
import id from "./id";
import it from "./it";
import ja from "./ja";
import ko from "./ko";
import lo from "./lo";
import ms from "./ms";
import my from "./my";
import nb from "./nb";
import nl from "./nl";
import pl from "./pl";
import pt from "./pt";
import ru from "./ru";
import si from "./si";
import sv from "./sv";
import ta from "./ta";
import th from "./th";
import tr from "./tr";
import vi from "./vi";
import zh from "./zh";
import zhTW from "./zh-TW";

/** Every language's guide translations (lib/rove/guides-i18n/blocks.ts says how they're kept). English is guides.ts. */
export const GUIDE_TRANSLATIONS: Record<string, GuideTranslations> = {
  de,
  el,
  es,
  fil,
  fr,
  he,
  hi,
  hr,
  id,
  it,
  ja,
  ko,
  lo,
  ms,
  my,
  nb,
  nl,
  pl,
  pt,
  ru,
  si,
  sv,
  ta,
  th,
  tr,
  vi,
  zh,
  "zh-TW": zhTW
};
