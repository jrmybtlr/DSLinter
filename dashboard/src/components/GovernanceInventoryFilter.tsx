import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
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

export function GovernanceInventoryFilter({
  value,
  onChange,
  counts,
}: {
  value: GovernanceInventoryTab;
  onChange: (value: GovernanceInventoryTab) => void;
  counts: Record<GovernanceInventoryTab, number>;
}) {
  return (
    <Select
      name="category"
      value={value}
      onValueChange={(next) => {
        if (isGovernanceInventoryTab(next)) onChange(next);
      }}
    >
      <SelectTrigger
        aria-label="Filter governance inventory"
        className="w-auto min-w-44 shrink-0 gap-3 bg-card text-base shadow-none sm:text-sm"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {tabs.map((tab) => (
          <SelectItem key={tab.id} value={tab.id}>
            {tab.label} · {counts[tab.id]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
