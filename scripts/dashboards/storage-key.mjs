// Object keys for demo files in the storage bucket. Supabase Storage only
// accepts a narrow set of characters in keys, while built apps ship paths
// like `_next/static/chunks/app/[slug]/page.js` or `audio/海阔天空.mp3`.
// Each path segment is percent-encoded, the few characters encodeURIComponent
// leaves alone are encoded too, then "%" becomes "!" - so keys only contain
// [A-Za-z0-9._!-] and "/", and the mapping is one-to-one.
//
// The browser never sees these keys: the site fetches files from the bucket
// and serves them under /demos/<slug>/<original path>.

export function storageKey(slug, rel) {
  const enc = rel
    .split("/")
    .map((seg) =>
      encodeURIComponent(seg)
        .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
        .replace(/%/g, "!"),
    )
    .join("/");
  return `${slug}/${enc}`;
}
