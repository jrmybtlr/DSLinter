import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";

/** Max previews in the variant matrix; larger Cartesian products show a cap notice. */
export const PLAYGROUND_VARIANT_MATRIX_CAP = 200;

export type EnumerateControlCombinationsResult = {
  /** Cartesian product of boolean + select axes, merged over `baseValues`, truncated to cap. */
  combinations: PlaygroundArgs[];
  /** Full product size before capping (0 when there are no finite axes). */
  totalCount: number;
  /** True when `totalCount` exceeds the cap. */
  capped: boolean;
  /** Keys that were expanded in the product (stable control order). */
  finiteAxisKeys: string[];
};

type FiniteAxis = {
  key: string;
  values: Array<string | number | boolean>;
};

function finiteAxesFromControls(controls: PlaygroundControl[]): FiniteAxis[] {
  const axes: FiniteAxis[] = [];
  for (const c of controls) {
    if (c.type === "boolean") {
      axes.push({ key: c.key, values: [false, true] });
    } else if (c.type === "select" && c.options.length > 0) {
      axes.push({
        key: c.key,
        values: c.options.map((o) => o.value),
      });
    }
  }
  return axes;
}

/**
 * Builds every combination of boolean and select controls, overlaid on `baseValues`
 * (string/number props stay as in the interactive panel).
 */
export function enumerateControlCombinations(
  controls: PlaygroundControl[],
  baseValues: PlaygroundArgs,
): EnumerateControlCombinationsResult {
  const axes = finiteAxesFromControls(controls);
  if (axes.length === 0) {
    return { combinations: [], totalCount: 0, capped: false, finiteAxisKeys: [] };
  }

  let totalCount = 1;
  for (const a of axes) {
    totalCount *= a.values.length;
  }

  const finiteAxisKeys = axes.map((a) => a.key);
  const combinations: PlaygroundArgs[] = [];
  const capped = totalCount > PLAYGROUND_VARIANT_MATRIX_CAP;

  const walk = (i: number, acc: PlaygroundArgs) => {
    if (combinations.length >= PLAYGROUND_VARIANT_MATRIX_CAP) return;
    if (i >= axes.length) {
      combinations.push({ ...acc });
      return;
    }
    const axis = axes[i]!;
    for (const v of axis.values) {
      walk(i + 1, { ...acc, [axis.key]: v });
    }
  };

  walk(0, { ...baseValues });

  return { combinations, totalCount, capped, finiteAxisKeys };
}
