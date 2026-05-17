import tsx from "@shikijs/langs/tsx";
import githubDark from "@shikijs/themes/github-dark";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

const THEME = "github-dark";
const LANG = "tsx";

let highlighterPromise: Promise<HighlighterCore> | null = null;

function getHighlighter(): Promise<HighlighterCore> {
  if (highlighterPromise == null) {
    highlighterPromise = createHighlighterCore({
      themes: [githubDark],
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
  signal?: AbortSignal,
): Promise<string> {
  const highlighter = await getHighlighter();
  assertNotAborted(signal);
  return highlighter.codeToHtml(source, { lang: LANG, theme: THEME });
}
