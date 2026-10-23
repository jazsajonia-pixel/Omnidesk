/** Browser origins allowed to call the API with cookies. */
export function trustedOrigins(): string[] {
  const origins = new Set<string>();
  const add = (value: string | undefined) => {
    if (!value) return;
    for (const part of value.split(",")) {
      const trimmed = part.trim().replace(/\/$/, "");
      if (trimmed) origins.add(trimmed);
    }
  };
  add(process.env.APP_ORIGIN ?? "http://localhost:5173");
  add(process.env.BETTER_AUTH_URL);
  if (process.env.VERCEL_URL) add("https://" + process.env.VERCEL_URL);
  if (process.env.VERCEL_BRANCH_URL) add("https://" + process.env.VERCEL_BRANCH_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) add("https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL);
  return [...origins];
}
