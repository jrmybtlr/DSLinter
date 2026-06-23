import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  dashboardSharesScannerPort,
  formatMcpConnection,
  getLanIpv4Addresses,
  httpUrl,
  scannerApiUrl,
} from "./network-hosts.mjs";

const BOX = {
  tl: "╭",
  tr: "╮",
  bl: "╰",
  br: "╯",
  h: "─",
  v: "│",
};

/** Block-letter DSLinter (two lines). */
export const LOGO = [
  "█▀▄\u2003█▀\u2003█░░\u2003█\u2003█▄░█\u2003▀█▀\u2003█▀▀\u2003█▀█",
  "█▄▀\u2003▄█\u2003█▄▄\u2003█\u2003█░▀█\u2003░█░\u2003██▄\u2003█▀▄",
];

const ESC = "\u001b";
const ANSI_RE = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

/** @param {string} s */
export function stripAnsi(s) {
  return s.replace(ANSI_RE, "");
}

/** @param {string} s */
export function visibleLength(s) {
  return stripAnsi(s).length;
}

/**
 * @param {string} s
 * @param {number} width
 */
function padVisible(s, width) {
  const pad = Math.max(0, width - visibleLength(s));
  return s + " ".repeat(pad);
}

/**
 * @param {string} text
 * @param {number} max
 */
function truncatePlain(text, max) {
  if (text.length <= max) return text;
  if (max <= 1) return text.slice(0, max);
  return `${text.slice(0, max - 1)}…`;
}

/** @param {boolean} enabled */
function createStyles(enabled) {
  if (!enabled) {
    const id = (s) => s;
    return {
      label: id,
      value: id,
      url: id,
      dim: id,
      ok: id,
      warn: id,
      err: id,
    };
  }
  const esc = (n, s) => `\u001b[${n}m${s}\u001b[0m`;
  return {
    label: (s) => esc("2", s),
    value: (s) => esc("0", s),
    url: (s) => esc("4;36", s),
    dim: (s) => esc("2", s),
    ok: (s) => esc("32", s),
    warn: (s) => esc("33", s),
    err: (s) => esc("31", s),
  };
}

/**
 * @param {string} path
 * @param {number} [maxLen]
 */
export function shortenPath(path, maxLen = 72) {
  const home = homedir();
  let s = path.startsWith(home) ? `~${path.slice(home.length)}` : path;
  if (s.length <= maxLen) return s;
  const head = Math.ceil((maxLen - 1) / 2);
  const tail = Math.floor((maxLen - 1) / 2);
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

/**
 * @param {string} label
 * @param {string} plainValue
 * @param {number} contentWidth
 * @param {(value: string) => string} [styleValue]
 */
function row(label, plainValue, contentWidth, styleValue = (v) => v) {
  const labelCol = 14;
  const gap = 2;
  const valueWidth = Math.max(1, contentWidth - labelCol - gap);
  const valueLines = wrapPlain(plainValue, valueWidth);
  const lines = [];
  for (let i = 0; i < valueLines.length; i++) {
    const lbl = i === 0 ? padVisible(label, labelCol) : " ".repeat(labelCol);
    lines.push(`${lbl}${" ".repeat(gap)}${styleValue(valueLines[i])}`);
  }
  return lines;
}

/**
 * @param {string} text
 * @param {number} width
 * @returns {string[]}
 */
function wrapPlain(text, width) {
  if (text.length <= width) return [text];
  const words = text.split(/(\s+)/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if (line.length + w.length <= width) {
      line += w;
    } else if (w.trim() === "") {
      line += w;
    } else if (w.length > width) {
      if (line) lines.push(line.trimEnd());
      for (let i = 0; i < w.length; i += width) {
        lines.push(w.slice(i, i + width));
      }
      line = "";
    } else {
      if (line) lines.push(line.trimEnd());
      line = w.trimStart();
    }
  }
  if (line) lines.push(line.trimEnd());
  return lines.length ? lines : [""];
}

/**
 * @param {string[]} lines
 * @param {number} totalWidth
 */
function boxLines(lines, totalWidth) {
  const contentWidth = totalWidth - 4;
  const out = [];
  out.push(`${BOX.tl}${BOX.h.repeat(totalWidth - 2)}${BOX.tr}`);
  for (const line of lines) {
    const plain = stripAnsi(line);
    const clipped =
      plain.length > contentWidth ? truncatePlain(plain, contentWidth) : line;
    out.push(`${BOX.v} ${padVisible(clipped, contentWidth)} ${BOX.v}`);
  }
  out.push(`${BOX.bl}${BOX.h.repeat(totalWidth - 2)}${BOX.br}`);
  return out;
}

/**
 * @param {{
 *   scanPath: string;
 *   reportPath: string;
 *   apiPort: number;
 *   apiAvailable: boolean;
 *   dashboardUrl?: string | null;
 *   bundledUrl?: string | null;
 *   pollMs?: number;
 * }} opts
 * @returns {string}
 */
export function formatDevBanner(opts) {
  const color = createStyles(process.stderr.isTTY === true);
  const terminalCols = process.stderr.columns ?? 80;
  const maxBox = Math.min(Math.max(terminalCols, 64), 96);

  const scanAbs = resolve(opts.scanPath);
  const dashboardUrl = opts.dashboardUrl ?? opts.bundledUrl ?? null;
  const scanPlain = shortenPath(scanAbs, 80);
  const scannerWarnPlain = opts.apiAvailable
    ? null
    : `unavailable — port ${opts.apiPort} in use`;
  const scannerUrl = scannerApiUrl(opts.apiPort);
  const showScannerApi =
    opts.apiAvailable &&
    dashboardUrl != null &&
    !dashboardSharesScannerPort(dashboardUrl, opts.apiPort);
  const mcpPlain = formatMcpConnection(opts.apiPort, opts.apiAvailable);
  const lanHost = opts.apiAvailable ? getLanIpv4Addresses()[0] : undefined;
  const networkUrl = lanHost ? httpUrl(opts.apiPort, lanHost) : null;

  /** @type {number[]} */
  const plainWidths = [
    ...LOGO.map((l) => visibleLength(l)),
    14 + 2 + scanPlain.length,
  ];
  if (dashboardUrl) plainWidths.push(14 + 2 + dashboardUrl.length);
  if (showScannerApi) plainWidths.push(14 + 2 + scannerUrl.length);
  if (networkUrl) plainWidths.push(14 + 2 + networkUrl.length);
  plainWidths.push(14 + 2 + mcpPlain.length);
  if (scannerWarnPlain) plainWidths.push(14 + 2 + scannerWarnPlain.length);
  if (opts.pollMs) plainWidths.push(14 + 2 + `polling every ${opts.pollMs} ms`.length);
  const footerPlain = dashboardUrl
    ? "  Open the Dashboard in your browser. Ctrl+C to stop."
    : "  Ctrl+C to stop.";
  plainWidths.push(visibleLength(footerPlain));

  const contentWidth = Math.min(maxBox - 4, Math.max(...plainWidths, 40));
  const totalWidth = contentWidth + 4;

  /** @type {string[]} */
  const styledRows = [];
  styledRows.push("");
  styledRows.push(...LOGO);
  styledRows.push("");
  styledRows.push(
    ...row(color.label("Scan path"), scanPlain, contentWidth, color.value),
  );
  if (opts.pollMs) {
    styledRows.push(
      ...row(color.label("Watch"), `polling every ${opts.pollMs} ms`, contentWidth, color.dim),
    );
  }
  styledRows.push("");
  if (dashboardUrl) {
    styledRows.push(
      ...row(color.label("Dashboard"), dashboardUrl, contentWidth, color.url),
    );
  }
  if (showScannerApi) {
    styledRows.push(
      ...row(color.label("Scanner API"), scannerUrl, contentWidth, color.url),
    );
  }
  if (networkUrl) {
    styledRows.push(
      ...row(color.label("Network"), networkUrl, contentWidth, color.url),
    );
  }
  styledRows.push(
    ...row(color.label("MCP"), mcpPlain, contentWidth, color.value),
  );
  if (scannerWarnPlain) {
    styledRows.push(
      ...row(color.label("Scanner"), scannerWarnPlain, contentWidth, color.err),
    );
  }
  styledRows.push("");
  styledRows.push(color.dim(footerPlain));

  return boxLines(styledRows, totalWidth).join("\n");
}

/**
 * @param {Parameters<typeof formatDevBanner>[0]} opts
 */
export function writeDevBanner(opts) {
  process.stderr.write(`${formatDevBanner(opts)}\n`);
}
