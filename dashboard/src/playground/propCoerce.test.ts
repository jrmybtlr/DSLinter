import { describe, expect, it } from "vitest";
import type { PlaygroundControl } from "../types/controls";
import {
  parseNumberArrayPanelValue,
  parseStringArrayPanelValue,
  valuesToComponentProps,
} from "./propCoerce";

describe("parseStringArrayPanelValue", () => {
  it("splits multiline panel text into trimmed unique items", () => {
    expect(parseStringArrayPanelValue("First\nSecond\nFirst")).toEqual([
      "First",
      "Second",
    ]);
  });

  it("returns empty array for blank input", () => {
    expect(parseStringArrayPanelValue("")).toEqual([]);
    expect(parseStringArrayPanelValue("   \n  ")).toEqual([]);
  });
});

describe("parseNumberArrayPanelValue", () => {
  it("parses unique finite numbers from multiline text", () => {
    expect(parseNumberArrayPanelValue("1\n2\n1\nx\n3.5")).toEqual([1, 2, 3.5]);
  });

  it("returns empty array for blank input", () => {
    expect(parseNumberArrayPanelValue("")).toEqual([]);
  });
});

describe("valuesToComponentProps", () => {
  it("coerces stringArray props to string[]", () => {
    const controls: PlaygroundControl[] = [
      {
        key: "errors",
        label: "errors",
        type: "stringArray",
        default: "Something went wrong.",
      },
      {
        key: "title",
        label: "title",
        type: "string",
        default: "Label",
      },
    ];

    const props = valuesToComponentProps(
      controls,
      ["errors", "title"],
      {
        errors: "Something went wrong.",
        title: "Request failed",
      },
      { errors: "stringArray", title: "string" },
    );

    expect(props.errors).toEqual(["Something went wrong."]);
    expect(props.title).toBe("Request failed");
  });

  it("coerces numberArray props and skips icon/function/object", () => {
    const controls: PlaygroundControl[] = [
      {
        key: "ids",
        label: "ids",
        type: "numberArray",
        default: "1\n2",
      },
      {
        key: "iconNode",
        label: "iconNode",
        type: "icon",
        default: "",
        typeLabel: "LucideIcon",
      },
      {
        key: "passkey",
        label: "passkey",
        type: "object",
        default: "",
        typeLabel: "Passkey",
      },
      {
        key: "onDelete",
        label: "onDelete",
        type: "function",
        default: "",
        typeLabel: "(id: number) => void",
      },
    ];

    const props = valuesToComponentProps(
      controls,
      ["ids", "iconNode", "passkey", "onDelete"],
      { ids: "10\n20" },
      {
        ids: "numberArray",
        iconNode: "icon",
        passkey: "object",
        onDelete: "function",
      },
    );

    expect(props.ids).toEqual([10, 20]);
    expect(props.iconNode).toBeUndefined();
    expect(props.passkey).toBeUndefined();
    expect(props.onDelete).toBeUndefined();
  });

  it("uses name heuristic for errors when kind is missing", () => {
    const controls: PlaygroundControl[] = [
      {
        key: "errors",
        label: "errors",
        type: "stringArray",
        default: "Something went wrong.",
      },
    ];

    const props = valuesToComponentProps(controls, ["errors"], {
      errors: "Something went wrong.",
    });

    expect(props.errors).toEqual(["Something went wrong."]);
  });
});
