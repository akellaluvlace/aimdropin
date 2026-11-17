import DatumRoute from "@/components/gsap/datum/DatumRoute";
import { gsapSiteMeta } from "@/lib/gsap/meta";

// Datum: a concept site for an architecture practice that does not exist.
export const metadata = gsapSiteMeta({
  slug: "datum",
  title: "Datum, a concept architecture practice",
  description:
    "A concept site for an architecture practice that does not exist: one level line across the sheet, and a drawing that becomes the building standing on it.",
});

export default function DatumPage() {
  return <DatumRoute />;
}
