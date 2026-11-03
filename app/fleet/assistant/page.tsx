import { redirect } from "next/navigation";

/**
 * The fleet assistant is part of the live chat now (Rory, 3 Nov 2026: "Why can we not just have one assistant?"):
 * vehicle and paperwork photos, "add a 2022 Honda Click", who's renting now, all in the chat. Old links and bookmarks
 * land on Fleet with the chat open, ready for photos (?chat=photos, read by components/chat/chat-launcher.tsx).
 * Setup (app/onboarding) still shows the full-page assistant, components/fleet-assistant.tsx.
 */
export default function FleetAssistantPage() {
  redirect("/fleet?chat=photos");
}
