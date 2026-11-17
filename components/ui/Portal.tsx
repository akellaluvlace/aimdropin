"use client";

// Renders children at the end of <body>. Dialogs opened from the sticky site
// header need this: the header's backdrop-filter makes it the containing
// block for position:fixed descendants, so an in-place overlay would be
// sized to the header instead of the viewport.

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
