// shadcn/ui legacy site (apps/www): only the Examples section is exported.
// Docs, blocks, charts, colors, themes, OG and internal/view routes go (they
// need Contentlayer or a server), and so does the Contentlayer plugin.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { replaceOnce, remove, BASE_NOSLASH } from "./_lib.mjs";
import { staticNextConfig, prefixPublicPaths, fixRscFetchAll, findFiles } from "./_next.mjs";

process.chdir("apps/www");
for (const p of ["app/(app)/docs", "app/(app)/blocks", "app/(app)/charts", "app/(app)/colors", "app/(app)/themes", "app/(app)/og", "app/(app)/page.tsx", "app/(internal)", "app/(view)", "pages"]) {
  remove(p);
}
// The header links to the removed sections: stub pages keep those links (and
// their prefetches) working and point to the real site.
const stub = (title) => `export default function Page() {\n  return (\n    <div className="container py-24 text-center">\n      <h1 className="text-2xl font-semibold">${title}</h1>\n      <p className="text-muted-foreground mt-2">This demo only includes the Examples section. See <a className="underline" href="https://v3.shadcn.com">v3.shadcn.com</a>.</p>\n    </div>\n  )\n}\n`;
for (const [dir, title] of [["docs", "Docs"], ["docs/components", "Components"], ["docs/installation", "Installation"], ["blocks", "Blocks"], ["charts", "Charts"], ["colors", "Colors"], ["themes", "Themes"]]) {
  mkdirSync(`app/(app)/${dir}`, { recursive: true });
  writeFileSync(`app/(app)/${dir}/page.tsx`, stub(title));
}
writeFileSync("app/(app)/page.tsx", 'import { redirect } from "next/navigation"\n\nexport default function Home() {\n  redirect("/examples/mail")\n}\n');
if (!existsSync("app/(app)/examples/mail/page.tsx")) throw new Error("patch: examples/mail missing");
replaceOnce("next.config.mjs", 'import { createContentlayerPlugin } from "next-contentlayer2"\n', "");
replaceOnce("next.config.mjs", /const withContentlayer = createContentlayerPlugin\(\{[\s\S]*?\}\)\s*export default withContentlayer\(nextConfig\)/, "export default nextConfig");
staticNextConfig();
// The mail example restores its panel sizes from cookies on the server: use defaults.
const mail = "app/(app)/examples/mail/page.tsx";
replaceOnce(mail, 'import { cookies } from "next/headers"\n', "");
replaceOnce(mail, '  const layout = cookies().get("react-resizable-panels:layout:mail")\n  const collapsed = cookies().get("react-resizable-panels:collapsed")\n', "  const layout = undefined as { value: string } | undefined\n  const collapsed = undefined as { value: string } | undefined\n");
prefixPublicPaths(["app", "components", "registry", "lib", "config", "hooks", "styles"], { skip: ["r", "registry", "schema", "schema.json", "examples"] });
// public/examples holds screenshots, but /examples/* is also the route: prefix only image files.
for (const f of findFiles("app", /\.tsx?$/)) {
  const s = readFileSync(f, "utf8");
  const t = s.replace(/(["'`])\/examples\/([\w-]+\.(?:png|jpe?g|svg|webp))/g, `$1${BASE_NOSLASH}/examples/$2`);
  if (t !== s) writeFileSync(f, t);
}
// Header, footer and menus link into the docs, which aren't exported:
// don't prefetch links, so only pages a visitor opens are requested.
for (const f of [...findFiles("components", /\.tsx$/), ...findFiles("app", /\.tsx$/), ...findFiles("registry", /\.tsx$/)]) {
  const s = readFileSync(f, "utf8");
  const t = s.replace(/<Link(\s)(?!prefetch)/g, "<Link prefetch={false}$1");
  if (t !== s) writeFileSync(f, t);
}
fixRscFetchAll();
