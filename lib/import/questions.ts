/**
 * The few things the importer can't settle from the file and would rather ask than guess, shown as quick questions
 * above the cards. Each answer re-reads the sheet. At most three, so it never turns into a form.
 */
import { parseDateValue } from "@/lib/import/normalize";
import type { ImportPreview, SheetMapping } from "@/lib/import/preview";

export type ImportQuestion =
  | { id: string; kind: "date_order"; sheet: string; example: string; dayFirst: string; monthFirst: string; current: "dmy" | "mdy" }
  | { id: string; kind: "rate_period"; sheet: string; amount: number; customer: string; current: "day" | "week" | "month" };

export function importQuestions(mappings: SheetMapping[], preview: ImportPreview): ImportQuestion[] {
  const questions: ImportQuestion[] = [];
  for (const sheet of mappings) {
    // Every date in the sheet could be day first or month first (05/06/2026).
    if (sheet.date_order_unsure && sheet.date_example) {
      const dayFirst = parseDateValue(sheet.date_example, "dmy");
      const monthFirst = parseDateValue(sheet.date_example, "mdy");
      if (dayFirst && monthFirst && dayFirst !== monthFirst) {
        questions.push({ id: `date:${sheet.sheet_name}`, kind: "date_order", sheet: sheet.sheet_name, example: sheet.date_example, dayFirst, monthFirst, current: sheet.date_order === "mdy" ? "mdy" : "dmy" });
      }
    }
    // Rent from a column that doesn't say what it's per ("Rent", "Price"), where the figure doesn't settle it either:
    // ฿11,000 on an open-ended rental is plainly monthly and ฿250 for three days plainly daily, but ฿2,500 for two
    // months, or ฿9,000 for a week, could be either.
    if (!sheet.rate_period) {
      const unclear = (rental: ImportPreview["rentals"][number]) => {
        const days = rental.startDate && rental.endDate ? (Date.parse(rental.endDate) - Date.parse(rental.startDate)) / 86_400_000 : null;
        const long = days === null || days >= 28;
        const rate = rental.rate || 0;
        if (rental.ratePeriod === "month" && rate >= 3000 && long) return false;
        if (rental.ratePeriod === "day" && rate < 3000 && !long) return false;
        return true;
      };
      const guessed = preview.rentals.filter((rental) => rental.sheet === sheet.sheet_name && rental.include && rental.periodGuessed && rental.rate && unclear(rental));
      if (guessed.length) {
        const counts = new Map<"day" | "week" | "month", number>();
        for (const rental of guessed) counts.set(rental.ratePeriod, (counts.get(rental.ratePeriod) || 0) + 1);
        const current = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
        questions.push({ id: `rate:${sheet.sheet_name}`, kind: "rate_period", sheet: sheet.sheet_name, amount: guessed[0].rate || 0, customer: guessed[0].customerName, current });
      }
    }
  }
  return questions.slice(0, 3);
}

/** The mappings with a question answered, ready to re-read the sheet. */
export function answerQuestion(mappings: SheetMapping[], question: ImportQuestion, answer: string): SheetMapping[] {
  return mappings.map((sheet) => {
    if (sheet.sheet_name !== question.sheet) return sheet;
    if (question.kind === "date_order") return { ...sheet, date_order: answer === "mdy" ? "mdy" : "dmy", date_order_unsure: false };
    return { ...sheet, rate_period: answer === "day" || answer === "week" ? answer : "month" };
  });
}
