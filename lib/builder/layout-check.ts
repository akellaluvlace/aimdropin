// Builder - automatic layout check of a generated page.
//
// Renders the page in hidden, sandboxed iframes at a desktop and a phone
// width and reports concrete problems the model can fix in one follow-up:
// horizontal overflow (with the offending elements), broken images, script
// errors and near-empty renders. Pure string builders are exported for tests;
// runLayoutCheck needs a DOM.

import type { LayoutProblem } from "./prompt";

export const CHECK_WIDTHS = [1280, 390] as const;

// Runs inside the preview iframe. Collects errors from the start, then after
// load (plus a settle delay for Babel/Tailwind/images) measures the page and
// posts { __aimcheck, nonce, width, problems } to the parent.
export function checkScript(nonce: number, settleMs = 1800): string {
  return `<script>(function(){
  var errors = [];
  window.addEventListener('error', function (e) {
    if (e && e.target && e.target !== window && e.target.tagName) return; // resource errors handled below
    errors.push(String((e && e.message) || 'Script error'));
  }, true);
  window.addEventListener('unhandledrejection', function (e) { errors.push('Unhandled promise rejection: ' + String(e && e.reason)); });
  var origError = console.error;
  console.error = function () {
    try { errors.push(Array.prototype.map.call(arguments, String).join(' ').slice(0, 300)); } catch (_) {}
    return origError.apply(console, arguments);
  };
  function describe(el) {
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    var cls = (el.getAttribute('class') || '').trim().split(/\\s+/).slice(0, 6).join('.');
    if (cls) s += '.' + cls;
    var t = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
    return s + (t ? ' ("' + t + '")' : '');
  }
  function clipped(el) {
    for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      var o = getComputedStyle(p).overflowX;
      if (o === 'hidden' || o === 'auto' || o === 'scroll' || o === 'clip') return true;
    }
    return false;
  }
  function run() {
    var problems = [];
    var W = window.innerWidth;
    var sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
    if (sw > W + 2) {
      var offenders = [];
      var all = document.body ? document.body.getElementsByTagName('*') : [];
      for (var i = 0; i < all.length && offenders.length < 4; i++) {
        var el = all[i];
        var r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= W + 2) continue;
        var pos = getComputedStyle(el).position;
        if (pos === 'fixed') continue;
        if (clipped(el)) continue;
        // Report the outermost offender only.
        var parentOver = el.parentElement && el.parentElement.getBoundingClientRect().right > W + 2 && !clipped(el.parentElement);
        if (parentOver && el.parentElement !== document.body) continue;
        offenders.push(describe(el) + ' extends to ' + Math.round(r.right) + 'px');
      }
      problems.push({ kind: 'overflow-x', detail: 'Page is ' + sw + 'px wide in a ' + W + 'px viewport (horizontal scroll).' + (offenders.length ? ' Widest elements: ' + offenders.join('; ') : '') });
    }
    var imgs = document.images, broken = [];
    for (var j = 0; j < imgs.length; j++) {
      var im = imgs[j];
      if (im.complete && im.naturalWidth === 0 && im.getAttribute('src')) broken.push(im.getAttribute('src').slice(0, 120));
    }
    if (broken.length) problems.push({ kind: 'broken-image', detail: broken.length + ' image(s) failed to load: ' + broken.slice(0, 4).join(', ') });
    var text = document.body ? (document.body.innerText || '').trim() : '';
    if (text.length < 80) problems.push({ kind: 'empty', detail: 'The page rendered almost no text (' + text.length + ' characters). It probably failed to render.' });
    var uniq = [];
    errors.forEach(function (e) { if (uniq.indexOf(e) < 0 && uniq.length < 4) uniq.push(e); });
    uniq.forEach(function (e) { problems.push({ kind: 'js-error', detail: e }); });
    parent.postMessage({ __aimcheck: true, nonce: ${nonce}, width: W, problems: problems }, '*');
  }
  function later() { setTimeout(run, ${settleMs}); }
  if (document.readyState === 'complete') later(); else window.addEventListener('load', later);
})();</script>`;
}

export function injectCheck(
  doc: string,
  nonce: number,
  settleMs?: number,
): string {
  const script = checkScript(nonce, settleMs);
  const m = doc.match(/<head[^>]*>/i);
  if (m && m.index != null) {
    const at = m.index + m[0].length;
    return doc.slice(0, at) + script + doc.slice(at);
  }
  return script + doc;
}

// Merge per-width results: the same problem at both widths is reported once
// (with the narrower width, where it's usually worst).
export function mergeProblems(
  perWidth: Array<{ width: number; problems: LayoutProblem[] }>,
): LayoutProblem[] {
  const out: LayoutProblem[] = [];
  const seen = new Set<string>();
  const sorted = [...perWidth].sort((a, b) => a.width - b.width);
  for (const { width, problems } of sorted) {
    for (const p of problems) {
      const key =
        p.kind === "overflow-x" ? `overflow@${width}` : `${p.kind}:${p.detail}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        ...p,
        viewport: p.kind === "overflow-x" ? width : p.viewport,
      });
    }
  }
  return out;
}

let nextNonce = 1;

// Render `doc` (a full preview document) at each width and collect problems.
export async function runLayoutCheck(
  buildDoc: () => string,
  opts: {
    widths?: readonly number[];
    timeoutMs?: number;
    settleMs?: number;
  } = {},
): Promise<LayoutProblem[]> {
  const widths = opts.widths ?? CHECK_WIDTHS;
  const timeoutMs = opts.timeoutMs ?? 20000;
  const results = await Promise.all(
    widths.map(
      (width) =>
        new Promise<{ width: number; problems: LayoutProblem[] }>((resolve) => {
          const nonce = nextNonce++;
          const frame = document.createElement("iframe");
          frame.setAttribute("sandbox", "allow-scripts");
          frame.setAttribute("aria-hidden", "true");
          frame.tabIndex = -1;
          frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;height:900px;border:0;visibility:hidden;pointer-events:none;`;
          const done = (problems: LayoutProblem[]) => {
            window.removeEventListener("message", onMsg);
            window.clearTimeout(timer);
            frame.remove();
            resolve({ width, problems });
          };
          const onMsg = (e: MessageEvent) => {
            const d = e.data as {
              __aimcheck?: boolean;
              nonce?: number;
              problems?: LayoutProblem[];
            } | null;
            if (
              e.source !== frame.contentWindow ||
              !d ||
              d.__aimcheck !== true ||
              d.nonce !== nonce
            )
              return;
            done(Array.isArray(d.problems) ? d.problems : []);
          };
          const timer = window.setTimeout(
            () =>
              done([
                {
                  kind: "timeout",
                  detail: "The page didn't finish rendering within 20 seconds.",
                },
              ]),
            timeoutMs,
          );
          window.addEventListener("message", onMsg);
          frame.srcdoc = injectCheck(buildDoc(), nonce, opts.settleMs);
          document.body.appendChild(frame);
        }),
    ),
  );
  return mergeProblems(results);
}
