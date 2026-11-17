"use client";

// Live preview for React registry items (shadcn-style), via the in-browser
// runtime in lib/registry-preview. About 9 in 10 items render; for the rest
// (Astro components, components that need props or a parent, missing files)
// we say so and point at the code tab and install command, which always work.

import { useState } from "react";
import RegistryPreview from "@/components/registry-preview/RegistryPreview";

export default function RegistryPreviewSlot({
  installUrl,
  dark,
  title,
}: {
  installUrl: string;
  dark: boolean;
  title: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-display text-2xl">No live preview for this one.</p>
        <p className="max-w-md text-sm text-ink/60">
          {failed} The code tab and the install command above still work.
        </p>
      </div>
    );
  }

  return (
    <RegistryPreview
      key={`${installUrl}:${dark ? "dark" : "light"}`}
      installUrl={installUrl}
      title={`Preview: ${title}`}
      theme={dark ? "dark" : "light"}
      height="100%"
      className="h-full w-full"
      onStatus={(status, message) => {
        if (status === "error") {
          setFailed(
            message
              ? `It needs something the previewer can't provide (${message.slice(0, 140)}).`
              : "It needs something the previewer can't provide.",
          );
        }
      }}
    />
  );
}
