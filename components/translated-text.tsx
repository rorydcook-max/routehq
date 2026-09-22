import { getLocale, getTranslations } from "next-intl/server";
import type { ReadableText } from "@/lib/content-translation";

/**
 * Shows typed text in the reader's language when it was written in another,
 * clearly marked as a translation, with the original always one tap away.
 * Untranslated text renders exactly as before.
 */
export async function TranslatedText({ value, className }: { value: ReadableText; className?: string }) {
  if (!value.original) return null;
  if (!value.translated) return <p className={className}>{value.original}</p>;

  const [t, locale] = await Promise.all([getTranslations("translation"), getLocale()]);
  let language = value.sourceLanguage || "";
  try {
    language = new Intl.DisplayNames([locale], { type: "language" }).of(value.sourceLanguage || "") || language;
  } catch {}

  return (
    <div className={className}>
      <p>{value.text}</p>
      <details className="mt-1 text-xs text-[#667085]">
        <summary className="cursor-pointer select-none font-semibold">
          {t("translatedFrom", { language })} · {t("showOriginal")}
        </summary>
        <p className="mt-1 whitespace-pre-wrap text-[#475467]" lang={value.sourceLanguage || undefined}>
          {value.original}
        </p>
      </details>
    </div>
  );
}
