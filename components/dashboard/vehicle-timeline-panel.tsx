"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, SectionHeader } from "@/components/ui";
import type { TimelineEvent } from "@/lib/types";

const collapsedLimit = 5;
const expandedLimit = 10;
const recentWindowDays = 7;

function parseEventDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinRecentWindow(event: TimelineEvent) {
  const eventDate = parseEventDate(event.date);
  if (!eventDate) {
    return true;
  }

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - recentWindowDays);
  windowStart.setHours(0, 0, 0, 0);

  return eventDate >= windowStart && eventDate <= now;
}

export function VehicleTimelinePanel({ timeline }: { timeline: TimelineEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  const recentEvents = useMemo(() => {
    const filtered = timeline.filter(isWithinRecentWindow);
    return filtered.length > 0 ? filtered : timeline.slice(0, collapsedLimit);
  }, [timeline]);
  const visibleEvents = expanded ? timeline.slice(0, expandedLimit) : recentEvents.slice(0, collapsedLimit);
  const canExpand = timeline.length > collapsedLimit;

  return (
    <Card>
      <SectionHeader eyebrow="Vehicle timeline" title="Operational history" />
      <div className="mt-4 space-y-3">
        {visibleEvents.map((event) => (
          <div className="border-l-2 border-[var(--primary)] pl-3" key={event.id}>
            <p className="font-semibold text-[var(--foreground)]">{event.title}</p>
            <p className="text-sm text-[var(--muted)]">
              {event.vehicle} · {event.date}
            </p>
            <p className="mt-1 text-sm text-[var(--foreground-secondary)]">{event.detail}</p>
          </div>
        ))}
      </div>
      {canExpand ? (
        <div className="mt-4 grid min-h-[48px] grid-cols-[1fr_auto_1fr] items-center border-t border-[var(--border)] pt-3">
          <p className="text-sm font-medium text-[var(--muted)]">
            Showing {visibleEvents.length} of {Math.min(timeline.length, expandedLimit)} events
          </p>
          <button
            aria-label={expanded ? "Collapse timeline" : "Expand timeline"}
            className="pressable inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--primary-light)] text-[var(--primary)] shadow-sm"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {expanded ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
          </button>
          <span aria-hidden="true" />
        </div>
      ) : null}
    </Card>
  );
}
