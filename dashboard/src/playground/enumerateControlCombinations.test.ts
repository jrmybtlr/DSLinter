import { describe, expect, it } from "vitest";
import {
  enumerateControlCombinations,
  PLAYGROUND_VARIANT_MATRIX_CAP,
} from "./enumerateControlCombinations";
import type { PlaygroundControl } from "../types/controls";

describe("enumerateControlCombinations", () => {
  it("returns empty when there are no boolean or select axes", () => {
    const controls: PlaygroundControl[] = [
      { key: "label", label: "label", type: "string", default: "Hi" },
      { key: "count", label: "count", type: "number", default: 1 },
    ];
    const base = { label: "X", count: 42 };
    const r = enumerateControlCombinations(controls, base);
    expect(r.combinations).toEqual([]);
    expect(r.totalCount).toBe(0);
    expect(r.capped).toBe(false);
    expect(r.finiteAxisKeys).toEqual([]);
  });

  it("expands booleans and merges string props from base", () => {
    const controls: PlaygroundControl[] = [
      { key: "open", label: "open", type: "boolean", default: false },
      { key: "title", label: "title", type: "string", default: "T" },
    ];
    const base = { open: false, title: "Hello" };
    const r = enumerateControlCombinations(controls, base);
    expect(r.totalCount).toBe(2);
    expect(r.capped).toBe(false);
    expect(r.finiteAxisKeys).toEqual(["open"]);
    expect(r.combinations).toEqual([
      { open: false, title: "Hello" },
      { open: true, title: "Hello" },
    ]);
  });

  it("computes Cartesian product for boolean and select", () => {
    const controls: PlaygroundControl[] = [
      {
        key: "variant",
        label: "variant",
        type: "select",
        default: "a",
        options: [
          { value: "a", label: "a" },
          { value: "b", label: "b" },
        ],
      },
      { key: "disabled", label: "disabled", type: "boolean", default: false },
    ];
    const base = { variant: "a", disabled: false, extra: "keep" };
    const r = enumerateControlCombinations(controls, base);
    expect(r.totalCount).toBe(4);
    expect(r.combinations).toHaveLength(4);
    expect(r.finiteAxisKeys).toEqual(["variant", "disabled"]);
    const keys = r.combinations.map((c) => `${c.variant}:${c.disabled}`);
    expect(keys.sort()).toEqual(["a:false", "a:true", "b:false", "b:true"]);
    for (const c of r.combinations) {
      expect(c.extra).toBe("keep");
    }
  });

  it("skips select with zero options", () => {
    const controls: PlaygroundControl[] = [
      {
        key: "empty",
        label: "empty",
        type: "select",
        default: "x",
        options: [],
      },
      { key: "on", label: "on", type: "boolean", default: false },
    ];
    const r = enumerateControlCombinations(controls, { on: false });
    expect(r.totalCount).toBe(2);
    expect(r.finiteAxisKeys).toEqual(["on"]);
  });

  it("caps combinations and reports totalCount", () => {
    const options = Array.from({ length: 20 }, (_, i) => ({
      value: `v${i}`,
      label: `v${i}`,
    }));
    const controls: PlaygroundControl[] = [
      { key: "a", label: "a", type: "boolean", default: false },
      { key: "b", label: "b", type: "boolean", default: false },
      { key: "c", label: "c", type: "boolean", default: false },
      { key: "d", label: "d", type: "boolean", default: false },
      { key: "e", label: "e", type: "boolean", default: false },
      {
        key: "s",
        label: "s",
        type: "select",
        default: "v0",
        options,
      },
    ];
    const base: Record<string, string | number | boolean> = {
      a: false,
      b: false,
      c: false,
      d: false,
      e: false,
      s: "v0",
    };
    const r = enumerateControlCombinations(controls, base);
    expect(r.totalCount).toBe(2 ** 5 * 20);
    expect(r.capped).toBe(true);
    expect(r.combinations.length).toBe(PLAYGROUND_VARIANT_MATRIX_CAP);
  });
});
