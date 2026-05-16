import { createTransformerFactory, rendererRich } from "@shikijs/twoslash/core";
import type { ShikiTransformer } from "@shikijs/types";
import type { HighlighterCore } from "shiki/core";
import { createTwoslashFromCDN, type TwoslashCdnReturn } from "twoslash-cdn";
import type { CompilerOptions } from "typescript";

const THEME = "github-dark";
const LANG = "tsx";

let twoslashPromise: Promise<TwoslashCdnReturn> | null = null;

function getTwoslash(): Promise<TwoslashCdnReturn> {
  twoslashPromise ??= (async () => {
    const compilerOptions = {
      lib: ["esnext", "dom"],
      jsx: "react-jsx",
      moduleResolution: "bundler",
      skipLibCheck: true,
      target: "ESNext",
      module: "ESNext",
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
    } as unknown as CompilerOptions;

    const tw = createTwoslashFromCDN({
      compilerOptions,
    });
    await tw.init();
    return tw;
  })();
  return twoslashPromise;
}

let twoslashTransformerPromise: Promise<ShikiTransformer> | null = null;

function getTwoslashTransformer(): Promise<ShikiTransformer> {
  twoslashTransformerPromise ??= getTwoslash().then((tw) =>
    createTransformerFactory(tw.runSync)({
      renderer: rendererRich(),
      throws: false,
      langs: ["ts", "tsx"],
    }),
  );
  return twoslashTransformerPromise;
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

export async function renderUsageWithTwoslash(
  highlighter: HighlighterCore,
  source: string,
  signal?: AbortSignal,
): Promise<string> {
  const tw = await getTwoslash();
  assertNotAborted(signal);
  await tw.prepareTypes(source);
  assertNotAborted(signal);

  const transformer = await getTwoslashTransformer();
  assertNotAborted(signal);

  return highlighter.codeToHtml(source, {
    lang: LANG,
    theme: THEME,
    transformers: [transformer],
  });
}
