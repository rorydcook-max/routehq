import { GuidesIndex, guidesMetadata } from "./guides-index";

export function generateMetadata() {
  return guidesMetadata(null);
}

/** /guides (and /th/guides …): every guide in the visitor's language. */
export default function GuidesPage() {
  return <GuidesIndex category={null} />;
}
