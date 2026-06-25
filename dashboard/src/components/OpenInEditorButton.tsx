import { useCallback, useState } from "react";
import { openSourceFile } from "../dashboard/editorLink";
import { Button } from "./ui/button";

type Props = {
  filePath: string;
  line?: number;
};

export function OpenInEditorButton({ filePath, line }: Props) {
  const [pending, setPending] = useState(false);

  const handleClick = useCallback(async () => {
    setPending(true);
    try {
      await openSourceFile(filePath, line);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      window.alert(`Could not open file: ${message}`);
    } finally {
      setPending(false);
    }
  }, [filePath, line]);

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => void handleClick()}
    >
      {pending ? "Opening…" : "Open in Editor"}
    </Button>
  );
}
