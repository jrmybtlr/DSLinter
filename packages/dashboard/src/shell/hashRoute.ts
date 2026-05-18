export type HashRoute =
  | { view: "tokens" }
  | { view: "governance"; catalog?: string }
  | { view: "component"; componentId: string };

const PREFIX = "#!/";

function stripShebang(hash: string): string {
  if (hash.startsWith(PREFIX)) {
    return hash.slice(PREFIX.length);
  }
  if (hash.startsWith("#")) {
    return hash.slice(1);
  }
  return hash;
}

export function parseHashRoute(hash: string): HashRoute {
  const raw = stripShebang(hash).trim();
  if (raw === "" || raw === "overview") {
    return { view: "governance" };
  }
  if (raw === "tokens") {
    return { view: "tokens" };
  }
  if (raw === "governance") {
    return { view: "governance" };
  }
  if (raw.startsWith("governance/")) {
    const catalog = decodeURIComponent(raw.slice("governance/".length));
    if (catalog.length > 0) {
      return { view: "governance", catalog };
    }
  }
  if (raw.startsWith("component/")) {
    const componentId = decodeURIComponent(raw.slice("component/".length));
    if (componentId.length > 0) {
      return { view: "component", componentId };
    }
  }
  return { view: "governance" };
}

export function formatHashRoute(route: HashRoute): string {
  switch (route.view) {
    case "tokens":
      return `${PREFIX}tokens`;
    case "governance":
      return route.catalog
        ? `${PREFIX}governance/${encodeURIComponent(route.catalog)}`
        : `${PREFIX}governance`;
    case "component":
      return `${PREFIX}component/${encodeURIComponent(route.componentId)}`;
    default:
      return `${PREFIX}governance`;
  }
}
