/** Eager modules from the scanned repo (`@dslint-scan` alias → DSLINT_SCAN_ROOT). */
export const scanPlaygroundModules = import.meta.glob(
  "@dslint-scan/**/*.{tsx,jsx}",
  { eager: true },
) as Record<string, Record<string, unknown>>;
