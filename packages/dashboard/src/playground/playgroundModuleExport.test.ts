import { forwardRef } from "react";
import { describe, expect, it } from "vitest";
import { getModuleExport, isPlaygroundComponent } from "./playgroundModuleExport";

describe("playgroundModuleExport", () => {
  it("accepts forwardRef components", () => {
    const Forward = forwardRef(() => null);
    expect(typeof Forward).toBe("object");
    expect(isPlaygroundComponent(Forward)).toBe(true);
  });

  it("getModuleExport returns forwardRef export", () => {
    const Forward = forwardRef(() => null);
    Forward.displayName = "DropdownMenu";
    const mod = { DropdownMenu: Forward };
    expect(getModuleExport(mod, "DropdownMenu")).toBe(Forward);
  });

  it("getModuleExport falls back to default export when named export is missing", () => {
    function AppLogoIcon() {
      return null;
    }
    const mod = { default: AppLogoIcon };
    expect(getModuleExport(mod, "AppLogoIcon")).toBe(AppLogoIcon);
  });

  it("getModuleExport prefers named export over default", () => {
    function Named() {
      return null;
    }
    function DefaultOnly() {
      return null;
    }
    const mod = { Button: Named, default: DefaultOnly };
    expect(getModuleExport(mod, "Button")).toBe(Named);
  });

  it("rejects non-components", () => {
    expect(isPlaygroundComponent(null)).toBe(false);
    expect(isPlaygroundComponent({ foo: 1 })).toBe(false);
  });
});
