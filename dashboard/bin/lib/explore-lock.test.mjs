import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { acquireExploreLock, explorerConflictMessage } from "./explore-lock.mjs";

function reportPath() {
  return join(mkdtempSync(join(tmpdir(), "dslinter-lock-")), "dslinter-report.json");
}

describe("acquireExploreLock", () => {
  it("acquires a free lock and releases it", () => {
    const path = reportPath();
    const lock = acquireExploreLock(path, {
      url: "http://127.0.0.1:5175/",
      version: "1.0.0",
    });
    expect(lock.acquired).toBe(true);
    expect(JSON.parse(readFileSync(`${path}.lock`, "utf8"))).toMatchObject({
      pid: process.pid,
      url: "http://127.0.0.1:5175/",
      version: "1.0.0",
    });
    lock.release();
    expect(existsSync(`${path}.lock`)).toBe(false);
  });

  it("reports a live holder instead of taking the lock", () => {
    const path = reportPath();
    // The test runner's parent is alive for the duration of the test.
    const holder = {
      pid: process.ppid,
      url: "http://127.0.0.1:5175/",
      version: "0.9.1",
    };
    writeFileSync(`${path}.lock`, JSON.stringify(holder));
    const lock = acquireExploreLock(path, {
      url: "http://127.0.0.1:5176/",
      version: "0.9.2",
    });
    expect(lock).toEqual({ acquired: false, holder });
  });

  it("replaces a stale lock left by a dead process", () => {
    const path = reportPath();
    writeFileSync(`${path}.lock`, JSON.stringify({ pid: 2 ** 22 + 12345, version: "0.9.1" }));
    const lock = acquireExploreLock(path, {
      url: "http://127.0.0.1:5176/",
      version: "0.9.2",
    });
    expect(lock.acquired).toBe(true);
    lock.release();
  });

  it("creates a missing cache folder", () => {
    const path = join(mkdtempSync(join(tmpdir(), "dslinter-lock-")), "new", "dslinter-report.json");
    expect(acquireExploreLock(path, { url: "x", version: "1" }).acquired).toBe(true);
  });

  it("replaces an unreadable lock", () => {
    const path = reportPath();
    writeFileSync(`${path}.lock`, "not json");
    expect(acquireExploreLock(path, { url: "x", version: "1" }).acquired).toBe(true);
  });

  it("does not remove a lock another process took over", () => {
    const path = reportPath();
    const lock = acquireExploreLock(path, { url: "x", version: "1" });
    writeFileSync(`${path}.lock`, JSON.stringify({ pid: process.ppid }));
    lock.release();
    expect(existsSync(`${path}.lock`)).toBe(true);
  });
});

describe("explorerConflictMessage", () => {
  it("asks to stop an explorer running another version", () => {
    const message = explorerConflictMessage(
      { pid: 42, url: "http://127.0.0.1:5175/", version: "0.9.1" },
      "0.9.2",
      "/w",
    );
    expect(message).toContain("DSLinter 0.9.1 is already exploring /w at http://127.0.0.1:5175/");
    expect(message).toContain("kill 42");
  });

  it("points at the running explorer when versions match", () => {
    expect(explorerConflictMessage({ pid: 42, url: "u", version: "1" }, "1", "/w")).toContain(
      "Opening that dashboard instead",
    );
  });
});
