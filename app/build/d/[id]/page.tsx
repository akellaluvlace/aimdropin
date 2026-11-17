import type { Metadata } from "next";
import SiteHeader from "@/components/site/SiteHeader";
import DraftView from "@/components/builder/DraftView";

export const metadata: Metadata = {
  title: "Your build",
  robots: { index: false, follow: false },
};

export default async function DraftPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <div className="min-h-screen font-sans text-ink">
      <SiteHeader builder />
      <DraftView id={params.id} />
    </div>
  );
}
