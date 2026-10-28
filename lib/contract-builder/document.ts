import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { CONTRACT_DEFAULTS, CONTRACT_FIELDS, type ContractCountry, type ContractValues } from "./fields";

const NUMBER_KEYS = new Set(CONTRACT_FIELDS.filter((field) => field.kind === "number").map((field) => field.key));

/**
 * Turns a country's agreement (content/contracts/<cc>.yaml: every clause in English and the local language, with
 * conditions and {{placeholders}}) plus the operator's form values into a list of blocks that the Word and print
 * renderers draw. Empty values become a blank line to write on, so the same agreement works filled in or blank.
 */

export type Bi = { en: string; local: string };
export type ContractBlock =
  | { kind: "heading"; text: Bi; pageBreak?: boolean }
  | { kind: "fields"; rows: Array<{ label: Bi; value: string }> }
  | { kind: "clause"; text: Bi }
  | { kind: "sign"; rows: Bi[] }
  | { kind: "grid"; columns: Bi[]; rows: Bi[] };
export type ContractDocument = {
  country: ContractCountry;
  locale: string;
  bilingual: boolean;
  title: Bi;
  subtitle: Bi;
  footer: Bi;
  pageWords: { page: string; of: string };
  business: { name: string; reg: string; address: string; phone: string; email: string };
  blocks: ContractBlock[];
};

type RawBi = { en?: string; local?: string } | undefined;
type RawClause = { id: string; en: string; local?: string; if?: string; unless?: string; when?: Record<string, string | string[]> };
type RawSection = {
  id: string;
  title: RawBi;
  fields?: Array<{ key: string; en: string; local?: string }>;
  clauses?: RawClause[];
  sign_rows?: RawBi[];
  check_rows?: RawBi[];
  price_rows?: RawBi[];
  columns?: Record<string, RawBi>;
  page_break?: boolean;
};
type RawContract = {
  country: string;
  locale: string;
  currency: string;
  title: RawBi;
  subtitle?: RawBi;
  footer?: RawBi;
  page_words?: { page?: string; of?: string };
  words: Record<string, RawBi>;
  sections: RawSection[];
} & Record<"prevailing_language" | "local_language" | "country_name" | "currency_name" | "jurisdiction" | "court_place", RawBi>;

export const BLANK = "________________";
const cache = new Map<string, RawContract>();

function load(country: ContractCountry): RawContract | null {
  const code = country.toLowerCase();
  if (cache.has(code)) return cache.get(code)!;
  const path = join(process.cwd(), "content", "contracts", `${code}.yaml`);
  if (!existsSync(path)) return null;
  const raw = parseYaml(readFileSync(path, "utf8").replace(/^﻿/, "")) as RawContract;
  cache.set(code, raw);
  return raw;
}

export function hasContract(country: ContractCountry) {
  return Boolean(load(country));
}

const bi = (value: RawBi, fallback = ""): Bi => ({ en: String(value?.en ?? fallback), local: String(value?.local ?? "") });

function money(value: string | undefined, currency: string) {
  if (!value) return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return `${currency} ${number.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** Every value a clause can name, in both languages: the form's, the country's, and the sentences built from them. */
function valueTable(raw: RawContract, input: ContractValues) {
  const v: ContractValues = { ...CONTRACT_DEFAULTS, ...input };
  const currency = v.currency || raw.currency || "";
  const w = (key: string) => bi(raw.words?.[key], key);
  const both = (en: string, local = en): Bi => ({ en, local });
  const table: Record<string, Bi> = {};
  // Amounts get thousands separators; text (a year, a plate) is printed as typed.
  for (const [key, value] of Object.entries(v)) table[key] = both(NUMBER_KEYS.has(key) && Number.isFinite(Number(value)) ? Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 }) : value);
  table.currency = both(currency);
  const sameCurrency = currency === raw.currency;
  table.currency_name = sameCurrency ? bi(raw.currency_name) : both(currency);
  for (const key of ["country_name", "jurisdiction", "court_place", "local_language", "prevailing_language"] as const) table[key] = bi(raw[key]);
  if (v.vehicle_type === "car" || v.vehicle_type === "motorbike") table.vehicle_type_label = w(v.vehicle_type);
  if (v.rate) {
    const per = w(`per_${v.rate_period || "day"}`);
    const amount = money(v.rate, currency);
    table.rate_text = { en: `${amount} ${per.en}`, local: `${amount} ${per.local || per.en}` };
  }
  if (v.delivery_fee !== undefined) table.delivery_fee_text = Number(v.delivery_fee) === 0 ? w("free") : both(money(v.delivery_fee, currency));
  if (v.deposit) table.deposit_text = both(money(v.deposit, currency));
  if (v.deposit_return_days) {
    const words = w("business_days");
    table.deposit_return_text = { en: `${v.deposit_return_days} ${words.en}`, local: `${v.deposit_return_days} ${words.local || words.en}` };
  }
  table.payment_methods = v.payment_methods ? both(v.payment_methods) : w("payment_default");
  table.insurance_text = w(`ins_${v.insurance_level || "compulsory"}`);
  if (v.insurance_excess) table.insurance_excess_text = both(money(v.insurance_excess, currency));
  table.mileage_period_label = w(v.mileage_period === "month" ? "month" : "day");
  return { values: v, table };
}

function visible(clause: RawClause, values: ContractValues) {
  if (clause.if && !values[clause.if]) return false;
  if (clause.unless && values[clause.unless]) return false;
  if (clause.when) {
    for (const [key, wanted] of Object.entries(clause.when)) {
      const list = Array.isArray(wanted) ? wanted.map(String) : [String(wanted)];
      if (!list.includes(String(values[key] ?? ""))) return false;
    }
  }
  return true;
}

/** Fills {{placeholders}} and {{#if key}}…{{/if}} in one language's text. */
function fill(text: string, table: Record<string, Bi>, lang: "en" | "local", values: ContractValues) {
  return String(text || "")
    .replace(/\{\{#if\s+([a-z0-9_]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key: string, inner: string) => (values[key] ? inner : ""))
    .replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/g, (_, key: string) => {
      const value = table[key];
      const text = value ? (lang === "local" ? value.local || value.en : value.en) : "";
      return text || BLANK;
    })
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

export function buildContract(country: ContractCountry, input: ContractValues): ContractDocument | null {
  const raw = load(country) || load("XX");
  if (!raw) return null;
  const { values, table } = valueTable(raw, input);
  const bilingual = raw.locale !== "en";
  const both = (text: RawBi): Bi => ({ en: fill(text?.en || "", table, "en", values), local: bilingual ? fill(text?.local || "", table, "local", values) : "" });
  const blocks: ContractBlock[] = [];
  for (const section of raw.sections) {
    blocks.push({ kind: "heading", text: both(section.title), pageBreak: section.page_break });
    if (section.fields?.length) {
      blocks.push({
        kind: "fields",
        rows: section.fields.map((field) => {
          const value = field.key.startsWith("renter_") || field.key.startsWith("driver2_") || field.key.startsWith("out_") || field.key.startsWith("in_") ? null : table[field.key];
          const text = value ? (value.local && bilingual && value.local !== value.en ? `${value.en} / ${value.local}` : value.en) : "";
          return { label: { en: field.en, local: bilingual ? field.local || "" : "" }, value: text };
        })
      });
    }
    for (const clause of section.clauses || []) if (visible(clause, values)) blocks.push({ kind: "clause", text: both(clause) });
    if (section.sign_rows?.length) blocks.push({ kind: "sign", rows: section.sign_rows.map(both) });
    const columns = section.columns ? Object.values(section.columns).map(both) : [];
    if (section.check_rows?.length) blocks.push({ kind: "grid", columns, rows: section.check_rows.map(both) });
    if (section.price_rows?.length) blocks.push({ kind: "grid", columns, rows: section.price_rows.map(both) });
  }
  return {
    country: (raw.country as ContractCountry) || country,
    locale: raw.locale,
    bilingual,
    title: both(raw.title),
    subtitle: both(raw.subtitle),
    // "Vehicle rental agreement · {business}" only when there is a business name to print.
    footer: values.business_name ? both(raw.footer) : both(raw.title),
    pageWords: { page: raw.page_words?.page || "Page", of: raw.page_words?.of || "of" },
    business: {
      name: values.business_name || "",
      reg: values.business_reg_no || "",
      address: values.business_address || "",
      phone: values.business_phone || "",
      email: values.business_email || ""
    },
    blocks
  };
}
