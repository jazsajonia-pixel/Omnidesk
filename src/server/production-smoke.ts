import { pathToFileURL } from "node:url";

type ReadyHealthPayload = {
  status: "ok";
  service: "omnidesk-api";
  database: true;
};

export type ProductionHealthResult = {
  url: string;
  status: number;
};

function isReadyHealthPayload(value: unknown): value is ReadyHealthPayload {
  if (typeof value !== "object" || value === null) return false;
  return "status" in value
    && value.status === "ok"
    && "service" in value
    && value.service === "omnidesk-api"
    && "database" in value
    && value.database === true;
}

/**
 * Check the deployed API without credentials or mutations. A 200 alone is not
 * enough: the endpoint must explicitly confirm that the database is ready.
 */
export async function verifyProductionHealth(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<ProductionHealthResult> {
  let origin: URL;
  try {
    origin = new URL(baseUrl);
  } catch {
    throw new Error("OMNIDESK_BASE_URL must be a valid HTTPS origin.");
  }

  if (
    origin.protocol !== "https:"
    || origin.username
    || origin.password
    || origin.pathname !== "/"
    || origin.search
    || origin.hash
  ) {
    throw new Error("OMNIDESK_BASE_URL must be an HTTPS origin without credentials, path, query, or fragment.");
  }

  const healthUrl = new URL("/api/health", origin);
  let response: Response;
  try {
    response = await fetcher(healthUrl, {
      method: "GET",
      headers: { accept: "application/json", "cache-control": "no-cache" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("Production health request failed to connect or timed out.");
  }

  if (!response.ok) {
    throw new Error(`Production health check failed with HTTP ${response.status}.`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Production health endpoint returned invalid JSON.");
  }

  if (!isReadyHealthPayload(payload)) {
    throw new Error("Production health endpoint did not confirm API and database readiness.");
  }

  return { url: healthUrl.toString(), status: response.status };
}

async function main(): Promise<void> {
  const baseUrl = process.env.OMNIDESK_BASE_URL?.trim();
  if (!baseUrl) {
    console.error("Set OMNIDESK_BASE_URL to the production HTTPS origin.");
    process.exitCode = 2;
    return;
  }

  try {
    const result = await verifyProductionHealth(baseUrl);
    console.log(`PASS: ${result.url} returned HTTP ${result.status}; API and database are ready.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Production health check failed.");
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
