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

export type TokenCatalog = {
  colors: readonly TokenCatalogColor[];
  spacing: readonly TokenCatalogSpacing[];
  radius: readonly TokenCatalogRadius[];
};
