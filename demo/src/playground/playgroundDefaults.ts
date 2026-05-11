import { demoAvatarSrc } from "./demoAssets";

/** Merged into preview props when controls leave a prop empty (e.g. demo image URLs). */
export const playgroundStaticDefaults: Record<string, Record<string, unknown>> = {
  UserAvatar: { src: demoAvatarSrc },
};
