// Modernize Angular (main20 folder): root-relative /assets/ URLs follow the
// <base href>; sidebar items (click-only anchors) get real hrefs for their
// in-app routes so the pages are linkable and crawlable.
import { replaceOnce } from "./_lib.mjs";
import { relativeAssets } from "./_angular.mjs";
process.chdir("main20");
relativeAssets("src");
const dir = "src/app/layouts/full/sidebar/nav-item/nav-item.component";
replaceOnce(`${dir}.html`, '<a mat-list-item (click)="onItemSelected(item)"', '<a mat-list-item [attr.href]="demoHref(item)" (click)="$event.preventDefault(); onItemSelected(item)"');
replaceOnce(
  `${dir}.ts`,
  "onItemSelected(item: NavItem) {",
  `demoHref(item: NavItem): string | null {
    const r = item.route;
    if (!r || (item.children && item.children.length) || !r.startsWith('/') || r.startsWith('/http')) return null;
    return r.slice(1);
  }

  onItemSelected(item: NavItem) {`,
);
