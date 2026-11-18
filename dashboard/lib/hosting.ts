// The shared-password check and version line for the hosted dashboard. Plain Node: no Next.js imports, so the tests
// can call it directly. proxy.ts and lib/data.ts call it. Env is read at call time, never at module load.
import { createHash, timingSafeEqual } from "node:crypto";

export type HostingEnv = {
  DASHBOARD_REQUIRE_PASSWORD?: string; DASHBOARD_PASSWORD?: string; DASHBOARD_COMMIT?: string;
};

export const AUTH_CHALLENGE = 'Basic realm="Dashboard", charset="UTF-8"';
export const NO_INDEX = "noindex, nofollow";

export class UnauthorizedError extends Error {
  constructor() {
    super("Password required");
    this.name = "UnauthorizedError";
  }
}

const BASIC = /^Basic ([A-Za-z0-9+/]+={0,2})$/i;
const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

/** The password from a Basic Authorization header (the user name is ignored), or null when the header is not one. */
function basicPassword(header: string | null): string | null {
  const match = header ? BASIC.exec(header) : null;
  if (!match) return null;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const colon = decoded.indexOf(":"); // the first colon: the password itself may contain colons
  return colon < 0 ? null : decoded.slice(colon + 1);
}

// The defaults below cast process.env: its type shares no declared key with HostingEnv, which TypeScript's weak-type
// check rejects. Being default parameters, they read process.env afresh on every call.

/** "open" when no password is required (local use), "ok" for the right password, else "denied". Fails closed: a
 * required password that is unset or empty denies every request. */
export function authorize(
  header: string | null, env: HostingEnv = process.env as HostingEnv,
): "open" | "ok" | "denied" {
  if (env.DASHBOARD_REQUIRE_PASSWORD !== "1") return "open";
  const expected = env.DASHBOARD_PASSWORD;
  if (!expected) return "denied";
  const given = basicPassword(header);
  if (given === null) return "denied";
  // Equal-length digests, so the compare takes the same time whatever the password's length or content.
  return timingSafeEqual(digest(given), digest(expected)) ? "ok" : "denied";
}

/** Throws UnauthorizedError when authorize() denies the request. */
export function assertAuthorized(header: string | null, env: HostingEnv = process.env as HostingEnv): void {
  if (authorize(header, env) === "denied") throw new UnauthorizedError();
}

/** The commit the hosted build was made from (trimmed DASHBOARD_COMMIT), or null when not hosted. */
export function liveCommit(env: HostingEnv = process.env as HostingEnv): string | null {
  return env.DASHBOARD_COMMIT?.trim() || null;
}
