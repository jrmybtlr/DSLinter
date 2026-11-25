/** Minimal element shape so the classifier can be unit-tested without a DOM. */
export type PreviewInsetNode = {
  tagName: string;
  getAttribute(name: string): string | null;
  children: PreviewInsetNode[];
};

const CONTROLS = new Set(["BUTTON", "INPUT", "TEXTAREA", "SELECT"]);
const LANDMARKS = new Set(["NAV", "HEADER", "FOOTER", "ASIDE"]);
const CHROME_ROLES = new Set([
  "navigation",
  "banner",
  "contentinfo",
  "complementary",
  "menubar",
]);
const CHROME_SLOTS = new Set(["navigation-menu", "sidebar"]);

function isBreadcrumb(node: PreviewInsetNode): boolean {
  return (
    node.getAttribute("aria-label") === "breadcrumb" ||
    node.getAttribute("data-slot") === "breadcrumb"
  );
}

function isChrome(node: PreviewInsetNode): boolean {
  if (isBreadcrumb(node)) return false;
  const tag = node.tagName.toUpperCase();
  if (LANDMARKS.has(tag)) return true;
  const role = node.getAttribute("role");
  if (role && CHROME_ROLES.has(role)) return true;
  const slot = node.getAttribute("data-slot");
  if (slot && CHROME_SLOTS.has(slot)) return true;
  return node.getAttribute("data-sidebar") !== null;
}

function isControl(node: PreviewInsetNode): boolean {
  return CONTROLS.has(node.tagName.toUpperCase());
}

/** True when the preview surface is page chrome that should sit flush with the frame. */
export function previewBleeds(root: PreviewInsetNode): boolean {
  let current = root;
  for (;;) {
    if (isChrome(current)) return true;
    if (isControl(current)) return false;
    const kids = current.children;
    if (kids.length === 0) return false;
    if (kids.length > 1) return false;
    current = kids[0]!;
  }
}

export function previewPadding(compact: boolean, bleeds: boolean): string {
  if (bleeds) return "0";
  return compact ? "32px" : "64px";
}

export function applyPreviewInset(root: HTMLElement, compact: boolean): void {
  root.style.padding = previewPadding(compact, previewBleeds(asInsetNode(root)));
}

function asInsetNode(element: Element): PreviewInsetNode {
  return {
    tagName: element.tagName,
    getAttribute: (name) => element.getAttribute(name),
    get children() {
      return [...element.children].map(asInsetNode);
    },
  };
}
