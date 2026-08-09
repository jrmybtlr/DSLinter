import { useCallback, useState } from "react";
import { openSourceFile } from "../dashboard/editorLink";
import { Button } from "./ui/button";

type Props = {
  filePath: string;
  line?: number;
};

export function OpenInEditorButton({ filePath, line }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      await openSourceFile(filePath, line);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Could not open file: ${message}`);
    } finally {
      setPending(false);
    }
  }, [filePath, line]);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => void handleClick()}
      >
        {pending ? "Opening…" : "Open in Editor"}
      </Button>
      {error ? (
        <p className="max-w-xs text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
