/** The helpdesk's parts the browser may use too (no server imports here): tab names, row shapes, time labels. */

export const QUEUE_VIEWS = ["waiting", "mine", "unassigned", "answered", "closed", "ai"] as const;
export type QueueView = (typeof QUEUE_VIEWS)[number];

export const QUEUE_VIEW_LABEL: Record<QueueView, string> = {
  waiting: "Waiting",
  mine: "Mine",
  unassigned: "Unassigned",
  answered: "Answered",
  closed: "Closed",
  ai: "AI conversations"
};

/** What each tab is for, shown under the tabs so nobody has to guess. */
export const QUEUE_VIEW_NOTE: Record<QueueView, string> = {
  waiting: "Handed over to the team and waiting for a reply. High priority first, then longest waiting.",
  mine: "Assigned to you and not closed.",
  unassigned: "With the team, not closed, and nobody has picked it up yet.",
  answered: "The team replied; waiting on the customer.",
  closed: "Sorted. Reopen one if it comes back.",
  ai: "The assistant is still handling these (last 7 days). Read along and take over if it is going wrong."
};

export function isQueueView(value: unknown): value is QueueView {
  return (QUEUE_VIEWS as readonly string[]).includes(String(value));
}

export type QueueRow = {
  id: string;
  organizationId: string | null;
  businessName: string;
  visitorEmail: string | null;
  visitorName: string | null;
  subject: string;
  channel: "chat" | "help";
  mode: "ai" | "human";
  status: "open" | "answered" | "closed";
  priority: "normal" | "high";
  tags: string[];
  assignedTo: string | null;
  assigneeName: string | null;
  unread: boolean;
  lastMessageAt: string;
  preview: string;
  previewFrom: "customer" | "assistant" | "team" | "note" | null;
  /** When the customer's latest message arrived, if the team still owes them a reply. Drives "waiting time". */
  waitingSince: string | null;
};

export type HelpdeskCounts = { waiting: number; mine: number; unassigned: number; unread: number; ai: number };

export const STATUS_LABEL: Record<string, string> = { open: "Waiting for us", answered: "Answered", closed: "Closed" };

/** "4 min", "2 h 10 min", "3 days": how long someone has been waiting. */
export function waitingLabel(since: string | null, now = Date.now()) {
  if (!since) return "";
  const minutes = Math.max(0, Math.round((now - Date.parse(since)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}
