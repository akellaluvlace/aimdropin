"use client";

import { useEffect, useState } from "react";
import { KIT_EVENT, KIT_STORAGE_KEY, loadKit, type KitItem } from "./kit-store";

export function useKit(): { kit: KitItem[]; ready: boolean } {
  const [kit, setKit] = useState<KitItem[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const refresh = () => setKit(loadKit());
    refresh();
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === KIT_STORAGE_KEY) refresh();
    };
    window.addEventListener(KIT_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(KIT_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return { kit, ready };
}
