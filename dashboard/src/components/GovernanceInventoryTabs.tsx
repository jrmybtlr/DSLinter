import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import type { GovernanceInventoryTab } from "../dashboard/aggregate";

const tabs: { id: GovernanceInventoryTab; label: string }[] = [
  { id: "all", label: "All issues" },
  { id: "a11y", label: "Accessibility" },
  { id: "code", label: "Code quality" },
  { id: "token", label: "Tokens" },
  { id: "unused", label: "Unused" },
];

function isGovernanceInventoryTab(value: string): value is GovernanceInventoryTab {
  return tabs.some((tab) => tab.id === value);
}

export function GovernanceInventoryTabs({
  value,
  onChange,
  counts,
}: {
  value: GovernanceInventoryTab;
  onChange: (value: GovernanceInventoryTab) => void;
  counts: Record<GovernanceInventoryTab, number>;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (isGovernanceInventoryTab(next)) onChange(next);
      }}
      variant="outline"
      size="sm"
      aria-label="Filter governance inventory"
      className="contents"
    >
      {tabs.map((tab) => (
        <ToggleGroupItem
          key={tab.id}
          value={tab.id}
          className="rounded-full px-2.5 text-xs font-medium"
        >
          {tab.label}
          <span className="ml-1 tabular-nums text-muted-foreground">
            {counts[tab.id]}
          </span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
