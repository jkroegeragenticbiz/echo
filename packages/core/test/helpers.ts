import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LookupFn } from "../src/server/ingest/safe-fetch";

const here = path.dirname(fileURLToPath(import.meta.url));

export function fixture(name: string): string {
  return readFileSync(path.join(here, "fixtures", name), "utf8");
}

export function llmFixture(name: string): unknown {
  return JSON.parse(fixture(`llm/${name}.json`));
}

/** Every hostname resolves to a public address unless listed. */
export function fakeLookup(overrides: Record<string, string> = {}): LookupFn {
  return async (host) => [{ address: overrides[host] ?? "93.184.216.34" }];
}

type Route = { status?: number; body: string; contentType?: string; headers?: Record<string, string> };

/**
 * fetch() replacement that serves recorded fixtures by URL prefix and records
 * each request. Unknown URLs fail the test loudly instead of hitting the network.
 */
export function fakeFetch(routes: Record<string, Route>) {
  const requests: { url: string; init?: RequestInit }[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    requests.push({ url, init });
    const key = Object.keys(routes)
      .filter((prefix) => url.startsWith(prefix))
      .sort((a, b) => b.length - a.length)[0];
    if (!key) throw new Error(`Unexpected fetch in test: ${url}`);
    const route = routes[key]!;
    return new Response(route.body, {
      status: route.status ?? 200,
      headers: { "content-type": route.contentType ?? "text/html; charset=utf-8", ...route.headers },
    });
  }) as typeof fetch;
  return { fetch: impl, requests };
}
