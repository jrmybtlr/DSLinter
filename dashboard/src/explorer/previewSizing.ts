import { observePreviewResize } from "./previewResize";

export function previewHeightLimit(compact: boolean): number {
  return compact ? 384 : 720;
}

/** Retain settled surface heights until the preview layout changes. */
export function createPreviewHeightTracker() {
  let width: number | undefined;
  let largest = 0;
  let candidate: number | undefined;
  return {
    measure(height: number, nextWidth: number): number {
      if (width !== nextWidth) {
        largest = 0;
        candidate = undefined;
      }
      width = nextWidth;
      // Popup positioning can briefly report oversized bounds before layout settles.
      if (height === candidate) largest = Math.max(largest, height);
      candidate = height;
      return Math.max(largest, height);
    },
    reset(): void {
      width = undefined;
      largest = 0;
      candidate = undefined;
    },
  };
}

type SurfaceBounds = {
  top: number;
  bottom: number;
  height: number;
  layout: "anchored" | "centered" | "viewport";
};

/** Viewport-relative surfaces must not feed their current position back into frame height. */
export function previewHeightForLayout(
  rootHeight: number,
  surfaces: SurfaceBounds[],
  padding: number,
  limit: number,
): number {
  let height = rootHeight;
  for (const surface of surfaces) {
    if (surface.layout === "viewport") height = Math.max(height, limit);
    else if (surface.layout === "centered") height = Math.max(height, surface.height + padding * 2);
    else {
      height = Math.max(height, surface.bottom + padding);
      // A collision-positioned popup may initially have flipped above its anchor.
      if (surface.top < 0) height = Math.max(height, surface.height + padding * 2);
    }
  }
  return Math.ceil(height);
}

const DIALOG = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]';
const ANCHORED =
  '[data-radix-popper-content-wrapper], [data-popper-placement], [role="menu"], [role="listbox"], [role="tooltip"]';
const SURFACE = `${DIALOG}, ${ANCHORED}`;
const CONTAINED = "data-dslinter-height-contained";
const CLIPPING = /^(auto|scroll|hidden|clip)$/;

function visible(element: HTMLElement, view: Window): boolean {
  const box = element.getBoundingClientRect();
  const style = view.getComputedStyle(element);
  return (
    box.width > 0 &&
    box.height > 0 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    (!element.checkVisibility ||
      element.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
  );
}

/** Clip to consumer scroll containers, but not to the iframe viewport we are sizing. */
function clippedBounds(
  element: HTMLElement,
  view: Window,
): Omit<SurfaceBounds, "layout"> | undefined {
  const box = element.getBoundingClientRect();
  let top = box.top;
  let bottom = box.bottom;
  let left = box.left;
  let right = box.right;
  for (
    let ancestor = element.parentElement;
    ancestor && ancestor !== element.ownerDocument.body;
    ancestor = ancestor.parentElement
  ) {
    const style = view.getComputedStyle(ancestor);
    const bounds = ancestor.getBoundingClientRect();
    if (CLIPPING.test(style.overflowY)) {
      top = Math.max(top, bounds.top + ancestor.clientTop);
      bottom = Math.min(bottom, bounds.top + ancestor.clientTop + ancestor.clientHeight);
    }
    if (CLIPPING.test(style.overflowX)) {
      left = Math.max(left, bounds.left + ancestor.clientLeft);
      right = Math.min(right, bounds.left + ancestor.clientLeft + ancestor.clientWidth);
    }
  }
  if (bottom <= top || right <= left) return;
  return {
    top: top + view.scrollY,
    bottom: bottom + view.scrollY,
    height: bottom - top,
  };
}

function viewportPositioned(element: HTMLElement, view: Window): boolean {
  for (
    let current: HTMLElement | null = element;
    current && current !== element.ownerDocument.body;
    current = current.parentElement
  ) {
    const style = view.getComputedStyle(current);
    if (style.position === "fixed") return !current.offsetParent;
    if (
      style.position === "absolute" &&
      (!current.offsetParent || current.offsetParent === element.ownerDocument.body)
    )
      return true;
  }
  return false;
}

function surfaceLayout(element: HTMLElement, view: Window): SurfaceBounds["layout"] {
  if (element.matches(ANCHORED) || element.closest("[data-radix-popper-content-wrapper]"))
    return "anchored";
  if (!viewportPositioned(element, view)) return "anchored";
  const style = view.getComputedStyle(element);
  const box = element.getBoundingClientRect();
  const fillsHeight = Math.abs(box.top) <= 2 && Math.abs(box.bottom - view.innerHeight) <= 2;
  if (
    fillsHeight &&
    ((style.top === "0px" && style.bottom === "0px") || box.width >= view.innerWidth - 2)
  )
    return "viewport";
  if (
    Math.abs(box.top + box.height / 2 - view.innerHeight / 2) <= 2 ||
    (style.top === "auto" && style.bottom !== "auto")
  )
    return "centered";
  return "anchored";
}

function previewSurfaces(root: HTMLElement, view: Window): HTMLElement[] {
  const elements = [...root.ownerDocument.body.querySelectorAll<HTMLElement>("*")];
  const candidates = new Set(
    elements.filter((element) => {
      if (element === root || ["SCRIPT", "STYLE", "LINK"].includes(element.tagName)) return false;
      const style = view.getComputedStyle(element);
      const outside = !root.contains(element);
      if (
        style.position !== "absolute" &&
        style.position !== "fixed" &&
        !(
          outside &&
          (element.parentElement === root.ownerDocument.body || element.matches(SURFACE))
        )
      )
        return false;
      if (!visible(element, view)) return false;
      const box = element.getBoundingClientRect();
      const fillsViewport =
        box.width >= view.innerWidth - 2 &&
        Math.abs(box.top) <= 2 &&
        Math.abs(box.bottom - view.innerHeight) <= 2;
      if (fillsViewport && !element.matches(SURFACE)) {
        // Backdrops and full-screen portal wrappers are not the content surface.
        if (!element.textContent?.trim() || element.querySelector(SURFACE)) return false;
      }
      return true;
    }),
  );
  return [...candidates].filter((element) => {
    const box = element.getBoundingClientRect();
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (!candidates.has(ancestor)) continue;
      const outer = ancestor.getBoundingClientRect();
      if (
        box.top >= outer.top &&
        box.bottom <= outer.bottom &&
        box.left >= outer.left &&
        box.right <= outer.right
      )
        return false;
    }
    return true;
  });
}

type PreviewSizeObserver = {
  schedule: (restart?: boolean) => void;
  reset: (compact: boolean) => void;
  disconnect: () => void;
};

/** One document-wide observer also sees portals mounted outside the framework root. */
export function observePreviewSize(
  root: HTMLElement,
  publish: (height: number) => void,
): PreviewSizeObserver {
  const document = root.ownerDocument;
  const view = document.defaultView!;
  const style = document.createElement("style");
  style.setAttribute("data-dslinter-preview-sizing", "");
  const containmentRule = `[${CONTAINED}] { min-height: 0 !important; overflow-y: auto !important; box-sizing: border-box !important; }`;
  document.head.append(style);
  let compact = false;
  let frame = 0;
  let remaining = 0;
  let lastHeight = 0;
  let stopped = false;
  let locked = false;
  let heights: number[] = [];
  let observed = new Set<Element>();
  const heightTracker = createPreviewHeightTracker();
  const contained = new Set<HTMLElement>();
  const viewportResize = observePreviewResize(view, (widthChanged) => schedule(widthChanged));

  function schedule(restart = true): void {
    if (stopped) return;
    if (restart) {
      heights = [];
      locked = false;
    }
    remaining = 2;
    if (!frame) frame = view.requestAnimationFrame(measure);
  }

  const resize = new ResizeObserver(() => schedule(false));
  function measure(): void {
    frame = 0;
    remaining--;
    // Read the consumer's natural dimensions again, including after content shrinks.
    for (const element of contained) element.removeAttribute(CONTAINED);
    contained.clear();
    const surfaces = previewSurfaces(root, view);
    const limit = previewHeightLimit(compact);
    const padding = parseFloat(view.getComputedStyle(root).paddingBottom) || 0;
    const rules = new Set([containmentRule]);
    const layouts = surfaces.map((element) => ({
      element,
      layout: surfaceLayout(element, view),
      box: element.getBoundingClientRect(),
    }));
    for (const { element, layout, box } of layouts) {
      if (layout === "viewport" || !viewportPositioned(element, view)) continue;
      if (!element.matches(DIALOG) && !element.querySelector(DIALOG)) continue;
      const available =
        limit - padding - Math.max(padding, layout === "centered" ? padding : box.top);
      if (box.height > available) {
        const maxHeight = Math.max(1, Math.floor(available));
        element.setAttribute(CONTAINED, String(maxHeight));
        rules.add(`[${CONTAINED}="${maxHeight}"] { max-height: ${maxHeight}px !important; }`);
        contained.add(element);
      }
    }
    const css = [...rules].join("\n");
    if (style.textContent !== css) style.textContent = css;
    const bounds = layouts.flatMap(({ element, layout }) => {
      const box = clippedBounds(element, view);
      return box ? [{ ...box, layout }] : [];
    });
    const nextObserved = new Set<Element>([root, ...surfaces]);
    for (const element of observed) if (!nextObserved.has(element)) resize.unobserve(element);
    for (const element of nextObserved) if (!observed.has(element)) resize.observe(element);
    observed = nextObserved;
    const measuredHeight = previewHeightForLayout(
      root.getBoundingClientRect().height,
      bounds,
      padding,
      limit,
    );
    const height = heightTracker.measure(measuredHeight, view.innerWidth);
    if (height === lastHeight && view.innerHeight === Math.min(height, limit)) {
      // Start a fresh settling budget only after the parent has applied a stable height.
      heights = [];
      locked = false;
    } else if (!locked && height !== lastHeight) {
      heights.push(height);
      let nextHeight = height;
      if (heights.length >= 8) {
        // Stop feedback from viewport-sized layouts or collision-positioning oscillations.
        nextHeight = Math.max(...heights);
        locked = true;
      }
      if (nextHeight > 0 && nextHeight !== lastHeight) {
        lastHeight = nextHeight;
        viewportResize.expectHeight(Math.min(nextHeight, limit));
        publish(nextHeight);
      }
    }
    if (remaining > 0) frame = view.requestAnimationFrame(measure);
  }

  const mutations = new MutationObserver((records) => {
    const changes = records.filter((record) => record.attributeName !== CONTAINED);
    if (!changes.length) return;
    schedule(
      changes.some((record) => record.type !== "attributes" || record.attributeName !== "style"),
    );
  });
  mutations.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
  function onScroll(): void {
    schedule(false);
  }
  function onContentChange(): void {
    schedule();
  }
  const events = ["load", "transitionend", "animationend", "input", "change", "toggle"];
  for (const event of events) document.addEventListener(event, onContentChange, true);
  document.addEventListener("scroll", onScroll, true);
  document.fonts?.addEventListener("loadingdone", onContentChange);
  schedule();

  return {
    schedule,
    reset(nextCompact: boolean) {
      compact = nextCompact;
      lastHeight = 0;
      heightTracker.reset();
      schedule();
    },
    disconnect() {
      stopped = true;
      view.cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      for (const event of events) document.removeEventListener(event, onContentChange, true);
      viewportResize.disconnect();
      document.removeEventListener("scroll", onScroll, true);
      document.fonts?.removeEventListener("loadingdone", onContentChange);
      for (const element of contained) element.removeAttribute(CONTAINED);
      style.remove();
    },
  };
}
