import { describe, expect, it } from "vitest";
import type { PlaygroundControl } from "../types/controls";
import {
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

describe("valuesToComponentProps", () => {
  it("coerces stringArray props to string[]", () => {
    const controls: PlaygroundControl[] = [
      {
        key: "errors",
        label: "errors",
        type: "string",
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

  it("uses name heuristic for errors when kind is missing", () => {
    const controls: PlaygroundControl[] = [
      {
        key: "errors",
        label: "errors",
        type: "string",
        default: "Something went wrong.",
      },
    ];

    const props = valuesToComponentProps(controls, ["errors"], {
      errors: "Something went wrong.",
    });

    expect(props.errors).toEqual(["Something went wrong."]);
  });
});
