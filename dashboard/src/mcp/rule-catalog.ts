import catalog from "./rule-catalog.json";
import type { Severity } from "../types/report";

export type RulePillar = "a11y" | "token" | "usage" | "code";

export type RuleCatalogEntry = {
  rule_id: string;
  pillar: RulePillar;
  default_severity: Severity;
  description: string;
  fix_hint: string;
};

const entries = catalog as RuleCatalogEntry[];

const byId = new Map(entries.map((e) => [e.rule_id, e]));

export function ruleCatalog(): RuleCatalogEntry[] {
  return entries;
}

export function ruleById(ruleId: string): RuleCatalogEntry | undefined {
  return byId.get(ruleId);
}

export function pillarForRule(ruleId: string): RulePillar {
  const entry = byId.get(ruleId);
  if (entry) return entry.pillar;
  if (ruleId.startsWith("a11y-")) return "a11y";
  if (ruleId.startsWith("token-")) return "token";
  if (ruleId.startsWith("code-")) return "code";
  return "usage";
}
