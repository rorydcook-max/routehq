"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { shownError } from "@/lib/error-text";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, CreditCard, FileText, IdCard, ImageIcon, MessageCircle, PenLine, Upload, UserRound, XCircle } from "lucide-react";
import { completePublicBooking, reportPublicBookingPayment } from "@/app/actions/public-booking";
import { preparePublicBookingUploads } from "@/app/actions/uploads";
import { readIdentityDocument } from "@/app/actions/identity-ocr";
import { uploadFormFiles } from "@/lib/direct-upload-client";
import { extractBodyHtml } from "@/lib/contract-rendering";
import { formatDeliveryLocation } from "@/lib/delivery-location";
import { toWallTime, businessToday } from "@/lib/business-time";

declare global {
  interface Window {
    __routeHqPublicGoogleMapsPromise?: Promise<void>;
  }
}

type OrgPaymentSettings = {
  accepted_payment_methods: string[];
  promptpay_id: string | null;
  promptpay_qr_url: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  wise_link: string | null;
  revolut_link: string | null;
  default_payment_method: string;
  upfront_discount_enabled: boolean;
  upfront_discount_min_periods: number;
  upfront_discount_rate: number | null;
  upfront_discount_label: string | null;
};

type PublicBookingDetail = {
  token: string;
  organizationName: string;
  /** The customer already has the vehicle (e.g. a rental entered after the handover). */
  vehicleWithCustomer?: boolean;
  customer: any;
  completion: {
    details: boolean;
    documents: boolean;
    agreement: boolean;
  };
  documentStatus: {
    passport: boolean;
    driver_license: boolean;
    selfie: boolean;
  };
  bookingData: Record<string, unknown>;
  contractHtml: string;
  orgPayment?: OrgPaymentSettings;
  /** PromptPay QR that already carries the first payment's amount. */
  promptPayQrSvg?: string | null;
  bookingReference?: string;
  rentalRate?: number;
  // The rent owed first: for a daily price, the whole stay.
  firstRent?: number;
  /** Paid extras picked on the booking, paid with the first rent. */
  extrasTotal?: number;
  outstandingBalance?: number;
  depositAmount?: number;
  currency?: string;
  billingPeriod?: string;
  rentalDocumentAgreement?: {
    eligibility: {
      eligible: boolean;
      blockingIssues: string[];
      warnings: string[];
      customerSafeMessage: string | null;
      contentHashFragment?: string | null;
      customerAlreadySigned: boolean;
      fullyExecuted: boolean;
    };
    agreement: null | {
      versionId: string;
      versionNumber: number;
      contentHashFragment: string;
      renderedHtmlSnapshot: string;
      businessIdentity: { name: string; legalName: string | null; poweredByRouteHq: boolean };
      rentalSummary: Record<string, string>;
      requiredAcknowledgements: ReadonlyArray<{ type: string; textVersion: string; text: string }>;
      businessSignatureStatus: string;
      customerSignatureStatus: string;
      executionStatus: string;
    };
  } | null;
  executedAgreementDownloads?: {
    originalAgreementUrl: string | null;
    executionCertificateUrl: string | null;
  } | null;
};

const fieldStyle = {
  height: 42,
  width: "100%",
  fontSize: 14,
  padding: "0 12px",
  border: "0.5px solid var(--border)",
  borderRadius: 8,
  background: "#ffffff",
  color: "var(--foreground)",
  boxSizing: "border-box" as const,
  outline: "none",
};
const inputClass = "mt-2 focus:ring-2 focus:ring-[var(--primary)]/15";
const emojiSelectStyle = {
  fontFamily: '"Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", "Segoe UI", system-ui, sans-serif'
};

type DocKind = "passport" | "driver_license";
type DocReadState = "reading" | "read" | "unreadable" | null;
const ID_FIELDS = ["passportNumber", "driverLicenseNumber", "driverLicenseExpiry", "driverLicenseCountry"] as const;

/** Phone photos are several megabytes; a copy this size reads just as well and sends in a moment. */
async function shrinkImage(file: File, maxSide = 1600): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ? new File([blob], "document.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

function buildContractPreviewDocument(contractHtml: string) {
  const bodyHtml = extractBodyHtml(contractHtml);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #1a1d21;
        font-family: Arial, sans-serif;
      }

      body {
        padding: 16px;
        box-sizing: border-box;
      }

      *,
      *::before,
      *::after {
        box-sizing: border-box;
      }

      img {
        max-width: 100%;
        height: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      /* On a phone the agreement must read top to bottom: nothing may push it sideways. */
      html,
      body {
        overflow-x: hidden;
      }

      body * {
        min-width: 0;
        overflow-wrap: anywhere;
      }
    </style>
  </head>
  <body>${bodyHtml}</body>
</html>`;
}

// ISO 3166-1 alpha-2 code, nationality adjective, country name
// Ordered with top Thailand tourism markets first, then alphabetical
const NATIONALITIES: { code: string; name: string; country: string }[] = [
  { code: "TH", name: "Thai", country: "Thailand" },
  { code: "CN", name: "Chinese", country: "China" },
  { code: "RU", name: "Russian", country: "Russia" },
  { code: "GB", name: "British", country: "United Kingdom" },
  { code: "DE", name: "German", country: "Germany" },
  { code: "FR", name: "French", country: "France" },
  { code: "AU", name: "Australian", country: "Australia" },
  { code: "US", name: "American", country: "United States" },
  { code: "IN", name: "Indian", country: "India" },
  { code: "MY", name: "Malaysian", country: "Malaysia" },
  { code: "SG", name: "Singaporean", country: "Singapore" },
  { code: "JP", name: "Japanese", country: "Japan" },
  { code: "KR", name: "South Korean", country: "South Korea" },
  { code: "ID", name: "Indonesian", country: "Indonesia" },
  { code: "PH", name: "Filipino", country: "Philippines" },
  { code: "VN", name: "Vietnamese", country: "Vietnam" },
  { code: "IL", name: "Israeli", country: "Israel" },
  { code: "CH", name: "Swiss", country: "Switzerland" },
  { code: "SE", name: "Swedish", country: "Sweden" },
  { code: "NL", name: "Dutch", country: "Netherlands" },
  { code: "NO", name: "Norwegian", country: "Norway" },
  { code: "DK", name: "Danish", country: "Denmark" },
  { code: "FI", name: "Finnish", country: "Finland" },
  { code: "NZ", name: "New Zealander", country: "New Zealand" },
  { code: "CA", name: "Canadian", country: "Canada" },
  { code: "ES", name: "Spanish", country: "Spain" },
  { code: "IT", name: "Italian", country: "Italy" },
  { code: "KH", name: "Cambodian", country: "Cambodia" },
  { code: "LA", name: "Lao", country: "Laos" },
  { code: "MM", name: "Burmese", country: "Myanmar" },
  // Rest alphabetical by country
  { code: "AF", name: "Afghan", country: "Afghanistan" },
  { code: "AL", name: "Albanian", country: "Albania" },
  { code: "DZ", name: "Algerian", country: "Algeria" },
  { code: "AD", name: "Andorran", country: "Andorra" },
  { code: "AO", name: "Angolan", country: "Angola" },
  { code: "AR", name: "Argentine", country: "Argentina" },
  { code: "AM", name: "Armenian", country: "Armenia" },
  { code: "AT", name: "Austrian", country: "Austria" },
  { code: "AZ", name: "Azerbaijani", country: "Azerbaijan" },
  { code: "BH", name: "Bahraini", country: "Bahrain" },
  { code: "BD", name: "Bangladeshi", country: "Bangladesh" },
  { code: "BY", name: "Belarusian", country: "Belarus" },
  { code: "BE", name: "Belgian", country: "Belgium" },
  { code: "BZ", name: "Belizean", country: "Belize" },
  { code: "BJ", name: "Beninese", country: "Benin" },
  { code: "BT", name: "Bhutanese", country: "Bhutan" },
  { code: "BO", name: "Bolivian", country: "Bolivia" },
  { code: "BA", name: "Bosnian", country: "Bosnia and Herzegovina" },
  { code: "BW", name: "Botswanan", country: "Botswana" },
  { code: "BR", name: "Brazilian", country: "Brazil" },
  { code: "BN", name: "Bruneian", country: "Brunei" },
  { code: "BG", name: "Bulgarian", country: "Bulgaria" },
  { code: "BF", name: "Burkinabe", country: "Burkina Faso" },
  { code: "BI", name: "Burundian", country: "Burundi" },
  { code: "CV", name: "Cape Verdean", country: "Cape Verde" },
  { code: "CM", name: "Cameroonian", country: "Cameroon" },
  { code: "CF", name: "Central African", country: "Central African Republic" },
  { code: "TD", name: "Chadian", country: "Chad" },
  { code: "CL", name: "Chilean", country: "Chile" },
  { code: "CO", name: "Colombian", country: "Colombia" },
  { code: "KM", name: "Comorian", country: "Comoros" },
  { code: "CG", name: "Congolese", country: "Congo" },
  { code: "CR", name: "Costa Rican", country: "Costa Rica" },
  { code: "HR", name: "Croatian", country: "Croatia" },
  { code: "CU", name: "Cuban", country: "Cuba" },
  { code: "CY", name: "Cypriot", country: "Cyprus" },
  { code: "CZ", name: "Czech", country: "Czech Republic" },
  { code: "EC", name: "Ecuadorian", country: "Ecuador" },
  { code: "EG", name: "Egyptian", country: "Egypt" },
  { code: "SV", name: "Salvadoran", country: "El Salvador" },
  { code: "GQ", name: "Equatoguinean", country: "Equatorial Guinea" },
  { code: "ER", name: "Eritrean", country: "Eritrea" },
  { code: "EE", name: "Estonian", country: "Estonia" },
  { code: "ET", name: "Ethiopian", country: "Ethiopia" },
  { code: "FJ", name: "Fijian", country: "Fiji" },
  { code: "GA", name: "Gabonese", country: "Gabon" },
  { code: "GM", name: "Gambian", country: "Gambia" },
  { code: "GE", name: "Georgian", country: "Georgia" },
  { code: "GH", name: "Ghanaian", country: "Ghana" },
  { code: "GR", name: "Greek", country: "Greece" },
  { code: "GT", name: "Guatemalan", country: "Guatemala" },
  { code: "GN", name: "Guinean", country: "Guinea" },
  { code: "GY", name: "Guyanese", country: "Guyana" },
  { code: "HT", name: "Haitian", country: "Haiti" },
  { code: "HN", name: "Honduran", country: "Honduras" },
  { code: "HK", name: "Hong Konger", country: "Hong Kong" },
  { code: "HU", name: "Hungarian", country: "Hungary" },
  { code: "IS", name: "Icelander", country: "Iceland" },
  { code: "IR", name: "Iranian", country: "Iran" },
  { code: "IQ", name: "Iraqi", country: "Iraq" },
  { code: "IE", name: "Irish", country: "Ireland" },
  { code: "JM", name: "Jamaican", country: "Jamaica" },
  { code: "JO", name: "Jordanian", country: "Jordan" },
  { code: "KZ", name: "Kazakhstani", country: "Kazakhstan" },
  { code: "KE", name: "Kenyan", country: "Kenya" },
  { code: "KW", name: "Kuwaiti", country: "Kuwait" },
  { code: "KG", name: "Kyrgyz", country: "Kyrgyzstan" },
  { code: "LV", name: "Latvian", country: "Latvia" },
  { code: "LB", name: "Lebanese", country: "Lebanon" },
  { code: "LY", name: "Libyan", country: "Libya" },
  { code: "LI", name: "Liechtensteiner", country: "Liechtenstein" },
  { code: "LT", name: "Lithuanian", country: "Lithuania" },
  { code: "LU", name: "Luxembourger", country: "Luxembourg" },
  { code: "MK", name: "Macedonian", country: "North Macedonia" },
  { code: "MG", name: "Malagasy", country: "Madagascar" },
  { code: "MW", name: "Malawian", country: "Malawi" },
  { code: "MV", name: "Maldivian", country: "Maldives" },
  { code: "ML", name: "Malian", country: "Mali" },
  { code: "MT", name: "Maltese", country: "Malta" },
  { code: "MR", name: "Mauritanian", country: "Mauritania" },
  { code: "MU", name: "Mauritian", country: "Mauritius" },
  { code: "MX", name: "Mexican", country: "Mexico" },
  { code: "MD", name: "Moldovan", country: "Moldova" },
  { code: "MC", name: "Monégasque", country: "Monaco" },
  { code: "MN", name: "Mongolian", country: "Mongolia" },
  { code: "ME", name: "Montenegrin", country: "Montenegro" },
  { code: "MA", name: "Moroccan", country: "Morocco" },
  { code: "MZ", name: "Mozambican", country: "Mozambique" },
  { code: "NA", name: "Namibian", country: "Namibia" },
  { code: "NP", name: "Nepali", country: "Nepal" },
  { code: "NI", name: "Nicaraguan", country: "Nicaragua" },
  { code: "NE", name: "Nigerien", country: "Niger" },
  { code: "NG", name: "Nigerian", country: "Nigeria" },
  { code: "OM", name: "Omani", country: "Oman" },
  { code: "PK", name: "Pakistani", country: "Pakistan" },
  { code: "PA", name: "Panamanian", country: "Panama" },
  { code: "PG", name: "Papua New Guinean", country: "Papua New Guinea" },
  { code: "PY", name: "Paraguayan", country: "Paraguay" },
  { code: "PE", name: "Peruvian", country: "Peru" },
  { code: "PL", name: "Polish", country: "Poland" },
  { code: "PT", name: "Portuguese", country: "Portugal" },
  { code: "QA", name: "Qatari", country: "Qatar" },
  { code: "RO", name: "Romanian", country: "Romania" },
  { code: "RW", name: "Rwandan", country: "Rwanda" },
  { code: "SA", name: "Saudi Arabian", country: "Saudi Arabia" },
  { code: "SN", name: "Senegalese", country: "Senegal" },
  { code: "RS", name: "Serbian", country: "Serbia" },
  { code: "SL", name: "Sierra Leonean", country: "Sierra Leone" },
  { code: "SK", name: "Slovak", country: "Slovakia" },
  { code: "SI", name: "Slovenian", country: "Slovenia" },
  { code: "SO", name: "Somali", country: "Somalia" },
  { code: "ZA", name: "South African", country: "South Africa" },
  { code: "SS", name: "South Sudanese", country: "South Sudan" },
  { code: "LK", name: "Sri Lankan", country: "Sri Lanka" },
  { code: "SD", name: "Sudanese", country: "Sudan" },
  { code: "SR", name: "Surinamese", country: "Suriname" },
  { code: "SZ", name: "Swazi", country: "Eswatini" },
  { code: "SY", name: "Syrian", country: "Syria" },
  { code: "TW", name: "Taiwanese", country: "Taiwan" },
  { code: "TJ", name: "Tajik", country: "Tajikistan" },
  { code: "TZ", name: "Tanzanian", country: "Tanzania" },
  { code: "TL", name: "Timorese", country: "Timor-Leste" },
  { code: "TG", name: "Togolese", country: "Togo" },
  { code: "TT", name: "Trinidadian", country: "Trinidad and Tobago" },
  { code: "TN", name: "Tunisian", country: "Tunisia" },
  { code: "TR", name: "Turkish", country: "Turkey" },
  { code: "TM", name: "Turkmen", country: "Turkmenistan" },
  { code: "UG", name: "Ugandan", country: "Uganda" },
  { code: "UA", name: "Ukrainian", country: "Ukraine" },
  { code: "AE", name: "Emirati", country: "United Arab Emirates" },
  { code: "UY", name: "Uruguayan", country: "Uruguay" },
  { code: "UZ", name: "Uzbek", country: "Uzbekistan" },
  { code: "VE", name: "Venezuelan", country: "Venezuela" },
  { code: "YE", name: "Yemeni", country: "Yemen" },
  { code: "ZM", name: "Zambian", country: "Zambia" },
  { code: "ZW", name: "Zimbabwean", country: "Zimbabwe" },
];

// ─── Payment method config ────────────────────────────────────────────────────

type PaymentMethodKey = "cash" | "promptpay" | "bank_transfer" | "wise" | "revolut" | "card";

const PAYMENT_METHODS: {
  key: PaymentMethodKey;
  label: string;
  description: string;
  deliveryOnly: boolean;
  iconClass: string;
}[] = [
  { key: "cash",          label: "Cash",                   description: "Pay in person when the vehicle is delivered or collected", deliveryOnly: true,  iconClass: "ti ti-cash" },
  { key: "promptpay",     label: "PromptPay / QR Payment", description: "Thai QR payment - scan with your banking app",             deliveryOnly: false, iconClass: "ti ti-qrcode" },
  { key: "bank_transfer", label: "Thai Bank Transfer",     description: "Direct transfer to the operator's Thai bank account",       deliveryOnly: false, iconClass: "ti ti-building-bank" },
  { key: "wise",          label: "Wise",                   description: "For international customers without a Thai bank account",   deliveryOnly: false, iconClass: "ti ti-world" },
  { key: "revolut",       label: "Revolut",                description: "For European customers",                                    deliveryOnly: false, iconClass: "ti ti-world" },
  { key: "card",          label: "Credit / Debit Card",    description: "Card payments via Stripe",                                  deliveryOnly: false, iconClass: "ti ti-credit-card" },
];

const CONTACT_METHODS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "messenger", label: "Messenger" },
  { value: "line", label: "LINE" },
  { value: "telegram", label: "Telegram" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone call" }
];

function defaultContactMethod(customer: any) {
  if (customer?.preferred_contact_method) return customer.preferred_contact_method;
  if (customer?.whatsapp_number) return "whatsapp";
  if (customer?.messenger_id) return "messenger";
  if (customer?.line_id) return "line";
  if (customer?.telegram_username) return "telegram";
  if (customer?.email) return "email";
  if (customer?.phone) return "phone";
  return "whatsapp";
}

// ─── PromptPay QR payload (EMVCo / Bank of Thailand standard) ─────────────────

function formatMoney(amount: number, currency = "THB"): string {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

// The business's today: the vehicle is handed over where the business is, and the page then reads the same on the server and on the phone.
function todayDateString() {
  return businessToday();
}

function compactDateTime(value: unknown) {
  return toWallTime(value);
}

function isTodayDateTime(value: string) {
  return Boolean(value && value.slice(0, 10) === todayDateString());
}

function timeLabelFromDateTime(value: string) {
  const time = value.includes("T") ? value.split("T")[1]?.slice(0, 5) : "";
  return time || "As agreed";
}

// ─── Flag emoji ────────────────────────────────────────────────────────────────

/** Generate a flag emoji from an ISO 3166-1 alpha-2 country code */
function flagEmoji(code: string) {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

function resolveNationality(value: string) {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  return (
    NATIONALITIES.find(
      (n) =>
        n.name.toLowerCase() === raw ||
        n.country.toLowerCase() === raw ||
        n.code.toLowerCase() === raw ||
        `${n.name} — ${n.country}`.toLowerCase() === raw
    ) || null
  );
}

const phoneCountryOptions = [
  { flag: "🇹🇭", code: "TH", callingCode: "+66" },
  { flag: "🇬🇧", code: "GB", callingCode: "+44" },
  { flag: "🇩🇪", code: "DE", callingCode: "+49" },
  { flag: "🇫🇷", code: "FR", callingCode: "+33" },
  { flag: "🇷🇺", code: "RU", callingCode: "+7" },
  { flag: "🇨🇳", code: "CN", callingCode: "+86" },
  { flag: "🇯🇵", code: "JP", callingCode: "+81" },
  { flag: "🇺🇸", code: "US", callingCode: "+1" },
  { flag: "🇦🇺", code: "AU", callingCode: "+61" },
  { flag: "🇨🇭", code: "CH", callingCode: "+41" },
  { flag: "🇳🇱", code: "NL", callingCode: "+31" },
  { flag: "🇸🇪", code: "SE", callingCode: "+46" },
  { flag: "🇮🇱", code: "IL", callingCode: "+972" },
  { flag: "🇩🇰", code: "DK", callingCode: "+45" },
  { flag: "🇳🇴", code: "NO", callingCode: "+47" },
  { flag: "🇫🇮", code: "FI", callingCode: "+358" },
  { flag: "🇮🇩", code: "ID", callingCode: "+62" },
  { flag: "🇲🇾", code: "MY", callingCode: "+60" },
  { flag: "🇸🇬", code: "SG", callingCode: "+65" },
  { flag: "🇻🇳", code: "VN", callingCode: "+84" },
  { flag: "🇵🇭", code: "PH", callingCode: "+63" },
  { flag: "🇰🇭", code: "KH", callingCode: "+855" },
  { flag: "🇱🇦", code: "LA", callingCode: "+856" },
  { flag: "🇮🇳", code: "IN", callingCode: "+91" }
];

/** A saved number like "+66812345678" shown as its country code and the rest, so the code isn't shown twice. */
function splitSavedPhone(value: unknown): { code: string; local: string } {
  const raw = String(value || "").replace(/[\s\-().]/g, "");
  if (!raw.startsWith("+")) return { code: "+66", local: raw };
  const match = phoneCountrySvgOptions
    .map((option) => option.callingCode)
    .sort((a, b) => b.length - a.length)
    .find((code) => raw.startsWith(code));
  // An unlisted country: leave the full number in the box, where the server accepts it as written.
  return match ? { code: match, local: raw.slice(match.length) } : { code: "+66", local: raw };
}

const phoneCountrySvgOptions = [
  { flagCode: "th", code: "TH", callingCode: "+66", name: "Thailand" },
  { flagCode: "gb", code: "GB", callingCode: "+44", name: "United Kingdom" },
  { flagCode: "us", code: "US", callingCode: "+1", name: "United States" },
  { flagCode: "au", code: "AU", callingCode: "+61", name: "Australia" },
  { flagCode: "de", code: "DE", callingCode: "+49", name: "Germany" },
  { flagCode: "fr", code: "FR", callingCode: "+33", name: "France" },
  { flagCode: "ru", code: "RU", callingCode: "+7", name: "Russia" },
  { flagCode: "ua", code: "UA", callingCode: "+380", name: "Ukraine" },
  { flagCode: "cn", code: "CN", callingCode: "+86", name: "China" },
  { flagCode: "jp", code: "JP", callingCode: "+81", name: "Japan" },
  { flagCode: "kr", code: "KR", callingCode: "+82", name: "South Korea" },
  { flagCode: "in", code: "IN", callingCode: "+91", name: "India" },
  { flagCode: "id", code: "ID", callingCode: "+62", name: "Indonesia" },
  { flagCode: "my", code: "MY", callingCode: "+60", name: "Malaysia" },
  { flagCode: "sg", code: "SG", callingCode: "+65", name: "Singapore" },
  { flagCode: "vn", code: "VN", callingCode: "+84", name: "Vietnam" },
  { flagCode: "ph", code: "PH", callingCode: "+63", name: "Philippines" },
  { flagCode: "kh", code: "KH", callingCode: "+855", name: "Cambodia" },
  { flagCode: "la", code: "LA", callingCode: "+856", name: "Laos" },
  { flagCode: "mm", code: "MM", callingCode: "+95", name: "Myanmar" },
  { flagCode: "nl", code: "NL", callingCode: "+31", name: "Netherlands" },
  { flagCode: "se", code: "SE", callingCode: "+46", name: "Sweden" },
  { flagCode: "ch", code: "CH", callingCode: "+41", name: "Switzerland" },
  { flagCode: "no", code: "NO", callingCode: "+47", name: "Norway" },
  { flagCode: "dk", code: "DK", callingCode: "+45", name: "Denmark" },
  { flagCode: "fi", code: "FI", callingCode: "+358", name: "Finland" },
  { flagCode: "il", code: "IL", callingCode: "+972", name: "Israel" },
  { flagCode: "es", code: "ES", callingCode: "+34", name: "Spain" },
  { flagCode: "it", code: "IT", callingCode: "+39", name: "Italy" },
  { flagCode: "pt", code: "PT", callingCode: "+351", name: "Portugal" },
  { flagCode: "pl", code: "PL", callingCode: "+48", name: "Poland" },
  { flagCode: "cz", code: "CZ", callingCode: "+420", name: "Czech Republic" },
  { flagCode: "at", code: "AT", callingCode: "+43", name: "Austria" },
  { flagCode: "be", code: "BE", callingCode: "+32", name: "Belgium" },
  { flagCode: "ca", code: "CA", callingCode: "+1", name: "Canada" },
  { flagCode: "nz", code: "NZ", callingCode: "+64", name: "New Zealand" },
  { flagCode: "za", code: "ZA", callingCode: "+27", name: "South Africa" },
  { flagCode: "ae", code: "AE", callingCode: "+971", name: "UAE" },
  { flagCode: "sa", code: "SA", callingCode: "+966", name: "Saudi Arabia" },
  { flagCode: "tr", code: "TR", callingCode: "+90", name: "Turkey" },
  { flagCode: "tw", code: "TW", callingCode: "+886", name: "Taiwan" },
  { flagCode: "hk", code: "HK", callingCode: "+852", name: "Hong Kong" },
  { flagCode: "mo", code: "MO", callingCode: "+853", name: "Macau" },
];


function loadPublicGooglePlaces() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || typeof window === "undefined") {
    return null;
  }

  if (window.google?.maps?.places?.Autocomplete) {
    return Promise.resolve();
  }

  if (!window.__routeHqPublicGoogleMapsPromise) {
    window.__routeHqPublicGoogleMapsPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>('script[data-routehq-public-google-places="true"]');
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.dataset.routehqPublicGooglePlaces = "true";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google Maps failed to load."));
      document.head.appendChild(script);
    });
  }

  return window.__routeHqPublicGoogleMapsPromise;
}

export function BookingCompletionForm({ detail }: { detail: PublicBookingDetail }) {
  const t = useTranslations("customer");
  const locale = useLocale();
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(detail.completion.agreement);
  const [signedContractUrl, setSignedContractUrl] = useState<string | null>(null);
  const [executionCertificateUrl, setExecutionCertificateUrl] = useState<string | null>(detail.executedAgreementDownloads?.executionCertificateUrl || null);
  const [originalAgreementUrl, setOriginalAgreementUrl] = useState<string | null>(detail.executedAgreementDownloads?.originalAgreementUrl || null);
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");
  const savedPhone = splitSavedPhone(detail.customer?.phone);
  const [phoneCountryCode, setPhoneCountryCode] = useState(savedPhone.code);
  const [emergencyPhoneCountryCode, setEmergencyPhoneCountryCode] = useState("+66");
  const [currentAddress, setCurrentAddress] = useState(String(detail.customer?.address || ""));
  const [contactChannelError, setContactChannelError] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] = useState<string>(() => {
    const m = detail.customer?.preferred_contact_method || "";
    return ["phone", "email", "whatsapp", "messenger", "line", "telegram"].includes(m) ? m : "";
  });
  const [whatsappNumber, setWhatsappNumber] = useState<string>(detail.customer?.whatsapp_number || "");
  const [livePhone, setLivePhone] = useState(detail.customer?.phone || "");
  const [liveEmail, setLiveEmail] = useState(detail.customer?.email || "");
  const [focusField, setFocusField] = useState<"phone" | "email" | null>(null);
  const [agreedAll, setAgreedAll] = useState(false);
  const [preferredDeliveryLocation, setPreferredDeliveryLocation] = useState(formatDeliveryLocation(String(detail.bookingData.delivery_location || "")));
  const [liveStatus, setLiveStatus] = useState(detail.completion);
  const orgPayment = detail.orgPayment;
  const acceptedMethods = useMemo(() => {
    const configuredMethods = orgPayment?.accepted_payment_methods ?? ["cash"];
    return configuredMethods.filter((method): method is PaymentMethodKey => {
      if (!PAYMENT_METHODS.some((option) => option.key === method)) return false;
      if (method === "promptpay") return Boolean(orgPayment?.promptpay_qr_url || orgPayment?.promptpay_id);
      if (method === "bank_transfer") return Boolean(orgPayment?.bank_account_number);
      if (method === "wise") return Boolean(orgPayment?.wise_link);
      if (method === "revolut") return Boolean(orgPayment?.revolut_link);
      if (method === "card") return false;
      return true;
    });
  }, [orgPayment]);
  const defaultMethod = acceptedMethods.includes(orgPayment?.default_payment_method as PaymentMethodKey)
    ? (orgPayment?.default_payment_method as PaymentMethodKey)
    : acceptedMethods[0] ?? "cash";
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodKey>(defaultMethod);
  const [paymentTiming, setPaymentTiming] = useState<"now" | "on_delivery">("on_delivery");
  const selectedMethodInfo = PAYMENT_METHODS.find((m) => m.key === paymentMethod) ?? null;
  const effectiveTiming = selectedMethodInfo?.deliveryOnly ? "on_delivery" : paymentTiming;
  const rentalRate = detail.rentalRate ?? 0;
  // What is due at the start: the first rent and the deposit.
  const paymentAmount = detail.outstandingBalance && detail.outstandingBalance > 0 ? detail.outstandingBalance : (detail.firstRent ?? rentalRate) + (detail.depositAmount ?? 0) + (detail.extrasTotal ?? 0);
  const currency = detail.currency ?? "THB";
  const [upfrontAccepted, setUpfrontAccepted] = useState<boolean | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isPaymentReportPending, startPaymentReportTransition] = useTransition();
  const [paymentReported, setPaymentReported] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Photos first: the passport and licence are read and the form fills itself in.
  const [docRead, setDocRead] = useState<Record<DocKind, DocReadState>>({ passport: null, driver_license: null });
  const [photoNationality, setPhotoNationality] = useState("");
  const [idOpen, setIdOpen] = useState(false);
  const filledByPhoto = useRef<Record<string, string>>({});
  const readQueue = useRef<Promise<void>>(Promise.resolve());

  function fieldValue(name: string) {
    return formRef.current?.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value.trim() || "";
  }

  function fillField(name: string, value: string | null) {
    const input = formRef.current?.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (!input || !value) return;
    const current = input.value.trim();
    // What the customer typed themselves is never replaced.
    if (current && current !== filledByPhoto.current[name]) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    filledByPhoto.current[name] = value;
  }

  function readDocument(kind: DocKind, picked: File) {
    if (!picked.type.startsWith("image/")) {
      // A PDF can't be read here: they type the numbers.
      setIdOpen(true);
      return;
    }
    setDocRead((state) => ({ ...state, [kind]: "reading" }));
    // One at a time, so two photos picked quickly don't trip over each other.
    readQueue.current = readQueue.current.then(async () => {
      try {
        const body = new FormData();
        body.set("token", detail.token);
        body.set("kind", kind);
        body.set("file", await shrinkImage(picked));
        const result = await readIdentityDocument(body);
        if (!result.ok) {
          setDocRead((state) => ({ ...state, [kind]: result.reason === "unreadable" ? "unreadable" : null }));
          setIdOpen(true);
          return;
        }
        const fields = result.fields;
        if (kind === "passport") {
          fillField("fullName", fields.fullName);
          fillField("dateOfBirth", fields.dateOfBirth);
          fillField("passportNumber", fields.passportNumber);
          if (fields.nationalityCode) setPhotoNationality(fields.nationalityCode);
        } else {
          // The passport is the better source for the name; the licence only fills gaps.
          if (!filledByPhoto.current.fullName) fillField("fullName", fields.fullName);
          if (!filledByPhoto.current.dateOfBirth) fillField("dateOfBirth", fields.dateOfBirth);
          fillField("driverLicenseNumber", fields.licenceNumber);
          fillField("driverLicenseExpiry", fields.licenceExpiry);
          fillField("driverLicenseCountry", fields.licenceCountry);
        }
        setDocRead((state) => ({ ...state, [kind]: "read" }));
        // Anything the photo didn't give is shown so they can add it.
        const mine = kind === "passport" ? ["passportNumber"] : ["driverLicenseNumber", "driverLicenseExpiry", "driverLicenseCountry"];
        if (mine.some((name) => !fieldValue(name))) setIdOpen(true);
      } catch {
        setDocRead((state) => ({ ...state, [kind]: "unreadable" }));
        setIdOpen(true);
      }
    });
  }

  const readNote = (kind: DocKind) =>
    docRead[kind] === "reading"
      ? t("readingDetails")
      : docRead[kind] === "read"
        ? t("detailsRead")
        : docRead[kind] === "unreadable"
          ? t("photoUnreadable")
          : null;
  const drawing = useRef(false);
  const isRentalDocumentEngine = true;
  const publicAgreement = detail.rentalDocumentAgreement?.agreement || null;
  const customerSigningEligibility = detail.rentalDocumentAgreement?.eligibility || null;
  const agreementHtml = publicAgreement?.renderedHtmlSnapshot || detail.contractHtml;
  // The customer signs only the final agreement: prepared with their details
  // and already signed by the business. Until then the text is a preview.
  const readyToSign = publicAgreement?.businessSignatureStatus === "signed";
  const [notice, setNotice] = useState("");
  const [submittedName, setSubmittedName] = useState("");
  const agreementRef = useRef<HTMLElement>(null);
  const router = useRouter();
  // Earliest time the picker allows: now, on the customer's own clock. Set after the page loads so the
  // server and the phone never disagree about what "now" is (it was also seven hours out, being in UTC).
  const [minDateTime, setMinDateTime] = useState("");
  // Until the page is live in the browser, a tap on the button would send the form the old-fashioned way and
  // land the customer on an error page. On a slow phone that gap is seconds long, so the button waits.
  const [pageLive, setPageLive] = useState(false);
  useEffect(() => setPageLive(true), []);
  useEffect(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setMinDateTime(now.toISOString().slice(0, 16));
  }, []);
  const operatorDeliveryDateTime = compactDateTime(detail.bookingData.delivery_datetime);
  const customerCollects = ["collect", "collection"].includes(String((detail as any).rental?.delivery_method || detail.bookingData.delivery_method || ""));
  const operatorDeliveryIsToday = isTodayDateTime(operatorDeliveryDateTime);
  const operatorDeliveryTimeLabel = timeLabelFromDateTime(operatorDeliveryDateTime);

  useEffect(() => {
    if (!focusField || !formRef.current) return;
    const el = formRef.current.querySelector(`[name="${focusField}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.borderColor = "var(--danger)";
    el.style.boxShadow = "0 0 0 2px var(--danger-line)";
    const timer = setTimeout(() => {
      el.style.borderColor = "";
      el.style.boxShadow = "";
      setFocusField(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [focusField]);

  function updateLiveStatus(form: HTMLFormElement | null = formRef.current, nextAgreed?: boolean, nextSignature = signature) {
    if (!form) return;
    const formData = new FormData(form);
    const filled = (name: string) => String(formData.get(name) || "").trim().length > 0;
    const uploaded = (...names: string[]) =>
      names.some((name) => formData.getAll(name).some((value) => value instanceof File && value.size > 0));
    const acceptedAgreement = typeof nextAgreed === "boolean" ? nextAgreed : formData.get("agreementAccepted") === "on";
    setLivePhone(String(formData.get("phone") || "").trim());
    setLiveEmail(String(formData.get("email") || "").trim());
    setLiveStatus({
      // Always from what's in the form now: a saved "complete" flag kept the tick
      // showing after the customer cleared a required field.
      details: ["fullName", "nationality", "phone", "dateOfBirth"].every(filled),
      documents:
        detail.completion.documents ||
        ((detail.documentStatus.passport || uploaded("passportFile", "passportCameraFile")) &&
          (detail.documentStatus.driver_license || uploaded("driverLicenseFile", "driverLicenseCameraFile")) &&
          (detail.documentStatus.selfie || uploaded("selfieFile", "selfieCameraFile"))),
      agreement: detail.completion.agreement || (acceptedAgreement && Boolean(nextSignature) && filled("signedName"))
    });
  }

  function position(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function startDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const context = canvas.getContext("2d");
    const point = position(event);
    context?.beginPath();
    context?.moveTo(point.x, point.y);
  }

  function moveDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const point = position(event);
    if (!context) return;
    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#1b2430";
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function endDraw() {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      const nextSignature = canvas.toDataURL("image/png", 0.72);
      setSignature(nextSignature);
      updateLiveStatus(undefined, agreed, nextSignature);
    }
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setSignature("");
    updateLiveStatus(undefined, agreed, "");
  }

  function handleReportPayment() {
    startPaymentReportTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("token", detail.token);
        formData.set("preferredPaymentMethod", paymentMethod);
        formData.set("paymentTiming", effectiveTiming);
        await reportPublicBookingPayment(formData);
        setPaymentReported(true);
      } catch (reportError) {
        setError(shownError(reportError, t("reportPaymentFailed")));
      }
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setContactChannelError("");

    const form = event.currentTarget;
    const fd = new FormData(form);

    if (!preferredContactMethod) {
      setContactChannelError(t("chooseContactMethod"));
      return;
    }
    if (preferredContactMethod === "phone" && !livePhone) {
      setContactChannelError(t("addPhoneAbove"));
      setFocusField("phone");
      return;
    }
    if (preferredContactMethod === "email" && !liveEmail) {
      setContactChannelError(t("addEmailAbove"));
      setFocusField("email");
      return;
    }
    if (preferredContactMethod === "whatsapp" && !whatsappNumber.trim()) {
      setContactChannelError(t("enterWhatsApp"));
      return;
    }
    if (preferredContactMethod === "messenger" && !String(fd.get("messengerId") || "").trim()) {
      setContactChannelError(t("enterMessenger"));
      return;
    }
    if (preferredContactMethod === "line" && !String(fd.get("lineId") || "").trim()) {
      setContactChannelError(t("enterLine"));
      return;
    }
    if (preferredContactMethod === "telegram" && !String(fd.get("telegramUsername") || "").trim()) {
      setContactChannelError(t("enterTelegram"));
      return;
    }

    if (ID_FIELDS.some((name) => !String(fd.get(name) || "").trim())) {
      setIdOpen(true);
      setError(t("addDocumentDetails"));
      document.getElementById("document-numbers")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (readyToSign) {
      const requiredAcknowledgements = publicAgreement?.requiredAcknowledgements || [];
      const accepted = requiredAcknowledgements.every((ack) => fd.get(`ack_${ack.type}`) === "on");
      if (!accepted) {
        setError(t("tickEachBox"));
        return;
      }
      if (!signature) {
        setError(t("pleaseSign"));
        return;
      }
    }

    startTransition(async () => {
      try {
        // Document photos go straight to storage; the form carries only their
        // paths (Vercel refuses request bodies over 4.5 MB).
        const formData = await uploadFormFiles(new FormData(form), (files) => preparePublicBookingUploads(detail.token, files));
        formData.set("intent", readyToSign ? "sign" : "review");
        if (readyToSign) {
          formData.set("signature", signature);
          formData.set("reviewedVersionId", publicAgreement?.versionId || "");
        }
        setSubmittedName(String(formData.get("fullName") || "").trim());
        const result = await completePublicBooking(formData);
        if ("needsReview" in result && result.needsReview) {
          // Documents are saved now; don't send the same files again.
          form.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => {
            input.value = "";
          });
          clearSignature();
          setNotice(
            result.changed
              ? t("agreementUpdated")
              : t("detailsSavedReadAgreement")
          );
          router.refresh();
          agreementRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        setSignedContractUrl(result.signedContractUrl || null);
        setOriginalAgreementUrl((result as any).originalAgreementUrl || null);
        setExecutionCertificateUrl((result as any).executionCertificateUrl || null);
        setCompleted(true);
        // The payments for this booking exist now; show them without a reload.
        router.refresh();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (submitError) {
        setError(shownError(submitError, t("completeFailed")));
      }
    });
  }

  if (completed) {
    return (
      <section className="-order-1 rounded-2xl border border-[var(--success-line)] bg-white p-5 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success-light)] text-[var(--success)]">
          <CheckCircle2 size={34} />
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-[var(--foreground)]">{(submittedName || detail.customer?.full_name) ? t("allSetNamed", { name: String(submittedName || detail.customer?.full_name).split(/\s+/)[0] }) : t("allSet")}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          {t("everythingReceived")}{" "}
          {detail.vehicleWithCustomer
            ? t("businessToldContact", { business: detail.organizationName })
            : operatorDeliveryDateTime && String(detail.bookingData.delivery_location || "").trim() && t.has("handoverAgreed" as never)
                ? t("handoverAgreed" as never)
                : t("businessWillContact", { business: detail.organizationName })}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
        {originalAgreementUrl ? (
          <a className="pressable inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href={originalAgreementUrl} rel="noreferrer" target="_blank">
            {t("downloadAgreement")}
          </a>
        ) : null}
        {signedContractUrl ? (
          <a className="pressable inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href={signedContractUrl} rel="noreferrer" target="_blank">
            {t("downloadAgreement")}
          </a>
        ) : null}
        {executionCertificateUrl ? (
          <a className="pressable inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--primary)]" href={executionCertificateUrl} rel="noreferrer" target="_blank">
            {t("proofOfSigning")}
          </a>
        ) : null}
        </div>
      </section>
    );
  }

  return (
    <form className="space-y-5" encType="multipart/form-data" method="post" onChange={(event) => updateLiveStatus(event.currentTarget)} onInput={(event) => updateLiveStatus(event.currentTarget)} onSubmit={handleSubmit} ref={formRef}>
      <input name="token" type="hidden" value={detail.token} />
      {/* The language they are reading this in is the language their messages and agreement use. */}
      <input name="preferredLocale" type="hidden" value={locale} />

      {/* Once the details are saved, the only thing left is to read and sign. Everything already
          filled in folds away so the agreement is the first thing on the screen, not the ninth. */}
      <SavedDetails folded={readyToSign}>
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <SectionTitle icon={Upload} label={t("yourDocuments")} />
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          {t("documentsIntro")}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <UploadCard cameraName="passportCameraFile" complete={detail.documentStatus.passport} icon={IdCard} label={t("passportOrId")} name="passportFile" note={readNote("passport")} noteTone={docRead.passport} onPicked={(picked) => readDocument("passport", picked)} />
          <UploadCard cameraName="driverLicenseCameraFile" complete={detail.documentStatus.driver_license} icon={FileText} label={t("drivingLicence")} name="driverLicenseFile" note={readNote("driver_license")} noteTone={docRead.driver_license} onPicked={(picked) => readDocument("driver_license", picked)} />
          <UploadCard cameraCapture="user" cameraName="selfieCameraFile" complete={detail.documentStatus.selfie} icon={ImageIcon} label={t("selfiePhoto")} name="selfieFile" />
        </div>
        {/* The numbers stay folded away: the photos fill them in. They open by themselves when something is missing. */}
        <details className="mt-2" id="document-numbers" onToggle={(event) => setIdOpen(event.currentTarget.open)} open={idOpen}>
          <summary className="cursor-pointer py-1 text-sm font-semibold text-[var(--primary)]">
            {docRead.passport === "read" || docRead.driver_license === "read" ? t("checkNumbers") : t("typeNumbersInstead")}
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-bold text-[var(--foreground-secondary)]">{t("passportNumber")}</span>
              <input className={inputClass} defaultValue={detail.customer?.passport_number || ""} name="passportNumber" style={fieldStyle} />
            </label>
            <label>
              <span className="text-sm font-bold text-[var(--foreground-secondary)]">{t("licenceNumber")}</span>
              <input className={inputClass} defaultValue={detail.customer?.driver_license_number || ""} name="driverLicenseNumber" style={fieldStyle} />
            </label>
            <label>
              <span className="text-sm font-bold text-[var(--foreground-secondary)]">{t("licenceExpiry")}</span>
              <input className={inputClass} defaultValue={detail.customer?.driver_license_expiry || ""} name="driverLicenseExpiry" style={fieldStyle} type="date" />
            </label>
            <label>
              <span className="text-sm font-bold text-[var(--foreground-secondary)]">{t("licenceCountry")}</span>
              <input className={inputClass} defaultValue={detail.customer?.driver_license_country || ""} name="driverLicenseCountry" style={fieldStyle} />
            </label>
          </div>
        </details>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <SectionTitle icon={UserRound} label={t("yourDetails")} />
        {detail.completion.details ? (
          <p className="mt-3 rounded-xl bg-[var(--success-light)] p-3 text-sm font-bold text-[var(--success)]">{t("detailsAlreadySent")}</p>
        ) : null}
        {docRead.passport === "read" || docRead.driver_license === "read" ? (
          <p className="mt-3 rounded-xl bg-[var(--primary-light)] p-3 text-sm font-semibold text-[var(--primary)]">{t("filledFromDocuments")}</p>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:items-start">
          <label>
            <span className="text-sm font-bold text-[var(--foreground-secondary)]">{t("fullName")}</span>
            <input className={inputClass} defaultValue={detail.customer?.full_name || ""} name="fullName" required style={fieldStyle} />
          </label>
          <label>
            <span className="text-sm font-bold text-[var(--foreground-secondary)]">{t("nationality")}</span>
            <NationalitySelect defaultValue={String(detail.customer?.nationality || "")} fill={photoNationality} name="nationality" />
          </label>
          <label>
            <span className="text-sm font-bold text-[var(--foreground-secondary)]">{t("phone")}</span>
            <div style={{ display: "flex", alignItems: "stretch", width: "100%", height: 42, position: "relative", marginTop: 8 }}>
              <PhoneCountrySelect name="phoneCountryCode" onChange={setPhoneCountryCode} value={phoneCountryCode} />
              <input defaultValue={savedPhone.local} name="phone" onClick={(e) => e.stopPropagation()} required style={{ ...fieldStyle, width: "auto", borderRadius: "0 8px 8px 0", flex: 1, minWidth: 0, borderLeft: "none", position: "relative", zIndex: 2 }} type="tel" />
            </div>
          </label>
          <label>
            <span className="text-sm font-bold text-[var(--foreground-secondary)]">{t("email")} <span className="font-normal text-[var(--muted)]">{t("optionalBrackets")}</span></span>
            <input className={inputClass} defaultValue={detail.customer?.email || ""} name="email" style={fieldStyle} type="email" />
          </label>
          <label>
            <span className="text-sm font-bold text-[var(--foreground-secondary)]">{t("dateOfBirth")}</span>
            <input className={inputClass} defaultValue={detail.customer?.date_of_birth || ""} name="dateOfBirth" required style={{ ...fieldStyle, textTransform: "uppercase", appearance: "none" as const }} type="date" />
          </label>
          <label>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--foreground-secondary)]">
              {t("whereStaying")} <span className="font-normal text-[var(--muted)]">{t("optionalBrackets")}</span>
            </span>
            <GoogleAddressInput onChange={setCurrentAddress} value={currentAddress} />
          </label>
          <details className="sm:col-span-2" open={Boolean(detail.customer?.emergency_contact_name || detail.customer?.emergency_contact_phone)}>
            <summary className="cursor-pointer text-sm font-semibold text-[var(--primary)]">{t("addEmergencyContact")}</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--foreground-secondary)]">
              {t("emergencyName")}
            </span>
            <input className={inputClass} defaultValue={detail.customer?.emergency_contact_name || ""} name="emergencyContactName" style={fieldStyle} />
          </label>
          <label>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--foreground-secondary)]">
              {t("emergencyPhone")}
            </span>
            <div style={{ display: "flex", alignItems: "stretch", width: "100%", height: 42, position: "relative", marginTop: 8 }}>
              <PhoneCountrySelect name="emergencyPhoneCountryCode" onChange={setEmergencyPhoneCountryCode} value={emergencyPhoneCountryCode} />
              <input defaultValue={detail.customer?.emergency_contact_phone || ""} name="emergencyContactPhone" onClick={(e) => e.stopPropagation()} style={{ ...fieldStyle, width: "auto", borderRadius: "0 8px 8px 0", flex: 1, minWidth: 0, borderLeft: "none", position: "relative", zIndex: 2 }} type="tel" />
            </div>
          </label>
            </div>
          </details>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <SectionTitle icon={MessageCircle} label={t("howContactYou")} />
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          {t("contactIntro", { business: detail.organizationName })}
        </p>
        {contactChannelError ? (
          <div style={{ background: "var(--warning-light)", border: "0.5px solid var(--warning-line)", borderRadius: 8, padding: "10px 14px", marginTop: 12, fontSize: 13, color: "var(--warning)" }}>
            {contactChannelError}
          </div>
        ) : null}
        <input name="contactChannelsSubmitted" type="hidden" value="true" />

        <div className="mt-4">
          <label>
            <span className="text-sm font-bold text-[var(--foreground-secondary)]">{t("preferredContact")}</span>
            <select
              className={inputClass}
              name="preferredContactMethod"
              onChange={(e) => {
                e.stopPropagation();
                const next = e.target.value;
                setPreferredContactMethod(next);
                if (next === "whatsapp" && !whatsappNumber && livePhone) {
                  setWhatsappNumber(livePhone);
                }
              }}
              onInput={(e) => e.stopPropagation()}
              required
              style={{ ...fieldStyle, color: preferredContactMethod ? "var(--foreground)" : "var(--muted)", cursor: "pointer" }}
              value={preferredContactMethod}
            >
              <option disabled value="">{t("choose")}</option>
              <option value="phone">{t("phoneCall")}</option>
              <option value="email">{t("email")}</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="messenger">Facebook Messenger</option>
              <option value="line">LINE</option>
              <option value="telegram">Telegram</option>
            </select>
          </label>
        </div>

        {/* Contextual confirmation / input for the selected method */}
        {preferredContactMethod === "phone" ? (
          livePhone ? (
            <div style={{ background: "var(--success-light)", border: "0.5px solid var(--success-line)", borderRadius: 8, padding: "10px 14px", marginTop: 8, fontSize: 13, color: "var(--success)" }}>
              ✓ {t("wellContactOn", { contact: livePhone })}
            </div>
          ) : (
            <div style={{ background: "var(--warning-light)", border: "0.5px solid var(--warning-line)", borderRadius: 8, padding: "10px 14px", marginTop: 8, fontSize: 13, color: "var(--warning)" }}>
              {t("addPhoneAbove")}
            </div>
          )
        ) : null}

        {preferredContactMethod === "email" ? (
          liveEmail ? (
            <div style={{ background: "var(--success-light)", border: "0.5px solid var(--success-line)", borderRadius: 8, padding: "10px 14px", marginTop: 8, fontSize: 13, color: "var(--success)" }}>
              ✓ {t("wellContactOn", { contact: liveEmail })}
            </div>
          ) : (
            <div style={{ background: "var(--warning-light)", border: "0.5px solid var(--warning-line)", borderRadius: 8, padding: "10px 14px", marginTop: 8, fontSize: 13, color: "var(--warning)" }}>
              {t("addEmailAbove")}
            </div>
          )
        ) : null}

        {preferredContactMethod === "whatsapp" ? (
          <div style={{ marginTop: 8 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{t("whatsappNumber")}</label>
            <input
              name="whatsappNumber"
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder={livePhone || "+66812345678"}
              style={{ ...fieldStyle, marginTop: 4 }}
              type="tel"
              value={whatsappNumber}
            />
            {livePhone && !whatsappNumber ? (
              <button
                onClick={() => setWhatsappNumber(livePhone)}
                style={{ fontSize: 11, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", marginTop: 4, padding: 0 }}
                type="button"
              >
                {t("sameAsPhone", { phone: livePhone })}
              </button>
            ) : null}
          </div>
        ) : null}

        {preferredContactMethod === "messenger" ? (
          <div style={{ marginTop: 8 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{t("messengerUsername")}</label>
            <input defaultValue={detail.customer?.messenger_id || ""} name="messengerId" placeholder="messenger.com/username" style={{ ...fieldStyle, marginTop: 4 }} />
          </div>
        ) : null}

        {preferredContactMethod === "line" ? (
          <div style={{ marginTop: 8 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>LINE ID</label>
            <input defaultValue={detail.customer?.line_id || ""} name="lineId" placeholder="@lineusername" style={{ ...fieldStyle, marginTop: 4 }} />
          </div>
        ) : null}

        {preferredContactMethod === "telegram" ? (
          <div style={{ marginTop: 8 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{t("telegramUsername")}</label>
            <input defaultValue={detail.customer?.telegram_username || ""} name="telegramUsername" placeholder="@telegramusername" style={{ ...fieldStyle, marginTop: 4 }} />
          </div>
        ) : null}

        {/* Secondary channels — collapsible */}
        <details style={{ marginTop: 16 }}>
          <summary style={{ fontSize: 13, color: "var(--primary)", cursor: "pointer", fontWeight: 500, listStyle: "none", userSelect: "none" }}>
            {t("moreWaysToContact")}
          </summary>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {preferredContactMethod !== "whatsapp" ? (
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", display: "block" }}>WhatsApp</label>
                <input name="whatsappNumber" onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+66812345678" style={{ ...fieldStyle, marginTop: 4 }} type="tel" value={whatsappNumber} />
              </div>
            ) : null}
            {preferredContactMethod !== "messenger" ? (
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", display: "block" }}>Facebook Messenger</label>
                <input defaultValue={detail.customer?.messenger_id || ""} name="messengerId" placeholder="messenger.com/username" style={{ ...fieldStyle, marginTop: 4 }} />
              </div>
            ) : null}
            {preferredContactMethod !== "line" ? (
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", display: "block" }}>LINE ID</label>
                <input defaultValue={detail.customer?.line_id || ""} name="lineId" placeholder="@lineusername" style={{ ...fieldStyle, marginTop: 4 }} />
              </div>
            ) : null}
            {preferredContactMethod !== "telegram" ? (
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", display: "block" }}>Telegram</label>
                <input defaultValue={detail.customer?.telegram_username || ""} name="telegramUsername" placeholder="@telegramusername" style={{ ...fieldStyle, marginTop: 4 }} />
              </div>
            ) : null}
            <div style={{ gridColumn: "1 / 2" }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", display: "block" }}>
                Instagram
              </label>
              <input defaultValue={detail.customer?.instagram_handle || ""} name="instagramHandle" placeholder="@instagramhandle" style={{ ...fieldStyle, marginTop: 4 }} />
            </div>
          </div>
        </details>
      </section>

      {/* When the business has already set both the place and the time, they are shown at the top: asking again is only for a customer who wants them changed. */}
      <HandoverWishes
        agreed={Boolean((customerCollects || String(detail.bookingData.delivery_location || "").trim()) && operatorDeliveryDateTime)}
        changeLabel={customerCollects ? t("collectChange") : t("handoverChange")}
        intro={customerCollects ? t("collectWhenIntro") : t("handoverPreferencesIntro")}
        title={customerCollects ? t("collectWhen") : t("handoverPreferences")}
      >
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Someone collecting from the shop already knows where: they are only asked when. */}
          {customerCollects ? null : (
            <label className="sm:col-span-2">
              <span className="text-sm font-bold text-[var(--foreground-secondary)]">{t("preferredPlace")}</span>
              <GoogleAddressInput name="preferredDeliveryLocation" onChange={setPreferredDeliveryLocation} value={preferredDeliveryLocation} />
            </label>
          )}
          <label className="sm:col-span-2">
            <span className="text-sm font-bold text-[var(--foreground-secondary)]">{t("preferredTime")}</span>
            {operatorDeliveryIsToday ? (
              <div className="mt-2 rounded-xl border border-[var(--info-line)] bg-[var(--panel-secondary)] p-3">
                <input name="preferredDeliveryDateTime" type="hidden" value={operatorDeliveryDateTime} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--primary)]">{t("date")}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{t("today")}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--primary)]">{t("time")}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{operatorDeliveryTimeLabel === "As agreed" ? t("asAgreed") : operatorDeliveryTimeLabel}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--primary)]">{t("readyToday")}</p>
              </div>
            ) : (
              <input className={inputClass} defaultValue={operatorDeliveryDateTime} min={minDateTime} name="preferredDeliveryDateTime" style={fieldStyle} type="datetime-local" />
            )}
          </label>
        </div>
      </HandoverWishes>

      {/* A cash-only business has nothing to choose between: say how to pay in one line. */}
      {acceptedMethods.length === 1 && acceptedMethods[0] === "cash" ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <SectionTitle icon={CreditCard} label={t("method_cash")} />
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t("method_cash_hint")}</p>
        </section>
      ) : acceptedMethods.length > 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <SectionTitle icon={CreditCard} label={t("howPay")} />
          <div className="mt-4 grid gap-3">
            {acceptedMethods.map((key) => {
              const info = PAYMENT_METHODS.find((m) => m.key === key)!;
              const active = paymentMethod === key;
              const payNowActive = active && effectiveTiming === "now";

              return (
                <div className={`rounded-2xl border p-4 transition ${active ? "border-[var(--primary)] bg-[var(--panel-secondary)]" : "border-[var(--border)] bg-white"}`} key={key}>
                  <label className="checkbox-label cursor-pointer">
                    <input
                      checked={active}
                      className="flex-shrink-0"
                      name="paymentMethodChoice"
                      onChange={() => {
                        setPaymentMethod(key);
                        setPaymentReported(false);
                        if (info.deliveryOnly) setPaymentTiming("on_delivery");
                      }}
                      type="radio"
                    />
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-[var(--primary)] text-white" : "bg-[var(--primary-light)] text-[var(--primary)]"}`}>
                      <i className={info.iconClass} style={{ fontSize: 19 }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--foreground)]">{t(`method_${key}`)}</span>
                      <span className="mt-1 block text-sm leading-5 text-[var(--muted)]">{t(`method_${key}_hint`)}</span>
                      <span className="mt-3 flex flex-wrap gap-2">
                        <button
                          className={`pressable rounded-full px-3 py-1 text-xs font-semibold ${active && effectiveTiming === "on_delivery" ? "bg-[var(--primary)] text-white" : "bg-white text-[var(--foreground-secondary)] ring-1 ring-[var(--border)]"}`}
                          onClick={(event) => {
                            event.preventDefault();
                            setPaymentMethod(key);
                            setPaymentTiming("on_delivery");
                            setPaymentReported(false);
                          }}
                          type="button"
                        >
                          {t("payAtHandover")}
                        </button>
                        {!info.deliveryOnly ? (
                          <button
                            className={`pressable rounded-full px-3 py-1 text-xs font-semibold ${payNowActive ? "bg-[var(--primary)] text-white" : "bg-white text-[var(--foreground-secondary)] ring-1 ring-[var(--border)]"}`}
                            onClick={(event) => {
                              event.preventDefault();
                              setPaymentMethod(key);
                              setPaymentTiming("now");
                              setPaymentReported(false);
                            }}
                            type="button"
                          >
                            {t("payNow")}
                          </button>
                        ) : null}
                      </span>
                    </span>
                  </label>

                  {active && effectiveTiming === "now" ? (
                    <div className="mt-4 rounded-2xl border border-[var(--info-line)] bg-white p-4">
                      {key === "promptpay" && (orgPayment?.promptpay_qr_url || orgPayment?.promptpay_id) ? (
                        <div>
                          {detail.promptPayQrSvg ? (
                            <>
                              <div aria-label="PromptPay QR code" className="mx-auto w-[220px] max-w-full rounded-lg border border-[var(--border)] bg-white p-2 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: detail.promptPayQrSvg }} role="img" />
                              <p className="mt-3 text-center text-[13px] text-[var(--foreground-secondary)]">{t("scanWithBankingApp")}</p>
                              <p className="mt-1 text-center text-[13px] font-semibold text-[var(--primary)]">{t("amountFilledIn", { amount: formatMoney(paymentAmount, currency) })}</p>
                              <p className="mt-1 text-center text-[11px] text-[var(--muted)]">{t("sendReceiptAfterSigning")}</p>
                            </>
                          ) : orgPayment.promptpay_qr_url ? (
                            <>
                              <img
                                alt="PromptPay QR code"
                                className="mx-auto block h-[220px] w-[220px] rounded-lg border border-[var(--border)] bg-white object-contain"
                                src={orgPayment.promptpay_qr_url}
                              />
                              <p className="mt-3 text-center text-[13px] text-[var(--foreground-secondary)]">{t("scanWithBankingApp")}</p>
                              <p className="mt-1 text-center text-[13px] font-semibold text-[var(--primary)]">{t("enterAmount", { amount: formatMoney(paymentAmount, currency) })}</p>
                              {orgPayment.promptpay_id ? (
                                <p className="mt-1 text-center text-[11px] text-[var(--muted)]">PromptPay ID: {orgPayment.promptpay_id}</p>
                              ) : null}
                            </>
                          ) : (
                            <div className="text-center">
                              <p className="text-base font-semibold text-[var(--foreground)]">PromptPay ID: {orgPayment.promptpay_id}</p>
                              <p className="mt-2 text-sm text-[var(--muted)]">{t("searchPromptPayNumber")}</p>
                              <p className="mt-2 text-sm font-semibold text-[var(--primary)]">{t("enterAmount", { amount: formatMoney(paymentAmount, currency) })}</p>
                            </div>
                          )}
                          <PaymentReportedButton isPending={isPaymentReportPending} onClick={handleReportPayment} reported={paymentReported} text={t("iHavePaid")} />
                        </div>
                      ) : key === "bank_transfer" && orgPayment?.bank_account_number ? (
                        <div>
                          <p className="text-xs font-semibold uppercase text-[var(--primary)]">{t("method_bank_transfer")}</p>
                          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                            <PaymentDetail label={t("bank")} value={orgPayment.bank_name || "-"} />
                            <PaymentDetail label={t("accountNumber")} value={orgPayment.bank_account_number} />
                            <PaymentDetail label={t("accountName")} value={orgPayment.bank_account_name || detail.organizationName} />
                            <PaymentDetail label={t("reference")} value={detail.bookingReference || detail.token.slice(0, 10)} />
                            <PaymentDetail label={t("exactAmount")} value={formatMoney(paymentAmount, currency)} />
                          </div>
                          <PaymentReportedButton isPending={isPaymentReportPending} onClick={handleReportPayment} reported={paymentReported} text={t("iHavePaid")} />
                        </div>
                      ) : key === "wise" && orgPayment?.wise_link ? (
                        <div>
                          <p className="text-xs font-semibold uppercase text-[var(--primary)]">Wise</p>
                          <p className="mt-2 text-sm text-[var(--muted)]">{t("useAppToPay", { app: "Wise", amount: formatMoney(paymentAmount, currency) })}</p>
                          <a className="pressable mt-3 inline-flex rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white" href={orgPayment.wise_link} rel="noreferrer" target="_blank">
                            {t("payWith", { app: "Wise" })}
                          </a>
                          <PaymentReportedButton isPending={isPaymentReportPending} onClick={handleReportPayment} reported={paymentReported} text="I've paid" />
                        </div>
                      ) : key === "revolut" && orgPayment?.revolut_link ? (
                        <div>
                          <p className="text-xs font-semibold uppercase text-[var(--primary)]">Revolut</p>
                          <p className="mt-2 text-sm text-[var(--muted)]">{t("useAppToPay", { app: "Revolut", amount: formatMoney(paymentAmount, currency) })}</p>
                          <a className="pressable mt-3 inline-flex rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white" href={orgPayment.revolut_link} rel="noreferrer" target="_blank">
                            {t("payWith", { app: "Revolut" })}
                          </a>
                          <PaymentReportedButton isPending={isPaymentReportPending} onClick={handleReportPayment} reported={paymentReported} text="I've paid" />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-3 text-sm leading-6 text-[var(--muted)]">
            {t("paymentConfirmedBy", { business: detail.organizationName })}
          </p>

          <input name="preferredPaymentMethod" type="hidden" value={paymentMethod} />
          <input name="paymentTiming" type="hidden" value={effectiveTiming} />
        </section>
      ) : null}

      {orgPayment?.upfront_discount_enabled && orgPayment.upfront_discount_rate && detail.billingPeriod === "monthly" ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <SectionTitle icon={CreditCard} label={orgPayment.upfront_discount_label || t("payUpfrontTitle")} />
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {t("payUpfrontBody", { months: orgPayment.upfront_discount_min_periods, rate: formatMoney(orgPayment.upfront_discount_rate, currency) })}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              className={`pressable flex-1 rounded-xl border px-3 py-3 text-sm font-semibold transition ${upfrontAccepted === true ? "border-[var(--primary)] bg-[var(--panel-secondary)] text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
              onClick={() => setUpfrontAccepted(true)}
              type="button"
            >
              {t("acceptOffer")}
            </button>
            <button
              className={`pressable flex-1 rounded-xl border px-3 py-3 text-sm font-semibold transition ${upfrontAccepted === false ? "border-[var(--muted)] bg-[var(--panel-secondary)] text-[var(--foreground-secondary)]" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
              onClick={() => setUpfrontAccepted(false)}
              type="button"
            >
              {t("noThanks")}
            </button>
          </div>
          {upfrontAccepted === true ? (
            <>
              <input name="upfrontPeriods" type="hidden" value={orgPayment.upfront_discount_min_periods} />
              <input name="upfrontRate" type="hidden" value={orgPayment.upfront_discount_rate} />
            </>
          ) : null}
        </section>
      ) : null}

      </SavedDetails>

      <section className="scroll-mt-4 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm" ref={agreementRef}>
        <SectionTitle icon={PenLine} label={t("rentalAgreement")} />
        {notice ? <p className="mt-3 rounded-xl bg-[var(--success-light)] p-3 text-sm font-bold text-[var(--success)]">{notice}</p> : null}
        {!readyToSign ? (
          <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-3 text-sm leading-6 text-[var(--foreground-secondary)]">
            {t("previewExplain", { business: detail.organizationName })}
          </p>
        ) : null}
        {/* Price and deposit are at the top of the page and in the agreement itself; the version number and
            document fingerprint are kept on the record, not shown to someone renting a scooter. */}
        {isRentalDocumentEngine && publicAgreement && readyToSign && customerSigningEligibility?.customerSafeMessage ? (
          <p className="mt-3 rounded-lg border border-[var(--danger-line)] bg-white p-3 text-sm font-bold text-[var(--danger)]">{customerSigningEligibility.customerSafeMessage}</p>
        ) : null}
        <div className="routehq-contract-preview contract-preview mt-4 h-[70vh] min-h-[460px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)]">
          <iframe
            className="h-full w-full border-0 bg-[var(--panel-secondary)]"
            sandbox=""
            srcDoc={buildContractPreviewDocument(agreementHtml)}
            title={t("rentalAgreement")}
          />
        </div>
        {readyToSign && publicAgreement ? (
          <>
          {/* The statements are read as a list and agreed with one tick. Each one is still recorded by name and version. */}
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-white p-4">
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--foreground)]">
              {publicAgreement.requiredAcknowledgements.map((ack) => (
                <li key={`${publicAgreement.versionId}-${ack.type}`}>{t.has(`ack_${ack.type}` as never) ? t(`ack_${ack.type}` as never) : ack.text}</li>
              ))}
            </ul>
            <label className="checkbox-label mt-4 rounded-xl bg-[var(--panel-secondary)] p-3 font-bold text-[var(--foreground)]">
              <input checked={agreedAll} className="flex-shrink-0" onChange={(event) => setAgreedAll(event.target.checked)} type="checkbox" />
              <span>{t.has("agreeAll" as never) ? t("agreeAll" as never) : "I agree to all of the above"}</span>
            </label>
            {agreedAll ? publicAgreement.requiredAcknowledgements.map((ack) => <input key={ack.type} name={`ack_${ack.type}`} type="hidden" value="on" />) : null}
          </div>
        <label className="mt-4 block">
          <span className="text-sm font-bold text-[var(--foreground-secondary)]">{t("yourFullName")}</span>
          <input className={inputClass} defaultValue={detail.customer?.full_name || ""} name="signedName" required style={fieldStyle} />
        </label>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-[var(--foreground-secondary)]">{t("signBelow")}</span>
            <button className="pressable rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold text-[var(--foreground-secondary)]" onClick={clearSignature} type="button">
              {t("clear")}
            </button>
          </div>
          <canvas
            className="h-44 w-full touch-none rounded-xl border border-[var(--border)] bg-white"
            height={220}
            onPointerCancel={endDraw}
            onPointerDown={startDraw}
            onPointerLeave={endDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            ref={canvasRef}
            width={560}
          />
        </div>
          </>
        ) : null}
        {error ? <p className="mt-4 rounded-xl bg-[var(--danger-light)] p-3 text-sm font-bold text-[var(--danger)]">{error}</p> : null}
        <button className="pressable mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-70" disabled={isPending || !pageLive} key={readyToSign ? "sign" : "review"} type="submit">
          {isPending ? (
            <span className="inline-flex items-center gap-2"><span className="spinner" /> {t("sending")}</span>
          ) : readyToSign ? (
            t("signAndComplete")
          ) : (
            t("saveAndReview")
          )}
        </button>
      </section>

      <CompletionStatus status={liveStatus} />
    </form>
  );
}

function CompletionStatus({ status }: { status: { details: boolean; documents: boolean; agreement: boolean } }) {
  const t = useTranslations("customer");
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase text-[var(--primary)]">{t("progress")}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatusItem complete={status.details} label={t("yourDetails")} />
        <StatusItem complete={status.documents} label={t("documents")} />
        <StatusItem complete={status.agreement} label={t("agreement")} />
      </div>
    </section>
  );
}

function StatusItem({ complete, label }: { complete: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition ${complete ? "border-[var(--success-line)] bg-[var(--success-light)]" : "border-[var(--border)] bg-[var(--panel-secondary)]"}`}>
      {complete ? <CheckCircle2 className="text-[var(--success)]" /> : <span className="h-5 w-5 rounded-md border border-[var(--muted)]" />}
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}

function PaymentDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
      <p className="text-[11px] font-semibold uppercase text-[var(--muted)]">{label}</p>
      <p className="font-mono-data mt-1 break-words text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function PaymentReportedButton({
  isPending,
  onClick,
  reported,
  text
}: {
  isPending: boolean;
  onClick: () => void;
  reported: boolean;
  text: string;
}) {
  const t = useTranslations("customer");
  if (reported) {
    return (
      <p className="mt-3 rounded-xl border border-[var(--success-line)] bg-[var(--success-light)] p-3 text-sm font-bold text-[var(--success)]">
        {t("paymentReported")}
      </p>
    );
  }

  return (
    <button
      className="pressable mt-3 inline-flex rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      disabled={isPending}
      onClick={onClick}
      type="button"
    >
      {isPending ? t("sending") : text}
    </button>
  );
}

function NationalitySelect({ defaultValue, fill, name }: { defaultValue: string; fill?: string; name: string }) {
  const t = useTranslations("customer");
  const locale = useLocale();
  // Countries are shown in the customer's language; what is saved stays in English for the business.
  const regionNames = useMemo(() => {
    try {
      return locale === "en" ? null : new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      return null;
    }
  }, [locale]);
  const countryName = (n: { code: string; country: string }) => regionNames?.of(n.code) || n.country;
  const shown = (n: { code: string; name: string; country: string }) => (regionNames ? countryName(n) : `${n.name} — ${n.country}`);
  const initial = resolveNationality(defaultValue);
  const [search, setSearch] = useState(initial ? shown(initial) : defaultValue);
  const [selected, setSelected] = useState(initial?.name || defaultValue);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // A nationality read from the passport fills the picker, unless they already chose one.
  useEffect(() => {
    const match = fill ? resolveNationality(fill) : null;
    if (!match || selectedRef.current) return;
    setSelected(match.name);
    setSearch(shown(match));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill]);

  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim();
    if (!needle) return NATIONALITIES.slice(0, 25);
    return NATIONALITIES.filter(
      (n) =>
        n.name.toLowerCase().includes(needle) ||
        n.country.toLowerCase().includes(needle) ||
        countryName(n).toLowerCase().includes(needle) ||
        n.code.toLowerCase().includes(needle)
    ).slice(0, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, regionNames]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <input name={name} type="hidden" value={selected} />
      <input
        autoComplete="off"
        className={inputClass}
        onBlur={() => {
          // If nothing selected, clear back to empty so required validation fires correctly
          if (!selected) setSearch("");
        }}
        onChange={(e) => {
          setSearch(e.target.value);
          setSelected(""); // clear confirmed selection while typing
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t("typeCountry")}
        required
        style={fieldStyle}
        value={search}
      />
      {open && filtered.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-white p-1 shadow-xl">
          {filtered.map((n) => (
            <button
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--primary-light)]"
              key={n.code}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus so blur doesn't fire first
                setSelected(n.name);
                setSearch(shown(n));
                setOpen(false);
              }}
              type="button"
            >
              <span className="text-xl leading-none">{flagEmoji(n.code)}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-[var(--foreground)]">{regionNames ? countryName(n) : n.name}</span>
                {regionNames ? null : <span className="block text-xs font-medium text-[var(--muted)]">{n.country}</span>}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PhoneCountrySelect({ name, onChange, value }: { name: string; onChange: (value: string) => void; value: string }) {
  const t = useTranslations("customer");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const selected = phoneCountrySvgOptions.find((country) => country.callingCode === value) || phoneCountrySvgOptions[0];

  const filtered = search.trim()
    ? phoneCountrySvgOptions.filter((c) => {
        const q = search.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.callingCode.includes(q);
      })
    : phoneCountrySvgOptions;

  function openDropdown() {
    setOpen(true);
    setSearch("");
    setTimeout(() => searchRef.current?.focus(), 30);
  }

  return (
    <>
      <input name={name} type="hidden" value={selected.callingCode} />
      <button
        aria-expanded={open}
        onClick={openDropdown}
        style={{
          height: 42,
          width: 80,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          border: "0.5px solid var(--border)",
          borderRight: "none",
          borderRadius: "8px 0 0 8px",
          background: "var(--panel-secondary)",
          cursor: "pointer",
          padding: 0,
          position: "relative",
          zIndex: open ? 101 : 1,
          whiteSpace: "nowrap",
        }}
        type="button"
      >
        <FlagSvg code={selected.flagCode} label={selected.code} />
        <span style={{ fontSize: 13 }}>{selected.callingCode}</span>
      </button>
      {open ? (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
          <div style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 1000,
            background: "white",
            border: "0.5px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            width: 200,
            maxHeight: 260,
            overflowY: "auto",
            overflowX: "hidden",
          }}>
            <input
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchCountryCode")}
              ref={searchRef}
              style={{
                width: "100%",
                padding: "7px 10px",
                fontSize: 13,
                border: "none",
                borderBottom: "0.5px solid var(--border)",
                outline: "none",
                boxSizing: "border-box",
              }}
              type="text"
              value={search}
            />
            <div>
              {filtered.length === 0 ? (
                <p style={{ padding: 16, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>{t("noResults")}</p>
              ) : filtered.map((country) => (
                <button
                  key={`${name}-${country.callingCode}-${country.code}`}
                  onClick={() => { onChange(country.callingCode); setOpen(false); setSearch(""); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    cursor: "pointer",
                    fontSize: 13,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                  }}
                  type="button"
                >
                  <FlagSvg code={country.flagCode} label={country.code} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", width: 36, flexShrink: 0 }}>{country.code}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)", flexShrink: 0 }}>{country.callingCode}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function FlagSvg({ code, label }: { code: string; label: string }) {
  return (
    <img
      alt={`${label} flag`}
      className="h-4 w-6 shrink-0 rounded-sm border border-black/10 object-cover"
      src={`https://flagcdn.com/${code}.svg`}
    />
  );
}

function GoogleAddressInput({ name = "address", onChange, value }: { name?: string; onChange: (value: string) => void; value: string }) {
  const t = useTranslations("customer");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const mapsKeyConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

  useEffect(() => {
    let cancelled = false;
    const placesLoader = loadPublicGooglePlaces();

    if (!placesLoader) {
      return;
    }

    placesLoader
      .then(() => {
        if (cancelled || !inputRef.current || !window.google?.maps?.places?.Autocomplete) {
          return;
        }

        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "name", "place_id"],
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          onChange(place.formatted_address || place.name || inputRef.current?.value || "");
        });
        setIsEnabled(true);
      })
      .catch(() => setHasError(true));

    return () => {
      cancelled = true;
    };
  }, [onChange]);

  return (
    <>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          autoComplete="street-address"
          className={inputClass}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("hotelVillaAddress")}
          ref={inputRef}
          style={fieldStyle}
          value={value}
        />
        {mapsKeyConfigured && isEnabled ? (
          <button
            className="pressable mt-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
            onClick={() => setPinModalOpen(true)}
            type="button"
          >
            {t("dropPin")}
          </button>
        ) : null}
      </div>
      {isEnabled ? <p className="mt-2 text-xs text-[var(--muted)]">{t("addressHint")}</p> : null}
      {pinModalOpen ? (
        <PublicGooglePinModal
          onClose={() => setPinModalOpen(false)}
          onConfirm={(address) => {
            onChange(address);
            setPinModalOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function PublicGooglePinModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (address: string) => void }) {
  const t = useTranslations("customer");
  const mapRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<any>(null);
  const [address, setAddress] = useState("Koh Samui, Thailand");

  useEffect(() => {
    let cancelled = false;
    const loader = loadPublicGooglePlaces();
    if (!loader) return;

    loader.then(() => {
      const maps = (window.google as any)?.maps;
      if (cancelled || !mapRef.current || !maps?.Map || !maps?.Marker || !maps?.Geocoder) return;

      const geocoder = new maps.Geocoder();
      const fallbackCenter = { lat: 9.512, lng: 100.013 };

      const updateFromPosition = (position: { lat: number; lng: number }) => {
        geocoder.geocode({ location: position }, (results: Array<{ formatted_address: string }> | null, status: string) => {
          if (status === "OK" && results?.[0]) {
            setAddress(results[0].formatted_address);
          }
        });
      };

      geocoder.geocode({ address: address || "Koh Samui, Thailand" }, (results: Array<{ geometry?: { location?: { lat: () => number; lng: () => number } }; formatted_address: string }> | null, status: string) => {
        const location = status === "OK" && results?.[0]?.geometry?.location
          ? { lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() }
          : fallbackCenter;
        const map = new maps.Map(mapRef.current, {
          center: location,
          mapTypeControl: false,
          streetViewControl: false,
          zoom: 13
        });
        const marker = new maps.Marker({
          draggable: true,
          map,
          position: location
        });
        markerRef.current = marker;
        setAddress(results?.[0]?.formatted_address || address);

        marker.addListener("dragend", () => {
          const position = marker.getPosition();
          if (position) updateFromPosition({ lat: position.lat(), lng: position.lng() });
        });
        map.addListener("click", (event: { latLng?: { lat: () => number; lng: () => number } }) => {
          if (!event.latLng) return;
          const nextPosition = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          marker.setPosition(nextPosition);
          updateFromPosition(nextPosition);
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-3 sm:items-center sm:justify-center">
      <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--primary)]">Google Maps</p>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">{t("dropPin")}</h3>
          </div>
          <button className="pressable rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold" onClick={onClose} type="button">
            {t("close")}
          </button>
        </div>
        <div className="mt-4 h-80 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)]" ref={mapRef} />
        <p className="mt-3 rounded-xl bg-[var(--panel-secondary)] p-3 text-sm font-bold text-[var(--foreground-secondary)]">{address}</p>
        <button className="pressable mt-3 min-h-12 w-full rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white" onClick={() => onConfirm(address)} type="button">
          {t("usePlace")}
        </button>
      </div>
    </div>
  );
}

/** The filled-in sections. Shown in full while they are being completed; folded to one line once saved. */
function SavedDetails({ folded, children }: { folded: boolean; children: React.ReactNode }) {
  const t = useTranslations("customer");
  if (!folded) return <>{children}</>;
  return (
    <details className="group rounded-2xl border border-[var(--success-line)] bg-white shadow-sm">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-base font-semibold text-[var(--success)]">✓ {t("detailsSaved")}</span>
          <span className="block text-sm text-[var(--muted)]">{t("tapToChange")}</span>
        </span>
        <span aria-hidden="true" className="text-[var(--muted)] transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-5 border-t border-[var(--border)] p-3">{children}</div>
    </details>
  );
}

function HandoverWishes({ agreed, changeLabel, children, intro, title }: { agreed: boolean; changeLabel: string; children: ReactNode; intro: string; title: string }) {
  if (agreed) {
    return (
      <details className="rounded-2xl border border-[var(--border)] bg-white px-5 py-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-bold text-[var(--primary)]">{changeLabel}</summary>
        {children}
      </details>
    );
  }
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <SectionTitle icon={PenLine} label={title} />
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{intro}</p>
      {children}
    </section>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: typeof UserRound; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
        <Icon size={20} />
      </span>
      <h2 className="text-xl font-semibold text-[var(--foreground)]">{label}</h2>
    </div>
  );
}

function UploadCard({
  accept = "image/*,.pdf",
  cameraCapture = "environment",
  cameraName,
  complete,
  icon: Icon,
  label,
  name,
  note,
  noteTone,
  onPicked
}: {
  accept?: string;
  cameraCapture?: "user" | "environment";
  cameraName: string;
  complete: boolean;
  icon: typeof UserRound;
  label: string;
  name: string;
  note?: string | null;
  noteTone?: DocReadState;
  onPicked?: (file: File) => void;
}) {
  const t = useTranslations("customer");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [cameraFile, setCameraFile] = useState<File | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const selectedFile = uploadFile || cameraFile;

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  return (
    <div style={{ borderRadius: 10, border: "0.5px solid var(--border)", background: "#ffffff", padding: "12px 14px", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Icon size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", lineHeight: 1.3 }}>{label}</span>
        </div>
        {complete || selectedFile ? (
          <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 500, flexShrink: 0 }}>
            {"✓ "}
            {selectedFile ? t("added") : t("received")}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "var(--warning)", flexShrink: 0 }}>{t("needed")}</span>
        )}
      </div>

      {!complete ? (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                flex: "1 1 auto",
                padding: "12px 12px",
                minHeight: 44,
                borderRadius: 7,
                cursor: "pointer",
                border: "0.5px solid var(--border)",
                background: "#ffffff",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--foreground)"
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {t("chooseFile")}
              <input
                accept={accept}
                className="sr-only"
                name={name}
                onChange={(event) => {
                  setUploadFile(event.target.files?.[0] ?? null);
                  if (event.target.files?.[0]) {
                    setCameraFile(null);
                    onPicked?.(event.target.files[0]);
                  }
                }}
                type="file"
              />
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                flex: "1 1 auto",
                padding: "12px 12px",
                minHeight: 44,
                borderRadius: 7,
                cursor: "pointer",
                border: "0.5px solid var(--primary)",
                background: "var(--primary-light)",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--primary)"
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              {t("takePhoto")}
              <input
                accept="image/*"
                capture={cameraCapture}
                className="sr-only"
                name={cameraName}
                onChange={(event) => {
                  setCameraFile(event.target.files?.[0] ?? null);
                  if (event.target.files?.[0]) {
                    setUploadFile(null);
                    onPicked?.(event.target.files[0]);
                  }
                }}
                type="file"
              />
            </label>
          </div>
          {!isMobile ? (
            <p style={{ fontSize: 10, color: "var(--muted)", margin: "4px 0 0", textAlign: "center" }}>
              {t("takePhotoHint")}
            </p>
          ) : null}
        </>
      ) : (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "7px 12px",
            borderRadius: 7,
            cursor: "pointer",
            border: "0.5px solid var(--border)",
            background: "var(--panel-secondary)",
            fontSize: 11,
            fontWeight: 500,
            color: "var(--muted)"
          }}
        >
          {t("replace")}
          <input
            accept={accept}
            className="sr-only"
            name={name}
            onChange={(event) => {
              setUploadFile(event.target.files?.[0] ?? null);
              if (event.target.files?.[0]) onPicked?.(event.target.files[0]);
            }}
            type="file"
          />
        </label>
      )}
      {note ? (
        <p aria-live="polite" style={{ fontSize: 12, fontWeight: 600, margin: "8px 0 0", color: noteTone === "unreadable" ? "var(--warning)" : noteTone === "read" ? "var(--success)" : "var(--primary)" }}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
