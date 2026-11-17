import { notFound } from "next/navigation";
import { ACCOUNTS_ENABLED } from "@/lib/supabase/client";
import ProjectEditor from "@/components/studio/ProjectEditor";

export const metadata = { title: "Studio", robots: { index: false, follow: false } };

export default async function EditProjectPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  // Accounts and community ship switched off (NEXT_PUBLIC_FEATURE_ACCOUNTS).
  if (!ACCOUNTS_ENABLED) notFound();
  return <ProjectEditor id={params.id} />;
}
