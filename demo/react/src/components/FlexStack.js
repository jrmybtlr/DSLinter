/** Layout primitive using spacing tokens from Tailwind theme. */
export function FlexStack({ children }) {
    return <div className="flex flex-col gap-layout-md">{children}</div>;
}
