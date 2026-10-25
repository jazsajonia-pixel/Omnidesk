const REQUIRED_SERVER_ENVIRONMENT = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "APP_ORIGIN",
] as const;

/** Return missing required server variable names only; never return their values. */
export function missingRequiredServerEnvironment(env: NodeJS.ProcessEnv = process.env): string[] {
  return REQUIRED_SERVER_ENVIRONMENT.filter((key) => !env[key]?.trim());
}
