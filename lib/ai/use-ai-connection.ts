"use client";

// React view of the stored AI connection. Re-reads on our own change event
// (same tab) and on `storage` (other tabs connecting / disconnecting).

import { useEffect, useState } from "react";
import {
  AI_CONNECTION_EVENT,
  AI_CONNECTION_STORAGE_KEY,
  loadConnection,
  type AiConnection,
} from "./connection-store";

export function useAiConnection(): {
  connection: AiConnection | null;
  // false until the first client-side read, so SSR markup and the first
  // client render agree and buttons don't flash "Connect" for connected users.
  ready: boolean;
} {
  const [connection, setConnection] = useState<AiConnection | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refresh = () => setConnection(loadConnection());
    refresh();
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === AI_CONNECTION_STORAGE_KEY) refresh();
    };
    window.addEventListener(AI_CONNECTION_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(AI_CONNECTION_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { connection, ready };
}
