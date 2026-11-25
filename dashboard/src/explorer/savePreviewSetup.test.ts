import { afterEach, expect, it, vi } from "vitest";
import { savePreviewSetup } from "./savePreviewSetup";

afterEach(() => vi.unstubAllGlobals());

it("sends only the selected app and component ID with a verified action token", async () => {
  const result = { path: "dslinter.preview.tsx", created: true, reloaded: true };
  const fetch = vi.fn(async () => Response.json(result));
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  expect(await savePreviewSetup("app", "src/Toast.tsx#Toast", "token", signal)).toEqual(result);
  expect(fetch).toHaveBeenCalledWith("/dslinter/preview-setup", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Dslinter-Token": "token" },
    body: JSON.stringify({ app: "app", componentId: "src/Toast.tsx#Toast" }),
    signal,
  });
});

it("preserves a server explanation when a merge cannot be applied", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        { message: "A preview is already configured. It has not been replaced." },
        { status: 409 },
      ),
    ),
  );
  await expect(
    savePreviewSetup("app", "id", "token", new AbortController().signal),
  ).rejects.toThrow("has not been replaced");
});

it("does not retry a failed mutation when the save result is unknown", async () => {
  const fetch = vi.fn(async () => {
    throw new TypeError("Network failed");
  });
  vi.stubGlobal("fetch", fetch);
  await expect(
    savePreviewSetup("app", "id", "token", new AbortController().signal),
  ).rejects.toThrow("Retry the preview first");
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("rejects unreadable errors and validates success before reloading", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("Not JSON", { status: 500 })),
  );
  await expect(
    savePreviewSetup("app", "id", "token", new AbortController().signal),
  ).rejects.toThrow("copyable example");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ ok: true })),
  );
  await expect(
    savePreviewSetup("app", "id", "token", new AbortController().signal),
  ).rejects.toThrow("before saving again");
});
