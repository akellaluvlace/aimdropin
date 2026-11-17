// Automatic checks for community pages before a moderator publishes them.
// Pages are shown to other people (sandboxed, but still), and anyone may copy
// them into real sites, so we flag anything that phones home, collects
// credentials, hides payloads, or isn't the kind of self-contained page the
// library promises. "block" findings mean reject unless a human is sure;
// "warn" findings need a look.

const ALLOWED_SCRIPT_HOSTS = [
  "cdn.tailwindcss.com",
  "unpkg.com",
  "cdn.jsdelivr.net",
  "cdnjs.cloudflare.com",
  "esm.sh",
];

const MAX_BYTES = 1024 * 1024;

function hostOf(url) {
  try {
    return new URL(url, "https://example.invalid").host;
  } catch {
    return null;
  }
}

export function checkPageSource(source, stack) {
  const findings = [];
  const add = (level, rule, detail) => findings.push({ level, rule, detail });
  const bytes = new TextEncoder().encode(source).length;
  if (bytes > MAX_BYTES)
    add("block", "size", `${bytes} bytes (limit ${MAX_BYTES})`);

  for (const m of source.matchAll(
    /<script[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
  )) {
    const host = hostOf(m[1]);
    if (!host || !ALLOWED_SCRIPT_HOSTS.includes(host))
      add("block", "external-script", m[1].slice(0, 200));
  }
  for (const m of source.matchAll(
    /<form[^>]*\baction\s*=\s*["']([^"']+)["']/gi,
  )) {
    if (/^https?:/i.test(m[1]))
      add("block", "form-posts-externally", m[1].slice(0, 200));
  }
  if (/<input[^>]+type\s*=\s*["']?password/i.test(source)) {
    add(
      "warn",
      "password-field",
      "Has a password field. Fine for a login-page design; check it doesn't post anywhere.",
    );
  }
  if (
    /\b(fetch|XMLHttpRequest|navigator\.sendBeacon|WebSocket|EventSource)\s*\(/.test(
      source,
    )
  ) {
    add("warn", "network-call", "Makes network requests from script.");
  }
  if (
    /\beval\s*\(|new\s+Function\s*\(|\batob\s*\(\s*["'][A-Za-z0-9+/=]{200,}/.test(
      source,
    )
  ) {
    add(
      "block",
      "obfuscated-code",
      "Uses eval / new Function / a large base64 payload.",
    );
  }
  if (/coinhive|cryptonight|webminer|coin-hive/i.test(source))
    add("block", "miner", "Crypto-miner signature.");
  if (/<iframe[^>]+src\s*=\s*["']https?:/i.test(source))
    add("warn", "external-iframe", "Embeds another site in an iframe.");
  if (
    /document\.cookie|localStorage\.getItem\(\s*["'][^"']*(token|auth|key|session)/i.test(
      source,
    )
  ) {
    add(
      "warn",
      "reads-credentials",
      "Reads cookies or token-like storage keys.",
    );
  }
  if (/window\.(top|parent)\.location|top\.location\s*=/i.test(source)) {
    add("block", "frame-busting", "Tries to navigate the parent page.");
  }
  const dataUris =
    source.match(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]{20000,}/gi) ??
    [];
  if (dataUris.length)
    add(
      "warn",
      "large-inline-data",
      `${dataUris.length} inline file(s) over ~15 KB.`,
    );
  if (stack === "html" && !/<html[\s>]/i.test(source))
    add("warn", "not-a-document", "HTML page without an <html> element.");
  if (stack === "jsx" && !/export\s+default/.test(source))
    add("warn", "no-default-export", "JSX file without a default export.");
  if (
    /(?:©|copyright)\s*(?:20\d\d)?\s*(?:themeforest|envato|creative\s*tim\s*pro|tailwind\s*ui|tailwindui)/i.test(
      source,
    )
  ) {
    add(
      "block",
      "paid-template-marker",
      "Mentions a paid template marketplace in a copyright line.",
    );
  }
  if (/tailwindui\.com\/(?:components|templates)/i.test(source)) {
    add(
      "block",
      "paid-template-marker",
      "References Tailwind UI (paid) source URLs.",
    );
  }

  const verdict = findings.some((f) => f.level === "block")
    ? "reject"
    : findings.length
      ? "review"
      : "pass";
  return { verdict, findings, bytes };
}
