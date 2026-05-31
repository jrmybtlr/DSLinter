import { describe, expect, it } from "vitest";
import { controlsFromKitParams, inferKitParams } from "./inferKitParams";

describe("inferKitParams", () => {
  it("reads simple destructured keys", () => {
    const kit = ({ title, description }: { title: string; description: string }) =>
      `${title}-${description}`;
    expect(inferKitParams(kit)).toEqual([{ key: "title" }, { key: "description" }]);
  });

  it("reads inline defaults from destructuring", () => {
    const kit = ({ placeholder = "Pick a stack" }: { placeholder?: string }) => placeholder;
    expect(inferKitParams(kit)).toEqual([
      { key: "placeholder", defaultValue: "Pick a stack" },
    ]);
  });

  it("reads boolean defaults", () => {
    const kit = ({ showEmail = false }: { showEmail?: boolean }) => showEmail;
    expect(inferKitParams(kit)).toEqual([{ key: "showEmail", defaultValue: false }]);
  });

  it("returns empty for parameterless kits", () => {
    const kit = () => "static";
    expect(inferKitParams(kit)).toEqual([]);
  });

  it("returns empty for non-destructured params", () => {
    const kit = (props: { title: string }) => props.title;
    expect(inferKitParams(kit)).toEqual([]);
  });

  it("builds control defaults from inferred params", () => {
    expect(
      controlsFromKitParams([
        { key: "title" },
        { key: "placeholder", defaultValue: "Pick one" },
      ]),
    ).toEqual({ title: "title", placeholder: "Pick one" });
  });
});
