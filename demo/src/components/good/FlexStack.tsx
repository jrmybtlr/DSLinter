type Props = {
  children: React.ReactNode;
};

/** Layout primitive using spacing tokens from Tailwind theme. */
export function FlexStack({ children }: Props) {
  return <div className="flex flex-col gap-layout-md">{children}</div>;
}
