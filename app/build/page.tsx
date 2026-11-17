import type { Metadata } from "next";
import SiteHeader from "@/components/site/SiteHeader";
import BuildStudio from "@/components/builder/BuildStudio";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Build a page with your AI",
  description:
    "Pick components, sections and templates from the library, add a note to each, describe your page, and your own AI (Claude, GPT, Gemini via OpenRouter or your key) builds the whole page in one go.",
  path: "/build",
});

export default function BuildPage() {
  return (
    <div className="min-h-screen font-sans text-ink">
      <SiteHeader builder />
      <main>
        <BuildStudio />
      </main>
    </div>
  );
}
