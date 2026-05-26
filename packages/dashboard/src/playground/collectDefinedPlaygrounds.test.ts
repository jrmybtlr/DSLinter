import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { definePlayground } from "./definePlayground";
import { collectDefinedPlaygrounds } from "./collectDefinedPlaygrounds";

describe("collectDefinedPlaygrounds", () => {
  it("collects definePlayground exports from eager modules", () => {
    const defined = definePlayground({
      id: "DropdownMenu",
      group: "ui",
      render: () => createElement("span", null, "menu"),
    });
    const modules = {
      "../components/ui/dropdown-menu.playground.tsx": {
        dropdownMenuPlayground: defined,
        unrelated: 42,
      },
    };
    const entries = collectDefinedPlaygrounds(modules);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe("DropdownMenu");
    expect(entries[0]?.meta.group).toBe("ui");
    expect(entries[0]?.controls).toEqual([]);
  });

  it("ignores modules without definePlayground exports", () => {
    const modules = {
      "../components/ui/button.tsx": {
        Button: () => createElement("button"),
      },
    };
    expect(collectDefinedPlaygrounds(modules)).toEqual([]);
  });

  it("ignores malformed definePlayground-like exports", () => {
    const modules = {
      "../components/ui/dropdown-menu.playground.tsx": {
        invalid: {
          playgroundMeta: { id: "DropdownMenu", title: 123 },
          playgroundControls: [],
          PlaygroundPreview: () => createElement("span", null, "menu"),
        },
      },
    };
    expect(collectDefinedPlaygrounds(modules)).toEqual([]);
  });
});
