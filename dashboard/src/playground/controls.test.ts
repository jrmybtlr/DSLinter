import { describe, expect, it } from "vitest";
import { controlsFromDeclaredProps } from "./controls";

describe("controlsFromDeclaredProps", () => {
  it("uses a readable default for stringArray errors props", () => {
    const controls = controlsFromDeclaredProps(["errors", "title"], {
      errors: "stringArray",
      title: "string",
    });
    const errorsControl = controls.find((c) => c.key === "errors");
    expect(errorsControl?.type).toBe("stringArray");
    if (errorsControl?.type === "stringArray") {
      expect(errorsControl.default).toBe("Something went wrong.");
      expect(errorsControl.placeholder).toBe("One item per line");
    }
  });

  it("emits display-only function/object/icon controls (no string fakes)", () => {
    const controls = controlsFromDeclaredProps(
      ["onDelete", "passkey", "ids", "iconNode", "title"],
      {
        onDelete: "function",
        passkey: "object",
        ids: "numberArray",
        iconNode: "icon",
        title: "string",
      },
      undefined,
      undefined,
      undefined,
      { title: true, iconNode: true },
      {
        iconNode: "LucideIcon",
        passkey: "Passkey",
        onDelete: "(id: number) => void",
      },
    );

    const onDelete = controls.find((c) => c.key === "onDelete");
    expect(onDelete?.type).toBe("function");
    if (onDelete?.type === "function") {
      expect(onDelete.typeLabel).toBe("(id: number) => void");
    }

    const passkey = controls.find((c) => c.key === "passkey");
    expect(passkey?.type).toBe("object");
    if (passkey?.type === "object") {
      expect(passkey.typeLabel).toBe("Passkey");
    }

    expect(controls.find((c) => c.key === "ids")?.type).toBe("numberArray");
    const icon = controls.find((c) => c.key === "iconNode");
    expect(icon?.type).toBe("icon");
    if (icon?.type === "icon") {
      expect(icon.typeLabel).toBe("LucideIcon");
      expect(icon.optional).toBe(true);
    }
    expect(controls.find((c) => c.key === "title")?.optional).toBe(true);
  });

  it("emits display-only function controls for onX props when kind is missing", () => {
    const controls = controlsFromDeclaredProps(["onClick", "label"], {
      label: "string",
    });
    expect(controls.map((c) => c.key)).toEqual(["onClick", "label"]);
    const onClick = controls.find((c) => c.key === "onClick");
    expect(onClick?.type).toBe("function");
    if (onClick?.type === "function") {
      expect(onClick.typeLabel).toBe("function");
    }
  });

  it("never invents string editors for unclassified props", () => {
    const controls = controlsFromDeclaredProps(["payload"], undefined);
    const payload = controls.find((c) => c.key === "payload");
    expect(payload?.type).toBe("object");
    if (payload?.type === "object") {
      expect(payload.typeLabel).toBe("unknown");
    }
  });
});
