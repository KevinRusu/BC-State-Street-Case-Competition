// The first of the two password checks (the second is in lib/data.ts's load(), before any store read). No matcher on
// purpose: it runs on every path, /_next/*, /robots.txt and public/ files included. Locally (no
// DASHBOARD_REQUIRE_PASSWORD) authorize() answers "open" and every request passes untouched.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_CHALLENGE, NO_INDEX, authorize } from "@/lib/hosting";

export function proxy(request: NextRequest): NextResponse {
  const result = authorize(request.headers.get("authorization"));
  if (result === "denied") {
    return new NextResponse("Password required", { status: 401, headers: { "WWW-Authenticate": AUTH_CHALLENGE } });
  }
  const response = NextResponse.next();
  if (result === "ok") response.headers.set("X-Robots-Tag", NO_INDEX);
  return response;
}
