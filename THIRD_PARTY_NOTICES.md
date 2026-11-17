# Third-party notices

The MIT licence in [LICENSE](LICENSE) covers this project's own code, the landing pages in `web/` and `templates/`, and the GSAP sites' own code in `components/gsap/`. Everything listed here comes from other people and keeps its own licence. Thank you to every author below.

## UI components

The gallery holds 6,873 components from 16 sources, all MIT licensed. Each component's author, licence and original source are recorded in [`data/catalog/catalog.json`](data/catalog/catalog.json) (`author`, `lic`, `licUrl`, `srcUrl`) and shown on its page on the site. Plain HTML components keep their code in `public/data/components/`. Registry components (the `@`-prefixed sources) are fetched from their registry when previewed and aren't stored here.

| Source | Components | Site | Licence |
| --- | ---: | --- | --- |
| uiverse | 3292 | [uiverse.io](https://uiverse.io) | [MIT](https://github.com/uiverse-io/galaxy/blob/main/LICENSE) |
| uiable | 664 | [uiable.com](https://uiable.com) | [MIT](https://uiable.com/legal/license) |
| hextaui | 506 | [hextaui.com](https://hextaui.com) | [MIT](https://hextaui.com/legal/license) |
| shadcnui-blocks | 431 | [shadcnui-blocks.com](https://shadcnui-blocks.com) | [MIT](https://github.com/akash3444/shadcn-ui-blocks/blob/main/LICENSE) |
| hyperui | 397 | [hyperui.dev](https://www.hyperui.dev) | [MIT](https://github.com/markmead/hyperui/blob/main/LICENSE) |
| shadcn-space | 371 | [shadcnspace.com](https://shadcnspace.com) | [MIT](https://github.com/shadcnspace/shadcnspace/blob/main/LICENSE) |
| shadcn | 246 | [ui.shadcn.com](https://ui.shadcn.com) | [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md) |
| cult-ui | 231 | [cult-ui.com](https://www.cult-ui.com) | [MIT](https://github.com/nolly-studio/cult-ui/blob/main/LICENSE.md) |
| uitripled | 194 | [ui.tripled.work](https://ui.tripled.work) | [MIT](https://github.com/moumen-soliman/uitripled/blob/master/LICENSE.md) |
| magicui | 175 | [magicui.design](https://magicui.design) | [MIT](https://github.com/magicuidesign/magicui/blob/main/LICENSE.md) |
| intentui | 106 | [intentui.com](https://intentui.com) | [MIT](https://github.com/intentui/intentui/blob/main/LICENSE) |
| kokonutui | 89 | [kokonutui.com](https://kokonutui.com) | [MIT](https://github.com/kokonut-labs/kokonutui/blob/main/LICENSE) |
| eldoraui | 72 | [eldoraui.site](https://eldoraui.site) | [MIT](https://github.com/karthikmudunuri/eldoraui/blob/main/LICENSE.md) |
| shadcnstore | 52 | [shadcnstore.com](https://www.shadcnstore.com) | [MIT](https://shadcnstore.com/license) |
| astryx | 45 | [astryx.atmeta.com](https://astryx.atmeta.com) | [MIT](https://github.com/facebook/astryx/blob/main/LICENSE) |
| motion-primitives | 2 | [motion-primitives.com](https://www.motion-primitives.com) | [MIT](https://github.com/ibelick/motion-primitives/blob/main/LICENCE.md) |

## Live dashboards

The 167 live dashboards come from 166 open-source repositories by 89 authors: 164 MIT and 3 Apache-2.0. Their code is not in this repository. [`scripts/dashboards`](scripts/dashboards) downloads each one from its original repository at a pinned commit and builds it; the built files are served from a storage bucket. This repository only holds each dashboard's metadata ([`data/dashboards/index.json`](data/dashboards/index.json): author, repository, commit, licence and a link to the licence file at that commit), a screenshot (`public/thumbs/dashboards/`) and the small patches that make it run under `/demos/<slug>/` (`scripts/dashboards/patches/`). The author and licence are also shown on every dashboard's page.

## GSAP sites

Sum, Meridian and Datum (`components/gsap/`) were made for this project, and their own code falls under its MIT licence. What they use from other people:

| What | Used by | Licence |
| --- | --- | --- |
| [GSAP](https://gsap.com) by GreenSock | all three | GreenSock's [standard "no charge" licence](https://gsap.com/standard-license). It is not MIT and not open source: read its terms before you reuse it. It is installed from npm and isn't stored in this repository. |
| [Archivo](https://github.com/Omnibus-Type/Archivo) | Sum | SIL Open Font License 1.1 (`public/assets/gsap/sum/fonts/OFL-archivo.txt`) |
| [Overpass and Overpass Mono](https://github.com/RedHatOfficial/Overpass) | Meridian | SIL Open Font License 1.1 (`public/assets/gsap/meridian/fonts/OFL-overpass.txt`) |
| [Jost](https://github.com/indestructible-type/Jost) | Datum | SIL Open Font License 1.1 (`public/assets/gsap/datum/fonts/OFL-jost.txt`) |
| [Natural Earth](https://www.naturalearthdata.com) land outlines | Meridian's map | Public domain |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) data for Dublin | Meridian's map | © OpenStreetMap contributors, [Open Database License](https://opendatacommons.org/licenses/odbl/). The credit on the map stays wherever the page goes. |

Every photograph in the three sites was generated for them (GPT Image 2.6 Sunburst, through fal.ai). The sites are concepts: no brand, product, person or building in them is real.

## Icons and assets

The asset library in the editor bundles these packs as JSON in `public/data/assets/`:

| Pack | Licence |
| --- | --- |
| [Heroicons](https://github.com/tailwindlabs/heroicons) | MIT |
| [Lucide](https://lucide.dev) | ISC |
| [Phosphor Icons](https://github.com/phosphor-icons/core) | MIT |
| [Tabler Icons](https://github.com/tabler/tabler-icons) | MIT |
| [Simple Icons](https://github.com/simple-icons/simple-icons) | CC0-1.0. The brand logos are trademarks of their owners. |
| [unicode-emoji-json](https://github.com/muan/unicode-emoji-json) | MIT |

The palettes, gradients, shadows, mockups, decorative patterns and the small illustration set were made for this project and fall under its MIT licence.

## Fonts

Fraunces, Instrument Sans and JetBrains Mono are loaded through `next/font/google` at build time (SIL Open Font License 1.1). They aren't stored in this repository. The GSAP sites carry their own fonts, listed above.

## npm packages

Dependencies listed in `package.json` keep their own licences.
