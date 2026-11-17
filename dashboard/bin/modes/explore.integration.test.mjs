import { spawn } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  readFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { once } from "node:events";
import { expect, it } from "vitest";

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
function snapshot(root) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const path = join(entry.parentPath, entry.name);
      return [path.slice(root.length), readFileSync(path, "utf8")];
    })
    .sort(([a], [b]) => a.localeCompare(b));
}
async function waitFor(url, accept = () => true) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const text = await response.text();
        if (accept(text)) return text;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

it.skipIf(process.env.DSLINTER_E2E !== "1")(
  "starts, renders a preview host, watches edits, and stops without implicit project writes",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-cli-e2e-"));
    const cache = mkdtempSync(join(tmpdir(), "dslinter-cli-cache-"));
    mkdirSync(join(root, "src"));
    symlinkSync(resolve("node_modules"), join(root, "node_modules"));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "fixture", type: "module", dependencies: { react: "*", vite: "*" } }),
    );
    writeFileSync(
      join(root, "vite.config.ts"),
      'import react from "@vitejs/plugin-react"; export default { plugins: [react()] };',
    );
    writeFileSync(
      join(root, "index.html"),
      '<div id="root"></div><script type="module" src="/src/main.tsx"></script>',
    );
    writeFileSync(
      join(root, "src/main.tsx"),
      'import "./style.css"; import { Button } from "./Button"; export function Page(){ return <Button>Original</Button> }',
    );
    writeFileSync(
      join(root, "src/Button.tsx"),
      "export function Button({children}: {children: string}) { return <button>{children}</button> }",
    );
    writeFileSync(join(root, "src/style.css"), "button { color: rgb(12, 34, 56) }");
    const port = await freePort();
    const before = snapshot(root);
    let expected = before;
    const child = spawn(process.execPath, [resolve("bin/dslinter.mjs")], {
      cwd: root,
      env: {
        ...process.env,
        CI: "false",
        DSLINTER_BIN: resolve("../target/debug/dslinter"),
        DSLINTER_CACHE_DIR: cache,
        DSLINTER_DEV_UI_PORT: String(port),
        DSLINTER_OPEN_BROWSER: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let logs = "";
    child.stdout.on("data", (data) => {
      logs += data;
    });
    child.stderr.on("data", (data) => {
      logs += data;
    });
    try {
      const origin = `http://127.0.0.1:${port}`;
      const report = JSON.parse(
        await waitFor(
          `${origin}/dslinter-report.json`,
          (text) => JSON.parse(text).components?.length > 0,
        ),
      );
      expect(report.schema_version).toBe(4);
      const frame = await waitFor(`${origin}/__dslinter/frame?app=.`);
      expect(frame).toContain("dslinter-preview");
      const previewOrigin = frame.match(/["'](http:\/\/127\.0\.0\.1:\d+)\/@vite\/client["']/)?.[1];
      expect(previewOrigin, frame).toBeTruthy();
      expect(frame).toContain(`<base href="${previewOrigin}/">`);
      const entry = await waitFor(`${previewOrigin}/__dslinter/entry.js`);
      expect(entry).toContain("boot");
      const runtimePath = entry.match(/import \{ boot \} from "([^"]+)"/)?.[1];
      expect(runtimePath).toBeTruthy();
      const runtime = await waitFor(`${previewOrigin}${runtimePath}`);
      const frameworkPath = runtime.match(/import \{ mount \} from "([^"]+)"/)?.[1];
      expect(frameworkPath).toBeTruthy();
      const framework = await waitFor(`${previewOrigin}${frameworkPath}`);
      expect(framework).toContain("createRoot");
      expect(framework).not.toContain("../types/report");
      const recoveryPath = framework.match(/from "([^"]*providerRecovery[^"]*)"/)?.[1];
      expect(recoveryPath).toBeTruthy();
      const recovery = await waitFor(`${previewOrigin}${recoveryPath}`);
      expect(recovery).toContain("contextRequirement");
      const contrastScanner = await waitFor(`${previewOrigin}/@id/__x00__dslinter-axe`);
      expect(contrastScanner).toContain("window.axe");
      expect(snapshot(root)).toEqual(before);
      const updated =
        'import "./style.css"; import { Button } from "./Button"; export function Page(){ return <Button>Updated</Button> }';
      writeFileSync(join(root, "src/main.tsx"), updated);
      await waitFor(`${origin}/dslinter-report.json`, (text) => text.includes('"Updated"'));
      expected = before.map(([path, content]) => [
        path,
        path === "/src/main.tsx" ? updated : content,
      ]);
      expect(snapshot(root)).toEqual(expected);
    } catch (error) {
      throw new Error(`${error}\n${logs}`);
    } finally {
      child.kill("SIGTERM");
      await Promise.race([
        once(child, "exit"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("CLI did not stop")), 10000)),
      ]);
      expect(snapshot(root)).toEqual(expected);
    }
  },
  60000,
);
