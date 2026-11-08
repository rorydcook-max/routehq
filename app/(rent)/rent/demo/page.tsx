import type { Route } from "next";
import { redirect } from "next/navigation";

/** /rent/demo on its own: the examples live on the website's Booking pages page (proxy.ts sends it to rovehq.io). */
export default function BookingDemosIndex() {
  redirect("/booking-pages" as Route);
}
