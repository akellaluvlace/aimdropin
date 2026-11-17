import type { Metadata } from "next";
import DraftEditor from "@/components/builder/DraftEditor";

export const metadata: Metadata = {
  title: "Edit your build",
  robots: { index: false, follow: false },
};

export default async function DraftEditPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <DraftEditor id={params.id} />;
}
