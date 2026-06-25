/** Named in `.dslinter.json` deprecated_components — triggers deprecated-component rule. */
export function DeprecatedChip({ label }) {
    return (<span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">{label}</span>);
}
