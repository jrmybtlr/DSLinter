import { describe, expect, it } from "vitest";
import { formatJsxPropAssignment, genericUsageSnippet } from "./snippet";
import type { PlaygroundControl } from "../types/controls";

describe("formatJsxPropAssignment", () => {
  it("uses string attribute syntax for simple strings", () => {
    expect(formatJsxPropAssignment("size", "lg")).toBe('size="lg"');
    expect(formatJsxPropAssignment("variant", "outline")).toBe(
      'variant="outline"',
    );
  });

  it("uses expression syntax for non-literal strings", () => {
    expect(formatJsxPropAssignment("title", 'Say "hi"')).toBe(
      'title={"Say \\"hi\\""}',
    );
  });

  it("uses boolean shorthand and explicit false", () => {
    expect(formatJsxPropAssignment("disabled", true)).toBe("disabled");
    expect(formatJsxPropAssignment("disabled", false)).toBe("disabled={false}");
  });

  it("uses expression syntax for numbers", () => {
    expect(formatJsxPropAssignment("count", 3)).toBe("count={3}");
  });
});

describe("genericUsageSnippet", () => {
  const controls: PlaygroundControl[] = [
    { key: "size", type: "select", default: "default", options: ["default", "lg"] },
    { key: "variant", type: "select", default: "default", options: ["default", "outline"] },
  ];

  it("renders select props with JSX string attributes", () => {
    expect(
      genericUsageSnippet("Toggle", { size: "lg", variant: "default" }, controls),
    ).toBe('<Toggle size="lg" />');
  });
});
