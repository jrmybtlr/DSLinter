import { describe, expect, it, vi } from "vitest";
import { observePreviewResize } from "./previewResize";

function setup() {
  const view = Object.assign(new EventTarget(), { innerWidth: 640, innerHeight: 160 });
  const schedule = vi.fn();
  const observer = observePreviewResize(view as unknown as Window, schedule);
  const dismiss = vi.fn();
  view.addEventListener("resize", dismiss);
  return { view, schedule, observer, dismiss };
}

describe("preview frame resize", () => {
  it("keeps a popup open when its content causes the host to grow or shrink the frame", () => {
    const { view, observer, schedule, dismiss } = setup();
    for (const height of [300, 160]) {
      observer.expectHeight(height);
      view.innerHeight = height;
      view.dispatchEvent(new Event("resize"));
    }
    expect(dismiss).not.toHaveBeenCalled();
    expect(schedule).toHaveBeenCalledTimes(2);
    expect(schedule).toHaveBeenLastCalledWith(false);
  });

  it("preserves real width changes even when a frame height update is pending", () => {
    const { view, observer, schedule, dismiss } = setup();
    observer.expectHeight(300);
    view.innerWidth = 480;
    view.innerHeight = 300;
    view.dispatchEvent(new Event("resize"));
    expect(dismiss).toHaveBeenCalledOnce();
    expect(schedule).toHaveBeenCalledWith(true);
  });

  it("preserves height changes that were not requested by auto-sizing", () => {
    const { view, observer, dismiss } = setup();
    observer.expectHeight(300);
    view.innerHeight = 250;
    view.dispatchEvent(new Event("resize"));
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it("removes the capture listener on disconnect", () => {
    const { view, observer, dismiss, schedule } = setup();
    observer.expectHeight(300);
    observer.disconnect();
    view.innerHeight = 300;
    view.dispatchEvent(new Event("resize"));
    expect(dismiss).toHaveBeenCalledOnce();
    expect(schedule).not.toHaveBeenCalled();
  });
});
