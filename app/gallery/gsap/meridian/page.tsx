import MeridianRoute from "@/components/gsap/meridian/MeridianRoute";
import { gsapSiteMeta } from "@/lib/gsap/meta";

// Meridian: a concept for delivery tracking software.
export const metadata = gsapSiteMeta({
  slug: "meridian",
  title: "Meridian, a concept for delivery tracking",
  description:
    "A concept for delivery tracking software that does not exist: one parcel looked up among 41,207, and a map that follows it from the whole earth to a door.",
});

export default function MeridianPage() {
  return <MeridianRoute />;
}
