/** Stub for ziggy-js in dslinter previews. */
export default function route(
  _name?: string,
  _params?: Record<string, unknown>,
  _absolute?: boolean,
): string {
  return "#";
}

export function routeFn(...args: Parameters<typeof route>): string {
  return route(...args);
}
