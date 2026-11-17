// The site navigation for the search, builder and account pages, with the
// builder's kit and AI controls. Editor routes keep their own toolbars.

import SiteNav from "./SiteNav";
import AiStatusButton from "@/components/ai/AiStatusButton";
import AccountButton from "@/components/auth/AccountButton";
import KitButton from "@/components/kit/KitButton";
import { getGalleryTabs } from "@/lib/gallery/sections";
import type { GallerySectionId } from "@/lib/gallery/types";

export default async function SiteHeader({ active = null, builder = false }: { active?: GallerySectionId | null; builder?: boolean }) {
  const tabs = await getGalleryTabs();
  return (
    <SiteNav
      tabs={tabs}
      active={active}
      sticky
      extra={
        <>
          <KitButton />
          {builder ? <AiStatusButton /> : null}
          <AccountButton />
        </>
      }
    />
  );
}
