
/** Intentional duplicate component name — triggers duplicate-component in DSLint. */
export function Card() {
  return (
    <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
      <p className="font-medium">Alex Morgan</p>
      <p className="text-blue-800/90">Engineering · Remote</p>
    </div>
  );
}
