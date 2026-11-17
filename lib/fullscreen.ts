// Real browser full screen (no tabs or address bar) where the browser allows
// it: desktop browsers, Android and iPad, not iPhone. It's requested from the
// click that opens a full-screen view, because browsers only allow it during
// a user gesture; the app navigates client-side, so the next page stays in
// full screen.

type ClickLike = { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; button: number };

export function canUseBrowserFullscreen(): boolean {
  return typeof document !== "undefined" && document.fullscreenEnabled === true && !!document.documentElement.requestFullscreen;
}

export function isBrowserFullscreen(): boolean {
  return typeof document !== "undefined" && !!document.fullscreenElement;
}

/** Enter browser full screen, unless this click opens a new tab or window. */
export function enterBrowserFullscreen(e?: ClickLike): void {
  if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return;
  if (!canUseBrowserFullscreen() || isBrowserFullscreen()) return;
  document.documentElement.requestFullscreen().catch(() => {});
}

export function exitBrowserFullscreen(): void {
  if (isBrowserFullscreen()) document.exitFullscreen().catch(() => {});
}

/**
 * True when the page before this one in the tab's history is on this site,
 * so "back" stays here. A full-screen link pasted into a fresh tab has the
 * browser's new-tab page behind it; Close should open the item instead.
 */
export function previousPageIsHere(): boolean {
  if (typeof window === "undefined") return false;
  // Navigation API (Chromium, recent Safari/Firefox): entries() lists only
  // this site's entries, so any earlier index is one of ours.
  const nav = (window as unknown as { navigation?: { currentEntry?: { index: number } | null } }).navigation;
  if (nav?.currentEntry) return nav.currentEntry.index > 0;
  try {
    return window.history.length > 1 && !!document.referrer && new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}
