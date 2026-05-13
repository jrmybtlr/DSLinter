/** Shape expected by `TokenWall` — your app mirrors Tailwind / tokens into this object. */

export type TokenCatalogColor = {
  token: string;
  shade: string;
  value: string;
  tw: string;
};

export type TokenCatalogSpacing = {
  token: string;
  value: string;
  tw: string;
};

export type TokenCatalogRadius = {
  token: string;
  value: string;
  tw: string;
};

export type TokenCatalogFontFamily = {
  /** Theme key / utility suffix, e.g. `sans` → `font-sans`. */
  key: string;
  /** Full CSS font-family stack for documentation. */
  value: string;
  tw: string;
};

export type TokenCatalogFontSize = {
  token: string;
  value: string;
  tw: string;
};

export type TokenCatalogFontWeight = {
  token: string;
  tw: string;
  /** Numeric weight for display, e.g. `600`. */
  value?: string;
};

export type TokenCatalogTypography = {
  families: readonly TokenCatalogFontFamily[];
  sizes: readonly TokenCatalogFontSize[];
  weights?: readonly TokenCatalogFontWeight[];
};

export type TokenCatalog = {
  colors: readonly TokenCatalogColor[];
  spacing: readonly TokenCatalogSpacing[];
  radius: readonly TokenCatalogRadius[];
  typography?: TokenCatalogTypography;
};
