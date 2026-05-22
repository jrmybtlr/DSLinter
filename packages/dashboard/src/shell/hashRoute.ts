export type HashRoute =
  | { view: "tokens" }
  | { view: "governance" }
  | { view: "component"; componentId: string };

function normalizePath(input: string): string {
  const raw = input.trim();
  if (raw.startsWith("/")) {
    return raw.replace(/\/+$/, "") || "/";
  }
  return raw.length > 0 ? `/${raw}` : "/";
}

export function parseHashRoute(pathname: string): HashRoute {
  const path = normalizePath(pathname);
  if (path === "/" || path === "/overview" || path === "/governance") {
    return { view: "governance" };
  }
  if (path === "/tokens") {
    return { view: "tokens" };
  }
  if (path.startsWith("/component/")) {
    const componentId = decodeURIComponent(path.slice("/component/".length));
    if (componentId.length > 0) {
      return { view: "component", componentId };
    }
  }
  return { view: "governance" };
}

export function formatHashRoute(route: HashRoute): string {
  switch (route.view) {
    case "tokens":
      return "/tokens";
    case "governance":
      return "/governance";
    case "component":
      return `/component/${encodeURIComponent(route.componentId)}`;
    default:
      return "/governance";
  }
}

/** Drop stale `#!/…` fragments left over from hash routing. */
export function stripLegacyHashFragment(): boolean {
  if (!window.location.hash.startsWith("#!/")) return false;
  const clean = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", clean || "/governance");
  return true;
}
