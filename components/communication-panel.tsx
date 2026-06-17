"use client";

import { useMemo, useState, useTransition } from "react";
import { AtSign, Copy, Instagram, Mail, MessageCircle, Phone, Send, Smartphone, StickyNote } from "lucide-react";
import { addCommunicationNote } from "@/app/actions/communication";
import { Badge } from "@/components/ui";

type Customer = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp_number?: string | null;
  messenger_id?: string | null;
  line_id?: string | null;
  telegram_username?: string | null;
  instagram_handle?: string | null;
  preferred_contact_method?: string | null;
};

type Booking = {
  vehicle_id?: string | null;
  vehicle_make_model?: string | null;
  vehicle_plate?: string | null;
  rental_status?: string | null;
  end_date?: string | null;
  outstanding_balance?: number | null;
  deposit_held?: number | null;
};

type ChannelKey = "whatsapp" | "messenger" | "line" | "telegram" | "phone" | "email" | "instagram";

type Channel = {
  key: ChannelKey;
  label: string;
  handle: string;
  icon: React.ReactNode;
};

export function CommunicationPanel({
  customer,
  booking,
  rentalId,
  organisationId,
  businessName = "RouteHQ",
  bookingPortalUrl,
  customerId,
  revalidatePathname
}: {
  customer: Customer;
  booking: Booking;
  rentalId: string;
  organisationId: string;
  businessName?: string;
  bookingPortalUrl?: string | null;
  customerId?: string | null;
  revalidatePathname?: string;
}) {
  const [activePopover, setActivePopover] = useState<"whatsapp" | "line" | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [note, setNote] = useState("");
  const [toast, setToast] = useState("");
  const [isPending, startTransition] = useTransition();

  const channels = useMemo(() => buildChannels(customer), [customer]);
  const returnTone = returnDateTone(booking.end_date);
  const returnLabel = booking.end_date ? formatDate(booking.end_date) : "Open ended";
  const outstanding = Number(booking.outstanding_balance || 0);
  const depositHeld = Number(booking.deposit_held || 0);
  const preferred = customer.preferred_contact_method;
  const paymentTemplate = `Hi ${customer.name || "there"}, this is a reminder that your rental payment of ${formatMoney(outstanding)} is due. Please send payment at your earliest convenience. Thank you, ${businessName}`;
  const returnTemplate = `Hi ${customer.name || "there"}, just a reminder that your ${booking.vehicle_make_model || "vehicle"} rental is due for return on ${returnLabel}. Please confirm you are able to return on this date. Thank you, ${businessName}`;
  const defaultTemplate = outstanding > 0 ? paymentTemplate : returnTemplate;

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }

  function portalLink() {
    if (!bookingPortalUrl) return window.location.href;
    if (/^https?:\/\//.test(bookingPortalUrl)) return bookingPortalUrl;
    return `${window.location.origin}${bookingPortalUrl.startsWith("/") ? "" : "/"}${bookingPortalUrl}`;
  }

  async function openExternal(channel: Channel) {
    if (channel.key === "whatsapp" || channel.key === "line") {
      setActivePopover(activePopover === channel.key ? null : channel.key);
      return;
    }

    if (channel.key === "messenger" || channel.key === "telegram") {
      await copyText(defaultTemplate);
      showToast(`Opening ${channel.label} - your message has been copied to clipboard`);
    }

    const url = channelUrl(channel);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  function openTemplate(channel: "whatsapp" | "line", text: string) {
    const url = channel === "whatsapp" ? whatsappUrl(customer.whatsapp_number || customer.phone || "", text) : lineTextUrl(text);
    window.open(url, "_blank", "noopener,noreferrer");
    setActivePopover(null);
  }

  function saveNote() {
    const trimmed = note.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("organizationId", organisationId);
      formData.set("content", trimmed);
      if (rentalId) formData.set("rentalId", rentalId);
      if (customerId || customer.id) formData.set("customerId", customerId || customer.id || "");
      if (booking.vehicle_id) formData.set("vehicleId", booking.vehicle_id);
      if (revalidatePathname) formData.set("revalidatePathname", revalidatePathname);
      await addCommunicationNote(formData);
      setNote("");
      showToast("Note saved");
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Vehicle</p>
            <p className="font-semibold text-[var(--foreground)]">
              {booking.vehicle_make_model || "Vehicle not set"} {booking.vehicle_plate ? <span className="font-mono-data text-[var(--muted)]">· {booking.vehicle_plate}</span> : null}
            </p>
          </div>
          <Badge tone={statusTone(booking.rental_status)}>{formatStatus(booking.rental_status)}</Badge>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <SummaryItem label="Return" tone={returnTone} value={returnLabel} />
          <SummaryItem label="Outstanding" tone={outstanding > 0 ? "red" : "green"} value={outstanding > 0 ? formatMoney(outstanding) : "No balance"} />
          <SummaryItem label="Deposit held" tone={depositHeld > 0 ? "amber" : "neutral"} value={depositHeld > 0 ? formatMoney(depositHeld) : "None"} />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          {channels.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No contact channels recorded yet.</p>
          ) : (
            channels.map((channel) => (
              <div className="relative" key={channel.key}>
                <button
                  aria-label={channel.label}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border bg-[var(--panel-secondary)] text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] ${
                    preferred === channel.key ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/25" : "border-[var(--border)]"
                  }`}
                  onClick={() => openExternal(channel)}
                  title={`${channel.label}: ${channel.handle}`}
                  type="button"
                >
                  {channel.icon}
                </button>
                {(activePopover === "whatsapp" && channel.key === "whatsapp") || (activePopover === "line" && channel.key === "line") ? (
                  <TemplatePopover
                    channel={channel.label}
                    customMessage={customMessage}
                    onCopyPortal={async () => {
                      await copyText(portalLink());
                      showToast("Link copied - paste into your message");
                      setActivePopover(null);
                    }}
                    onCustomChange={setCustomMessage}
                    onOpen={(text) => openTemplate(channel.key as "whatsapp" | "line", text)}
                    paymentTemplate={paymentTemplate}
                    returnTemplate={returnTemplate}
                  />
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3">
        <label className="flex gap-2">
          <span className="mt-2 text-[var(--primary)]">
            <StickyNote size={16} />
          </span>
          <input
            className="min-h-10 flex-1 rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") saveNote();
            }}
            placeholder="Add a note..."
            value={note}
          />
          <button className="btn-primary min-h-10" disabled={isPending || !note.trim()} onClick={saveNote} type="button">
            {isPending ? "Saving..." : "Save"}
          </button>
        </label>
      </div>

      {toast ? <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white shadow-lg">{toast}</div> : null}
    </div>
  );
}

function SummaryItem({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "red" | "neutral" }) {
  const tones = {
    green: "text-[var(--success)]",
    amber: "text-[var(--warning)]",
    red: "text-[var(--danger)]",
    neutral: "text-[var(--muted)]"
  };
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className={`font-mono-data mt-1 text-sm font-black ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function TemplatePopover({
  channel,
  paymentTemplate,
  returnTemplate,
  customMessage,
  onCustomChange,
  onOpen,
  onCopyPortal
}: {
  channel: string;
  paymentTemplate: string;
  returnTemplate: string;
  customMessage: string;
  onCustomChange: (value: string) => void;
  onOpen: (text: string) => void;
  onCopyPortal: () => void;
}) {
  return (
    <div className="absolute left-0 top-12 z-30 w-[min(320px,calc(100vw-48px))] rounded-xl border border-[var(--border)] bg-white p-3 shadow-xl">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--primary)]">{channel} message</p>
      <div className="mt-2 space-y-2">
        <button className="secondary-action w-full justify-start px-3 py-2 text-left" onClick={() => onOpen(paymentTemplate)} type="button">
          Payment reminder
        </button>
        <button className="secondary-action w-full justify-start px-3 py-2 text-left" onClick={() => onOpen(returnTemplate)} type="button">
          Return reminder
        </button>
        <div>
          <textarea
            className="min-h-20 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
            onChange={(event) => onCustomChange(event.target.value)}
            placeholder="Custom message"
            value={customMessage}
          />
          <button className="primary-action mt-2 w-full justify-center px-3 py-2" disabled={!customMessage.trim()} onClick={() => onOpen(customMessage)} type="button">
            Open in {channel}
          </button>
        </div>
        <button className="secondary-action w-full justify-start px-3 py-2 text-left" onClick={onCopyPortal} type="button">
          <Copy size={15} />
          Share booking portal
        </button>
      </div>
    </div>
  );
}

function buildChannels(customer: Customer): Channel[] {
  const channels: Channel[] = [];
  if (customer.whatsapp_number) channels.push({ key: "whatsapp", label: "WhatsApp", handle: customer.whatsapp_number, icon: <MessageCircle size={18} /> });
  if (customer.messenger_id) channels.push({ key: "messenger", label: "Messenger", handle: customer.messenger_id, icon: <Send size={18} /> });
  if (customer.line_id) channels.push({ key: "line", label: "LINE", handle: customer.line_id, icon: <MessageCircle size={18} /> });
  if (customer.telegram_username) channels.push({ key: "telegram", label: "Telegram", handle: customer.telegram_username, icon: <Send size={18} /> });
  if (customer.phone) channels.push({ key: "phone", label: "Phone", handle: customer.phone, icon: <Phone size={18} /> });
  if (customer.email) channels.push({ key: "email", label: "Email", handle: customer.email, icon: <Mail size={18} /> });
  if (customer.instagram_handle) channels.push({ key: "instagram", label: "Instagram", handle: customer.instagram_handle, icon: <Instagram size={18} /> });
  return channels;
}

function channelUrl(channel: Channel) {
  if (channel.key === "messenger") return `https://m.me/${cleanHandle(channel.handle)}`;
  if (channel.key === "telegram") return `https://t.me/${cleanHandle(channel.handle)}`;
  if (channel.key === "phone") return `tel:${channel.handle}`;
  if (channel.key === "email") return `mailto:${channel.handle}`;
  if (channel.key === "instagram") return `https://instagram.com/${cleanHandle(channel.handle)}`;
  if (channel.key === "line") return `https://line.me/ti/p/${encodeURIComponent(channel.handle)}`;
  return null;
}

function cleanHandle(value: string) {
  return value.replace(/^https?:\/\/(www\.)?/i, "").replace(/^m\.me\//i, "").replace(/^t\.me\//i, "").replace(/^instagram\.com\//i, "").replace(/^@/, "").trim();
}

function whatsappUrl(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function lineTextUrl(text: string) {
  return `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value: string) {
  return value.includes("T") ? value.slice(0, 10) : value;
}

function returnDateTone(value: string | null | undefined): "green" | "amber" | "red" | "neutral" {
  if (!value) return "neutral";
  const today = new Date();
  const target = new Date(value);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const days = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "red";
  if (days <= 3) return "amber";
  return "neutral";
}

function statusTone(status?: string | null): "neutral" | "green" | "amber" | "red" | "blue" {
  if (status === "completed") return "green";
  if (status === "booked") return "amber";
  if (status === "overdue" || status === "cancelled") return "red";
  if (status === "active" || status === "due_soon" || status === "extended") return "blue";
  return "neutral";
}

function formatStatus(status?: string | null) {
  return status ? status.replace(/_/g, " ") : "No status";
}
