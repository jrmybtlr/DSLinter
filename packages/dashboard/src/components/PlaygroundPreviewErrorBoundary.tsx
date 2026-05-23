import { Component, type ErrorInfo, type ReactNode } from "react";

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
    if (import.meta.env?.DEV) {
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
      return (
        <div className="rounded-md border border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            Preview could not render {name}
          </p>
          <p className="mt-2">
            This component may need Inertia page props, a provider, or other app
            context. The scanner snapshot and governance panels still reflect
            static analysis.
          </p>
          <p className="mt-2 font-mono text-xs">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
