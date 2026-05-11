
type Props = {
  href: string;
  children: React.ReactNode;
};

/** Visible focus ring for keyboard users. */
export function NavLink({ href, children }: Props) {
  return (
    <a
      href={href}
      className="text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {children}
    </a>
  );
}
