"use client";

// Fetch the code behind each kit item so the model can adapt it. Failures
// don't block the build: an item without code is still described by title
// and source, and the UI shows which ones fell back.

import type { KitItem } from "@/lib/kit/kit-store";
import { getComponentFull } from "@/lib/component-library/client";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { fitKitToBudget, type KitPromptItem } from "./prompt";

type Files = Array<{ path: string; content: string }>;

async function registryFiles(url: string): Promise<Files> {
  const res = await fetch(`/api/registry/item?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(String(res.status));
  const j = (await res.json()) as {
    files?: Array<{ path?: string; target?: string; content?: string }>;
    item?: unknown;
  };
  const item = (j.item && typeof j.item === "object" ? j.item : j) as {
    files?: Array<{ path?: string; target?: string; content?: string }>;
  };
  return (item.files ?? [])
    .filter((f) => typeof f.content === "string" && f.content.length > 0)
    .map((f) => ({
      path: f.target || f.path || "component.tsx",
      content: f.content as string,
    }));
}

async function filesFor(item: KitItem, output: "html" | "jsx"): Promise<Files> {
  const ref = item.codeRef;
  switch (ref.type) {
    case "registry":
      return registryFiles(ref.url);
    case "html-component": {
      const full = await getComponentFull(ref.slug);
      const out: Files = [{ path: `${ref.slug}.html`, content: full.html }];
      if (full.css)
        out.push({
          path: `${ref.slug}.css`,
          content: full.css.replace(/__UIV_SCOPE__/g, ".piece"),
        });
      return out;
    }
    case "template": {
      // Same format as the page being built, when the template has it.
      const res = await fetch(
        `/api/templates/${encodeURIComponent(ref.slug)}?kind=${output}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { source: string; kind: string };
      return [
        {
          path: `${ref.slug}.${j.kind === "html" ? "html" : "jsx"}`,
          content: j.source,
        },
      ];
    }
    case "page": {
      const sb = getBrowserSupabase();
      if (!sb) return [];
      const { data } = await sb
        .from("pages")
        .select("source, stack")
        .eq("id", ref.id)
        .maybeSingle();
      return data
        ? [
            {
              path: `page.${data.stack === "html" ? "html" : "jsx"}`,
              content: String(data.source),
            },
          ]
        : [];
    }
    case "none":
      return [];
  }
}

export interface CollectedKit {
  items: KitPromptItem[];
  missing: string[];
}

export async function collectKit(
  kit: KitItem[],
  output: "html" | "jsx",
): Promise<CollectedKit> {
  const missing: string[] = [];
  const fetched = await Promise.all(
    kit.map(async (k, i) => {
      let files: Files = [];
      try {
        files = await filesFor(k, output);
      } catch {
        files = [];
      }
      if (!files.length && k.codeRef.type !== "none") missing.push(k.title);
      return {
        index: i + 1,
        title: k.title,
        sourceLabel: k.srcLabel ?? k.src,
        kind: k.kind,
        license: k.lic,
        author: k.author,
        sourceUrl: k.srcUrl,
        note: k.note,
        files,
      };
    }),
  );
  return { items: fitKitToBudget(fetched), missing };
}
