const REQUIRED_SERVER_ENVIRONMENT = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "APP_ORIGIN",
] as const;

const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

function isHttpOrigin(value: string, requireHttps: boolean): boolean {
  try {
    const url = new URL(value);
    return HTTP_PROTOCOLS.has(url.protocol)
      && Boolean(url.hostname)
      && !url.username
      && !url.password
      && url.pathname === "/"
      && !url.search
      && !url.hash
      && (!requireHttps || url.protocol === "https:");
  } catch {
    return false;
  }
}

/** Return configuration issue names only; never expose values or secrets. */
export function serverEnvironmentIssues(
  env: NodeJS.ProcessEnv = process.env,
  production = env.NODE_ENV === "production",
): string[] {
  const issues = new Set<string>(
    REQUIRED_SERVER_ENVIRONMENT.filter((key) => !env[key]?.trim()),
  );

  const databaseUrl = env.DATABASE_URL?.trim();
  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
        issues.add("DATABASE_URL");
      }
    } catch {
      issues.add("DATABASE_URL");
    }
  }

  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (secret && secret.length < 32) issues.add("BETTER_AUTH_SECRET");

  const authUrl = env.BETTER_AUTH_URL?.trim();
  if (authUrl && !isHttpOrigin(authUrl, production)) issues.add("BETTER_AUTH_URL");

  const appOrigin = env.APP_ORIGIN?.trim();
  if (appOrigin) {
    const origins = appOrigin.split(",").map((origin) => origin.trim());
    if (origins.some((origin) => !origin || !isHttpOrigin(origin, production))) {
      issues.add("APP_ORIGIN");
    }
  }

  return [...issues];
}
