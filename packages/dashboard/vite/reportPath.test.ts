import { describe, expect, it } from "vitest";
import { join, resolve } from "node:path";
import { resolveReportFilePath } from "../shared/reportPath";

describe("resolveReportFilePath", () => {
  it("defaults to public/dslinter-report.json under scan root", () => {
    const root = "/app/demo-inertia";
    expect(resolveReportFilePath(root, {})).toBe(
      resolve(root, "public", "dslinter-report.json"),
    );
  });

  it("uses DSLINTER_REPORT_PATH when set", () => {
    const custom = join("/tmp", "custom-report.json");
    expect(
      resolveReportFilePath("/app", { DSLINTER_REPORT_PATH: custom }),
    ).toBe(resolve(custom));
  });
});
