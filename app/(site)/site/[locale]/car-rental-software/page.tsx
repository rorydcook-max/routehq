import type { SiteParams } from "@/lib/site/static-page";
import { SegmentPage, segmentMetadata } from "../_components/segment-page";

/** /car-rental-software (and /th/car-rental-software …): RoveHQ for car rental businesses (lib/site/segments.ts). */
export function generateMetadata({ params }: SiteParams) {
  return segmentMetadata("car", params);
}

export default function CarRentalSoftwarePage({ params }: SiteParams) {
  return <SegmentPage id="car" params={params} />;
}
