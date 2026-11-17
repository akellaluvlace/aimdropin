// One result in the library grid. Server-rendered; only the kit button is a
// client island. Items with a screenshot show it; registry items without one
// get a typographic card (live previews open on the detail page, so the grid
// never spins up dozens of iframes).

import Link from "next/link";
import AddToKitButton from "@/components/kit/AddToKitButton";
import { kitItemFromLibrary } from "@/lib/kit/from-library";
import type { LibraryItem } from "@/lib/catalog/library";
import { itemHref, kindLabel, stackLabel } from "./labels";

export default function LibraryCard({
  item,
  srcLabel,
}: {
  item: LibraryItem;
  srcLabel: string;
}) {
  const href = itemHref(item.id);
  return (
    <article className="group flex h-full flex-col border-2 border-ink bg-card transition-shadow hover:shadow-[6px_6px_0_0_#0F0F0F]">
      <Link
        href={href}
        className="relative block aspect-[16/10] overflow-hidden border-b-2 border-ink bg-soft"
      >
        {item.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumb}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full flex-col justify-between p-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
              {item.type?.replace("registry:", "") ?? kindLabel(item)}
            </span>
            <span className="font-display text-2xl leading-tight text-ink/85 sm:text-3xl">
              {item.title}
            </span>
            <span className="flex flex-wrap gap-1">
              {(item.heavy.length ? item.heavy : item.deps)
                .slice(0, 4)
                .map((d) => (
                  <span
                    key={d}
                    className="bg-paper px-1.5 py-0.5 font-mono text-[10px] text-ink/60"
                  >
                    {d}
                  </span>
                ))}
            </span>
          </div>
        )}
        {item.src === "aimdropin" ? (
          <span className="absolute left-2 top-2 bg-coral px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-paper">
            AIMdropin
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-[15px] font-medium leading-snug">
            <Link href={href} className="hover:underline">
              {item.title}
            </Link>
          </h3>
          <AddToKitButton item={kitItemFromLibrary(item, srcLabel)} compact />
        </div>
        {item.desc ? (
          <p className="line-clamp-2 text-xs text-ink/65">{item.desc}</p>
        ) : null}
        <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          <span>{srcLabel}</span>
          <span aria-hidden>·</span>
          <span>{kindLabel(item)}</span>
          {item.stack ? (
            <>
              <span aria-hidden>·</span>
              <span>{stackLabel(item.stack)}</span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <span title="License">{item.lic}</span>
        </p>
      </div>
    </article>
  );
}
