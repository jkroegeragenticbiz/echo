import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { IngestError, LlmRefusalError } from "@echo/core/server";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

/** Maps known errors to JSON responses with messages safe to show users. */
export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return json({ error: err.message, code: err.code }, err.status);
  if (err instanceof ZodError) {
    return json({ error: "Invalid request", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, 400);
  }
  if (err instanceof IngestError) return json({ error: err.userMessage, code: "ingest_failed" }, 422);
  if (err instanceof LlmRefusalError) return json({ error: "We can't rewrite this post.", code: "refused" }, 422);
  console.error(err);
  return json({ error: "Something went wrong. Please try again." }, 500);
}

/** Wraps a route handler so thrown errors become JSON responses. */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
