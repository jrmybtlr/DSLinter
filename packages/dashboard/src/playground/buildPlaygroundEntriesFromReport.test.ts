import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlaygroundControl, PlaygroundEntry } from "../types/playground";
import type { WorkspaceReport } from "../types/report";
import {
  buildPlaygroundEntriesFromReportWithSkips,
  resolvePlaygroundEntry,
} from "./buildPlaygroundEntriesFromReport";

const entries: PlaygroundEntry[] = [
  {
    id: "PrimaryButton",
    meta: { id: "PrimaryButton", title: "PrimaryButton" },
    modulePath: "@dslinter-scan/src/components/PrimaryButton.tsx",
    controls: [],
    renderPreview: () => null,
    Preview: () => null,
  },
];

describe("resolvePlaygroundEntry", () => {
  it("finds by catalog export name id", () => {
    expect(resolvePlaygroundEntry(entries, "PrimaryButton")).toBe(entries[0]);
  });

  it("returns undefined for unknown name", () => {
    expect(resolvePlaygroundEntry(entries, "Missing")).toBeUndefined();
  });
});

describe("playground catalog id alignment", () => {
  it("report playgrounds use export_name as id", () => {
    const report: WorkspaceReport = {
      root: "/repo",
      files: [],
      findings: [],
      scores: {
        system_health: 0,
        token_adoption: 0,
        component_adoption: 0,
        ux_consistency: 0,
      },
      ownership: [],
      duplicate_components: [],
      usage_by_component: [],
      playgrounds: [
        {
          id: "Card",
          export_name: "Card",
          rel_path: "src/components/nested/DuplicateCardA.tsx",
          declared_props: [],
        },
      ],
    };
    expect(report.playgrounds?.[0]?.id).toBe("Card");
    expect(report.playgrounds?.[0]?.export_name).toBe("Card");
  });
});

describe("playground preview props", () => {
  const report: WorkspaceReport = {
    root: "/repo",
    files: [],
    findings: [],
    scores: {
      system_health: 0,
      token_adoption: 0,
      component_adoption: 0,
      ux_consistency: 0,
    },
    ownership: [],
    duplicate_components: [],
    usage_by_component: [],
    playgrounds: [
      {
        id: "Demo",
        export_name: "Demo",
        rel_path: "src/components/Demo.tsx",
        declared_props: ["children"],
      },
    ],
  };

  it("maps playground control values even when declared_props omits them", () => {
    const controlOverrides: Record<string, PlaygroundControl[]> = {
      Demo: [
        { key: "children", label: "children", type: "string", default: "" },
        {
          key: "variant",
          label: "variant",
          type: "select",
          default: "primary",
          options: [
            { value: "primary", label: "primary" },
            { value: "muted", label: "muted" },
          ],
        },
      ],
    };
    let lastProps: Record<string, unknown> | null = null;
    const modules = {
      "../components/Demo.tsx": {
        Demo: (props: Record<string, unknown>) => {
          lastProps = props;
          return createElement("span", null, String(props.children ?? ""));
        },
      },
    };
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(
      report,
      modules,
      {
        globKeyFromRelPath: (rel) => `../components/${rel.split("/").pop()}`,
        controlOverrides,
        logJoinSkips: false,
      },
    );
    const entry = entries[0];
    expect(entry).toBeDefined();
    renderToStaticMarkup(
      createElement(entry!.Preview, {
        values: { children: "Hello", variant: "muted" },
      }),
    );
    expect(lastProps).toMatchObject({ children: "Hello", variant: "muted" });
  });
});
