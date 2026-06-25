import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { envIs } from "./env.mjs";

/**
 * @returns {boolean}
 */
export function isInteractiveTTY() {
  const ci = process.env.CI === "true" || process.env.CI === "1";
  if (ci) return false;
  if (envIs("NO_PROMPT")) return false;
  return Boolean(input.isTTY && output.isTTY);
}

/**
 * @param {string} question
 * @param {{ defaultYes?: boolean }} [opts]
 * @returns {Promise<boolean>}
 */
export async function confirmYesNo(question, opts = {}) {
  const defaultYes = opts.defaultYes !== false;
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question(`${question} ${hint} `)).trim().toLowerCase();
    if (!answer) return defaultYes;
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}
