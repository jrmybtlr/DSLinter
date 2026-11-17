import { useRef, useState } from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { cn } from "../lib/utils";
import { useDashboardTheme } from "../shell/DashboardTheme";
import { IconDotsVertical } from "./icons";
import { HideFromCatalogButton } from "./HideFromCatalogButton";
import { useOpenSourceFile } from "./OpenInEditorButton";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

function libraryLabel(componentName: string): string {
  const hash = componentName.lastIndexOf("#");
  const label = hash >= 0 ? componentName.slice(hash + 1) : componentName;
  return label || componentName;
}

const menuItemClass =
  "relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground";

type Props = {
  displayPath: string;
  filePath?: string;
  componentName: string;
  onHideFromCatalog?: (componentName: string) => void;
  onHideComponent?: () => void;
};

export function SourcePathActions({
  displayPath,
  filePath,
  componentName,
  onHideFromCatalog,
  onHideComponent,
}: Props) {
  const { resolvedTheme } = useDashboardTheme();
  const { pending, error, open } = useOpenSourceFile(filePath);
  const [hideOpen, setHideOpen] = useState(false);
  const [sessionHideOpen, setSessionHideOpen] = useState(false);
  const openingDialog = useRef(false);
  const canOpen = Boolean(filePath);
  const canHide = Boolean(onHideFromCatalog || onHideComponent);

  return (
    <div className="mt-1 min-w-0">
      <div className="flex min-w-0 items-center gap-1">
        {canOpen ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void open()}
            className="min-w-0 cursor-pointer text-left font-mono text-xs break-all text-muted-foreground underline-offset-2 disabled:opacity-60"
            className:hover="text-foreground underline"
            className:focus-visible="text-foreground underline outline-none"
          >
            {displayPath}
          </button>
        ) : (
          <p className="min-w-0 font-mono text-xs break-all text-muted-foreground">{displayPath}</p>
        )}
        {canOpen || canHide ? (
          <DropdownMenuPrimitive.Root>
            <DropdownMenuPrimitive.Trigger
              type="button"
              aria-label="Component actions"
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-base leading-none text-muted-foreground"
              className:hover="bg-accent text-accent-foreground"
              className:focus-visible="ring-1 ring-ring outline-none"
            >
              <IconDotsVertical className="size-4" aria-hidden />
            </DropdownMenuPrimitive.Trigger>
            <DropdownMenuPrimitive.Portal>
              <DropdownMenuPrimitive.Content
                align="start"
                sideOffset={4}
                data-dashboard-theme={resolvedTheme}
                onCloseAutoFocus={(event) => {
                  if (!openingDialog.current) return;
                  event.preventDefault();
                  openingDialog.current = false;
                }}
                className={cn(
                  "z-50 min-w-40 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md",
                )}
              >
                {canOpen ? (
                  <DropdownMenuPrimitive.Item
                    className={menuItemClass}
                    disabled={pending}
                    onSelect={() => void open()}
                  >
                    {pending ? "Opening…" : "Open in Editor"}
                  </DropdownMenuPrimitive.Item>
                ) : null}
                {canHide ? (
                  <DropdownMenuPrimitive.Item
                    className={menuItemClass}
                    onSelect={() => {
                      openingDialog.current = true;
                      if (onHideFromCatalog) {
                        setHideOpen(true);
                        return;
                      }
                      setSessionHideOpen(true);
                    }}
                  >
                    Hide from Library
                  </DropdownMenuPrimitive.Item>
                ) : null}
              </DropdownMenuPrimitive.Content>
            </DropdownMenuPrimitive.Portal>
          </DropdownMenuPrimitive.Root>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1 max-w-md text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {onHideFromCatalog ? (
        <HideFromCatalogButton
          hideTrigger
          open={hideOpen}
          onOpenChange={setHideOpen}
          componentName={componentName}
          onHidden={onHideFromCatalog}
        />
      ) : null}
      {!onHideFromCatalog && onHideComponent ? (
        <Dialog open={sessionHideOpen} onOpenChange={setSessionHideOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Hide from library?</DialogTitle>
              <DialogDescription className="space-y-2">
                <span className="block">
                  This hides{" "}
                  <span className="font-medium text-foreground">{libraryLabel(componentName)}</span>{" "}
                  from the library in this browser. Nothing is deleted, and DSLint still scans it.
                </span>
                <span className="block">
                  Bring hidden components back from the Restore link in the sidebar.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSessionHideOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setSessionHideOpen(false);
                  onHideComponent?.();
                }}
              >
                Hide from library
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
