// Shadboard full kit: static export. NextAuth/Prisma and the auth/i18n
// middleware go: the layout passes a null session (the demo opens on the
// dashboards; sign-in pages stay as UI), locales and the chat/email routes
// get static params, and a Suspense boundary covers useSearchParams users.
import { readFileSync, writeFileSync } from "node:fs";
import { replaceOnce, remove } from "./_lib.mjs";
import { staticNextConfig, removeMiddleware, fixRscFetchAll } from "./_next.mjs";

process.chdir("full-kit");
staticNextConfig();
removeMiddleware();
remove("src/app/api");
remove("src/app/[lang]/[...not-found]");

const layout = "src/app/[lang]/layout.tsx";
replaceOnce(layout, 'import { getServerSession } from "next-auth"\n', 'import { Suspense } from "react"\n');
replaceOnce(layout, 'import { authOptions } from "@/configs/next-auth"\n', "");
replaceOnce(layout, "  const session = await getServerSession(authOptions)\n", "  const session = null\n");
replaceOnce(layout, "          {children}\n", "          <Suspense>{children}</Suspense>\n");
replaceOnce(layout, "export default async function RootLayout(", "export function generateStaticParams() {\n  return i18n.locales.map((lang) => ({ lang }))\n}\n\nexport default async function RootLayout(");

const apps = "src/app/[lang]/(dashboard-layout)/apps";
const ids = (file, re) => {
  const out = [...readFileSync(file, "utf8").matchAll(re)].map((m) => m[1]);
  if (!out.length) throw new Error(`patch: no ids in ${file}`);
  return [...new Set(out)];
};
const chats = ids(`${apps}/chat/_data/chats.ts`, /^    id: "(chat_[^"]+)"/gm);
const filters = ids(`${apps}/email/_data/emails-sidebar-items.ts`, /name: "([^"]+)"/g);
const emails = ids(`${apps}/email/_data/emails.ts`, /^    id: "([^"]+)"/gm);

replaceOnce(`${apps}/chat/[[...id]]/page.tsx`, "export default async function ChatBoxPage(", `export function generateStaticParams() {\n  return [{ id: [] as string[] }, ...${JSON.stringify(chats)}.map((id) => ({ id: [id] }))]\n}\n\nexport default async function ChatBoxPage(`);
replaceOnce(`${apps}/email/[filter]/page.tsx`, "export default async function EmailPage(", `export function generateStaticParams() {\n  return ${JSON.stringify(filters)}.map((filter) => ({ filter }))\n}\n\nexport default async function EmailPage(`);
replaceOnce(`${apps}/email/[filter]/[id]/page.tsx`, "export default function EmailViewPage(", `export function generateStaticParams() {\n  // [filter] has no layout here, so this page names both segments.\n  return ${JSON.stringify(filters)}.flatMap((filter) => ${JSON.stringify(emails)}.map((id) => ({ filter, id })))\n}\n\nexport default function EmailViewPage(`);

// next/font/google (Next 15.2) fails to parse Google's current CSS for these
// fonts: load them with a plain stylesheet and keep the CSS variables.
replaceOnce("src/app/[lang]/layout.tsx", 'import { Cairo, Lato } from "next/font/google"\n', 'const Lato = (_: unknown) => ({ variable: "aim-font-lato", className: "" })\nconst Cairo = (_: unknown) => ({ variable: "aim-font-cairo", className: "" })\n');
replaceOnce("src/app/(unlocalized)/layout.tsx", 'import { Lato } from "next/font/google"\n', 'const Lato = (_: unknown) => ({ variable: "aim-font-lato", className: "" })\n');
const css = "src/app/globals.css";
writeFileSync(
  css,
  '@import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,400&display=swap");\n' +
    readFileSync(css, "utf8") +
    '\n.aim-font-lato { --font-lato: "Lato", sans-serif; }\n.aim-font-cairo { --font-cairo: "Cairo", sans-serif; }\n',
);
// "/<lang>" and ".../apps/email" were middleware/config redirects: real pages now.
const go = (to) => `import { redirect } from "next/navigation"\n\nexport default async function Page(props: { params: Promise<{ lang: string }> }) {\n  const { lang } = await props.params\n  redirect(\`/\${lang}${to}\`)\n}\n`;
writeFileSync("src/app/[lang]/(dashboard-layout)/page.tsx", go("/dashboards/analytics"));
writeFileSync(`${apps}/email/page.tsx`, go("/apps/email/inbox"));
fixRscFetchAll();
