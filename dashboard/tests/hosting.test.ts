import { describe, expect, it } from "vitest";
import { authorize, assertAuthorized, liveCommit, UnauthorizedError } from "@/lib/hosting";

const basic = (user: string, pass: string) => "Basic " + Buffer.from(`${user}:${pass}`, "utf8").toString("base64");
const on = { DASHBOARD_REQUIRE_PASSWORD: "1", DASHBOARD_PASSWORD: "fixture-only-pass:word" };

describe("authorize", () => {
  it("is open when the password is not required", () => {
    expect(authorize(null, {})).toBe("open");
    expect(authorize(basic("x", "anything"), { DASHBOARD_PASSWORD: "fixture-only-pass:word" })).toBe("open");
  });
  it("accepts the password with any user name, including none", () => {
    expect(authorize(basic("judge", "fixture-only-pass:word"), on)).toBe("ok");
    expect(authorize(basic("", "fixture-only-pass:word"), on)).toBe("ok");
  });
  it("denies a missing, wrong, truncated or longer password", () => {
    for (const h of [null, "", basic("judge", "wrong"), basic("judge", "fixture-only-pass"),
      basic("judge", "fixture-only-pass:word!")]) expect(authorize(h, on)).toBe("denied");
  });
  it("denies headers that are not Basic or not base64, without throwing", () => {
    for (const h of ["Bearer abc", "Basic", "Basic ###", "Basic " + Buffer.from("no-colon").toString("base64")])
      expect(authorize(h, on)).toBe("denied");
  });
  it("fails closed when required but no password is set", () => {
    expect(authorize(basic("judge", ""), { DASHBOARD_REQUIRE_PASSWORD: "1" })).toBe("denied");
    expect(authorize(basic("judge", ""), { DASHBOARD_REQUIRE_PASSWORD: "1", DASHBOARD_PASSWORD: "" })).toBe("denied");
  });
});

describe("assertAuthorized", () => {
  it("throws UnauthorizedError only when denied", () => {
    expect(() => assertAuthorized(null, {})).not.toThrow();
    expect(() => assertAuthorized(basic("j", "fixture-only-pass:word"), on)).not.toThrow();
    expect(() => assertAuthorized(null, on)).toThrow(UnauthorizedError);
  });
});

describe("liveCommit", () => {
  it("is the trimmed commit, or null when not hosted", () => {
    expect(liveCommit({ DASHBOARD_COMMIT: " abc1234 " })).toBe("abc1234");
    expect(liveCommit({ DASHBOARD_COMMIT: "" })).toBeNull();
    expect(liveCommit({})).toBeNull();
  });
});
