import { useEffect, useRef, useState } from "react";
import "@shikijs/twoslash/style-rich.css";
import { renderPlaygroundUsageHtml } from "./playgroundUsageHighlight";

const shellClass =
  "playground-usage-shiki mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-gray-950 p-4 text-sm leading-relaxed shadow-xs " +
  "[&_.shiki]:!bg-transparent [&_pre.shiki]:!m-0 [&_pre.shiki]:!bg-transparent [&_pre.shiki]:!p-0";

const plainPreClass = "m-0 whitespace-pre font-mono text-sm leading-relaxed text-gray-100";

type Props = {
  source: string;
};

export function PlaygroundUsageCode({ source }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    const ac = new AbortController();
    setHtml(null);

    void (async () => {
      try {
        const next = await renderPlaygroundUsageHtml(source, ac.signal);
        if (id !== seq.current) return;
        setHtml(next);
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") return;
        if (id !== seq.current) return;
        setHtml(null);
      }
    })();

    return () => ac.abort();
  }, [source]);

  if (html) {
    return <div className={shellClass} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <pre className={shellClass}>
      <code className={plainPreClass}>{source}</code>
    </pre>
  );
}
