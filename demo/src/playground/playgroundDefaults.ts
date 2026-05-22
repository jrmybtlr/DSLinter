import { demoAvatarSrc } from "./demoAssets";

/** Merged into preview props when controls leave a prop empty (e.g. demo image URLs). */
export const playgroundStaticDefaults: Record<string, Record<string, unknown>> = {
  UserAvatar: { src: demoAvatarSrc },
  TextField: {
    id: "demo-text",
    label: "Email",
    placeholder: "you@example.com",
  },
  SelectField: {
    id: "demo-select",
    label: "Plan",
    options: "Free, Pro, Enterprise",
    defaultValue: "Free",
  },
  TextareaField: {
    id: "demo-textarea",
    label: "Notes",
    rows: 4,
  },
  TextLink: { href: "/governance" },
  ProgressBar: { value: 45, max: 100 },
  InlineAlert: {
    children: "You can edit props in the playground panel to try different variants.",
  },
  Spinner: { label: "Loading" },
};
