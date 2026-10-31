import { Component, type ErrorInfo, type ReactNode } from "react";
import { renderErrorExplanation } from "../explorer/previewMessages";

type Props = {
  children: ReactNode;
  componentName?: string;
};

type State = {
  error: Error | null;
};

export class PlaygroundPreviewErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[dslinter] preview render failed", error, info.componentStack);
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.children !== this.props.children && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      const name = this.props.componentName ?? "Component";
      const explanation = renderErrorExplanation(name, this.state.error.message);
      return (
        <div
          role="alert"
          className="rounded-md border border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground"
        >
          <p className="font-medium text-foreground">{explanation.title}</p>
          <p className="mt-2">{explanation.description}</p>
          <p className="mt-3">{explanation.nextStep}</p>
          <button
            type="button"
            className="mt-4 underline underline-offset-4"
            onClick={() => this.setState({ error: null })}
          >
            Retry preview
          </button>
          <details className="mt-4">
            <summary className="cursor-pointer font-medium">Technical details</summary>
            <pre className="mt-2 max-h-48 overflow-auto font-mono text-xs break-words whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
