import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  MouseEvent,
  ReactNode,
} from "react";

type Variant =
  | "black"
  | "dark"
  | "muted"
  | "white"
  | "primary"
  | "danger"
  | "gitlab"
  | "bitbucket"
  | "nightwatch"
  | "ghost"
  | "outline"
  | "danger-outline"
  | "icon"
  | "icon-outline";

type Size = "small" | "default" | "large";
type IconSize = "small" | "medium" | "default";

type CommonProps = {
  variant?: Variant;
  size?: Size | IconSize;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
};

type ButtonAsButton = CommonProps & {
  as?: "button";
  href?: undefined;
} & Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    keyof CommonProps | "as" | "href"
  >;

type ButtonAsAnchor = CommonProps & {
  as?: "a";
  href: string;
} & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    keyof CommonProps | "as" | "href"
  >;

type Props = ButtonAsButton | ButtonAsAnchor;

const styles = {
  base: [
    "relative isolate inline-flex items-center justify-center rounded-md border font-medium whitespace-nowrap",
    "focus:outline-hidden focus-visible:shadow-xs",
    "data-disabled:cursor-default data-disabled:opacity-50",
    "[&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-(--btn-icon)",
  ],
  solid: [
    "border-transparent bg-(--btn-border)",
    "before:absolute before:inset-0 before:-z-10 before:rounded-[calc(var(--radius-md)-1px)] before:bg-(--btn-bg)",
    "before:shadow-xs",
    "after:absolute after:inset-0 after:-z-10 after:rounded-[calc(var(--radius-md)-1px)]",
    "after:shadow-[inset_0_1px_rgba(255,255,255,0.15)]",
    "hover:not-data-disabled:after:bg-(--btn-hover-overlay)",
    "data-disabled:before:shadow-none data-disabled:after:shadow-none",
  ],
  variants: {
    black: [
      "text-white [--btn-bg:var(--color-foreground)] [--btn-border:var(--color-foreground)] [--btn-hover-overlay:var(--color-white)]/10",
      "[--btn-icon:var(--color-white)] hover:[--btn-icon:var(--color-white)]",
    ],
    dark: [
      "text-[#ECEDEE] [--btn-bg:#26292B] [--btn-border:#E5F2FE42] [--btn-hover-overlay:var(--color-white)]/5",
      "[--btn-icon:#E1F1FF69]",
      "after:shadow-none",
    ],
    muted: [
      "text-white [--btn-bg:transparent] [--btn-border:#FFFFFF1A] [--btn-hover-overlay:var(--color-white)]/5",
      "[--btn-icon:#E1F1FF69]",
      "after:shadow-none",
    ],
    white: [
      "text-foreground [--btn-bg:var(--color-surface-elevated)] [--btn-border:var(--color-surface-border)] [--btn-hover-overlay:var(--color-foreground)]/2.5 hover:[--btn-border:var(--color-surface-border)]",
      "[--btn-icon:var(--color-muted-foreground)] hover:[--btn-icon:var(--color-muted-foreground)]",
    ],
    primary: [
      "text-white [--btn-bg:var(--color-primary)] [--btn-border:var(--color-primary)] [--btn-hover-overlay:var(--color-white)]/10",
      "[--btn-icon:var(--color-white)] hover:[--btn-icon:var(--color-white)]",
    ],
    danger: [
      "text-white [--btn-bg:var(--color-danger)] [--btn-border:var(--color-danger)] [--btn-hover-overlay:var(--color-white)]/10",
      "[--btn-icon:var(--color-white)] hover:[--btn-icon:var(--color-white)]",
    ],
    gitlab: [
      "text-white [--btn-bg:#E3622B] [--btn-border:#C14510] [--btn-hover-overlay:var(--color-white)]/10",
    ],
    bitbucket: [
      "text-white [--btn-bg:#0052CC] [--btn-border:#0042A4] [--btn-hover-overlay:var(--color-white)]/10",
    ],
    nightwatch: [
      "text-white [--btn-bg:#2f4e45] [--btn-border:#83FFD44D] [--btn-hover-overlay:var(--color-white)]/10 after:shadow-none",
    ],
    ghost: [
      "border-transparent text-foreground",
      "hover:not-data-disabled:bg-muted",
    ],
    outline: [
      "border-surface-border text-foreground",
      "hover:not-data-disabled:border-gray-300",
      "[--btn-icon:var(--color-muted-foreground)] hover:[--btn-icon:var(--color-muted-foreground)]",
    ],
    "danger-outline": [
      "hover:text-danger/90 border-surface-border bg-surface-elevated text-danger",
      "hover:not-data-disabled:border-gray-300",
      "[--btn-icon:var(--color-danger)] hover:[--btn-icon:var(--color-danger)]",
    ],
    icon: [
      "border-transparent",
      "text-muted-foreground hover:not-data-disabled:text-foreground focus-visible:not-data-disabled:text-foreground active:not-data-disabled:text-foreground",
      "hover:not-data-disabled:bg-muted hover:not-data-disabled:shadow-xs focus:outline-hidden focus-visible:not-data-disabled:shadow-xs active:not-data-disabled:bg-surface-elevated active:not-data-disabled:shadow-xs! disabled:opacity-50 disabled:hover:bg-transparent data-[state=focus]:not-data-disabled:bg-surface-elevated! data-[state=focus]:not-data-disabled:shadow-xs! data-[state=open]:not-data-disabled:bg-surface-elevated data-[state=open]:not-data-disabled:shadow-xs",
    ],
    "icon-outline": [
      "border-surface-border bg-surface-elevated text-foreground",
      "hover:not-data-disabled:border-gray-300",
      "[--btn-icon:var(--color-muted-foreground)] hover:[--btn-icon:var(--color-muted-foreground)]",
    ],
  } satisfies Record<Variant, string[]>,
  sizes: {
    small: "min-h-7 px-4",
    default: "min-h-8 px-4",
    large: "min-h-10 px-5 sm:px-8",
  } satisfies Record<Size, string>,
  iconSizes: {
    small: "size-5 rounded-sm p-0 *:size-4 [&_svg]:size-4",
    medium: "size-6 rounded-md p-0 *:size-4 [&_svg]:size-4",
    default: "size-8 rounded-md p-0 *:size-5 [&_svg]:size-5",
  } satisfies Record<IconSize, string>,
};

const ICON_VARIANTS: ReadonlySet<Variant> = new Set(["icon", "icon-outline"]);
const NON_SOLID_VARIANTS: ReadonlySet<Variant> = new Set([
  "ghost",
  "outline",
  "danger-outline",
  "icon",
  "icon-outline",
]);

type ClassValue = string | false | null | undefined | ClassValue[];

function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue) => {
    if (!v) return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    out.push(v);
  };
  inputs.forEach(walk);
  return out.join(" ");
}

function pickSizeClasses(variant: Variant, size: Size | IconSize): string {
  if (ICON_VARIANTS.has(variant)) {
    const key =
      (size as IconSize) in styles.iconSizes ? (size as IconSize) : "default";
    return styles.iconSizes[key];
  }
  const key = (size as Size) in styles.sizes ? (size as Size) : "default";
  return styles.sizes[key];
}

/**
 * Real-world layered button with 13 variants. The "solid" variants render their
 * border as the outer background and place the actual fill on a `before:` layer
 * inset by 1px, with an `after:` layer for the inner highlight + hover overlay.
 * Local `--btn-bg` / `--btn-border` / `--btn-hover-overlay` / `--btn-icon` vars
 * are set per-variant and read by the layered classes.
 */
export function Button({
  variant = "white",
  size = "default",
  loading = false,
  disabled,
  className,
  onClick,
  children,
  as,
  href,
  ...rest
}: Props) {
  const v: Variant = variant in styles.variants ? variant : "white";
  const isDisabled = disabled ?? loading;
  const isIconVariant = ICON_VARIANTS.has(v);

  const classes = cn(
    styles.base,
    !NON_SOLID_VARIANTS.has(v) && styles.solid,
    styles.variants[v],
    pickSizeClasses(v, size),
    className,
  );

  const renderAsAnchor = as === "a" || (as !== "button" && href !== undefined);

  if (renderAsAnchor) {
    const anchorProps = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a
        {...anchorProps}
        href={href}
        onClick={isDisabled ? (e) => e.preventDefault() : onClick}
        data-disabled={isDisabled || undefined}
        aria-disabled={isDisabled || undefined}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-x-1.5",
          !isIconVariant &&
            "[&>svg:nth-child(1)]:-ml-1.5 [&>svg:nth-child(2)]:-mr-1.5",
          classes,
        )}
      >
        <TouchTarget>{children}</TouchTarget>
      </a>
    );
  }

  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      type={buttonProps.type ?? "button"}
      {...buttonProps}
      onClick={isDisabled ? (e) => e.preventDefault() : onClick}
      disabled={isDisabled || undefined}
      data-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      className={cn("relative shrink-0 cursor-default", classes)}
    >
      <TouchTarget>
        <span
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center justify-center opacity-0",
            loading && "opacity-100",
          )}
          aria-hidden
        >
          <LoadingSpinner />
        </span>
        <span
          className={cn(
            "inline-flex min-w-0 items-center justify-center gap-x-1.5",
            !isIconVariant &&
              "[&>svg:nth-child(1)]:-ml-1.5 [&>svg:nth-child(2)]:-mr-1.5",
            loading && "opacity-0",
          )}
        >
          {children}
        </span>
      </TouchTarget>
    </button>
  );
}

function LoadingSpinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

/** Expand the hit area to at least 44x44px on touch devices. */
export function TouchTarget({ children }: { children?: ReactNode }) {
  return (
    <>
      {children}
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 size-[max(100%,2.75rem)] -translate-1/2 pointer-fine:hidden"
      />
    </>
  );
}
