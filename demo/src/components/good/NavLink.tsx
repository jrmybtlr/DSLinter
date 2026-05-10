import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";

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

export const playgroundMeta: PlaygroundMeta = {
  id: "NavLink",
  title: "NavLink",
  section: "good",
  description: "Visible focus ring for keyboard users.",
};

export const playgroundControls: PlaygroundControl[] = [
  { key: "href", label: "href", type: "string", default: "#!/overview" },
  { key: "text", label: "Link text", type: "string", default: "Back to overview" },
];

export function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
  return (
    <NavLink href={String(values.href)}>{String(values.text)}</NavLink>
  );
}
