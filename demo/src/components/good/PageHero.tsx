import { definePlayground } from "@dslint/workbench";

type Props = {
  title: string;
  subtitle?: string;
};

/** Single clear title + optional subtitle (heading hierarchy). */
export function PageHero({ title, subtitle }: Props) {
  return (
    <header className="border-b border-surface-border bg-surface-elevated px-layout-lg py-layout-md">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      {subtitle ? <p className="mt-layout-xs text-slate-600">{subtitle}</p> : null}
    </header>
  );
}

export const { playgroundMeta, playgroundControls, PlaygroundPreview } = definePlayground(PageHero, {
  section: "good",
  description: "Single clear title and optional subtitle.",
  controls: [
    { key: "title", label: "Title", type: "string", default: "Example page" },
    {
      key: "subtitle",
      label: "Subtitle",
      type: "string",
      default: "Heading hierarchy stays simple for screen readers and scanability.",
    },
    { key: "showSubtitle", label: "Show subtitle", type: "boolean", default: true },
  ],
  props: (values) => ({
    title: String(values.title),
    subtitle: values.showSubtitle ? String(values.subtitle) : undefined,
  }),
});
