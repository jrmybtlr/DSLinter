import tsx from "@shikijs/langs/tsx";
import githubDark from "@shikijs/themes/github-dark";
import githubLight from "@shikijs/themes/github-light";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

export type PlaygroundUsageTheme = "light" | "dark";

const SHIKI_THEMES: Record<PlaygroundUsageTheme, string> = {
  light: "github-light",
  dark: "github-dark",
};

const LANG = "tsx";

let highlighterPromise: Promise<HighlighterCore> | null = null;

function getHighlighter(): Promise<HighlighterCore> {
  if (highlighterPromise == null) {
    highlighterPromise = createHighlighterCore({
      themes: [githubLight, githubDark],
      langs: [tsx],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighterPromise;
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

/** Renders usage source to Shiki HTML. */
export async function renderPlaygroundUsageHtml(
  source: string,
  theme: PlaygroundUsageTheme,
  signal?: AbortSignal,
): Promise<string> {
  const highlighter = await getHighlighter();
  assertNotAborted(signal);
  return highlighter.codeToHtml(source, {
    lang: LANG,
    theme: SHIKI_THEMES[theme],
  });
}
