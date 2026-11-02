/** Keep frame auto-sizing from dismissing consumer popups that close on window resize. */
export function observePreviewResize(view: Window, schedule: (widthChanged: boolean) => void) {
  let width = view.innerWidth;
  let height = view.innerHeight;
  let expectedHeight: number | undefined;

  function onResize(event: Event): void {
    const widthChanged = view.innerWidth !== width;
    const automatic =
      !widthChanged && view.innerHeight !== height && view.innerHeight === expectedHeight;
    width = view.innerWidth;
    height = view.innerHeight;
    expectedHeight = undefined;
    // ResizeObserver still updates consumer layout; only the host's own height change is hidden.
    if (automatic) event.stopImmediatePropagation();
    schedule(widthChanged);
  }

  view.addEventListener("resize", onResize, { capture: true });
  return {
    expectHeight(nextHeight: number): void {
      expectedHeight = nextHeight;
    },
    disconnect(): void {
      view.removeEventListener("resize", onResize, { capture: true });
    },
  };
}
