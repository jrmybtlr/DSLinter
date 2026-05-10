import type { PlaygroundControl, PlaygroundEntry, PlaygroundMeta, PlaygroundPreviewComponent } from "@dslint/workbench";
import { usageSnippets } from "./usageSnippets";

type PlaygroundModule = {
  playgroundMeta?: PlaygroundMeta;
  playgroundControls?: PlaygroundControl[];
  PlaygroundPreview?: PlaygroundPreviewComponent;
};

/** Optional `playgroundMeta` + `PlaygroundPreview` on any component module — no separate story files. */
const modules = import.meta.glob("../components/**/*.tsx", {
  eager: true,
}) as Record<string, PlaygroundModule>;

function buildEntries(): PlaygroundEntry[] {
  const out: PlaygroundEntry[] = [];
  for (const [modulePath, mod] of Object.entries(modules)) {
    const meta = mod?.playgroundMeta;
    const Preview = mod?.PlaygroundPreview;
    if (!meta || !Preview) continue;
    out.push({
      id: meta.id,
      meta,
      modulePath,
      controls: mod.playgroundControls ?? [],
      usageSnippet: usageSnippets[meta.id],
      Preview,
    });
  }
  out.sort((a, b) => {
    if (a.meta.section !== b.meta.section) {
      return a.meta.section === "good" ? -1 : 1;
    }
    return a.meta.title.localeCompare(b.meta.title);
  });
  return out;
}

export const playgroundEntries: PlaygroundEntry[] = buildEntries();

export function getPlaygroundEntry(id: string): PlaygroundEntry | undefined {
  return playgroundEntries.find((e) => e.id === id);
}
