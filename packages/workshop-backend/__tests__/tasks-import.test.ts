import { beforeAll, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { handleTaskImportRequest, TASK_IMPORT_PATH } from "../src/tasks-import.js";
import type { UserDurableObject } from "../src/user.js";

declare module "cloudflare:workers" {
  interface ProvidedEnv {
    TEST_USER: DurableObjectNamespace<UserDurableObject>;
  }
}

const TOKEN = "import-secret";
const users = env.TEST_USER;
let nextUser = 0;

async function signUp(): Promise<string> {
  let email = `import${nextUser++}@example.com`;
  await users.get(users.idFromName(email)).authenticateFromCfAccess(email, true);
  return email;
}

function request(body: unknown, init: { headers?: Record<string, string>; method?: string } = {}) {
  return new Request(`https://os.example${TASK_IMPORT_PATH}`, {
    method: init.method ?? "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
      ...init.headers,
    },
    body: init.method === "GET" ? null : typeof body === "string" ? body : JSON.stringify(body),
  });
}

const plainEnv = { TASKS_IMPORT_TOKEN: TOKEN };
const accessEnv = {
  TASKS_IMPORT_TOKEN: TOKEN,
  CF_ACCESS_AUD: "aud",
  CF_ACCESS_ISS: "https://team.cloudflareaccess.com",
};

describe("handleTaskImportRequest", () => {
  // The first user object to wake pays for loading the whole Workshop module graph into the pool,
  // which on a contended runner is longer than a test's default budget; pay it once, up front.
  beforeAll(async () => { await signUp(); }, 60_000);

  it("is off until the secret is set", async () => {
    let response = await handleTaskImportRequest(request({}), {}, users);
    expect(response.status).toBe(503);
    expect((await response.json() as { error: string }).error).toMatch(/TASKS_IMPORT_TOKEN/);
  });

  it("insists on POST and the bearer", async () => {
    expect((await handleTaskImportRequest(request({}, { method: "GET" }), plainEnv, users)).status).toBe(405);
    expect((await handleTaskImportRequest(request({}, { headers: { authorization: "Bearer nope" } }),
        plainEnv, users)).status).toBe(401);
    expect((await handleTaskImportRequest(request({}, { headers: { authorization: "" } }),
        plainEnv, users)).status).toBe(401);
  });

  it("requires a Cloudflare Access assertion when the deployment runs behind Access", async () => {
    let denied = vi.fn(async () => null);
    let response = await handleTaskImportRequest(request({ source: "crm", tasks: [] }), accessEnv, users, denied);
    expect(response.status).toBe(403);
    expect(denied).toHaveBeenCalledTimes(1);

    // A service token's assertion has a common_name and no email; that is enough here.
    let serviceToken = vi.fn(async () => ({ common_name: "nightly-crm-sync" }));
    let email = await signUp();
    let ok = await handleTaskImportRequest(request({ source: "crm", assignee: email, tasks: [] }),
        accessEnv, users, serviceToken);
    expect(ok.status).toBe(200);
  });

  it("validates the body and names the offending field", async () => {
    let email = await signUp();
    let notJson = await handleTaskImportRequest(request("{oops", { headers: {} }), plainEnv, users);
    expect(notJson.status).toBe(400);

    let wrongType = await handleTaskImportRequest(
        request({}, { headers: { "content-type": "text/plain" } }), plainEnv, users);
    expect(wrongType.status).toBe(415);

    let badDate = await handleTaskImportRequest(request({
      source: "crm", assignee: email, tasks: [{ externalId: "1", title: "x", dueDate: "tomorrow" }],
    }), plainEnv, users);
    expect(badDate.status).toBe(400);
    expect(await badDate.json()).toMatchObject({
      issues: [{ path: "tasks.0.dueDate", message: "expected YYYY-MM-DD" }],
    });

    let noAssignee = await handleTaskImportRequest(request({
      source: "crm", tasks: [{ externalId: "1", title: "x" }],
    }), plainEnv, users);
    expect(noAssignee.status).toBe(400);
    expect(await noAssignee.json()).toMatchObject({ issues: [{ path: "tasks.0.assignee" }] });

    let reserved = await handleTaskImportRequest(request({
      source: "os", assignee: email, tasks: [],
    }), plainEnv, users);
    expect(reserved.status).toBe(400);
    expect((await reserved.json() as { error: string }).error).toMatch(/OS's own source id/);

    // A rule the schema cannot express is still a 400, with the user object's message.
    let phantomDate = await handleTaskImportRequest(request({
      source: "crm", assignee: email, tasks: [{ externalId: "1", title: "x", dueDate: "2026-02-30" }],
    }), plainEnv, users);
    expect(phantomDate.status).toBe(400);
    expect((await phantomDate.json() as { error: string }).error).toMatch(/not a calendar date/);
  });

  it("bounds the body", async () => {
    let huge = request({ source: "crm", tasks: [], padding: "x".repeat(513 * 1024) });
    expect((await handleTaskImportRequest(huge, plainEnv, users)).status).toBe(413);
  });

  it("routes tasks to their assignees, reporting unknown addresses instead of creating them", async () => {
    let alice = await signUp();
    let bob = await signUp();
    let response = await handleTaskImportRequest(request({
      source: "crm",
      sourceLabel: "Green Hat CRM",
      assignee: alice.toUpperCase(),
      tasks: [
        { externalId: "1", title: "Alice's task", dueDate: "2026-09-18", priority: "high", tag: "Sales" },
        { externalId: "2", title: "Bob's task", assignee: bob },
        { externalId: "3", title: "Nobody's task", assignee: "nobody@example.com" },
      ],
    }), plainEnv, users);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      source: "crm",
      users: [
        { assignee: alice, created: 1, updated: 0, removed: 0, kept: 0 },
        { assignee: bob, created: 1, updated: 0, removed: 0, kept: 0 },
      ],
      skipped: [{ assignee: "nobody@example.com", reason: "no account on this deployment" }],
    });

    let alicesTasks = await users.get(users.idFromName(alice)).listTasks();
    expect(alicesTasks).toHaveLength(1);
    expect(alicesTasks[0]).toMatchObject({
      id: "crm:1", title: "Alice's task", source: "crm", sourceLabel: "Green Hat CRM", priority: "high",
    });
    expect(await users.get(users.idFromName(bob)).listTasks()).toHaveLength(1);
    expect(await users.get(users.idFromName("nobody@example.com")).whoamiIfExists()).toBeNull();
  });

  it("replaces by default and merges when asked", async () => {
    let email = await signUp();
    let user = users.get(users.idFromName(email));
    let first = await handleTaskImportRequest(request({
      source: "crm", assignee: email,
      tasks: [{ externalId: "1", title: "one" }, { externalId: "2", title: "two" }],
    }), plainEnv, users);
    expect(first.status).toBe(200);

    let merged = await handleTaskImportRequest(request({
      source: "crm", assignee: email, replace: false,
      tasks: [{ externalId: "3", title: "three" }],
    }), plainEnv, users);
    expect(await merged.json()).toMatchObject({
      users: [{ assignee: email, created: 1, updated: 0, removed: 0 }],
    });
    expect((await user.listTasks()).map(t => t.id).toSorted()).toEqual(["crm:1", "crm:2", "crm:3"]);

    let replaced = await handleTaskImportRequest(request({
      source: "crm", assignee: email,
      tasks: [{ externalId: "3", title: "three" }],
    }), plainEnv, users);
    expect(await replaced.json()).toMatchObject({
      users: [{ assignee: email, created: 0, updated: 0, removed: 2 }],
    });
    expect((await user.listTasks()).map(t => t.id)).toEqual(["crm:3"]);

    // A replacing sync with nothing in it clears the source's entries for the default assignee.
    let cleared = await handleTaskImportRequest(request({ source: "crm", assignee: email, tasks: [] }),
        plainEnv, users);
    expect(await cleared.json()).toMatchObject({ users: [{ assignee: email, removed: 1 }] });
    expect(await user.listTasks()).toEqual([]);
  });
});
