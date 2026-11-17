import { notFound } from "next/navigation";
import { ACCOUNTS_ENABLED } from "@/lib/supabase/client";
import type { Metadata } from "next";
import SiteHeader from "@/components/site/SiteHeader";
import StudioHome from "@/components/studio/StudioHome";

export const metadata: Metadata = {
  title: "My studio",
  robots: { index: false, follow: false },
};

export default function MePage() {
  // Accounts and community ship switched off (NEXT_PUBLIC_FEATURE_ACCOUNTS).
  if (!ACCOUNTS_ENABLED) notFound();
  return (
    <div className="min-h-screen font-sans text-ink">
      <SiteHeader />
      <StudioHome />
    </div>
  );
}
