import { useEffect, useRef, useState } from "react";
import context from "virtual:dslinter/explorer";
import type { CatalogComponent } from "../types/report";
import { usePreviewSectionTheme } from "../shell/previewSectionTheme";
import { PREVIEW_PROTOCOL, type PreviewCommand, type PreviewResponse } from "./protocol";
import { PreviewFailureNotice } from "./PreviewFailureNotice";
import { previewHeightLimit } from "./previewSizing";

type Props = {
  component: CatalogComponent;
  catalog: CatalogComponent[];
  app: string;
  values: Record<string, unknown>;
  compact?: boolean;
  explicitKeys?: string[];
  scanLabel?: string;
  scanVersion?: string;
  onResponse?: (message: PreviewResponse) => void;
  onScanPending?: (pending: boolean) => void;
};

/** One independent consumer document; variant frames start only near the viewport. */
export function PreviewFrame({
  component,
  catalog,
  app,
  values,
  compact = false,
  explicitKeys,
  scanLabel = "Live preview",
  scanVersion,
  onResponse,
  onScanPending,
}: Props) {
  const resolvedTheme = usePreviewSectionTheme();
  const host = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const origin = useRef<string | null>(null);
  const latest = useRef({
    explicitKeys,
    component,
    catalog,
    values,
    onResponse,
    onScanPending,
    resolvedTheme,
    scanLabel,
  });
  latest.current = {
    explicitKeys,
    component,
    catalog,
    values,
    onResponse,
    onScanPending,
    resolvedTheme,
    scanLabel,
  };
  const [visible, setVisible] = useState(!compact);
  const [revision, setRevision] = useState(0);
  const [height, setHeight] = useState<number>();
  const [heightLimited, setHeightLimited] = useState(false);
  const [status, setStatus] = useState<PreviewResponse | null>(null);
  const compatible =
    context.apps.find((candidate) => candidate.id === app)?.framework === component.framework;
  const previousValues = useRef(values);
  const valuesKey = JSON.stringify([values, explicitKeys]);
  const failed = compatible && visible && status?.type === "error";

  useEffect(() => {
    setStatus(null);
    setHeight(undefined);
    setHeightLimited(false);
  }, [app, component.id]);

  useEffect(() => {
    if (!compact || !host.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [compact]);

  useEffect(() => {
    if (!visible || !compatible) return;
    let scanTimer: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => {
      const message: PreviewResponse = {
        protocol: PREVIEW_PROTOCOL,
        type: "error",
        failurePhase: "connect",
        message:
          "The preview host did not become ready. Check the selected application's Vite configuration.",
      };
      setStatus((previous) => previous || message);
      latest.current.onScanPending?.(false);
    }, 20000);
    function send(command: Omit<PreviewCommand, "protocol">) {
      if (origin.current)
        frame.current?.contentWindow?.postMessage(
          { protocol: PREVIEW_PROTOCOL, ...command },
          origin.current,
        );
    }
    function receive(event: MessageEvent<PreviewResponse>) {
      if (
        event.source !== frame.current?.contentWindow ||
        event.data?.protocol !== PREVIEW_PROTOCOL
      )
        return;
      const message = event.data;
      if (message.type === "ready") {
        clearTimeout(timeout);
        origin.current = event.origin;
        send({
          type: "mount",
          component: latest.current.component,
          catalog: latest.current.catalog,
          values: latest.current.values,
          explicitKeys: latest.current.explicitKeys,
          compact,
          theme: latest.current.resolvedTheme,
        });
        return;
      }
      if (message.type === "resize") {
        if (
          typeof message.height === "number" &&
          Number.isFinite(message.height) &&
          message.height > 0
        ) {
          // Viewport-sized consumer layouts can otherwise grow the iframe on every resize.
          const limit = previewHeightLimit(compact);
          setHeight(Math.min(Math.ceil(message.height), limit));
          setHeightLimited(message.height > limit);
        }
        return;
      }
      if (message.type === "rendered" || message.type === "error") setStatus(message);
      latest.current.onResponse?.(message);
      if (message.type === "a11y" || message.type === "error")
        latest.current.onScanPending?.(false);
      if (message.type === "rendered" || message.type === "event") {
        clearTimeout(scanTimer);
        latest.current.onScanPending?.(true);
        scanTimer = setTimeout(
          () => send({ type: "scan-a11y", requestId: latest.current.scanLabel }),
          350,
        );
      }
    }
    window.addEventListener("message", receive);
    return () => {
      clearTimeout(timeout);
      clearTimeout(scanTimer);
      send({ type: "unmount" });
      window.removeEventListener("message", receive);
      origin.current = null;
    };
  }, [app, compact, visible, compatible, revision]);

  useEffect(() => {
    const removed = Object.keys(previousValues.current).some((key) => !(key in values));
    previousValues.current = values;
    if (origin.current)
      frame.current?.contentWindow?.postMessage(
        {
          protocol: PREVIEW_PROTOCOL,
          type: removed ? "mount" : "update",
          ...(removed ? { component, catalog, compact } : {}),
          values: latest.current.values,
          explicitKeys: latest.current.explicitKeys,
          theme: resolvedTheme,
        },
        origin.current,
      );
  }, [valuesKey, resolvedTheme, scanVersion]);
  useEffect(() => {
    if (origin.current)
      frame.current?.contentWindow?.postMessage(
        {
          protocol: PREVIEW_PROTOCOL,
          type: "mount",
          component,
          catalog,
          values: latest.current.values,
          explicitKeys: latest.current.explicitKeys,
          compact,
          theme: resolvedTheme,
        },
        origin.current,
      );
  }, [component, catalog]);

  return (
    <div ref={host} className="relative min-w-0" data-preview-status={status?.type || "pending"}>
      {!compatible ? (
        <p className="p-6 text-sm text-muted-foreground">
          {component.name} is a {component.framework === "vue" ? "Vue" : "React"} component.
          {context.apps.some((candidate) => candidate.framework === component.framework)
            ? " Select a matching app under Preview application in the sidebar to see it render."
            : ` No matching preview app was found. Run DSLinter from a workspace that includes a ${component.framework === "vue" ? "Vue" : "React"} app.`}
        </p>
      ) : visible ? (
        <iframe
          key={revision}
          ref={frame}
          title={compact ? `${component.name} variant ${scanLabel}` : `${component.name} preview`}
          src={`/__dslinter/frame?app=${encodeURIComponent(app)}`}
          aria-hidden={failed || undefined}
          tabIndex={failed ? -1 : undefined}
          className="block h-fit w-full border-0"
          style={{
            height: failed ? 0 : height,
            // Keep the frame connected so source updates can recover the preview.
            visibility: failed ? "hidden" : undefined,
            position: failed ? "absolute" : undefined,
            colorScheme: resolvedTheme,
          }}
        />
      ) : (
        <div
          className="h-24 animate-pulse bg-muted/20"
          aria-label={`Loading ${component.name} variant preview`}
        />
      )}
      {compatible && visible && !status && (
        <p
          role="status"
          className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-sm text-muted-foreground"
        >
          Loading {component.name} preview…
        </p>
      )}
      {!failed && heightLimited && (
        <p className="border-t border-border p-3 text-xs text-muted-foreground">
          Scroll within the preview to see more.
        </p>
      )}
      {failed && (
        <PreviewFailureNotice
          component={component}
          status={status}
          compact={compact}
          app={app}
          setupToken={context.setupToken}
          onRetry={() => {
            setStatus(null);
            setRevision((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}
