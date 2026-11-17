"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

// A link that prefetches its page only after a sign of interest: the pointer,
// a touch or keyboard focus. A plain <Link> prefetches as soon as it is on
// screen, which here meant every page view downloaded the playground's editor
// code (about 430 KB) and asked the server for a dozen pages nobody opened.
export default function IntentLink({ onPointerEnter, onTouchStart, onFocus, ...props }: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...props}
      prefetch={intent ? null : false}
      onPointerEnter={(e) => {
        setIntent(true);
        onPointerEnter?.(e);
      }}
      onTouchStart={(e) => {
        setIntent(true);
        onTouchStart?.(e);
      }}
      onFocus={(e) => {
        setIntent(true);
        onFocus?.(e);
      }}
    />
  );
}
