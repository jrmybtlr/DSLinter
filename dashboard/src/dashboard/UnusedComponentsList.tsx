import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { TruncatedPath } from "../components/TruncatedPath";
import type { UnusedComponent } from "./aggregate";
import { shortPath } from "./paths";
import { pluralize } from "usemods";

export function UnusedComponentsList({
  components,
  root,
  onOpenComponent,
}: {
  components: UnusedComponent[];
  root: string;
  onOpenComponent?: (name: string) => void;
}) {
  if (components.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No unused components — every scanned definition has at least one JSX
        reference in the workspace.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Component</TableHead>
          <TableHead scope="col">Defined in</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {components.map(({ name, definitionPaths }) => (
          <TableRow key={name}>
            <TableCell>
              {onOpenComponent ? (
                <button
                  type="button"
                  onClick={() => onOpenComponent(name)}
                  className="text-left font-medium text-foreground underline decoration-transparent underline-offset-2 transition hover:decoration-current"
                >
                  {name}
                </button>
              ) : (
                name
              )}
            </TableCell>
            <TableCell className="min-w-0 font-mono text-xs text-muted-foreground">
              {definitionPaths.length === 1 ? (
                <TruncatedPath
                  path={shortPath(root, definitionPaths[0]!)}
                  className="text-xs"
                />
              ) : (
                <span title={definitionPaths.map((p) => shortPath(root, p)).join("\n")}>
                  {definitionPaths.length}{" "}
                  {pluralize("file", definitionPaths.length)}
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
