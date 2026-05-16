import { useCallback, useEffect } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import type { PlaygroundEntry } from "../types/playground";
import type { HashRoute } from "../shell/hashRoute";

type Props = {
  entries: PlaygroundEntry[];
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

type ComponentChunk = {
  heading: string;
  entries: PlaygroundEntry[];
};

function chunkPlaygroundEntries(entries: PlaygroundEntry[]): ComponentChunk[] {
  if (entries.length === 0) return [];
  const chunks: ComponentChunk[] = [];
  let chunk: PlaygroundEntry[] = [];
  let heading = "Components";

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const prev = i > 0 ? entries[i - 1] : undefined;
    const showGroup =
      Boolean(e.meta.group) &&
      (prev == null || prev.meta.group !== e.meta.group);

    if (showGroup && chunk.length > 0) {
      chunks.push({ heading, entries: chunk });
      chunk = [];
      heading = e.meta.group ?? "Components";
    } else if (showGroup && chunk.length === 0) {
      heading = e.meta.group ?? "Components";
    }
    chunk.push(e);
  }
  if (chunk.length > 0) {
    chunks.push({ heading, entries: chunk });
  }
  return chunks;
}

export function DashboardCommandPalette({
  entries,
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

  const componentChunks = chunkPlaygroundEntries(entries);

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
        {componentChunks.map((c, chunkIndex) => (
          <CommandGroup key={`${c.heading}-${chunkIndex}`} heading={c.heading}>
            {c.entries.map((entry) => (
              <CommandItem
                key={entry.id}
                value={`${entry.id} ${entry.meta.title} ${entry.meta.group ?? ""}`}
                onSelect={() => {
                  onNavigate({ view: "component", componentId: entry.id });
                  close();
                }}
              >
                {entry.meta.title}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
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
