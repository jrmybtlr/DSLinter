import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { buildAgentContext } from "./agent-context";
import {
  catalogSummary,
  componentSpec,
  findingsQuery,
  governanceSummary,
  policyFromReport,
  tokenSummary,
  usageExamples,
} from "./agent-query";
import type { McpConfig } from "./config";
import { ReportCache, loadBaseline, saveBaseline } from "./report-cache";
import {
  agentContextInput,
  catalogInput,
  checkPathsInput,
  componentInput,
  diffSinceInput,
  findingsInput,
  scanInput,
  suggestFixInput,
  tokensInput,
  usageExamplesInput,
} from "./schemas";
import {
  computeDrift,
  findingsForPaths,
  suggestFix,
} from "./verify-loop";

function jsonResult(data: unknown, isError = false): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

export function createDslinterMcpServer(
  config: McpConfig,
  cache: ReportCache,
): McpServer {
  const server = new McpServer({
    name: "dslinter",
    version: "0.1.0",
  });

  server.registerTool(
    "dslinter_scan",
    {
      description:
        "Refresh or load the DSLinter workspace report. Returns governance scores and finding counts.",
      inputSchema: scanInput,
    },
    async (args) => {
      const report = await cache.getReport({ fresh: args.fresh ?? false });
      const gov = governanceSummary(report);
      return jsonResult({
        schema_version: report.schema_version,
        generated_at: report.generated_at,
        source: "scan",
        scores: gov.scores,
        finding_counts: gov.finding_counts,
        total_findings: gov.total_findings,
        component_count: catalogSummary(report, { limit: 10_000 }).length,
      });
    },
  );

  server.registerTool(
    "dslinter_get_catalog",
    {
      description:
        "List design-system components sorted by usage frequency, with import paths and flags.",
      inputSchema: catalogInput,
    },
    async (args) => {
      const report = await cache.getReport();
      return jsonResult(catalogSummary(report, args));
    },
  );

  server.registerTool(
    "dslinter_get_component",
    {
      description:
        "Full component spec: props, CVA variants, usage, findings, and example JSX from repo patterns.",
      inputSchema: componentInput,
    },
    async (args) => {
      const report = await cache.getReport();
      const spec = componentSpec(report, args.name);
      if (!spec) {
        return jsonResult({ error: `Component not found: ${args.name}` }, true);
      }
      return jsonResult(spec);
    },
  );

  server.registerTool(
    "dslinter_get_findings",
    {
      description: "Filtered governance findings by component, rule prefix, severity, or path.",
      inputSchema: findingsInput,
    },
    async (args) => {
      const report = await cache.getReport();
      return jsonResult(findingsQuery(report, args));
    },
  );

  server.registerTool(
    "dslinter_get_usage_examples",
    {
      description:
        "Real call sites and prop value frequencies for a component from repo usage data.",
      inputSchema: usageExamplesInput,
    },
    async (args) => {
      const report = await cache.getReport();
      const examples = usageExamples(report, args.component, args.limit);
      if (!examples) {
        return jsonResult(
          { error: `No usage data for component: ${args.component}` },
          true,
        );
      }
      return jsonResult(examples);
    },
  );

  server.registerTool(
    "dslinter_get_tokens",
    {
      description: "CSS design tokens: definitions, usage counts, and unused tokens.",
      inputSchema: tokensInput,
    },
    async (args) => {
      const report = await cache.getReport();
      return jsonResult(tokenSummary(report, args.category));
    },
  );

  server.registerTool(
    "dslinter_get_agent_context",
    {
      description:
        "Compact design-system context pack for LLM system prompts (scores, top components, policy, dos/donts).",
      inputSchema: agentContextInput,
    },
    async (args) => {
      const report = await cache.getReport();
      const context = buildAgentContext(report, args);
      if (args.format === "json") {
        return jsonResult(context);
      }
      return {
        content: [{ type: "text", text: String(context) }],
      };
    },
  );

  server.registerTool(
    "dslinter_get_policy",
    {
      description:
        "Effective governance policy from .dslinter.json snapshot and rule catalog.",
    },
    async () => {
      const report = await cache.getReport();
      return jsonResult(policyFromReport(report));
    },
  );

  server.registerTool(
    "dslinter_check_paths",
    {
      description:
        "Findings for specific file paths after agent edits (post-write verification).",
      inputSchema: checkPathsInput,
    },
    async (args) => {
      const report = await cache.getReport({ fresh: args.fresh ?? true });
      return jsonResult(findingsForPaths(report, args.paths));
    },
  );

  server.registerTool(
    "dslinter_diff_since",
    {
      description:
        "Compare current governance scores/findings to saved MCP baseline (.dslinter/mcp-baseline.json).",
      inputSchema: diffSinceInput,
    },
    async (args) => {
      const report = await cache.getReport({ fresh: args.fresh ?? false });
      const baseline = await loadBaseline(config.projectRoot);
      const drift = computeDrift(report, baseline);
      if (args.save_baseline) {
        const hash = cache.reportHash();
        if (hash) await saveBaseline(config.projectRoot, report, hash);
      }
      return jsonResult(drift);
    },
  );

  server.registerTool(
    "dslinter_suggest_fix",
    {
      description:
        "Heuristic fix suggestion for a rule id (deprecated components, tokens, a11y).",
      inputSchema: suggestFixInput,
    },
    async (args) => {
      const report = await cache.getReport();
      const fix = suggestFix(report, args);
      if (!fix) {
        return jsonResult({ error: "No suggestion available" }, true);
      }
      return jsonResult(fix);
    },
  );

  server.registerResource(
    "agent-context",
    "dslinter://context",
    {
      description: "Compact design-system agent context (markdown)",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: "dslinter://context",
          mimeType: "text/markdown",
          text: String(
            buildAgentContext(await cache.getReport(), { format: "markdown" }),
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "catalog",
    "dslinter://catalog",
    {
      description: "Component catalog sorted by usage",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: "dslinter://catalog",
          mimeType: "application/json",
          text: JSON.stringify(
            catalogSummary(await cache.getReport(), { limit: 200 }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "component",
    {
      uriTemplate: "dslinter://component/{name}",
      name: "component",
      description: "Single component spec by name",
      mimeType: "application/json",
    },
    async (uri, { name }) => {
      const report = await cache.getReport();
      const spec = componentSpec(report, name);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              spec ?? { error: `Component not found: ${name}` },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "design-system-ui-task",
    {
      description:
        "System prompt template for building UI with the repo design system.",
      argsSchema: {
        task: z.string().describe("What UI to build"),
      },
    },
    async ({ task }) => {
      const context = buildAgentContext(await cache.getReport(), {
        format: "markdown",
      });
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `You are building UI in this repository. Use only catalog components and match repo usage patterns.\n\n${context}\n\nTask: ${task}`,
            },
          },
        ],
      };
    },
  );

  return server;
}

export async function runMcpServer(config: McpConfig): Promise<void> {
  const cache = new ReportCache(config);
  cache.startDevWatch();
  const server = createDslinterMcpServer(config, cache);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function runMcpSelfTest(config: McpConfig): Promise<void> {
  const cache = new ReportCache(config);
  const report = await cache.getReport({ fresh: false });
  const catalog = catalogSummary(report, { limit: 5 });
  if (catalog.length === 0 && (report.files?.length ?? 0) === 0) {
    throw new Error("Self-test: empty report");
  }
  governanceSummary(report);
  buildAgentContext(report);
}
