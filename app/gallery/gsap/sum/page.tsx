import SumRoute from "@/components/gsap/sum/SumRoute";
import { gsapSiteMeta } from "@/lib/gsap/meta";

// Sum: a concept shop for a watch brand that does not exist. It sells one
// watch, by taking it apart into its parts and putting it back. The count in
// the description is the page's own (`total` in content.ts);
// scripts/gsap/verify-sum.mjs holds the two together.
export const metadata = gsapSiteMeta({
  slug: "sum",
  title: "Sum, a concept shop for one watch",
  description: "A concept shop for a watch brand that does not exist: one watch, taken apart into its 147 parts and put back.",
});

export default function SumPage() {
  return <SumRoute />;
}
