import { describe, expect, it } from "vitest";
import {
  CONTAINER_WIDTH_PRESETS,
  SCREEN_WIDTH_PRESETS,
  containerBreakpointForWidth,
  screenBreakpointForWidth,
} from "./previewBreakpoints";

describe("screenBreakpointForWidth", () => {
  it("matches Tailwind / usemods screen thresholds", () => {
    expect(screenBreakpointForWidth(375)).toBe("xs");
    expect(screenBreakpointForWidth(639)).toBe("xs");
    expect(screenBreakpointForWidth(640)).toBe("sm");
    expect(screenBreakpointForWidth(767)).toBe("sm");
    expect(screenBreakpointForWidth(768)).toBe("md");
    expect(screenBreakpointForWidth(1023)).toBe("md");
    expect(screenBreakpointForWidth(1024)).toBe("lg");
    expect(screenBreakpointForWidth(1279)).toBe("lg");
    expect(screenBreakpointForWidth(1280)).toBe("xl");
    expect(screenBreakpointForWidth(1535)).toBe("xl");
    expect(screenBreakpointForWidth(1536)).toBe("2xl");
  });

  it("presets land on their own label", () => {
    for (const preset of SCREEN_WIDTH_PRESETS) {
      expect(screenBreakpointForWidth(preset.width)).toBe(preset.label);
    }
  });
});

describe("containerBreakpointForWidth", () => {
  it("uses Tailwind @container min-width semantics", () => {
    expect(containerBreakpointForWidth(319)).toBe("@xs");
    expect(containerBreakpointForWidth(320)).toBe("@xs");
    expect(containerBreakpointForWidth(383)).toBe("@xs");
    expect(containerBreakpointForWidth(384)).toBe("@sm");
    expect(containerBreakpointForWidth(995)).toBe("@4xl");
    expect(containerBreakpointForWidth(1023)).toBe("@4xl");
    expect(containerBreakpointForWidth(1024)).toBe("@5xl");
    expect(containerBreakpointForWidth(1151)).toBe("@5xl");
    expect(containerBreakpointForWidth(1152)).toBe("@6xl");
    expect(containerBreakpointForWidth(1280)).toBe("@7xl");
  });

  it("presets land on their own label", () => {
    for (const preset of CONTAINER_WIDTH_PRESETS) {
      expect(containerBreakpointForWidth(preset.width)).toBe(preset.label);
    }
  });
});
