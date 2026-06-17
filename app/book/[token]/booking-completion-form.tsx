"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CheckCircle2, CreditCard, FileText, IdCard, ImageIcon, MessageCircle, PenLine, Upload, UserRound, XCircle } from "lucide-react";
import { completePublicBooking, reportPublicBookingPayment } from "@/app/actions/public-booking";

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
};

const inputClass =
  "mt-2 w-full rounded-xl border border-[#d6e5e2] bg-white px-4 py-3 text-base text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15";
const emojiSelectStyle = {
  fontFamily: '"Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", "Segoe UI", system-ui, sans-serif'
};

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
  return String(value || "").slice(0, 16);
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
  { flagCode: "th", code: "TH", callingCode: "+66" },
  { flagCode: "gb", code: "GB", callingCode: "+44" },
  { flagCode: "de", code: "DE", callingCode: "+49" },
  { flagCode: "fr", code: "FR", callingCode: "+33" },
  { flagCode: "ru", code: "RU", callingCode: "+7" },
  { flagCode: "cn", code: "CN", callingCode: "+86" },
  { flagCode: "jp", code: "JP", callingCode: "+81" },
  { flagCode: "us", code: "US", callingCode: "+1" },
  { flagCode: "au", code: "AU", callingCode: "+61" },
  { flagCode: "ch", code: "CH", callingCode: "+41" },
  { flagCode: "nl", code: "NL", callingCode: "+31" },
  { flagCode: "se", code: "SE", callingCode: "+46" },
  { flagCode: "il", code: "IL", callingCode: "+972" },
  { flagCode: "dk", code: "DK", callingCode: "+45" },
  { flagCode: "no", code: "NO", callingCode: "+47" },
  { flagCode: "fi", code: "FI", callingCode: "+358" },
  { flagCode: "id", code: "ID", callingCode: "+62" },
  { flagCode: "my", code: "MY", callingCode: "+60" },
  { flagCode: "sg", code: "SG", callingCode: "+65" },
  { flagCode: "vn", code: "VN", callingCode: "+84" },
  { flagCode: "ph", code: "PH", callingCode: "+63" },
  { flagCode: "kh", code: "KH", callingCode: "+855" },
  { flagCode: "la", code: "LA", callingCode: "+856" },
  { flagCode: "in", code: "IN", callingCode: "+91" }
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
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+66");
  const [emergencyPhoneCountryCode, setEmergencyPhoneCountryCode] = useState("+66");
  const [currentAddress, setCurrentAddress] = useState(String(detail.customer?.address || ""));
  const [contactChannelsSkipped, setContactChannelsSkipped] = useState(false);
  const [preferredDeliveryLocation, setPreferredDeliveryLocation] = useState(String(detail.bookingData.delivery_location || ""));
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
  const [isPending, startTransition] = useTransition();
  const [isPaymentReportPending, startPaymentReportTransition] = useTransition();
  const [paymentReported, setPaymentReported] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const minDateTime = new Date().toISOString().slice(0, 16);
  const operatorDeliveryDateTime = compactDateTime(detail.bookingData.delivery_datetime);
  const operatorDeliveryIsToday = isTodayDateTime(operatorDeliveryDateTime);
  const operatorDeliveryTimeLabel = timeLabelFromDateTime(operatorDeliveryDateTime);

  function updateLiveStatus(form: HTMLFormElement | null = formRef.current, nextAgreed?: boolean, nextSignature = signature) {
    if (!form) return;
    const formData = new FormData(form);
    const filled = (name: string) => String(formData.get(name) || "").trim().length > 0;
    const uploaded = (...names: string[]) =>
      names.some((name) => formData.getAll(name).some((value) => value instanceof File && value.size > 0));
    const acceptedAgreement = typeof nextAgreed === "boolean" ? nextAgreed : formData.get("agreementAccepted") === "on";
    setLiveStatus({
      details: detail.completion.details || ["fullName", "nationality", "phone", "dateOfBirth"].every(filled),
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

    if (!agreed) {
      setError("Please confirm that you have read and agree to the rental terms.");
      return;
    }
    if (!signature) {
      setError("Please sign the agreement before submitting.");
      return;
    }

    const form = event.currentTarget;
    startTransition(async () => {
      try {
        const formData = new FormData(form);
        formData.set("signature", signature);
        const result = await completePublicBooking(formData);
        setSignedContractUrl(result.signedContractUrl || null);
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
        <h2 className="mt-4 text-2xl font-black text-[#10252b]">You're all set, {detail.customer?.full_name || "there"}.</h2>
        <p className="mt-2 text-sm leading-6 text-[#667085]">Your booking details, documents, and signed agreement have been received. {detail.organizationName} will contact you to confirm delivery time and answer any questions.</p>
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
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-sm font-bold text-[#344054]">Full name</span>
            <input className={inputClass} defaultValue={detail.customer?.full_name || ""} name="fullName" required />
          </label>
          <label>
            <span className="text-sm font-bold text-[#344054]">Nationality</span>
            <NationalitySelect defaultValue={String(detail.customer?.nationality || "")} name="nationality" />
          </label>
          <label>
            <span className="text-sm font-bold text-[#344054]">Phone</span>
            <div className="grid grid-cols-[108px_1fr] gap-2">
              <PhoneCountrySelect name="phoneCountryCode" onChange={setPhoneCountryCode} value={phoneCountryCode} />
              <input className={inputClass} defaultValue={detail.customer?.phone || ""} name="phone" required type="tel" />
            </div>
          </label>
          <label>
            <span className="text-sm font-bold text-[#344054]">Email</span>
            <input className={inputClass} defaultValue={detail.customer?.email || ""} name="email" type="email" />
          </label>
          <label>
            <span className="text-sm font-bold text-[#344054]">Date of birth</span>
            <input className={inputClass} defaultValue={detail.customer?.date_of_birth || ""} name="dateOfBirth" required style={{ textTransform: "uppercase" }} type="date" />
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
            <input className={inputClass} defaultValue={detail.customer?.emergency_contact_name || ""} name="emergencyContactName" />
          </label>
          <label>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-[#344054]">
              Emergency contact phone
              <span className="cursor-help text-[#667085]" title="Optional — add an emergency contact phone number if available.">ⓘ</span>
            </span>
            <div className="grid grid-cols-[108px_1fr] gap-2">
              <PhoneCountrySelect name="emergencyPhoneCountryCode" onChange={setEmergencyPhoneCountryCode} value={emergencyPhoneCountryCode} />
              <input className={inputClass} defaultValue={detail.customer?.emergency_contact_phone || ""} name="emergencyContactPhone" type="tel" />
            </div>
          </label>
        </div>
      </section>

      {!contactChannelsSkipped ? (
        <section className="rounded-2xl border border-[#d6e5e2] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <SectionTitle icon={MessageCircle} label="How should we contact you?" />
              <p className="mt-2 text-sm leading-6 text-[#667085]">We'll send reminders and updates to your preferred channel.</p>
            </div>
            <button className="pressable self-start rounded-xl border border-[#d6e5e2] bg-white px-3 py-2 text-xs font-black text-[#667085]" onClick={() => setContactChannelsSkipped(true)} type="button">
              Skip this step
            </button>
          </div>
          <input name="contactChannelsSubmitted" type="hidden" value="true" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-bold text-[#344054]">WhatsApp number</span>
              <input className={inputClass} defaultValue={detail.customer?.whatsapp_number || ""} name="whatsappNumber" placeholder="+66812345678 or your number with country code" type="tel" />
            </label>
            <label>
              <span className="text-sm font-bold text-[#344054]">Facebook Messenger</span>
              <input className={inputClass} defaultValue={detail.customer?.messenger_id || ""} name="messengerId" placeholder="messenger.com/username or full profile URL" />
            </label>
            <label>
              <span className="text-sm font-bold text-[#344054]">LINE ID</span>
              <input className={inputClass} defaultValue={detail.customer?.line_id || ""} name="lineId" placeholder="@lineusername" />
            </label>
            <label>
              <span className="text-sm font-bold text-[#344054]">Telegram</span>
              <input className={inputClass} defaultValue={detail.customer?.telegram_username || ""} name="telegramUsername" placeholder="@telegramusername" />
            </label>
            <label className="opacity-85">
              <span className="text-sm font-bold text-[#344054]">Instagram</span>
              <input className={inputClass} defaultValue={detail.customer?.instagram_handle || ""} name="instagramHandle" placeholder="@instagramhandle" />
              <span className="mt-1 block text-xs text-[#667085]">Optional</span>
            </label>
            <label>
              <span className="text-sm font-bold text-[#344054]">Preferred contact method</span>
              <select className={inputClass} defaultValue={defaultContactMethod(detail.customer)} name="preferredContactMethod">
                {CONTACT_METHODS.map((method) => (
                  <option key={`public-contact-${method.value}`} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-[#d6e5e2] bg-white p-4 text-sm text-[#667085]">
          Contact preferences skipped.{" "}
          <button className="font-black text-[#0f766e]" onClick={() => setContactChannelsSkipped(false)} type="button">
            Add contact channels
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-[#d6e5e2] bg-white p-5 shadow-sm">
        <SectionTitle icon={Upload} label="Documents" />
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
              <input className={inputClass} defaultValue={operatorDeliveryDateTime} min={minDateTime} name="preferredDeliveryDateTime" type="datetime-local" />
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
      <section className="rounded-2xl border border-[#d6e5e2] bg-white p-5 shadow-sm">
        <SectionTitle icon={PenLine} label="Rental Agreement" />
        <div className="contract-preview mt-4 max-h-[460px] overflow-y-auto rounded-xl border border-[#d6e5e2] bg-[#fbfefd] p-4 text-sm leading-7 text-[#344054]" dangerouslySetInnerHTML={{ __html: detail.contractHtml }} />
        <label className="checkbox-label mt-4 rounded-xl border border-[#d6e5e2] bg-white p-3 font-bold text-[#10252b]">
          <input
            checked={agreed}
            className="flex-shrink-0"
            name="agreementAccepted"
            onChange={(event) => {
              setAgreed(event.target.checked);
              updateLiveStatus(undefined, event.target.checked, signature);
            }}
            type="checkbox"
          />
          <span>I have read and agree to the rental terms and conditions.</span>
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-bold text-[#344054]">Full name for signature</span>
          <input className={inputClass} defaultValue={detail.customer?.full_name || ""} name="signedName" required />
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
        {error ? <p className="mt-4 rounded-xl bg-[#ffe4e6] p-3 text-sm font-bold text-[#be123c]">{error}</p> : null}
        <button className="pressable mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-black text-white disabled:opacity-70" disabled={isPending} type="submit">
          {isPending ? <span className="inline-flex items-center gap-2"><span className="spinner" /> Submitting...</span> : "Complete booking and sign agreement"}
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
  const selected = phoneCountrySvgOptions.find((country) => country.callingCode === value) || phoneCountrySvgOptions[0];

  return (
    <div className="relative mt-2">
      <input name={name} type="hidden" value={selected.callingCode} />
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#d6e5e2] bg-white px-3 py-3 text-left text-sm font-bold text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2">
          <FlagSvg code={selected.flagCode} label={selected.code} />
          <span className="truncate">{selected.callingCode}</span>
        </span>
        <span className="text-[#667085]">⌄</span>
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-y-auto rounded-xl border border-[#d6e5e2] bg-white p-1 shadow-xl">
          {phoneCountrySvgOptions.map((country) => (
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-[#10252b] hover:bg-[#e6fffb]"
              key={`${name}-${country.callingCode}-${country.code}`}
              onClick={() => {
                onChange(country.callingCode);
                setOpen(false);
              }}
              type="button"
            >
              <FlagSvg code={country.flagCode} label={country.code} />
              <span>{country.code} | {country.callingCode}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
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
