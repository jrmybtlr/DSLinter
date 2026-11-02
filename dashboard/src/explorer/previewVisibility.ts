/** A provider or empty container alone is not a useful rendered example. */
export function hasVisiblePreview(root: HTMLElement): boolean {
  const document = root.ownerDocument;
  const elements = [
    ...root.querySelectorAll<HTMLElement>("*"),
    ...document.querySelectorAll<HTMLElement>(
      '[role="dialog"] *,[role="menu"] *,[role="listbox"] *,[data-radix-popper-content-wrapper] *',
    ),
  ];
  return elements.some((element) => {
    if (["SCRIPT", "STYLE", "LINK", "OPTION"].includes(element.tagName)) return false;
    const box = element.getBoundingClientRect();
    const style = document.defaultView!.getComputedStyle(element);
    if (
      !box.width ||
      !box.height ||
      style.visibility === "hidden" ||
      style.display === "none" ||
      style.opacity === "0"
    )
      return false;
    if (
      element.checkVisibility &&
      !element.checkVisibility({ opacityProperty: true, visibilityProperty: true })
    )
      return false;
    if (element.matches('input,button,select,textarea,img,svg,canvas,video,[role="separator"]'))
      return true;
    if (
      [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      )
    )
      return true;
    const colored =
      style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent";
    return !element.children.length && (colored || parseFloat(style.borderTopWidth) > 0);
  });
}
