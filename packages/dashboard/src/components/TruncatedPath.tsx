import { useLayoutEffect, useRef, useState } from "react";
import {
  monospaceCharCountThatFits,
  truncatePathMiddle,
} from "../dashboard/paths";
import { cn } from "../lib/utils";

export function TruncatedPath({
  path,
  className,
  title,
}: {
  path: string;
  className?: string;
  title?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [displayPath, setDisplayPath] = useState(path);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sync = () => {
      const maxLength = monospaceCharCountThatFits(el);
      setDisplayPath(truncatePathMiddle(path, maxLength));
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [path]);

  return (
    <span
      ref={ref}
      className={cn("block min-w-0 font-mono", className)}
      title={title ?? path}
    >
      {displayPath}
    </span>
  );
}
