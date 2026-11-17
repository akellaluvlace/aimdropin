import { describe, expect, it } from "vitest";
import { dashboardNeighbors, templateNeighbors } from "@/lib/gallery/neighbors";
import { getDashboards } from "@/lib/dashboards";
import { dashboardCard } from "@/lib/gallery/cards";
import { applyGalleryFilter } from "@/lib/gallery/filter";

// Full-screen ← / → follow the gallery's default order and wrap around.
describe("full-screen previous / next", () => {
  it("steps through dashboards in Best-first order, wrapping at both ends", async () => {
    const order = applyGalleryFilter((await getDashboards()).map(dashboardCard), { query: "", active: null, sort: "best" });
    const first = order[0];
    const second = order[1];
    const last = order[order.length - 1];

    const atStart = await dashboardNeighbors(first.key);
    expect(atStart).not.toBeNull();
    expect(atStart!.index).toBe(1);
    expect(atStart!.total).toBe(order.length);
    expect(atStart!.next).toEqual({ href: `/d/${second.key}/live`, title: second.title });
    expect(atStart!.prev).toEqual({ href: `/d/${last.key}/live`, title: last.title });

    const atEnd = await dashboardNeighbors(last.key);
    expect(atEnd!.index).toBe(order.length);
    expect(atEnd!.next.href).toBe(`/d/${first.key}/live`);
  });

  it("has no neighbours for an unknown dashboard", async () => {
    expect(await dashboardNeighbors("no-such-dashboard")).toBeNull();
  });

  it("steps through landing pages and keeps the HTML preference in the links", async () => {
    const jsx = await templateNeighbors("05-mobile-app-landing", "jsx");
    expect(jsx).not.toBeNull();
    expect(jsx!.prev.href).toMatch(/^\/preview\/[^?]+$/);
    expect(jsx!.next.href).toMatch(/^\/preview\/[^?]+$/);
    expect(jsx!.prev.href).not.toBe(jsx!.next.href);

    const html = await templateNeighbors("05-mobile-app-landing", "html");
    expect(html!.next.href).toMatch(/\?kind=html$/);
    expect(html!.index).toBe(jsx!.index);
  });
});
