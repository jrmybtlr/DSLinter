import { demoAvatarSrc } from "../../playground/demoAssets";
import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";

type Props = {
  src: string;
  name: string;
};

/** Always passes meaningful `alt` for real user photos. */
export function UserAvatar({ src, name }: Props) {
  return (
    <img
      src={src}
      alt={`Avatar of ${name}`}
      className="h-12 w-12 rounded-full border-2 border-surface-border object-cover"
    />
  );
}

export const playgroundMeta: PlaygroundMeta = {
  id: "UserAvatar",
  title: "UserAvatar",
  section: "good",
  description: "Passes meaningful alt text for real user photos.",
};

export const playgroundControls: PlaygroundControl[] = [
  { key: "name", label: "Name (used in alt)", type: "string", default: "Jordan Lee" },
];

export function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
  return <UserAvatar src={demoAvatarSrc} name={String(values.name)} />;
}
