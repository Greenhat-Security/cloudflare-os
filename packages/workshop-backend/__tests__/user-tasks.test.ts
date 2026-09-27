import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { MAX_TASKS_PER_USER } from "@gadgets/workshop-shared/api";
import type { UserDurableObject } from "../src/user.js";
import type { TaskRecord } from "../src/tasks.js";

declare module "cloudflare:workers" {
  interface ProvidedEnv {
    TEST_USER: DurableObjectNamespace<UserDurableObject>;
  }
}

let nextUser = 0;

/** A fresh, signed-up user per test, so nothing leaks between them. */
async function makeUser() {
  let email = `user${nextUser++}@example.com`;
  let stub = env.TEST_USER.get(env.TEST_USER.idFromName(email));
  await stub.authenticateFromCfAccess(email, true);
  return stub;
}

async function expectRejection(call: PromiseLike<unknown>, pattern: RegExp): Promise<void> {
  let caught: unknown;
  try {
    await call;
  } catch (error) {
    caught = error;
  }
  expect(String(caught)).toMatch(pattern);
}

describe("UserDurableObject tasks", () => {
  // The first user object to wake pays for loading the whole Workshop module graph into the pool,
  // which on a contended runner is longer than a test's default budget; pay it once, up front.
  beforeAll(async () => { await makeUser(); }, 60_000);

  it("creates, lists, edits and deletes the user's own tasks", async () => {
    let user = await makeUser();
    expect(await user.listTasks()).toEqual([]);

    let task = await user.createTask({
      title: "  Review SOC 2 evidence for HR-5 ", dueDate: "2026-09-17", priority: "high", tag: "Audit",
    });
    expect(task).toMatchObject({
      title: "Review SOC 2 evidence for HR-5", status: "open", dueDate: "2026-09-17",
      priority: "high", tag: "Audit", source: "os", sourceLabel: null, url: null, completedAt: null,
    });
    expect(task.createdAt).toBeInstanceOf(Date);

    let done = await user.updateTask(task.id, { status: "done" });
    expect(done.status).toBe("done");
    expect(done.completedAt).toBeInstanceOf(Date);
    expect((await user.listTasks()).map(t => t.id)).toEqual([task.id]);

    await user.deleteTask(task.id);
    await user.deleteTask(task.id);  // idempotent
    expect(await user.listTasks()).toEqual([]);
    await expectRejection(user.updateTask(task.id, { title: "gone" }), /No such task/);
  });

  it("refuses input the rules reject and keeps nothing from it", async () => {
    let user = await makeUser();
    await expectRejection(user.createTask({ title: " " }), /needs a title/);
    await expectRejection(user.createTask({ title: "x", dueDate: "2026-13-01" }), /not a calendar date/);
    expect(await user.listTasks()).toEqual([]);
  });

  it("clears completed tasks and reports how many went", async () => {
    let user = await makeUser();
    let a = await user.createTask({ title: "a" });
    let b = await user.createTask({ title: "b" });
    await user.createTask({ title: "c" });
    await user.updateTask(a.id, { status: "done" });
    await user.updateTask(b.id, { status: "done" });
    expect(await user.clearCompletedTasks()).toBe(2);
    expect((await user.listTasks()).map(t => t.title)).toEqual(["c"]);
  });

  it("prunes tasks completed more than the retention period ago when listing", async () => {
    let user = await makeUser();
    let recent = await user.createTask({ title: "recent" });
    await user.updateTask(recent.id, { status: "done" });
    await runInDurableObject(user, (instance: UserDurableObject) => {
      // Reach past the public API to age a record; nothing public can write a past completion.
      let storage = (instance as unknown as { storage: { tasks: { put(r: TaskRecord): void } } }).storage;
      let old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      storage.tasks.put({
        id: "old", title: "old", notes: "", status: "done", priority: null, dueDate: null, tag: null,
        source: "os", sourceLabel: null, url: null, createdAt: old, updatedAt: old, completedAt: old,
      });
    });
    expect((await user.listTasks()).map(t => t.id)).toEqual([recent.id]);
  });

  it("imports one source's tasks and replaces what that source no longer lists", async () => {
    let user = await makeUser();
    let own = await user.createTask({ title: "mine" });

    let first = await user.importTasks("crm", "Green Hat CRM", [
      { externalId: "1", title: "Call Archie", dueDate: "2026-09-18", priority: "low", tag: "Sales",
        url: "https://crm.greenhatsec.com/tasks/1" },
      { externalId: "2", title: "Send proposal", status: "done" },
    ], true);
    expect(first).toEqual({ created: 2, updated: 0, removed: 0, kept: 0 });

    let tasks = await user.listTasks();
    expect(tasks.map(t => t.id).toSorted()).toEqual([own.id, "crm:1", "crm:2"].toSorted());
    expect(tasks.find(t => t.id === "crm:1")).toMatchObject({
      title: "Call Archie", source: "crm", sourceLabel: "Green Hat CRM", tag: "Sales",
      url: "https://crm.greenhatsec.com/tasks/1", status: "open",
    });
    expect(tasks.find(t => t.id === "crm:2")!.status).toBe("done");

    // Task 2 closed in the CRM and dropped from the feed; task 1 was renamed; the OS task stays.
    let second = await user.importTasks("crm", "Green Hat CRM", [
      { externalId: "1", title: "Call Archie back", dueDate: "2026-09-18", priority: "low", tag: "Sales",
        url: "https://crm.greenhatsec.com/tasks/1" },
    ], true);
    expect(second).toEqual({ created: 0, updated: 1, removed: 1, kept: 0 });
    tasks = await user.listTasks();
    expect(tasks.map(t => t.id).toSorted()).toEqual([own.id, "crm:1"].toSorted());
    expect(tasks.find(t => t.id === "crm:1")!.title).toBe("Call Archie back");

    // Another source is not affected by the CRM's replace.
    await user.importTasks("exponential", "Exponential", [{ externalId: "9", title: "Ship v2" }], true);
    await user.importTasks("crm", "Green Hat CRM", [], true);
    expect((await user.listTasks()).map(t => t.id).toSorted()).toEqual([own.id, "exponential:9"].toSorted());
  });

  it("keeps a newer local edit only when the source dates its records", async () => {
    let user = await makeUser();
    await user.importTasks("crm", null, [
      { externalId: "1", title: "Call Archie", updatedAt: "2026-01-01T00:00:00Z" },
    ], true);
    await user.updateTask("crm:1", { status: "done" });
    let synced = await user.importTasks("crm", null, [
      { externalId: "1", title: "Call Archie", updatedAt: "2026-01-01T00:00:00Z" },
    ], true);
    expect(synced).toEqual({ created: 0, updated: 0, removed: 0, kept: 1 });
    expect((await user.listTasks())[0].status).toBe("done");

    let undated = await user.importTasks("crm", null, [{ externalId: "1", title: "Call Archie" }], true);
    expect(undated).toEqual({ created: 0, updated: 1, removed: 0, kept: 0 });
    expect((await user.listTasks())[0].status).toBe("open");
  });

  it("persists GreenPM source metadata without losing a local task edit", async () => {
    let user = await makeUser();
    let item = { externalId: "42", title: "Source title", updatedAt: "2026-01-01T00:00:00Z",
      url: "https://tools.greenhatsec.com/exponential/tasks/42" };
    await user.importTasks("exponential", "Exponential", [item], true);
    let edited = await user.updateTask("exponential:42", { status: "done", priority: "high", tag: "Personal" });
    let migratedItem = { ...item, url: "https://pm.greenhatsec.com/exponential/tasks/42" };
    let synced = await user.importTasks("exponential", "GreenPM", [migratedItem], true);
    expect(synced).toEqual({ created: 0, updated: 1, removed: 0, kept: 0 });
    expect((await user.listTasks())[0]).toMatchObject({ ...edited, url: migratedItem.url,
      sourceLabel: "GreenPM", updatedAt: expect.any(Date) });
    expect(await user.importTasks("exponential", "GreenPM", [migratedItem], true))
        .toEqual({ created: 0, updated: 0, removed: 0, kept: 1 });
  });

  it("mirrors a record in place, so a later sync from that source updates rather than duplicates", async () => {
    let user = await makeUser();
    let added = await user.mirrorTask("crm", "Green Hat CRM", {
      externalId: "42", title: "Call Archie", dueDate: "2026-09-18", url: "https://crm.example/object/task/42",
    });
    expect(added).toMatchObject({ id: "crm:42", source: "crm", sourceLabel: "Green Hat CRM", status: "open" });
    let again = await user.mirrorTask("crm", "Green Hat CRM", { externalId: "42", title: "Call Archie back" });
    expect(again.id).toBe("crm:42");
    expect(again.title).toBe("Call Archie back");
    expect(await user.listTasks()).toHaveLength(1);

    let synced = await user.importTasks("crm", "Green Hat CRM", [
      { externalId: "42", title: "Call Archie back", status: "done" },
    ], true);
    expect(synced).toEqual({ created: 0, updated: 1, removed: 0, kept: 0 });
    let tasks = await user.listTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("done");
    await expectRejection(user.mirrorTask("os", null, { externalId: "1", title: "x" }), /OS's own source id/);
  });

  it("does not import into an account that does not exist", async () => {
    let stub = env.TEST_USER.get(env.TEST_USER.idFromName("nobody@example.com"));
    expect(await stub.importTasks("crm", null, [{ externalId: "1", title: "x" }], true)).toBeNull();
    expect(await stub.whoamiIfExists()).toBeNull();
  });

  it("bounds the list, counting a replacing sync against the size it leaves behind", async () => {
    let user = await makeUser();
    let big = Array.from({ length: MAX_TASKS_PER_USER }, (_, i) => ({ externalId: `${i}`, title: `t${i}` }));
    expect(await user.importTasks("crm", null, big, true)).toMatchObject({ created: MAX_TASKS_PER_USER });
    await expectRejection(user.createTask({ title: "one more" }), /at most 1000 tasks/);
    // A smaller sync from the same source always fits, however full the list is.
    expect(await user.importTasks("crm", null, big.slice(0, 10), true))
        .toEqual({ created: 0, updated: 0, removed: MAX_TASKS_PER_USER - 10, kept: 0 });
    expect(await user.createTask({ title: "one more" })).toMatchObject({ title: "one more" });
  });
});
