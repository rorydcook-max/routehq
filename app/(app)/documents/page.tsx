import type { Route } from "next";
import { permanentRedirect } from "next/navigation";

/** Documents moved to Settings › Business › Files (Rory, 7 Nov 2026); old links and bookmarks land there. */
export default function DocumentsPage() {
  permanentRedirect("/settings/files" as Route);
}
