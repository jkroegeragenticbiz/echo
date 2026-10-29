import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export class IngestError extends Error {
  constructor(
    message: string,
    /** Safe to show to the user. */
    readonly userMessage: string = message,
  ) {
    super(message);
    this.name = "IngestError";
  }
}

export type LookupFn = (hostname: string) => Promise<{ address: string }[]>;

const defaultLookup: LookupFn = (hostname) => dnsLookup(hostname, { all: true });

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIP(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIPv4(ip);
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  if (v6.startsWith("::ffff:")) return isPrivateIPv4(v6.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6);
}

/** Rejects URLs that would let a user make our server call internal addresses (SSRF). */
export async function assertPublicUrl(raw: string, lookup: LookupFn = defaultLookup): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new IngestError(`Invalid URL: ${raw}`, "That link doesn't look valid.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new IngestError(`Unsupported protocol ${url.protocol}`, "Only web links can be saved.");
  }
  if (url.username || url.password) throw new IngestError("Credentials in URL", "That link can't be saved.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new IngestError(`Blocked host ${host}`, "That link can't be saved.");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host).catch(() => []);
  if (addresses.length === 0) throw new IngestError(`DNS lookup failed for ${host}`, "We couldn't reach that link.");
  if (addresses.some((a) => isPrivateIP(a.address))) {
    throw new IngestError(`Blocked private address for ${host}`, "That link can't be saved.");
  }
  return url;
}

export const USER_AGENT = "Mozilla/5.0 (compatible; EchoBot/1.0; +https://getecho.ai/bot)";
const MAX_BYTES = 3 * 1024 * 1024;

export interface SafeFetchOptions {
  fetch?: typeof fetch;
  lookup?: LookupFn;
  timeoutMs?: number;
  accept?: string;
  maxBytes?: number;
}

/**
 * GET with SSRF checks on every redirect hop, a timeout and a size cap.
 * Public pages only: we never send cookies or log in on the user's behalf.
 */
export async function safeFetch(
  raw: string,
  opts: SafeFetchOptions = {},
): Promise<{ url: string; status: number; contentType: string; body: Uint8Array }> {
  const fetchImpl = opts.fetch ?? fetch;
  let current = raw;
  for (let hop = 0; hop < 5; hop++) {
    const url = await assertPublicUrl(current, opts.lookup);
    const res = await fetchImpl(url, {
      redirect: "manual",
      headers: { "user-agent": USER_AGENT, accept: opts.accept ?? "text/html,application/xhtml+xml,*/*;q=0.8" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, url).toString();
      continue;
    }
    const body = await readCapped(res, opts.maxBytes ?? MAX_BYTES);
    return { url: url.toString(), status: res.status, contentType: res.headers.get("content-type") ?? "", body };
  }
  throw new IngestError("Too many redirects", "That link redirects too many times.");
}

async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(await res.arrayBuffer()).slice(0, maxBytes);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const out = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, Math.min(chunk.byteLength, out.byteLength - offset));
    out.set(slice, offset);
    offset += slice.byteLength;
    if (offset >= out.byteLength) break;
  }
  return out;
}
