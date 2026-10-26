import { describe, expect, it } from "vitest";
import { verifyProductionHealth } from "./production-smoke";

const readyPayload = {
  status: "ok",
  service: "omnidesk-api",
  database: true,
};

describe("production health smoke check", () => {
  it("requests the API health endpoint and requires database readiness", async () => {
    let requestedUrl = "";
    let requestedMethod = "";

    const fetcher: typeof fetch = async (input, init) => {
      requestedUrl = input instanceof URL ? input.toString() : String(input);
      requestedMethod = init?.method ?? "GET";
      return new Response(JSON.stringify(readyPayload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await verifyProductionHealth("https://omnidesk.example", fetcher);

    expect(requestedUrl).toBe("https://omnidesk.example/api/health");
    expect(requestedMethod).toBe("GET");
    expect(result).toEqual({
      url: "https://omnidesk.example/api/health",
      status: 200,
    });
  });

  it("rejects non-HTTPS or non-origin base URLs before making a request", async () => {
    const fetcher: typeof fetch = async () => {
      throw new Error("fetch should not be called");
    };

    await expect(verifyProductionHealth("http://omnidesk.example", fetcher))
      .rejects.toThrow("must be an HTTPS origin");
    await expect(verifyProductionHealth("https://omnidesk.example/path", fetcher))
      .rejects.toThrow("without credentials, path, query, or fragment");
    await expect(verifyProductionHealth("https://user:pass@omnidesk.example", fetcher))
      .rejects.toThrow("without credentials, path, query, or fragment");
  });

  it("fails when the endpoint returns a non-success status", async () => {
    const fetcher: typeof fetch = async () => new Response("unavailable", { status: 503 });

    await expect(verifyProductionHealth("https://omnidesk.example", fetcher))
      .rejects.toThrow("HTTP 503");
  });

  it("fails when HTTP 200 does not confirm API and database readiness", async () => {
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({
      status: "not_ready",
      service: "omnidesk-api",
      database: false,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    await expect(verifyProductionHealth("https://omnidesk.example", fetcher))
      .rejects.toThrow("did not confirm API and database readiness");
  });

  it("does not leak low-level network errors", async () => {
    const fetcher: typeof fetch = async () => {
      throw new Error("private connection details");
    };

    await expect(verifyProductionHealth("https://omnidesk.example", fetcher))
      .rejects.toThrow("failed to connect or timed out");
    await expect(verifyProductionHealth("https://omnidesk.example", fetcher))
      .rejects.not.toThrow("private connection details");
  });

  it("rejects malformed JSON", async () => {
    const fetcher: typeof fetch = async () => new Response("not-json", {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    await expect(verifyProductionHealth("https://omnidesk.example", fetcher))
      .rejects.toThrow("returned invalid JSON");
  });
});
