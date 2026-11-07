import type { SiteParams } from "@/lib/site/static-page";
import { SegmentPage, segmentMetadata } from "../_components/segment-page";

/** /motorcycle-rental-software (and /th/motorcycle-rental-software …): RoveHQ for motorcycle rentals (lib/site/segments.ts). */
export function generateMetadata({ params }: SiteParams) {
  return segmentMetadata("motorcycle", params);
}

export default function MotorcycleRentalSoftwarePage({ params }: SiteParams) {
  return <SegmentPage id="motorcycle" params={params} />;
}
