import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Wrap a route handler with consistent error handling. */
export function handle(
  fn: () => Promise<NextResponse>
): Promise<NextResponse> {
  return fn().catch((e) => {
    if (e instanceof AuthError) return fail(e.message, e.status);
    console.error("API error:", e);
    return fail(e?.message || "Internal Server Error", 500);
  });
}
