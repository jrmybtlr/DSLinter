import tsx from "@shikijs/langs/tsx";
import githubDark from "@shikijs/themes/github-dark";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

const THEME = "github-dark";
const LANG = "tsx";

/** When true, run Twoslash (CDN ATA + hover) before highlighting. */
export function usageSnippetNeedsTwoslash(source: string): boolean {
  return (
    /\^\?/.test(source) ||
    /\/\/\s*@(?:errors|error|log|warn|filename|noErrors)/m.test(source) ||
    /\/\/\s*---cut---/.test(source)
  );
}

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

/**
 * Renders usage source to Shiki HTML. Twoslash runs only when {@link usageSnippetNeedsTwoslash} is true
 * (loaded in a separate async chunk so the default bundle stays smaller).
 */
export async function renderPlaygroundUsageHtml(source: string, signal?: AbortSignal): Promise<string> {
  const highlighter = await getHighlighter();
  assertNotAborted(signal);

  if (!usageSnippetNeedsTwoslash(source)) {
    return highlighter.codeToHtml(source, { lang: LANG, theme: THEME });
  }

  const { renderUsageWithTwoslash } = await import("./playgroundUsageTwoslash");
  assertNotAborted(signal);
  return renderUsageWithTwoslash(highlighter, source, signal);
}
