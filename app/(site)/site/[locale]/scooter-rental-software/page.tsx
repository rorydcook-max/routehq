import type { SiteParams } from "@/lib/site/static-page";
import { SegmentPage, segmentMetadata } from "../_components/segment-page";

/** /scooter-rental-software (and /th/scooter-rental-software …): RoveHQ for scooter rental shops (lib/site/segments.ts). */
export function generateMetadata({ params }: SiteParams) {
  return segmentMetadata("scooter", params);
}

export default function ScooterRentalSoftwarePage({ params }: SiteParams) {
  return <SegmentPage id="scooter" params={params} />;
}
