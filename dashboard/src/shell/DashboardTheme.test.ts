import { describe, expect, it } from "vitest";
import { resolveDashboardTheme } from "./DashboardTheme";

describe("resolveDashboardTheme", () => {
  it("follows the browser colour scheme for the system preference", () => {
    expect(resolveDashboardTheme("system", "dark")).toBe("dark");
    expect(resolveDashboardTheme("system", "light")).toBe("light");
  });

  it("keeps an explicit preference regardless of the browser colour scheme", () => {
    expect(resolveDashboardTheme("light", "dark")).toBe("light");
    expect(resolveDashboardTheme("dark", "light")).toBe("dark");
  });
});
