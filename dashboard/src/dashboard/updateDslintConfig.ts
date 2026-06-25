const CONFIG_HIDE_PATH = "/dslinter-config/hide-component";

export type HideCatalogComponentResult = {
  ok: boolean;
  hidden_components: string[];
};

/** Append a component name to `hidden_components` in `.dslinter.json` (dev server only). */
export async function hideCatalogComponent(
  componentName: string,
): Promise<HideCatalogComponentResult> {
  const res = await fetch(CONFIG_HIDE_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: componentName }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `Failed to hide component (${res.status})`);
  }
  return (await res.json()) as HideCatalogComponentResult;
}
