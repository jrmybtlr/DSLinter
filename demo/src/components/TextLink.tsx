type Props = {
  children: React.ReactNode;
  href: string;
  external?: boolean;
};

/** Text-style anchor with optional external target/rel defaults. */
export function TextLink({ children, href, external = false }: Props) {
  return (
    <a
      href={href}
      className="font-medium text-primary underline decoration-primary/30 underline-offset-2 transition hover:text-primary/80 hover:decoration-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      {children}
      {external ? (
        <span className="sr-only"> (opens in a new tab)</span>
      ) : null}
    </a>
  );
}
