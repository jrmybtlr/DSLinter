import { demoAvatarSrc } from "../../playground/demoAssets";
import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";
import { FormField } from "./FormField";
import { InlineCode } from "./InlineCode";
import { NavLink } from "./NavLink";
import { PrimaryButton } from "./PrimaryButton";
import { StatusBadge } from "./StatusBadge";
import { UserAvatar } from "./UserAvatar";

type Props = {
  title: string;
  children: React.ReactNode;
};

/** Card shell using semantic surface tokens. */
export function ContentCard({ title, children }: Props) {
  return (
    <article className="rounded-ds-lg border border-surface-border bg-surface-elevated p-layout-md shadow-sm">
      <h3 className="mb-layout-sm text-lg font-semibold text-slate-900">{title}</h3>
      <div className="text-sm text-slate-600">{children}</div>
    </article>
  );
}

export const playgroundMeta: PlaygroundMeta = {
  id: "ContentCard",
  title: "ContentCard",
  section: "good",
  description: "Card shell using semantic surface tokens with nested examples.",
};

export const playgroundControls: PlaygroundControl[] = [
  { key: "cardTitle", label: "Card title", type: "string", default: "Good — tokens & a11y" },
  { key: "buttonLabel", label: "Primary button", type: "string", default: "Save" },
  { key: "avatarName", label: "Avatar name", type: "string", default: "Jordan Lee" },
  { key: "badgeText", label: "Badge text", type: "string", default: "Synced" },
  {
    key: "badgeTone",
    label: "Badge tone",
    type: "select",
    default: "success",
    options: [
      { value: "neutral", label: "neutral" },
      { value: "success", label: "success" },
      { value: "danger", label: "danger" },
    ],
  },
  { key: "emailLabel", label: "Field label", type: "string", default: "Email" },
  { key: "navText", label: "Nav link text", type: "string", default: "Token wall" },
  { key: "showNav", label: "Show token link", type: "boolean", default: true },
];

export function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
  const tone =
    values.badgeTone === "neutral" || values.badgeTone === "danger" ? values.badgeTone : "success";
  return (
    <ContentCard title={String(values.cardTitle)}>
      <p className="mb-layout-md">
        Uses extended Tailwind theme (<InlineCode>primary</InlineCode>, <InlineCode>surface</InlineCode>,{" "}
        <InlineCode>layout-*</InlineCode> spacing).
      </p>
      <div className="flex flex-wrap items-center gap-layout-md">
        <PrimaryButton>{String(values.buttonLabel)}</PrimaryButton>
        <UserAvatar src={demoAvatarSrc} name={String(values.avatarName)} />
        <StatusBadge tone={tone}>{String(values.badgeText)}</StatusBadge>
      </div>
      <div className="mt-layout-md space-y-layout-sm">
        <FormField id="playground-email" label={String(values.emailLabel)} />
        {values.showNav ? <NavLink href="#!/tokens">{String(values.navText)}</NavLink> : null}
      </div>
    </ContentCard>
  );
}
