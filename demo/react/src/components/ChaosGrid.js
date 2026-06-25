/** Arbitrary spacing drift (`[#px]`) instead of layout tokens. */
export function ChaosGrid({ children }) {
    return (<div className="grid grid-cols-1 md:grid-cols-2 gap-[13px] p-[19px]">
      <div className="rounded bg-gray-100 p-[11px]">{children}</div>
      <div className="rounded bg-gray-50 p-[7px]">{children}</div>
    </div>);
}
