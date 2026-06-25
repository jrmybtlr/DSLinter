type Variant = "primary" | "secondary" | "danger" | "success" | "warning" | "ghost";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "bg-[#5b21b6] text-white hover:bg-[#4a148c]",
  secondary: "bg-[#e2e8f0] text-gray-800 hover:bg-[#cbd5e1]",
  danger: "bg-[#dc2626] text-white hover:bg-[#b91c1c]",
  success: "bg-[#16a34a] text-white hover:bg-[#15803d]",
  warning: "bg-[#f59e0b] text-gray-800 hover:bg-[#d97706]",
  ghost: "bg-transparent text-gray-800 hover:bg-gray-100",
};

const sizeClass: Record<Size, string> = {
  sm: "text-xs py-1 px-3",
  md: "text-sm py-2 px-4",
  lg: "text-lg py-3 px-6",
};

/** Test button. */
export function LegacyButton({
  children,
  variant = "primary",
  size = "md",
}: {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
}): JSX.Element {
  const v: Variant = variant in variantClass ? (variant as Variant) : "primary";
  const s: Size = size in sizeClass ? (size as Size) : "md";
  return (
    <button type="button" className={`rounded-md font-medium ${variantClass[v]} ${sizeClass[s]}`}>
      {children}
    </button>
  );
}
