"use client";

/**
 * Files sent in the live chat, carried to the screen that deals with them (same page load, so nothing is uploaded
 * twice): vehicle photos and documents to the fleet assistant, a spreadsheet to Import. Receipts use the existing
 * hand-over in components/receipt-handoff.ts. Each screen takes its files once, when it opens.
 */
type Kind = "photos" | "sheet";
const pending: Record<Kind, File[]> = { photos: [], sheet: [] };

export function handFiles(kind: Kind, files: File[]) {
  pending[kind] = files.slice();
}

export function takeHandedFiles(kind: Kind): File[] {
  const files = pending[kind];
  pending[kind] = [];
  return files;
}
