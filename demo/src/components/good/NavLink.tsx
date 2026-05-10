import { definePlayground } from "@dslint/workbench";

type Props = {
  href: string;
  children: React.ReactNode;
};

/** Visible focus ring for keyboard users. */
export function NavLink({ href, children }: Props) {
  return (
    <a
      href={href}
      className="text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {children}
    </a>
  );
}

export const { playgroundMeta, playgroundControls, PlaygroundPreview } = definePlayground(NavLink, {
  section: "good",
  description: "Visible focus ring for keyboard users.",
  controls: [
    { key: "href", label: "href", type: "string", default: "#!/overview" },
    { key: "text", label: "Link text", type: "string", default: "Back to overview" },
  ],
  props: (values) => ({
    href: String(values.href),
    children: String(values.text),
  }),
});
