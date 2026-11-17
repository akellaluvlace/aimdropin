"use client";

import GalleryTile from "./gallery/GalleryTile";
import { templateCard } from "@/lib/gallery/cards";
import type { TemplateKind, TemplateSummary } from "@/lib/templates";

interface TemplateTileProps {
  template: TemplateSummary;
  hasThumb: boolean;
  kindPref: TemplateKind;
  tabbable?: boolean;
  widthPx?: number;
}

// A landing-page tile: the shared gallery tile fed from a template.
export default function TemplateTile({ template, hasThumb, kindPref, tabbable, widthPx }: TemplateTileProps) {
  return <GalleryTile card={templateCard(template, hasThumb, kindPref)} tabbable={tabbable} widthPx={widthPx} />;
}
