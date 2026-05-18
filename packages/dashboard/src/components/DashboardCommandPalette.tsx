import { useCallback, useEffect } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import type { HashRoute } from "../shell/hashRoute";

type Props = {
  catalogNames: string[];
  onNavigate: (next: HashRoute) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function eventTargetIsEditable(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function DashboardCommandPalette({
  catalogNames,
  onNavigate,
  open,
  onOpenChange,
}: Props) {
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "k") return;
      if (!open && eventTargetIsEditable(e.target)) return;
      e.preventDefault();
      onOpenChange(!open);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Jump to"
      description="Search components and views"
    >
      <CommandInput placeholder="Search components…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Explore">
          <CommandItem
            value="governance explore overview"
            onSelect={() => {
              onNavigate({ view: "governance" });
              close();
            }}
          >
            Governance
          </CommandItem>
        </CommandGroup>
        {catalogNames.length > 0 ? (
          <CommandGroup heading="Components">
            {catalogNames.map((name) => (
              <CommandItem
                key={name}
                value={name}
                onSelect={() => {
                  onNavigate({ view: "component", componentId: name });
                  close();
                }}
              >
                {name}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        <CommandGroup heading="System">
          <CommandItem
            value="tokens design system colors"
            onSelect={() => {
              onNavigate({ view: "tokens" });
              close();
            }}
          >
            Design tokens
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
