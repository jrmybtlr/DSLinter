import { useCallback } from "react";
import { TruncatedPath } from "../components/TruncatedPath";
import { openSourceFile } from "./editorLink";
import { resolveReportAbsolutePath, shortPath } from "./paths";

export function SourceLocationLink({
  root,
  path,
  line,
}: {
  root: string;
  path: string;
  line: number;
}) {
  const fileText = shortPath(root, path);
  const locationText = `${fileText}:${line}`;
  const absolutePath = resolveReportAbsolutePath(root, path);

  const handleClick = useCallback(() => {
    void openSourceFile(absolutePath, line).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      window.alert(`Could not open file: ${message}`);
    });
  }, [absolutePath, line]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="block min-w-0 w-full text-left text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
      title={locationText}
    >
      <TruncatedPath
        path={locationText}
        className="text-xs"
        title={undefined}
      />
    </button>
  );
}
