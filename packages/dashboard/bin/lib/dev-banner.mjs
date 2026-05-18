import { homedir } from "node:os";
import { resolve } from "node:path";

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

const ANSI_RE = /\u001b\[[0-9;]*m/g;

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
  const reportAbs = resolve(opts.reportPath);
  const apiBase = `http://127.0.0.1:${opts.apiPort}`;

  const apiStatusPlain = opts.apiAvailable ? "listening" : "unavailable — port in use";
  const bundledStatusPlain = opts.apiAvailable ? "ready" : "port busy";
  const scanPlain = shortenPath(scanAbs, 80);
  const reportPlain = shortenPath(reportAbs, 80);

  /** @type {number[]} */
  const plainWidths = [
    ...LOGO.map((l) => visibleLength(l)),
    14 + 2 + scanPlain.length,
    14 + 2 + reportPlain.length,
  ];
  if (opts.dashboardUrl) plainWidths.push(14 + 2 + opts.dashboardUrl.length);
  if (opts.bundledUrl) {
    plainWidths.push(14 + 2 + `${opts.bundledUrl}  (${bundledStatusPlain})`.length);
  }
  plainWidths.push(14 + 2 + `${apiBase}  (${apiStatusPlain})`.length);
  if (opts.apiAvailable) {
    plainWidths.push(14 + 2 + `${apiBase}/dslint-report.json`.length);
    plainWidths.push(14 + 2 + `${apiBase}/events`.length);
  }
  if (opts.pollMs) plainWidths.push(14 + 2 + `polling every ${opts.pollMs} ms`.length);
  plainWidths.push(visibleLength("  Open the Dashboard URL in your browser. Ctrl+C to stop."));

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
  styledRows.push(
    ...row(color.label("Report file"), reportPlain, contentWidth, color.value),
  );
  styledRows.push("");
  if (opts.dashboardUrl) {
    styledRows.push(
      ...row(color.label("Dashboard"), opts.dashboardUrl, contentWidth, color.url),
    );
  }
  if (opts.bundledUrl) {
    const status = opts.apiAvailable ? color.ok(bundledStatusPlain) : color.warn(bundledStatusPlain);
    styledRows.push(
      ...row(
        color.label("Bundled UI"),
        `${opts.bundledUrl}  (${bundledStatusPlain})`,
        contentWidth,
        () => `${color.url(opts.bundledUrl)}  ${color.dim("(")}${status}${color.dim(")")}`,
      ),
    );
  }
  const apiStatus = opts.apiAvailable ? color.ok(apiStatusPlain) : color.err(apiStatusPlain);
  styledRows.push(
    ...row(
      color.label("Scanner API"),
      `${apiBase}  (${apiStatusPlain})`,
      contentWidth,
      () => `${color.url(apiBase)}  ${color.dim("(")}${apiStatus}${color.dim(")")}`,
    ),
  );
  if (opts.apiAvailable) {
    styledRows.push(
      ...row("", `${apiBase}/dslint-report.json`, contentWidth, color.dim),
    );
    styledRows.push(...row("", `${apiBase}/events`, contentWidth, color.dim));
  }
  if (opts.pollMs) {
    styledRows.push("");
    styledRows.push(
      ...row(color.label("Watch"), `polling every ${opts.pollMs} ms`, contentWidth, color.dim),
    );
  }
  styledRows.push("");
  styledRows.push(color.dim("  Open the Dashboard URL in your browser. Ctrl+C to stop."));

  return boxLines(styledRows, totalWidth).join("\n");
}

/**
 * @param {Parameters<typeof formatDevBanner>[0]} opts
 */
export function writeDevBanner(opts) {
  process.stderr.write(`${formatDevBanner(opts)}\n`);
}
