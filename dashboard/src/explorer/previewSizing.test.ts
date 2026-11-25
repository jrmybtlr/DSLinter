import { describe, expect, it } from "vitest";
import {
  createPreviewHeightTracker,
  previewHeightForLayout,
  previewHeightLimit,
} from "./previewSizing";

describe("automatic preview height", () => {
  it("keeps ordinary content at its natural height", () => {
    expect(previewHeightForLayout(240.2, [], 64, 720)).toBe(241);
  });

  it("includes a portaled menu and breathing room below its anchor", () => {
    expect(
      previewHeightForLayout(
        152,
        [{ top: 96, bottom: 233.5, height: 137.5, layout: "anchored" }],
        64,
        720,
      ),
    ).toBe(298);
  });

  it("fits a centered dialog independently of the current viewport", () => {
    for (const viewport of [128, 400, 720]) {
      const top = (viewport - 272) / 2;
      expect(
        previewHeightForLayout(
          128,
          [{ top, bottom: top + 272, height: 272, layout: "centered" }],
          64,
          720,
        ),
      ).toBe(400);
    }
  });

  it("gives a popup flipped above its anchor enough space to reposition", () => {
    expect(
      previewHeightForLayout(
        152,
        [{ top: -100, bottom: 64, height: 164, layout: "anchored" }],
        64,
        720,
      ),
    ).toBe(292);
  });

  it("includes nested surfaces and shrinks when they close", () => {
    const menu = { top: 96, bottom: 234, height: 138, layout: "anchored" as const };
    const submenu = { top: 200, bottom: 400, height: 200, layout: "anchored" as const };
    expect(previewHeightForLayout(152, [menu, submenu], 64, 720)).toBe(464);
    expect(previewHeightForLayout(152, [menu], 64, 720)).toBe(298);
    expect(previewHeightForLayout(152, [], 64, 720)).toBe(152);
  });

  it("uses stable stages for viewport-filling surfaces in both preview sizes", () => {
    for (const compact of [false, true]) {
      const limit = previewHeightLimit(compact);
      const padding = compact ? 32 : 64;
      for (const viewport of [128, limit])
        expect(
          previewHeightForLayout(
            padding * 2,
            [{ top: 0, bottom: viewport, height: viewport, layout: "viewport" }],
            padding,
            limit,
          ),
        ).toBe(limit);
    }
  });

  it("preserves the overflow signal for tall ordinary content", () => {
    expect(previewHeightForLayout(1200, [], 64, 720)).toBe(1200);
  });
});

describe("stable preview area", () => {
  it("starts at each component's measured height without reserving guessed popup space", () => {
    for (const height of [100, 164, 212, 450]) {
      const tracker = createPreviewHeightTracker();
      expect(tracker.measure(height, 640)).toBe(height);
    }
  });

  it("keeps the area stable as menus and nested surfaces open and close", () => {
    const tracker = createPreviewHeightTracker();
    const menu = { top: 96, bottom: 234, height: 138, layout: "anchored" as const };
    const submenu = { top: 200, bottom: 400, height: 200, layout: "anchored" as const };
    const heights = [[], [menu], [menu, submenu], [menu], []].map((surfaces) => {
      const measured = previewHeightForLayout(164, surfaces, 64, 720);
      tracker.measure(measured, 640);
      return tracker.measure(measured, 640);
    });
    expect(heights).toEqual([164, 298, 464, 464, 464]);
  });

  it("does not retain temporary positioning or animation bounds", () => {
    const tracker = createPreviewHeightTracker();
    const heights = [164, 164, 326, 278, 278, 164].map((height) => tracker.measure(height, 640));
    expect(heights).toEqual([164, 164, 326, 278, 278, 278]);
  });

  it("remeasures for a new width, including when returning to a previous width", () => {
    const tracker = createPreviewHeightTracker();
    expect(tracker.measure(600, 320)).toBe(600);
    expect(tracker.measure(300, 640)).toBe(300);
    expect(tracker.measure(400, 320)).toBe(400);
  });

  it("clears reserved space when mounting a new component or resetting the preview", () => {
    const tracker = createPreviewHeightTracker();
    tracker.measure(600, 640);
    tracker.reset();
    expect(tracker.measure(164, 640)).toBe(164);
  });

  it("retains the overflow signal for surfaces taller than the frame limit", () => {
    const tracker = createPreviewHeightTracker();
    expect(tracker.measure(1200, 640)).toBe(1200);
    expect(tracker.measure(1200, 640)).toBe(1200);
    expect(tracker.measure(164, 640)).toBe(1200);
  });
});
