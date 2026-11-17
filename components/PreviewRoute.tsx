"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import PreviewModal from "./PreviewModal";
import type { FullscreenTarget } from "@/components/fullscreen/FullscreenBar";
import { exitBrowserFullscreen, previousPageIsHere } from "@/lib/fullscreen";
import type { PreviewKind } from "@/lib/preview";

interface PreviewRouteProps {
  code: string;
  kind: PreviewKind;
  filename?: string;
  steps?: { prev?: FullscreenTarget | null; next?: FullscreenTarget | null } | null;
}

// Thin client wrapper that hosts <PreviewModal> as a full page (the
// /preview/[slug] route uses this). Close goes back to whatever launched
// the preview - gallery, landing carousel, or a deep link's referrer.
// Falls back to /gallery when the page before isn't on this site (a
// shared link, a fresh tab).
export default function PreviewRoute({
  code,
  kind,
  filename,
  steps = null,
}: PreviewRouteProps) {
  const router = useRouter();

  const handleClose = useCallback(() => {
    exitBrowserFullscreen();
    if (previousPageIsHere()) {
      router.back();
    } else {
      router.push("/gallery");
    }
  }, [router]);

  return (
    <PreviewModal
      code={code}
      kind={kind}
      filename={filename}
      onClose={handleClose}
      lockBodyScroll={false}
      closeLabel="Close · Esc"
      publicPreviewMode
      steps={steps}
    />
  );
}
