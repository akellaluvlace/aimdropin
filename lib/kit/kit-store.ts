// The kit: what the user has picked from the library to build a page from.
// Lives in localStorage (per browser) so it survives navigation between the
// library and the builder. Each entry can carry a short note: where it goes,
// colours, what to change.

export interface KitItem {
  id: string;
  title: string;
  src: string;
  srcLabel?: string;
  kind: "page" | "section" | "component";
  purpose: string;
  stack: "react-tsx" | "react-jsx" | "html" | null;
  thumb: string | null;
  srcUrl: string | null;
  // SPDX id - copied into the page's credits comment.
  lic: string;
  licUrl: string | null;
  author: string | null;
  // Where to fetch code for the prompt: registry item URL, component slug, …
  codeRef: KitCodeRef;
  note: string;
  addedAt: number;
}

export type KitCodeRef =
  | { type: "registry"; url: string }
  | { type: "html-component"; slug: string }
  | { type: "template"; slug: string }
  | { type: "page"; id: string }
  | { type: "none" };

export const KIT_STORAGE_KEY = "aimdropin:kit";
export const KIT_EVENT = "aimdropin:kit-change";
export const KIT_MAX_ITEMS = 24;
export const KIT_NOTE_MAX = 400;

export function parseKit(raw: string | null): KitItem[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (x): x is KitItem =>
          !!x &&
          typeof x === "object" &&
          typeof (x as KitItem).id === "string" &&
          typeof (x as KitItem).title === "string" &&
          typeof (x as KitItem).codeRef === "object",
      )
      .map((x) => ({
        ...x,
        note: typeof x.note === "string" ? x.note.slice(0, KIT_NOTE_MAX) : "",
      }))
      .slice(0, KIT_MAX_ITEMS);
  } catch {
    return [];
  }
}

export function loadKit(): KitItem[] {
  try {
    return parseKit(window.localStorage.getItem(KIT_STORAGE_KEY));
  } catch {
    return memoryKit;
  }
}

// Fallback when storage is blocked: the kit lasts for this page view.
let memoryKit: KitItem[] = [];

function saveKit(items: KitItem[]): void {
  memoryKit = items;
  try {
    window.localStorage.setItem(KIT_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // memory only
  }
  try {
    window.dispatchEvent(new Event(KIT_EVENT));
  } catch {
    // no window
  }
}

export type AddResult = "added" | "already" | "full";

export function addToKit(
  item: Omit<KitItem, "note" | "addedAt"> & { note?: string },
): AddResult {
  const kit = loadKit();
  if (kit.some((k) => k.id === item.id)) return "already";
  if (kit.length >= KIT_MAX_ITEMS) return "full";
  saveKit([
    ...kit,
    {
      ...item,
      note: item.note?.slice(0, KIT_NOTE_MAX) ?? "",
      addedAt: Date.now(),
    },
  ]);
  return "added";
}

export function removeFromKit(id: string): void {
  saveKit(loadKit().filter((k) => k.id !== id));
}

export function setKitNote(id: string, note: string): void {
  saveKit(
    loadKit().map((k) =>
      k.id === id ? { ...k, note: note.slice(0, KIT_NOTE_MAX) } : k,
    ),
  );
}

export function moveKitItem(id: string, dir: -1 | 1): void {
  const kit = loadKit();
  const i = kit.findIndex((k) => k.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= kit.length) return;
  const next = kit.slice();
  [next[i], next[j]] = [next[j], next[i]];
  saveKit(next);
}

export function clearKit(): void {
  saveKit([]);
}
