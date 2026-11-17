// Where registry items live, and which hosts the preview proxy may fetch.
//
// The URL templates mirror what the catalog indexer resolved for each
// namespace (scripts/catalog/sources.json + the shadcn registry directory):
// every catalog item's `install.url` is one of these with `{name}` filled in.
// Only namespaces whose license passed the catalog's gate are listed, so a
// registryDependency pointing anywhere else (an excluded or unknown registry)
// can't be fetched and the preview reports it as missing instead.

export const OFFICIAL_ITEM_URL =
  "https://ui.shadcn.com/r/styles/new-york-v4/{name}.json";

export const REGISTRY_URL_TEMPLATES: Readonly<Record<string, string>> = {
  "@shadcn": OFFICIAL_ITEM_URL,
  "@shadcn-space": "https://shadcnspace.com/r/{name}.json",
  "@uitripled": "https://ui.tripled.work/r/{name}.json",
  "@saastro": "https://ui.saastro.io/r/{name}.json",
  "@intentui": "https://intentui.com/r/{name}",
  "@astryx": "https://astryx.atmeta.com/shadcn/{name}.json",
  "@soldevelo": "https://registry.soldevelo.com/r/{name}.json",
  "@uiable": "https://uiable.com/r/{name}.json",
  "@shadcnstore": "https://shadcnstore.com/r/{name}.json",
  "@shadcnui-blocks": "https://shadcnui-blocks.com/r/{name}.json",
  "@kokonutui": "https://kokonutui.com/r/{name}.json",
  "@cult-ui": "https://cult-ui.com/r/{name}.json",
  "@magicui": "https://magicui.design/r/{name}",
  "@motion-primitives": "https://motion-primitives.com/c/{name}.json",
  "@eldoraui": "https://eldoraui.site/r/{name}.json",
  "@hextaui": "https://hextaui.com/r/{name}.json",
};

// Hosts a registry may redirect to (magicui.design → www.magicui.design etc.)
// are accepted when they are the same registrable host with a `www.` prefix.
export const ALLOWED_REGISTRY_HOSTS: ReadonlySet<string> = new Set(
  Object.values(REGISTRY_URL_TEMPLATES).flatMap((t) => {
    const host = new URL(t.replace("{name}", "x")).hostname;
    return host.startsWith("www.") ? [host, host.slice(4)] : [host, `www.${host}`];
  }),
);

/** https, an allowlisted host, default port, no credentials. */
export function isAllowedRegistryUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  return (
    u.protocol === "https:" &&
    u.port === "" &&
    u.username === "" &&
    u.password === "" &&
    ALLOWED_REGISTRY_HOSTS.has(u.hostname)
  );
}

/** Which namespace an item URL belongs to, or null. */
export function namespaceOfUrl(raw: string): string | null {
  let host: string;
  try {
    host = new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  for (const [ns, tpl] of Object.entries(REGISTRY_URL_TEMPLATES)) {
    if (new URL(tpl.replace("{name}", "x")).hostname.replace(/^www\./, "") === host) {
      return ns;
    }
  }
  return null;
}

/**
 * Turn one `registryDependencies` entry into an item URL, the way the shadcn
 * CLI does: a full URL is used as-is, `@ns/name` goes through that registry's
 * template, and a bare name means the official shadcn registry. Returns null
 * for anything we may not fetch.
 */
export function resolveDependencyUrl(dep: string): string | null {
  const d = dep.trim();
  if (!d) return null;
  if (/^https?:\/\//i.test(d)) return isAllowedRegistryUrl(d) ? d : null;
  const ns = d.match(/^(@[a-z0-9][\w.-]*)\/([\w.-]+)$/i);
  if (ns) {
    const tpl = REGISTRY_URL_TEMPLATES[ns[1].toLowerCase()];
    return tpl ? tpl.replace("{name}", ns[2]) : null;
  }
  if (/^[\w.-]+$/.test(d)) return OFFICIAL_ITEM_URL.replace("{name}", d);
  return null;
}

/**
 * The `{name}-demo` sibling of an item URL. Bare primitives (a Button, a
 * Marquee) render nothing useful on their own; most registries publish a demo
 * next to them that does.
 */
export function demoUrlFor(itemUrl: string, name: string): string | null {
  if (!name || name.endsWith("-demo")) return null;
  const idx = itemUrl.lastIndexOf(name);
  if (idx < 0) return null;
  return itemUrl.slice(0, idx) + `${name}-demo` + itemUrl.slice(idx + name.length);
}
