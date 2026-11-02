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
  /** Controlled dialog, used when another control opens the confirm step. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Omit the default button when a menu item opens the dialog. */
  hideTrigger?: boolean;
};

export function HideFromCatalogButton({
  componentName,
  onHidden,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
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
  }, [componentName, onHidden, setOpen]);

  return (
    <>
      {hideTrigger ? null : (
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
      )}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
      >
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Hide from library?</DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                This hides{" "}
                <span className="font-medium text-foreground">{componentName}</span> from the
                DSLint library. Nothing is deleted — the source file stays in your project, and
                DSLint still scans it. It just will not appear in the sidebar, command palette, or
                playground.
              </span>
              <span className="block">
                Show it again by removing the name from{" "}
                <code className="text-xs">hidden_components</code> in{" "}
                <code className="text-xs">.dslinter.json</code>.
              </span>
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
            <Button type="button" disabled={pending} onClick={() => void handleConfirm()}>
              {pending ? "Hiding…" : "Hide from library"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
