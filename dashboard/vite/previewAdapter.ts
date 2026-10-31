import { existsSync } from "node:fs";
import { join } from "node:path";

const adapterNames = ["dslinter.preview.ts", "dslinter.preview.tsx", "dslinter.preview.js"];

export type PreviewApp = {
  id: string;
  name: string;
  root: string;
  config: string;
  framework: "react" | "vue";
};

export function findPreviewAdapter(appRoot: string, scanRoot: string): string | undefined {
  return [...new Set([appRoot, scanRoot])]
    .flatMap((root) => adapterNames.map((name) => join(root, name)))
    .find(existsSync);
}
