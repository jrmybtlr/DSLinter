/** Read `DSLINTER_*` environment variables. */
export function readEnv(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env[`DSLINTER_${name}`]?.trim() || undefined;
}

export function envIs(
  name: string,
  value = "1",
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return readEnv(name, env) === value;
}
