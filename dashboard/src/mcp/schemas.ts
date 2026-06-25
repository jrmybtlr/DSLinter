import { z } from "zod";

export const scanInput = z.object({
  fresh: z.boolean().optional(),
});

export const catalogInput = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

export const componentInput = z.object({
  name: z.string().min(1),
});

export const findingsInput = z.object({
  component: z.string().optional(),
  rule_prefix: z.string().optional(),
  severity: z.enum(["error", "warning", "info"]).optional(),
  path: z.string().optional(),
  limit: z.number().int().positive().max(200).optional(),
});

export const usageExamplesInput = z.object({
  component: z.string().min(1),
  limit: z.number().int().positive().max(50).optional(),
});

export const tokensInput = z.object({
  category: z
    .enum(["color", "spacing", "radius", "typography", "other"])
    .optional(),
});

export const agentContextInput = z.object({
  max_components: z.number().int().positive().max(100).optional(),
  format: z.enum(["markdown", "json"]).optional(),
});

export const checkPathsInput = z.object({
  paths: z.array(z.string().min(1)).min(1).max(50),
  fresh: z.boolean().optional(),
});

export const diffSinceInput = z.object({
  save_baseline: z.boolean().optional(),
  fresh: z.boolean().optional(),
});

export const suggestFixInput = z.object({
  rule_id: z.string().min(1),
  path: z.string().optional(),
  component: z.string().optional(),
});
