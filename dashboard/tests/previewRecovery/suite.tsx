import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { PreviewFrame } from "../../src/explorer/PreviewFrame";
import { DashboardThemeProvider } from "../../src/shell/DashboardTheme";
import type { CatalogComponent, ProviderCandidate } from "../../src/types/report";
import type { PreviewResponse } from "../../src/explorer/protocol";

const results: string[] = [];
const host = document.getElementById("tests")!;
const root = createRoot(host);
let messages: PreviewResponse[] = [];
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function until(check: () => boolean, description: string): Promise<void> {
  const deadline = Date.now() + 15000;
  while (!check()) {
    if (Date.now() > deadline)
      throw new Error(`Timed out: ${description}. ${JSON.stringify(messages)}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
function component(framework: "react" | "vue", name = "NeedsContext"): CatalogComponent {
  const path = `dashboard/tests/previewRecovery/${framework}Fixtures.${framework === "react" ? "tsx" : "ts"}`;
  const provider: ProviderCandidate = {
    id: `${path}#TestProvider`,
    name: "TestProvider",
    rel_path: path,
    export_name: "TestProvider",
  };
  return {
    id: `${path}#${name}`,
    name,
    framework,
    preview: {
      id: name,
      rel_path: path,
      export_name: name,
      declared_props: ["label", "fail"],
      provider_candidates: [provider],
    },
    usages: [],
    dependencies: [],
    bindings: {},
  };
}
function show(
  target: CatalogComponent,
  values: Record<string, unknown> = {},
  app: string = target.framework,
  explicitKeys: string[] = [],
  compact = false,
): void {
  flushSync(() =>
    root.render(
      <DashboardThemeProvider>
        <PreviewFrame
          component={target}
          catalog={[target]}
          app={app}
          values={values}
          explicitKeys={explicitKeys}
          compact={compact}
          onResponse={(message) => messages.push(message)}
        />
      </DashboardThemeProvider>,
    ),
  );
}
function frameText(): string {
  return host.querySelector("iframe")?.contentDocument?.body?.textContent || "";
}
function reset(): void {
  flushSync(() => root.render(null));
  messages = [];
}
async function run(): Promise<void> {
  for (const framework of ["react", "vue"] as const) {
    reset();
    const target = component(framework);
    show(target);
    await until(
      () =>
        messages.some(
          (message) =>
            message.type === "rendered" &&
            message.suppliedProviders?.some((provider) => provider.name === "TestProvider"),
        ),
      `${framework} recovery label`,
    );
    assert(frameText().includes("provided"), `${framework} provider must supply real context`);
    assert(
      !messages.some((m) => m.type === "error"),
      `${framework} must not publish transient errors`,
    );
    assert(
      messages.some((m) => m.snippet?.includes("<TestProvider>")),
      `${framework} snippet must include provider`,
    );
    show(target, { label: "Updated" });
    await until(() => frameText().includes("Updated: provided"), `${framework} live update`);
    results.push(`${framework}: real provider recovery, labels, snippets, and updates`);
    const rendered = () => messages.filter((message) => message.type === "rendered");
    let before = rendered().length;
    show({ ...target });
    await until(() => rendered().length > before, `${framework} cached provider chain`);
    assert(
      rendered().at(-1)!.attempts?.length === 0,
      `${framework} cached chains skip the missing-context attempt`,
    );
    before = rendered().length;
    await fetch("/__tests/invalidate", { method: "POST" });
    await until(() => rendered().length > before, `${framework} source invalidation`);
    assert(
      rendered().at(-1)!.attempts!.length > 0,
      `${framework} source changes invalidate provider cache`,
    );
    results.push(`${framework}: cached chains and source invalidation`);

    reset();
    show(target, {}, `${framework}-configured`);
    await until(
      () => host.textContent!.includes("authoritative"),
      `${framework} configured wrapper precedence`,
    );
    assert(
      !messages.some((message) => message.suppliedProviders?.length),
      `${framework} configured wrappers are not changed`,
    );
    results.push(`${framework}: configured wrapper precedence`);

    reset();
    const absent = { ...target, preview: { ...target.preview, provider_candidates: [] } };
    show(absent);
    await until(
      () => host.textContent!.includes("No matching provider export"),
      `${framework} terminal guidance`,
    );
    assert(
      messages.filter((m) => m.type === "error").length === 1,
      `${framework} publishes one final error`,
    );
    assert(host.textContent!.includes("Preview setup"), `${framework} adapter example`);
    assert(
      !messages.some((message) => message.setupAction),
      `${framework} incomplete parent setups stay manual`,
    );
    const failedFrame = host.querySelector("iframe")!;
    const alert = host.querySelector('[role="alert"]')!;
    assert(
      failedFrame.getBoundingClientRect().height === 0,
      `${framework} failed iframe must not reserve empty space`,
    );
    assert(
      failedFrame.getAttribute("aria-hidden") === "true",
      `${framework} failed iframe is hidden from assistive technology`,
    );
    assert(
      Math.abs(alert.getBoundingClientRect().top - host.getBoundingClientRect().top) < 2,
      `${framework} diagnostic must replace the preview at its top edge`,
    );
    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent?.trim() === "Retry preview")!
      .click();
    await until(
      () => messages.filter((message) => message.type === "error").length === 2,
      `${framework} retry completes`,
    );
    assert(
      host.querySelector("iframe") !== failedFrame,
      `${framework} retry creates a fresh frame`,
    );
    show(target);
    await until(
      () =>
        messages.some(
          (message) => message.type === "rendered" && Boolean(message.suppliedProviders?.length),
        ),
      `${framework} recovery restores the preview`,
    );
    assert(
      host.querySelector("iframe")!.getBoundingClientRect().height > 0,
      `${framework} recovered preview is visible again`,
    );
    results.push(
      `${framework}: terminal diagnostics replace blank previews; retry and recovery restore frames`,
    );

    reset();
    const updating = component(framework, "UpdateFailure");
    show(updating);
    await until(
      () => frameText().includes("Ready for update"),
      `${framework} initial update fixture`,
    );
    show(updating, { fail: true });
    await until(() => messages.some((m) => m.type === "error"), `${framework} update failure`);
    assert(!frameText().includes("Ready for update"), `${framework} update failure unmounts root`);
    results.push(`${framework}: asynchronous update failures and cleanup`);
    reset();
    const gated = component(framework, "VisibilityGate");
    gated.preview.visibility_props = ["showContent"];
    show(gated);
    await until(
      () => messages.some((message) => message.revealedValues?.showContent === true),
      `${framework} automatic visibility`,
    );
    assert(
      messages.some((message) => message.revealedValues?.showContent === true),
      `${framework} reveals inferred visibility props`,
    );
    reset();
    show(gated, { showContent: false }, framework, ["showContent"]);
    await until(
      () => messages.some((message) => message.type === "error"),
      `${framework} explicit false remains empty`,
    );
    assert(!frameText().includes("Revealed content"), `${framework} respects explicit false`);
    results.push(`${framework}: visibility recovery preserves explicit false`);

    for (const exported of ["TestProvider", "default", "*"]) {
      reset();
      const imported = component(framework);
      imported.preview.provider_candidates = [];
      const name = exported === "*" ? "Example.TestProvider" : "Example";
      imported.preview.example_tree = {
        type: "element",
        name,
        children: [{ type: "element", name: imported.name }],
      };
      imported.preview.source_imports = {
        Example: {
          specifier: `./${framework}Fixtures`,
          importer: imported.preview.rel_path,
          export_name: exported,
        },
      };
      show(imported);
      await until(
        () => frameText().includes("provided"),
        `${framework} ${exported} source binding`,
      );
      assert(
        !messages.some((message) => message.type === "error"),
        `${framework} resolves ${exported} imports`,
      );
    }
    results.push(`${framework}: named, default, and namespace source imports`);

    reset();
    show(component(framework, "UnrelatedFailure"));
    await until(
      () => Boolean(host.querySelector('[role="alert"]')),
      `${framework} plain-language error`,
    );
    const failureAlert = host.querySelector<HTMLElement>('[role="alert"]')!;
    assert(
      failureAlert.innerText.includes("UnrelatedFailure could not render"),
      `${framework} identifies the failed component`,
    );
    assert(
      !failureAlert.innerText.includes("Unexpected demo failure"),
      `${framework} raw errors are collapsed by default`,
    );
    const technical = [...failureAlert.querySelectorAll("details")].find(
      (details) => details.querySelector("summary")?.textContent === "Technical details",
    )!;
    technical.querySelector("summary")!.click();
    assert(
      failureAlert.innerText.includes("Unexpected demo failure"),
      `${framework} original errors remain available`,
    );
    results.push(
      `${framework}: clear failure summaries keep original errors in expandable details`,
    );

    reset();
    show(component(framework, "EmptyComponent"));
    await until(
      () => Boolean(host.querySelector('[role="alert"]')),
      `${framework} empty explanation`,
    );
    assert(
      host
        .querySelector<HTMLElement>('[role="alert"]')!
        .innerText.includes("EmptyComponent has no visible content"),
      `${framework} empty output is not described as a context failure`,
    );
    results.push(`${framework}: empty output receives separate guidance`);

    for (const compact of [false, true]) {
      reset();
      show(component(framework, "ViewportFill"), {}, framework, [], compact);
      const limit = compact ? 384 : 720;
      await until(
        () => host.textContent!.includes("Scroll within the preview"),
        `${framework} height limit`,
      );
      const iframe = host.querySelector("iframe")!;
      assert(
        iframe.getBoundingClientRect().height <= limit,
        `${framework} viewport layouts stay bounded`,
      );
      const doc = iframe.contentDocument!;
      assert(
        doc.scrollingElement!.scrollHeight > doc.documentElement.clientHeight,
        `${framework} tall content remains scrollable`,
      );
      const button = doc.querySelector("button")!;
      button.scrollIntoView({ block: "end" });
      assert(
        button.getBoundingClientRect().bottom <= doc.documentElement.clientHeight + 1,
        `${framework} bottom content can be reached`,
      );
      button.click();
      await until(() => frameText().includes("Bottom reached"), `${framework} bottom action works`);
      show(component(framework), {}, framework, [], compact);
      await until(
        () =>
          frameText().includes("provided") &&
          !host.textContent!.includes("Scroll within the preview"),
        `${framework} small content restores automatic height`,
      );
      assert(
        iframe.getBoundingClientRect().height < limit,
        `${framework} small previews shrink again`,
      );
    }
    results.push(
      `${framework}: viewport height loops are bounded; tall content scrolls and normal previews shrink`,
    );
  }
  reset();
  const manual = component("react");
  manual.preview.manual_preview = {
    rel_path: manual.preview.rel_path,
    export_name: "manualDefinition",
  };
  show(manual);
  await until(
    () => frameText().includes("Manual default"),
    "manual preview defaults before visibility check",
  );
  results.push("manual previews: seed declared defaults before checking visibility");

  reset();
  const notification = component("react", "EmptyComponent");
  notification.preview.component_imports = {
    Sonner: {
      specifier: "sonner",
      export_name: "Toaster",
      importer: notification.preview.rel_path,
    },
  };
  show(notification);
  await until(
    () => host.textContent!.includes("No notification to show"),
    "notification explanation",
  );
  const notificationAlert = host.querySelector<HTMLElement>('[role="alert"]')!;
  assert(
    messages.some((message) => message.setupAction === "notification"),
    "complete notification setups expose the save action",
  );
  assert(
    notificationAlert.innerText.includes("button that shows a sample notification"),
    "notification guidance describes a concrete action",
  );
  const setup = [...notificationAlert.querySelectorAll("details")].find(
    (details) => details.querySelector("summary")?.textContent === "Preview setup",
  )!;
  setup.querySelector("summary")!.click();
  assert(
    notificationAlert.innerText.includes('toast("Example notification")'),
    "notification setup contains a working local trigger",
  );
  assert(
    notificationAlert.innerText.includes(notification.id),
    "notification setup targets this component",
  );
  results.push("notifications: clear empty state and component-specific setup example");

  reset();
  show(component("react"), { label: "Legacy host" }, "react-legacy");
  await until(
    () => frameText().includes("Legacy host: provided"),
    "older preview host compatibility",
  );
  assert(
    !messages.some((message) => message.type === "error"),
    "older hosts must not fail reading moduleRoot",
  );
  results.push("older hosts: module root fallback avoids replaceAll errors");

  reset();
  show(component("vue", "BareInjection"));
  await until(
    () => host.textContent!.includes("app.provide or app.use"),
    "Vue bare injection guidance",
  );
  results.push("vue: missing injection warnings produce service guidance");

  reset();
  // The real reported regression: nested SidebarMenuButton needs SidebarProvider.
  const path = "demo/inertia/resources/js/components/sidebar-nav.tsx";
  const sidebar: CatalogComponent = {
    id: `${path}#SidebarNavBrand`,
    name: "SidebarNavBrand",
    framework: "react",
    preview: {
      id: "SidebarNavBrand",
      rel_path: path,
      export_name: "SidebarNavBrand",
      declared_props: ["href", "logo"],
      provider_candidates: [
        {
          id: "demo/inertia/resources/js/components/ui/sidebar.tsx#SidebarProvider",
          name: "SidebarProvider",
          rel_path: "demo/inertia/resources/js/components/ui/sidebar.tsx",
          export_name: "SidebarProvider",
        },
      ],
    },
    usages: [],
    bindings: {},
    dependencies: [],
  };
  show(sidebar, { href: "/", logo: "DSLinter brand" });
  await until(
    () =>
      messages.some(
        (message) =>
          message.type === "rendered" &&
          message.suppliedProviders?.some((provider) => provider.name === "SidebarProvider"),
      ),
    "real SidebarNavBrand recovery",
  );
  assert(frameText().includes("DSLinter brand"), "real SidebarNavBrand must render its logo");
  assert(!messages.some((m) => m.type === "error"), "real SidebarNavBrand has no terminal errors");
  results.push("SidebarNavBrand: real SidebarProvider recovery without an adapter");
  const beforeHotUpdate = messages.filter((message) => message.type === "rendered").length;
  await fetch("/__tests/hot-provider", { method: "POST" });
  await until(
    () => messages.filter((message) => message.type === "rendered").length > beforeHotUpdate,
    "versioned provider HMR",
  );
  assert(
    !messages.some((message) => message.type === "error"),
    "Vite-versioned provider shares context with nested imports",
  );
  results.push("HMR: real provider invalidation preserves module identity");

  const { router } = await import("../../src/explorer/inertiaShared");
  let flashes = 0;
  const unsubscribe = router.on("flash", () => flashes++);
  window.dispatchEvent(new CustomEvent("inertia:flash"));
  unsubscribe();
  window.dispatchEvent(new CustomEvent("inertia:flash"));
  assert(flashes === 1, "Inertia subscriptions unsubscribe correctly");
  results.push("Inertia: local event subscriptions and cleanup");

  reset();
  const cycle = component("react", "PageConsumer");
  cycle.id = "dashboard/tests/previewRecovery/adapterCycleFixture.tsx#PageConsumer";
  cycle.preview.rel_path = "dashboard/tests/previewRecovery/adapterCycleFixture.tsx";
  show(cycle, {}, "react-cycle");
  await until(
    () => frameText().includes("Adapter page props loaded"),
    "adapter imports an Inertia component without an initialization cycle",
  );
  assert(
    !messages.some((message) => message.type === "error"),
    "adapter import cycles do not break preview startup",
  );
  results.push(
    "Inertia: adapters can import components using page props without an initialization cycle",
  );

  reset();
  show(component("react"));
  // Supersede the initial async imports/mount before completion.
  show(component("vue"), { label: "Navigation winner" });
  await until(
    () => frameText().includes("Navigation winner: provided"),
    "navigation supersedes recovery",
  );
  assert(!messages.some((m) => m.type === "error"), "stale recovery must not publish errors");
  results.push("navigation: superseded recovery cannot replace the active preview");
}
run()
  .then(() => {
    document.getElementById("results")!.textContent =
      `PASS (${results.length})\n${results.join("\n")}`;
  })
  .catch((error) => {
    document.getElementById("results")!.textContent = `FAIL\n${error.stack}\n${results.join("\n")}`;
    console.error(error);
  });
