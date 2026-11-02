import { page } from "../../src/explorer/inertiaShared";

export function PageConsumer() {
  return <span>{String(page.props.cycleValue || "No adapter page props")}</span>;
}
