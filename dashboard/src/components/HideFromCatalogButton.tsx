import { useCallback, useState } from "react";
import { hideCatalogComponent } from "../dashboard/updateDslintConfig";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type Props = {
  componentName: string;
  onHidden: (componentName: string) => void;
};

export function HideFromCatalogButton({ componentName, onHidden }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      await hideCatalogComponent(componentName);
      setOpen(false);
      onHidden(componentName);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Could not hide ${componentName}: ${message}`);
    } finally {
      setPending(false);
    }
  }, [componentName, onHidden]);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Hide Component
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
      >
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Hide from catalog?</DialogTitle>
            <DialogDescription>
              Hide <span className="font-medium text-foreground">{componentName}</span>{" "}
              from the component catalog. This updates{" "}
              <code className="text-xs">hidden_components</code> in{" "}
              <code className="text-xs">.dslinter.json</code>.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => void handleConfirm()}
            >
              {pending ? "Hiding…" : "Hide component"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
