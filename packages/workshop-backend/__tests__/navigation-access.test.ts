import { describe, expect, it } from "vitest";
import { handleNavigationAccess } from "../src/navigation-access";

const native = { sub: "os-person", email: "staff@greenhatsec.com" };
const request = (cookie = "", method = "GET") => new Request("https://os.greenhatsec.com/api/me/module-access", {
  method, headers: { cookie },
});
const centralCookie = "__Secure-greenhat_tools.session_token=opaque";
const centralResponse = (email: string) => new Response(JSON.stringify({
  restricted: true, modules: ["sign"], user: { id: "central-person", email },
}), { headers: { "content-type": "application/json" } });

describe("navigation grants", () => {
  it("requires a verified native Access identity and only accepts reads", async () => {
    expect((await handleNavigationAccess(request(), {}, async () => null)).status).toBe(401);
    expect((await handleNavigationAccess(request("", "POST"), {}, async () => native)).status).toBe(405);
  });
  it("keeps an Access-only user limited to OS", async () => {
    const response = await handleNavigationAccess(request(), {}, async () => native);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      restricted: true, modules: [], nativeModules: ["os"], user: { id: native.sub, email: native.email },
    });
  });
  it("uses central grants only for the same person", async () => {
    const same = await handleNavigationAccess(request(centralCookie), {}, async () => native,
      async () => centralResponse(native.email));
    expect(await same.json()).toMatchObject({ modules: ["sign"], nativeModules: ["os"] });
    const other = await handleNavigationAccess(request(centralCookie), {}, async () => native,
      async () => centralResponse("other@greenhatsec.com"));
    expect(await other.json()).toMatchObject({ restricted: true, modules: [], nativeModules: ["os"] });
  });
  it("retains only native OS access when central verification fails", async () => {
    const response = await handleNavigationAccess(request(centralCookie), {}, async () => native,
      async () => new Response(null, { status: 503 }));
    expect(await response.json()).toMatchObject({ restricted: true, modules: [], nativeModules: ["os"] });
  });
});
