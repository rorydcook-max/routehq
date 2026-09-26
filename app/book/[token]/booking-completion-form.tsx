"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, FileText, IdCard, ImageIcon, MessageCircle, PenLine, Upload, UserRound, XCircle } from "lucide-react";
import { completePublicBooking, reportPublicBookingPayment } from "@/app/actions/public-booking";
import { extractBodyHtml } from "@/lib/contract-rendering";
import { formatDeliveryLocation } from "@/lib/delivery-location";
import { toWallTime } from "@/lib/business-time";

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
  bookingReference?: string;
  rentalRate?: number;
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
  border: "0.5px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#0f172a",
  boxSizing: "border-box" as const,
  outline: "none",
};
const inputClass = "mt-2 focus:ring-2 focus:ring-[#0f766e]/15";
const emojiSelectStyle = {
  fontFamily: '"Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", "Segoe UI", system-ui, sans-serif'
};

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
        background: #fbfefd;
        color: #344054;
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

function todayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(detail.completion.agreement);
  const [signedContractUrl, setSignedContractUrl] = useState<string | null>(null);
  const [executionCertificateUrl, setExecutionCertificateUrl] = useState<string | null>(detail.executedAgreementDownloads?.executionCertificateUrl || null);
  const [originalAgreementUrl, setOriginalAgreementUrl] = useState<string | null>(detail.executedAgreementDownloads?.originalAgreementUrl || null);
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+66");
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
  const paymentAmount = detail.outstandingBalance && detail.outstandingBalance > 0 ? detail.outstandingBalance : rentalRate;
  const currency = detail.currency ?? "THB";
  const [upfrontAccepted, setUpfrontAccepted] = useState<boolean | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isPaymentReportPending, startPaymentReportTransition] = useTransition();
  const [paymentReported, setPaymentReported] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
  const minDateTime = new Date().toISOString().slice(0, 16);
  const operatorDeliveryDateTime = compactDateTime(detail.bookingData.delivery_datetime);
  const operatorDeliveryIsToday = isTodayDateTime(operatorDeliveryDateTime);
  const operatorDeliveryTimeLabel = timeLabelFromDateTime(operatorDeliveryDateTime);

  useEffect(() => {
    if (!focusField || !formRef.current) return;
    const el = formRef.current.querySelector(`[name="${focusField}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.borderColor = "#dc2626";
    el.style.boxShadow = "0 0 0 2px #fecaca";
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
    context.strokeStyle = "#10252b";
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
        setError(reportError instanceof Error ? reportError.message : "Unable to report payment.");
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
      setContactChannelError("Please select your preferred contact method.");
      return;
    }
    if (preferredContactMethod === "phone" && !livePhone) {
      setContactChannelError("Please add your phone number in the section above.");
      setFocusField("phone");
      return;
    }
    if (preferredContactMethod === "email" && !liveEmail) {
      setContactChannelError("Please add your email address in the section above.");
      setFocusField("email");
      return;
    }
    if (preferredContactMethod === "whatsapp" && !whatsappNumber.trim()) {
      setContactChannelError("Please enter your WhatsApp number.");
      return;
    }
    if (preferredContactMethod === "messenger" && !String(fd.get("messengerId") || "").trim()) {
      setContactChannelError("Please enter your Facebook Messenger username.");
      return;
    }
    if (preferredContactMethod === "line" && !String(fd.get("lineId") || "").trim()) {
      setContactChannelError("Please enter your LINE ID.");
      return;
    }
    if (preferredContactMethod === "telegram" && !String(fd.get("telegramUsername") || "").trim()) {
      setContactChannelError("Please enter your Telegram username.");
      return;
    }

    if (readyToSign) {
      const requiredAcknowledgements = publicAgreement?.requiredAcknowledgements || [];
      const accepted = requiredAcknowledgements.every((ack) => fd.get(`ack_${ack.type}`) === "on");
      if (!accepted) {
        setError("Please accept each required acknowledgement before signing.");
        return;
      }
      if (!signature) {
        setError("Please sign the agreement before submitting.");
        return;
      }
    }

    startTransition(async () => {
      try {
        const formData = new FormData(form);
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
              ? "Your changes updated the agreement. Please read the updated version below and sign again."
              : "Your details are saved. Please read your final agreement below, then sign it."
          );
          router.refresh();
          agreementRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        setSignedContractUrl(result.signedContractUrl || null);
        setOriginalAgreementUrl((result as any).originalAgreementUrl || null);
        setExecutionCertificateUrl((result as any).executionCertificateUrl || null);
        setCompleted(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Unable to complete booking.");
      }
    });
  }

  if (completed) {
    return (
      <section className="rounded-2xl border border-[#bbf7d0] bg-white p-5 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#dcfce7] text-[#166534]">
          <CheckCircle2 size={34} />
        </div>
        <h2 className="mt-4 text-2xl font-black text-[#10252b]">You're all set{(submittedName || detail.customer?.full_name) ? `, ${String(submittedName || detail.customer?.full_name).split(/\s+/)[0]}` : ""}.</h2>
        <p className="mt-2 text-sm leading-6 text-[#667085]">Your booking details, documents, and signed agreement have been received. {detail.organizationName} will contact you to confirm delivery time and answer any questions.</p>
        {originalAgreementUrl ? (
          <a className="pressable mt-5 inline-flex rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-black text-white" href={originalAgreementUrl} rel="noreferrer" target="_blank">
            Download original agreement
          </a>
        ) : null}
        {executionCertificateUrl ? (
          <a className="pressable mt-5 ml-2 inline-flex rounded-xl border border-[#0f766e] bg-white px-5 py-3 text-sm font-black text-[#0f766e]" href={executionCertificateUrl} rel="noreferrer" target="_blank">
            Download execution certificate
          </a>
        ) : null}
        {signedContractUrl ? (
          <a className="pressable mt-5 inline-flex rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-black text-white" href={signedContractUrl} rel="noreferrer" target="_blank">
            Download signed contract
          </a>
        ) : null}
      </section>
    );
  }

  return (
    <form className="space-y-5" encType="multipart/form-data" onChange={(event) => updateLiveStatus(event.currentTarget)} onInput={(event) => updateLiveStatus(event.currentTarget)} onSubmit={handleSubmit} ref={formRef}>
      <input name="token" type="hidden" value={detail.token} />
      <input name="preferredLocale" type="hidden" value="en" />

      <section className="rounded-2xl border border-[#d6e5e2] bg-white p-5 shadow-sm">
        <SectionTitle icon={UserRound} label="Your details" />
        {detail.completion.details ? (
          <p className="mt-3 rounded-xl bg-[#dcfce7] p-3 text-sm font-bold text-[#166534]">Your details have already been submitted. You can update them below if needed.</p>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:items-start">
          <label>
            <span className="text-sm font-bold text-[#344054]">Full name</span>
            <input className={inputClass} defaultValue={detail.customer?.full_name || ""} name="fullName" required style={fieldStyle} />
          </label>
          <label>
            <span className="text-sm font-bold text-[#344054]">Nationality</span>
            <NationalitySelect defaultValue={String(detail.customer?.nationality || "")} name="nationality" />
          </label>
          <label>
            <span className="text-sm font-bold text-[#344054]">Phone</span>
            <div style={{ display: "flex", alignItems: "stretch", width: "100%", height: 42, position: "relative", marginTop: 8 }}>
              <PhoneCountrySelect name="phoneCountryCode" onChange={setPhoneCountryCode} value={phoneCountryCode} />
              <input defaultValue={detail.customer?.phone || ""} name="phone" onClick={(e) => e.stopPropagation()} required style={{ ...fieldStyle, width: "auto", borderRadius: "0 8px 8px 0", flex: 1, minWidth: 0, borderLeft: "none", position: "relative", zIndex: 2 }} type="tel" />
            </div>
          </label>
          <label>
            <span className="text-sm font-bold text-[#344054]">Email</span>
            <input className={inputClass} defaultValue={detail.customer?.email || ""} name="email" style={fieldStyle} type="email" />
          </label>
          <label>
            <span className="text-sm font-bold text-[#344054]">Date of birth</span>
            <input className={inputClass} defaultValue={detail.customer?.date_of_birth || ""} name="dateOfBirth" required style={{ ...fieldStyle, textTransform: "uppercase", appearance: "none" as const }} type="date" />
          </label>
          <label>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-[#344054]">
              Current address
              <span className="cursor-help text-[#667085]" title="Your current address, hotel, villa or residence">ⓘ</span>
            </span>
            <GoogleAddressInput onChange={setCurrentAddress} value={currentAddress} />
          </label>
          <label>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-[#344054]">
              Emergency contact name
              <span className="cursor-help text-[#667085]" title="Optional — add a contact if you would like us to know who to call in an emergency.">ⓘ</span>
            </span>
            <input className={inputClass} defaultValue={detail.customer?.emergency_contact_name || ""} name="emergencyContactName" style={fieldStyle} />
          </label>
          <label>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-[#344054]">
              Emergency contact phone
              <span className="cursor-help text-[#667085]" title="Optional — add an emergency contact phone number if available.">ⓘ</span>
            </span>
            <div style={{ display: "flex", alignItems: "stretch", width: "100%", height: 42, position: "relative", marginTop: 8 }}>
              <PhoneCountrySelect name="emergencyPhoneCountryCode" onChange={setEmergencyPhoneCountryCode} value={emergencyPhoneCountryCode} />
              <input defaultValue={detail.customer?.emergency_contact_phone || ""} name="emergencyContactPhone" onClick={(e) => e.stopPropagation()} style={{ ...fieldStyle, width: "auto", borderRadius: "0 8px 8px 0", flex: 1, minWidth: 0, borderLeft: "none", position: "relative", zIndex: 2 }} type="tel" />
            </div>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[#d6e5e2] bg-white p-5 shadow-sm">
        <SectionTitle icon={MessageCircle} label="How should we contact you?" />
        <p className="mt-2 text-sm leading-6 text-[#667085]">
          Choose how you&apos;d like {detail.organizationName} to contact you for payment reminders and rental updates.
        </p>
        {contactChannelError ? (
          <div style={{ background: "#fffbeb", border: "0.5px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginTop: 12, fontSize: 13, color: "#92400e" }}>
            {contactChannelError}
          </div>
        ) : null}
        <input name="contactChannelsSubmitted" type="hidden" value="true" />

        <div className="mt-4">
          <label>
            <span className="text-sm font-bold text-[#344054]">Preferred contact method</span>
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
              style={{ ...fieldStyle, color: preferredContactMethod ? "#0f172a" : "#94a3b8", cursor: "pointer" }}
              value={preferredContactMethod}
            >
              <option disabled value="">Select your preferred channel...</option>
              <option value="phone">Phone call</option>
              <option value="email">Email</option>
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
            <div style={{ background: "#f0fdf4", border: "0.5px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", marginTop: 8, fontSize: 13, color: "#15803d" }}>
              ✓ We&apos;ll contact you on {livePhone}
            </div>
          ) : (
            <div style={{ background: "#fffbeb", border: "0.5px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginTop: 8, fontSize: 13, color: "#92400e" }}>
              Please add your phone number in the section above first.
            </div>
          )
        ) : null}

        {preferredContactMethod === "email" ? (
          liveEmail ? (
            <div style={{ background: "#f0fdf4", border: "0.5px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", marginTop: 8, fontSize: 13, color: "#15803d" }}>
              ✓ We&apos;ll contact you at {liveEmail}
            </div>
          ) : (
            <div style={{ background: "#fffbeb", border: "0.5px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginTop: 8, fontSize: 13, color: "#92400e" }}>
              Please add your email address in the section above first.
            </div>
          )
        ) : null}

        {preferredContactMethod === "whatsapp" ? (
          <div style={{ marginTop: 8 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#344054" }}>WhatsApp number</label>
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
                style={{ fontSize: 11, color: "#0e7490", background: "none", border: "none", cursor: "pointer", marginTop: 4, padding: 0 }}
                type="button"
              >
                Use same as phone number ({livePhone})
              </button>
            ) : null}
          </div>
        ) : null}

        {preferredContactMethod === "messenger" ? (
          <div style={{ marginTop: 8 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#344054" }}>Messenger username</label>
            <input defaultValue={detail.customer?.messenger_id || ""} name="messengerId" placeholder="messenger.com/username or full profile URL" style={{ ...fieldStyle, marginTop: 4 }} />
          </div>
        ) : null}

        {preferredContactMethod === "line" ? (
          <div style={{ marginTop: 8 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#344054" }}>LINE ID</label>
            <input defaultValue={detail.customer?.line_id || ""} name="lineId" placeholder="@lineusername" style={{ ...fieldStyle, marginTop: 4 }} />
          </div>
        ) : null}

        {preferredContactMethod === "telegram" ? (
          <div style={{ marginTop: 8 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#344054" }}>Telegram username</label>
            <input defaultValue={detail.customer?.telegram_username || ""} name="telegramUsername" placeholder="@telegramusername" style={{ ...fieldStyle, marginTop: 4 }} />
          </div>
        ) : null}

        {/* Secondary channels — collapsible */}
        <details style={{ marginTop: 16 }}>
          <summary style={{ fontSize: 13, color: "#0e7490", cursor: "pointer", fontWeight: 500, listStyle: "none", userSelect: "none" }}>
            + Add more ways to contact you (optional)
          </summary>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {preferredContactMethod !== "whatsapp" ? (
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#344054", display: "block" }}>WhatsApp</label>
                <input name="whatsappNumber" onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+66812345678" style={{ ...fieldStyle, marginTop: 4 }} type="tel" value={whatsappNumber} />
              </div>
            ) : null}
            {preferredContactMethod !== "messenger" ? (
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#344054", display: "block" }}>Facebook Messenger</label>
                <input defaultValue={detail.customer?.messenger_id || ""} name="messengerId" placeholder="messenger.com/username" style={{ ...fieldStyle, marginTop: 4 }} />
              </div>
            ) : null}
            {preferredContactMethod !== "line" ? (
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#344054", display: "block" }}>LINE ID</label>
                <input defaultValue={detail.customer?.line_id || ""} name="lineId" placeholder="@lineusername" style={{ ...fieldStyle, marginTop: 4 }} />
              </div>
            ) : null}
            {preferredContactMethod !== "telegram" ? (
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#344054", display: "block" }}>Telegram</label>
                <input defaultValue={detail.customer?.telegram_username || ""} name="telegramUsername" placeholder="@telegramusername" style={{ ...fieldStyle, marginTop: 4 }} />
              </div>
            ) : null}
            <div style={{ gridColumn: "1 / 2" }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#344054", display: "block" }}>
                Instagram <span style={{ fontSize: 11, color: "#94a3b8" }}>Optional</span>
              </label>
              <input defaultValue={detail.customer?.instagram_handle || ""} name="instagramHandle" placeholder="@instagramhandle" style={{ ...fieldStyle, marginTop: 4 }} />
            </div>
          </div>
        </details>
      </section>

      <section className="rounded-2xl border border-[#d6e5e2] bg-white p-5 shadow-sm">
        <SectionTitle icon={Upload} label="Documents" />
        {isRentalDocumentEngine ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label>
              <span className="text-sm font-bold text-[#344054]">Passport or ID number</span>
              <input className={inputClass} defaultValue={detail.customer?.passport_number || ""} name="passportNumber" required style={fieldStyle} />
            </label>
            <label>
              <span className="text-sm font-bold text-[#344054]">Driving licence number</span>
              <input className={inputClass} defaultValue={detail.customer?.driver_license_number || ""} name="driverLicenseNumber" required style={fieldStyle} />
            </label>
            <label>
              <span className="text-sm font-bold text-[#344054]">Licence expiry</span>
              <input className={inputClass} defaultValue={detail.customer?.driver_license_expiry || ""} name="driverLicenseExpiry" required style={fieldStyle} type="date" />
            </label>
            <label>
              <span className="text-sm font-bold text-[#344054]">Licence country</span>
              <input className={inputClass} defaultValue={detail.customer?.driver_license_country || ""} name="driverLicenseCountry" required style={fieldStyle} />
            </label>
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <UploadCard cameraName="passportCameraFile" complete={detail.documentStatus.passport} icon={IdCard} label="Passport" name="passportFile" />
          <UploadCard cameraName="driverLicenseCameraFile" complete={detail.documentStatus.driver_license} icon={FileText} label="Driving licence" name="driverLicenseFile" />
          <UploadCard cameraCapture="user" cameraName="selfieCameraFile" complete={detail.documentStatus.selfie} icon={ImageIcon} label="Selfie photo" name="selfieFile" />
        </div>
      </section>

      <section className="rounded-2xl border border-[#d6e5e2] bg-white p-5 shadow-sm">
        <SectionTitle icon={PenLine} label="Preferred delivery details" />
        <p className="mt-2 text-sm leading-6 text-[#667085]">Optional. Add your preferred location and time if the operator has not confirmed them yet.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-sm font-bold text-[#344054]">Preferred delivery or collection location</span>
            <GoogleAddressInput name="preferredDeliveryLocation" onChange={setPreferredDeliveryLocation} value={preferredDeliveryLocation} />
          </label>
          <label className="sm:col-span-2">
            <span className="text-sm font-bold text-[#344054]">Preferred delivery or collection time</span>
            {operatorDeliveryIsToday ? (
              <div className="mt-2 rounded-xl border border-[#99f6e4] bg-[#f0fdfb] p-3">
                <input name="preferredDeliveryDateTime" type="hidden" value={operatorDeliveryDateTime} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-[#d6e5e2] bg-white px-3 py-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#0f766e]">Date</p>
                    <p className="mt-1 text-sm font-black text-[#10252b]">Today</p>
                  </div>
                  <div className="rounded-lg border border-[#d6e5e2] bg-white px-3 py-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#0f766e]">Time</p>
                    <p className="mt-1 text-sm font-black text-[#10252b]">{operatorDeliveryTimeLabel}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm font-semibold text-[#0f766e]">Your vehicle will be ready for handover today.</p>
              </div>
            ) : (
              <input className={inputClass} defaultValue={operatorDeliveryDateTime} min={minDateTime} name="preferredDeliveryDateTime" style={fieldStyle} type="datetime-local" />
            )}
          </label>
        </div>
      </section>

      {acceptedMethods.length > 0 ? (
        <section className="rounded-2xl border border-[#d6e5e2] bg-white p-5 shadow-sm">
          <SectionTitle icon={CreditCard} label="How would you like to pay?" />
          <div className="mt-4 grid gap-3">
            {acceptedMethods.map((key) => {
              const info = PAYMENT_METHODS.find((m) => m.key === key)!;
              const active = paymentMethod === key;
              const payNowActive = active && effectiveTiming === "now";

              return (
                <div className={`rounded-2xl border p-4 transition ${active ? "border-[#0f766e] bg-[#f0fdfa]" : "border-[#d6e5e2] bg-white"}`} key={key}>
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
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-[#0f766e] text-white" : "bg-[#e6fffb] text-[#0f766e]"}`}>
                      <i className={info.iconClass} style={{ fontSize: 19 }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-[#10252b]">{info.label}</span>
                      <span className="mt-1 block text-sm leading-5 text-[#667085]">{info.description}</span>
                      <span className="mt-3 flex flex-wrap gap-2">
                        <button
                          className={`pressable rounded-full px-3 py-1 text-xs font-black ${active && effectiveTiming === "on_delivery" ? "bg-[#0f766e] text-white" : "bg-white text-[#344054] ring-1 ring-[#d6e5e2]"}`}
                          onClick={(event) => {
                            event.preventDefault();
                            setPaymentMethod(key);
                            setPaymentTiming("on_delivery");
                            setPaymentReported(false);
                          }}
                          type="button"
                        >
                          Pay on delivery / collection
                        </button>
                        {!info.deliveryOnly ? (
                          <button
                            className={`pressable rounded-full px-3 py-1 text-xs font-black ${payNowActive ? "bg-[#0f766e] text-white" : "bg-white text-[#344054] ring-1 ring-[#d6e5e2]"}`}
                            onClick={(event) => {
                              event.preventDefault();
                              setPaymentMethod(key);
                              setPaymentTiming("now");
                              setPaymentReported(false);
                            }}
                            type="button"
                          >
                            Pay now
                          </button>
                        ) : null}
                      </span>
                    </span>
                  </label>

                  {active && effectiveTiming === "now" ? (
                    <div className="mt-4 rounded-2xl border border-[#99f6e4] bg-white p-4">
                      {key === "promptpay" && (orgPayment?.promptpay_qr_url || orgPayment?.promptpay_id) ? (
                        <div>
                          {orgPayment.promptpay_qr_url ? (
                            <>
                              <img
                                alt="PromptPay QR code"
                                className="mx-auto block h-[220px] w-[220px] rounded-lg border border-[#e3e6e8] bg-white object-contain"
                                src={orgPayment.promptpay_qr_url}
                              />
                              <p className="mt-3 text-center text-[13px] text-[#454d54]">Scan with any Thai banking app</p>
                              <p className="mt-1 text-center text-[13px] font-semibold text-[#0e7490]">Enter the amount: {formatMoney(paymentAmount, currency)}</p>
                              {orgPayment.promptpay_id ? (
                                <p className="mt-1 text-center text-[11px] text-[#717d86]">PromptPay ID: {orgPayment.promptpay_id}</p>
                              ) : null}
                            </>
                          ) : (
                            <div className="text-center">
                              <p className="text-base font-semibold text-[#10252b]">PromptPay ID: {orgPayment.promptpay_id}</p>
                              <p className="mt-2 text-sm text-[#667085]">Search for this number in your Thai banking app to pay</p>
                              <p className="mt-2 text-sm font-semibold text-[#0e7490]">Amount to enter: {formatMoney(paymentAmount, currency)}</p>
                            </div>
                          )}
                          <PaymentReportedButton isPending={isPaymentReportPending} onClick={handleReportPayment} reported={paymentReported} text="I've made the payment" />
                        </div>
                      ) : key === "bank_transfer" && orgPayment?.bank_account_number ? (
                        <div>
                          <p className="text-xs font-black uppercase text-[#0f766e]">Thai Bank Transfer</p>
                          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                            <PaymentDetail label="Bank" value={orgPayment.bank_name || "Bank details provided by operator"} />
                            <PaymentDetail label="Account number" value={orgPayment.bank_account_number} />
                            <PaymentDetail label="Account name" value={orgPayment.bank_account_name || detail.organizationName} />
                            <PaymentDetail label="Reference" value={detail.bookingReference || detail.token.slice(0, 10)} />
                            <PaymentDetail label="Exact amount" value={formatMoney(paymentAmount, currency)} />
                          </div>
                          <PaymentReportedButton isPending={isPaymentReportPending} onClick={handleReportPayment} reported={paymentReported} text="I've made the transfer" />
                        </div>
                      ) : key === "wise" && orgPayment?.wise_link ? (
                        <div>
                          <p className="text-xs font-black uppercase text-[#0f766e]">Wise</p>
                          <p className="mt-2 text-sm text-[#667085]">Use Wise to pay {formatMoney(paymentAmount, currency)}.</p>
                          <a className="pressable mt-3 inline-flex rounded-xl bg-[#0f766e] px-4 py-3 text-sm font-black text-white" href={orgPayment.wise_link} rel="noreferrer" target="_blank">
                            Pay via Wise
                          </a>
                          <PaymentReportedButton isPending={isPaymentReportPending} onClick={handleReportPayment} reported={paymentReported} text="I've paid" />
                        </div>
                      ) : key === "revolut" && orgPayment?.revolut_link ? (
                        <div>
                          <p className="text-xs font-black uppercase text-[#0f766e]">Revolut</p>
                          <p className="mt-2 text-sm text-[#667085]">Use Revolut to pay {formatMoney(paymentAmount, currency)}.</p>
                          <a className="pressable mt-3 inline-flex rounded-xl bg-[#0f766e] px-4 py-3 text-sm font-black text-white" href={orgPayment.revolut_link} rel="noreferrer" target="_blank">
                            Pay via Revolut
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

          <p className="mt-4 rounded-xl border border-[#d6e5e2] bg-[#f8fffd] p-3 text-sm leading-6 text-[#667085]">
            Payment will be confirmed by {detail.organizationName} when received. You will not be charged automatically.
          </p>

          <input name="preferredPaymentMethod" type="hidden" value={paymentMethod} />
          <input name="paymentTiming" type="hidden" value={effectiveTiming} />
        </section>
      ) : null}

      {orgPayment?.upfront_discount_enabled && orgPayment.upfront_discount_rate && detail.billingPeriod === "monthly" ? (
        <section className="rounded-2xl border border-[#d6e5e2] bg-white p-5 shadow-sm">
          <SectionTitle icon={CreditCard} label={orgPayment.upfront_discount_label || "Pay upfront and save"} />
          <p className="mt-2 text-sm leading-6 text-[#667085]">
            Pay {orgPayment.upfront_discount_min_periods} months upfront at {formatMoney(orgPayment.upfront_discount_rate, currency)} per month and enjoy a discounted rate.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              className={`pressable flex-1 rounded-xl border px-3 py-3 text-sm font-black transition ${upfrontAccepted === true ? "border-[#0f766e] bg-[#f0fdfa] text-[#0f766e]" : "border-[#d6e5e2] bg-white text-[#344054]"}`}
              onClick={() => setUpfrontAccepted(true)}
              type="button"
            >
              Accept offer
            </button>
            <button
              className={`pressable flex-1 rounded-xl border px-3 py-3 text-sm font-black transition ${upfrontAccepted === false ? "border-[#94a3b8] bg-[#f8fafc] text-[#475569]" : "border-[#d6e5e2] bg-white text-[#344054]"}`}
              onClick={() => setUpfrontAccepted(false)}
              type="button"
            >
              No thanks
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

      <section className="scroll-mt-4 rounded-2xl border border-[#d6e5e2] bg-white p-5 shadow-sm" ref={agreementRef}>
        <SectionTitle icon={PenLine} label="Rental Agreement" />
        {notice ? <p className="mt-3 rounded-xl bg-[#dcfce7] p-3 text-sm font-bold text-[#166534]">{notice}</p> : null}
        {!readyToSign ? (
          <p className="mt-3 rounded-xl border border-[#d6e5e2] bg-[#fbfefd] p-3 text-sm leading-6 text-[#344054]">
            This is a preview. When you save your details, your name and document numbers are added to the agreement and
            {" "}{detail.organizationName} signs it. You will then read the final agreement here before you sign it.
          </p>
        ) : null}
        {isRentalDocumentEngine && publicAgreement && readyToSign ? (
          <div className="mt-4 rounded-xl border border-[#99f6e4] bg-[#f0fdfa] p-4">
            <p className="text-xs font-black uppercase text-[#0f766e]">Agreement version {publicAgreement.versionNumber}</p>
            <p className="mt-1 text-sm font-bold text-[#10252b]">{publicAgreement.businessIdentity.name}</p>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="font-bold">Rate:</span> {publicAgreement.rentalSummary.rate} / {publicAgreement.rentalSummary.billingPeriod}</p>
              <p><span className="font-bold">Deposit:</span> {publicAgreement.rentalSummary.deposit}</p>
              {/* Only shown when the agreement actually states one. */}
              {publicAgreement.rentalSummary.standardDailyRate ? (
                <p><span className="font-bold">Standard daily rate:</span> {publicAgreement.rentalSummary.standardDailyRate}</p>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-[#667085]">
              This exact text is fixed once you sign. Document fingerprint: <span className="font-mono">{publicAgreement.contentHashFragment}</span>
            </p>
            {customerSigningEligibility?.customerSafeMessage ? (
              <p className="mt-3 rounded-lg border border-[#fecaca] bg-white p-3 text-sm font-bold text-[#be123c]">{customerSigningEligibility.customerSafeMessage}</p>
            ) : null}
          </div>
        ) : null}
        <div className="routehq-contract-preview contract-preview mt-4 h-[460px] overflow-hidden rounded-xl border border-[#d6e5e2] bg-[#fbfefd]">
          <iframe
            className="h-full w-full border-0 bg-[#fbfefd]"
            sandbox=""
            srcDoc={buildContractPreviewDocument(agreementHtml)}
            title="Rental agreement preview"
          />
        </div>
        {readyToSign && publicAgreement ? (
          <>
          <div className="mt-4 space-y-2">
            {publicAgreement.requiredAcknowledgements.map((ack) => (
              <label className="checkbox-label rounded-xl border border-[#d6e5e2] bg-white p-3 font-bold text-[#10252b]" key={`${publicAgreement.versionId}-${ack.type}`}>
                <input className="flex-shrink-0" name={`ack_${ack.type}`} type="checkbox" />
                <span>{ack.text}</span>
              </label>
            ))}
          </div>
        <label className="mt-4 block">
          <span className="text-sm font-bold text-[#344054]">Full name for signature</span>
          <input className={inputClass} defaultValue={detail.customer?.full_name || ""} name="signedName" required style={fieldStyle} />
        </label>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-[#344054]">Sign below</span>
            <button className="pressable rounded-lg border border-[#d6e5e2] bg-white px-3 py-2 text-xs font-bold text-[#344054]" onClick={clearSignature} type="button">
              Clear
            </button>
          </div>
          <canvas
            className="h-44 w-full touch-none rounded-xl border border-[#d6e5e2] bg-white"
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
        {error ? <p className="mt-4 rounded-xl bg-[#ffe4e6] p-3 text-sm font-bold text-[#be123c]">{error}</p> : null}
        <button className="pressable mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-black text-white disabled:opacity-70" disabled={isPending} key={readyToSign ? "sign" : "review"} type="submit">
          {isPending ? (
            <span className="inline-flex items-center gap-2"><span className="spinner" /> Submitting...</span>
          ) : readyToSign ? (
            "Sign agreement and complete booking"
          ) : (
            "Save details and review agreement"
          )}
        </button>
      </section>

      <CompletionStatus status={liveStatus} />
    </form>
  );
}

function CompletionStatus({ status }: { status: { details: boolean; documents: boolean; agreement: boolean } }) {
  return (
    <section className="rounded-2xl border border-[#d6e5e2] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase text-[#0f766e]">Completion status</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatusItem complete={status.details} label="Your details" />
        <StatusItem complete={status.documents} label="Documents" />
        <StatusItem complete={status.agreement} label="Agreement" />
      </div>
    </section>
  );
}

function StatusItem({ complete, label }: { complete: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition ${complete ? "border-[#bbf7d0] bg-[#f0fdf4]" : "border-[#d6e5e2] bg-[#fbfefd]"}`}>
      {complete ? <CheckCircle2 className="text-[#16a34a]" /> : <span className="h-5 w-5 rounded-md border border-[#94a3b8]" />}
      <span className="text-sm font-black">{label}</span>
    </div>
  );
}

function PaymentDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#d6e5e2] bg-[#fbfefd] p-3">
      <p className="text-[11px] font-black uppercase text-[#667085]">{label}</p>
      <p className="font-mono-data mt-1 break-words text-sm font-black text-[#10252b]">{value}</p>
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
  if (reported) {
    return (
      <p className="mt-3 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm font-bold text-[#166534]">
        Payment reported - your booking will be confirmed shortly.
      </p>
    );
  }

  return (
    <button
      className="pressable mt-3 inline-flex rounded-xl bg-[#0f766e] px-4 py-3 text-sm font-black text-white disabled:opacity-60"
      disabled={isPending}
      onClick={onClick}
      type="button"
    >
      {isPending ? "Reporting..." : text}
    </button>
  );
}

function NationalitySelect({ defaultValue, name }: { defaultValue: string; name: string }) {
  const initial = resolveNationality(defaultValue);
  const [search, setSearch] = useState(initial ? `${initial.name} — ${initial.country}` : defaultValue);
  const [selected, setSelected] = useState(initial?.name || defaultValue);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim();
    if (!needle) return NATIONALITIES.slice(0, 25);
    return NATIONALITIES.filter(
      (n) =>
        n.name.toLowerCase().includes(needle) ||
        n.country.toLowerCase().includes(needle) ||
        n.code.toLowerCase().includes(needle)
    ).slice(0, 40);
  }, [search]);

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
        placeholder="Type nationality or country name..."
        required
        style={fieldStyle}
        value={search}
      />
      {open && filtered.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-64 overflow-y-auto rounded-xl border border-[#d6e5e2] bg-white p-1 shadow-xl">
          {filtered.map((n) => (
            <button
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[#e6fffb]"
              key={n.code}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus so blur doesn't fire first
                setSelected(n.name);
                setSearch(`${n.name} — ${n.country}`);
                setOpen(false);
              }}
              type="button"
            >
              <span className="text-xl leading-none">{flagEmoji(n.code)}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-[#10252b]">{n.name}</span>
                <span className="block text-xs font-medium text-[#667085]">{n.country}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PhoneCountrySelect({ name, onChange, value }: { name: string; onChange: (value: string) => void; value: string }) {
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
          border: "0.5px solid #cbd5e1",
          borderRight: "none",
          borderRadius: "8px 0 0 8px",
          background: "#f8fafc",
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
              placeholder="Search country or code..."
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
                <p style={{ padding: 16, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>No results</p>
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
          placeholder="Search Google Maps or enter address..."
          ref={inputRef}
          style={fieldStyle}
          value={value}
        />
        {mapsKeyConfigured ? (
          <button
            className="pressable mt-2 rounded-xl border border-[#d6e5e2] bg-white px-4 py-3 text-sm font-black text-[#10252b]"
            onClick={() => setPinModalOpen(true)}
            type="button"
          >
            Drop a pin
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-xs font-semibold text-[#667085]">
        {isEnabled ? "Search for your current address, hotel, villa, or residence." : hasError || !mapsKeyConfigured ? "Google Maps search unavailable — enter address manually." : "Loading Google Maps address search..."}
      </p>
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
            <p className="text-xs font-black uppercase text-[#0f766e]">Google Maps</p>
            <h3 className="text-lg font-black text-[#10252b]">Drop a pin</h3>
          </div>
          <button className="pressable rounded-xl border border-[#d6e5e2] bg-white px-3 py-2 text-sm font-bold" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="mt-4 h-80 overflow-hidden rounded-xl border border-[#d6e5e2] bg-[#eef7f5]" ref={mapRef} />
        <p className="mt-3 rounded-xl bg-[#fbfefd] p-3 text-sm font-bold text-[#344054]">{address}</p>
        <button className="pressable mt-3 min-h-12 w-full rounded-xl bg-[#0f766e] px-4 py-3 text-sm font-black text-white" onClick={() => onConfirm(address)} type="button">
          Confirm location
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: typeof UserRound; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6fffb] text-[#0f766e]">
        <Icon size={20} />
      </span>
      <h2 className="text-xl font-black text-[#10252b]">{label}</h2>
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
  name
}: {
  accept?: string;
  cameraCapture?: "user" | "environment";
  cameraName: string;
  complete: boolean;
  icon: typeof UserRound;
  label: string;
  name: string;
}) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [cameraFile, setCameraFile] = useState<File | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const selectedFile = uploadFile || cameraFile;

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  return (
    <div style={{ borderRadius: 10, border: "0.5px solid #e2e8f0", background: "#ffffff", padding: "12px 14px", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Icon size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        </div>
        {complete || selectedFile ? (
          <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 500, flexShrink: 0 }}>
            {"✓ "}
            {selectedFile?.name || "Uploaded"}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "#d97706", flexShrink: 0 }}>Required</span>
        )}
      </div>

      {selectedFile ? (
        <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedFile.name} selected
        </p>
      ) : null}

      {!complete ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 12px",
                borderRadius: 7,
                cursor: "pointer",
                border: "0.5px solid #cbd5e1",
                background: "#ffffff",
                fontSize: 12,
                fontWeight: 500,
                color: "#334155"
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload file
              <input
                accept={accept}
                className="sr-only"
                name={name}
                onChange={(event) => {
                  setUploadFile(event.target.files?.[0] ?? null);
                  if (event.target.files?.[0]) setCameraFile(null);
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
                padding: "8px 12px",
                borderRadius: 7,
                cursor: "pointer",
                border: "0.5px solid var(--primary)",
                background: "var(--primary-light)",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--primary)"
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Take photo
              <input
                accept="image/*"
                capture={cameraCapture}
                className="sr-only"
                name={cameraName}
                onChange={(event) => {
                  setCameraFile(event.target.files?.[0] ?? null);
                  if (event.target.files?.[0]) setUploadFile(null);
                }}
                type="file"
              />
            </label>
          </div>
          {!isMobile ? (
            <p style={{ fontSize: 10, color: "#94a3b8", margin: "4px 0 0", textAlign: "center" }}>
              On mobile, "Take photo" opens your camera directly
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
            border: "0.5px solid #e2e8f0",
            background: "#f8fafc",
            fontSize: 11,
            fontWeight: 500,
            color: "#64748b"
          }}
        >
          Replace document
          <input
            accept={accept}
            className="sr-only"
            name={name}
            onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
      )}
    </div>
  );
}
