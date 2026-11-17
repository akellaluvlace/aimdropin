"use client";

import Link from "next/link";
import FullscreenIcon from "./FullscreenIcon";
import { enterBrowserFullscreen } from "@/lib/fullscreen";

// Every way into a full-screen view: same label and icon everywhere, and the
// click also asks the browser for real full screen where that's allowed.
export default function FullscreenLink({
  href,
  className = "btn btn-ink h-10 py-0",
  label = "Full screen",
  iconOnly = false,
  ariaLabel,
  tabIndex,
  iconClassName,
  prefetch,
}: {
  href: string;
  className?: string;
  label?: string;
  iconOnly?: boolean;
  ariaLabel?: string;
  tabIndex?: number;
  iconClassName?: string;
  // Passed to the link as is. Left out, the link prefetches as usual.
  prefetch?: boolean | null;
}) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={className}
      aria-label={ariaLabel ?? (iconOnly ? label : undefined)}
      title={iconOnly ? ariaLabel ?? label : undefined}
      tabIndex={tabIndex}
      onClick={(e) => enterBrowserFullscreen(e)}
    >
      <FullscreenIcon className={iconClassName} />
      {iconOnly ? null : <span>{label}</span>}
    </Link>
  );
}
