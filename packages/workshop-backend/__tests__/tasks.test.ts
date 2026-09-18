import { describe, expect, it } from "vitest";
import {
  TaskInputError,
  applyTaskPatch,
  importedTaskId,
  newOsTask,
  normalizeTaskDueDate,
  normalizeTaskSource,
  normalizeTaskTag,
  normalizeTaskTitle,
  normalizeTaskUrl,
  reconcileImportedTask,
  sameTaskContent,
  taskChangeFromPatch,
  toTaskInfo,
  type TaskRecord,
} from "../src/tasks.js";

const T0 = new Date("2026-09-17T10:00:00Z");
const T1 = new Date("2026-09-17T15:00:00Z");
const T2 = new Date("2026-09-18T02:00:00Z");

function osTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return { ...newOsTask("t1", { title: "Review SOC 2 evidence" }, T0), ...overrides };
}

describe("task field rules", () => {
  it("trims titles and bounds their length", () => {
    expect(normalizeTaskTitle("  Update deck  ")).toBe("Update deck");
    expect(() => normalizeTaskTitle("   ")).toThrow(TaskInputError);
    expect(() => normalizeTaskTitle("x".repeat(201))).toThrow(/200 characters/);
  });

  it("accepts only real calendar days as due dates", () => {
    expect(normalizeTaskDueDate("2026-09-18")).toBe("2026-09-18");
    expect(normalizeTaskDueDate(null)).toBeNull();
    expect(normalizeTaskDueDate("")).toBeNull();
    expect(() => normalizeTaskDueDate("2026-02-30")).toThrow(/not a calendar date/);
    expect(() => normalizeTaskDueDate("2026-9-8")).toThrow(/YYYY-MM-DD/);
    expect(() => normalizeTaskDueDate("2026-09-18T00:00:00Z")).toThrow(/YYYY-MM-DD/);
  });

  it("clears empty tags and keeps the rest trimmed", () => {
    expect(normalizeTaskTag("  Sales ")).toBe("Sales");
    expect(normalizeTaskTag("   ")).toBeNull();
    expect(normalizeTaskTag(undefined)).toBeNull();
  });

  it("allows only web links", () => {
    expect(normalizeTaskUrl("https://crm.greenhatsec.com/objects/tasks/42")).toBe(
        "https://crm.greenhatsec.com/objects/tasks/42");
    expect(normalizeTaskUrl("")).toBeNull();
    expect(() => normalizeTaskUrl("javascript:alert(1)")).toThrow(/http or https/);
    expect(() => normalizeTaskUrl("crm.greenhatsec.com/x")).toThrow(/absolute/);
  });

  it("keeps the OS's own source id for the OS", () => {
    expect(normalizeTaskSource("crm")).toBe("crm");
    expect(() => normalizeTaskSource("os")).toThrow(/OS's own source id/);
    expect(() => normalizeTaskSource("Green CRM")).toThrow(/lowercase slugs/);
  });

  it("derives stable, source-prefixed ids for imported tasks", () => {
    expect(importedTaskId("crm", " 42 ")).toBe("crm:42");
    expect(() => importedTaskId("crm", "  ")).toThrow(/externalId/);
  });
});

describe("applyTaskPatch", () => {
  it("changes only the fields named, clearing nullable ones set to null", () => {
    let task = osTask({ dueDate: "2026-09-18", tag: "Audit", priority: "high" });
    let next = applyTaskPatch(task, { dueDate: null, notes: " details " }, T1);
    expect(next).toMatchObject({
      title: task.title, dueDate: null, tag: "Audit", priority: "high", notes: "details",
      updatedAt: T1, localEditedAt: T1,
    });
  });

  it("stamps completion when a task is done and clears it when reopened", () => {
    let done = applyTaskPatch(osTask(), { status: "done" }, T1);
    expect(done.status).toBe("done");
    expect(done.completedAt).toEqual(T1);
    let again = applyTaskPatch(done, { status: "done", title: "Same" }, T2);
    expect(again.completedAt).toEqual(T1);
    let reopened = applyTaskPatch(again, { status: "open" }, T2);
    expect(reopened.status).toBe("open");
    expect(reopened.completedAt).toBeNull();
  });
});

describe("reconcileImportedTask", () => {
  const item = {
    externalId: "42", title: "Follow up with Archie", dueDate: "2026-09-20", priority: "low" as const,
    tag: "Sales", url: "https://crm.greenhatsec.com/tasks/42",
  };

  it("creates a record owned by the source", () => {
    let record = reconcileImportedTask(undefined, "crm:42", "crm", "Green Hat CRM", item, T0);
    expect(record).toMatchObject({
      id: "crm:42", title: item.title, status: "open", dueDate: "2026-09-20", priority: "low",
      tag: "Sales", source: "crm", sourceLabel: "Green Hat CRM", url: item.url,
      createdAt: T0, updatedAt: T0, completedAt: null,
    });
    expect(record!.localEditedAt).toBeUndefined();
  });

  it("writes nothing when the source repeats what is already stored", () => {
    let existing = reconcileImportedTask(undefined, "crm:42", "crm", "Green Hat CRM", item, T0)!;
    expect(reconcileImportedTask(existing, "crm:42", "crm", "Green Hat CRM", item, T1)).toBeNull();
    expect(sameTaskContent(existing, existing)).toBe(true);
  });

  it("lets the source overwrite a local edit when it does not date its records", () => {
    let existing = reconcileImportedTask(undefined, "crm:42", "crm", null, item, T0)!;
    let edited = applyTaskPatch(existing, { status: "done" }, T1);
    let synced = reconcileImportedTask(edited, "crm:42", "crm", null, item, T2)!;
    expect(synced.status).toBe("open");
    expect(synced.completedAt).toBeNull();
    expect(synced.localEditedAt).toBeUndefined();
    expect(synced.createdAt).toEqual(T0);
  });

  it("keeps a local edit that is newer than the source's own timestamp", () => {
    let existing = reconcileImportedTask(undefined, "crm:42", "crm", null, item, T0)!;
    let edited = applyTaskPatch(existing, { status: "done" }, T1);
    let stale = { ...item, updatedAt: "2026-09-17T09:00:00Z" };
    expect(reconcileImportedTask(edited, "crm:42", "crm", null, stale, T2)).toBeNull();
    let fresh = { ...item, updatedAt: "2026-09-18T01:00:00Z", title: "Renamed in the CRM" };
    let synced = reconcileImportedTask(edited, "crm:42", "crm", null, fresh, T2)!;
    expect(synced.title).toBe("Renamed in the CRM");
    expect(synced.status).toBe("open");
    expect(synced.sourceUpdatedAt).toEqual(new Date("2026-09-18T01:00:00Z"));
  });

  it("carries a source-side completion through and keeps its first completion time", () => {
    let existing = reconcileImportedTask(undefined, "crm:42", "crm", null, item, T0)!;
    let done = reconcileImportedTask(existing, "crm:42", "crm", null,
        { ...item, status: "done" }, T1)!;
    expect(done.completedAt).toEqual(T1);
    let still = reconcileImportedTask(done, "crm:42", "crm", null, { ...item, status: "done" }, T2);
    expect(still).toBeNull();
  });

  it("rejects an unparseable updatedAt rather than treating it as absent", () => {
    expect(() => reconcileImportedTask(undefined, "crm:42", "crm", null,
        { ...item, updatedAt: "yesterday" }, T0)).toThrow(/ISO 8601/);
  });
});

describe("taskChangeFromPatch", () => {
  it("names only what changed on a mirrored task, and nothing for an OS task", () => {
    let mirrored = reconcileImportedTask(undefined, "crm:42", "crm", null,
        { externalId: "42", title: "Call Archie", dueDate: "2026-09-20" }, T0)!;
    let done = applyTaskPatch(mirrored, { status: "done" }, T1);
    expect(taskChangeFromPatch(done, { status: "done" }))
        .toEqual({ source: "crm", externalId: "42", status: "done" });
    let moved = applyTaskPatch(done, { dueDate: null, title: "Call Archie back", priority: "high" }, T2);
    expect(taskChangeFromPatch(moved, { dueDate: null, title: "Call Archie back", priority: "high" }))
        .toEqual({ source: "crm", externalId: "42", title: "Call Archie back", dueDate: null });
    // Priority and tag have no home in any source: nothing to write back.
    expect(taskChangeFromPatch(moved, { priority: "low", tag: "Sales" })).toBeNull();
    expect(taskChangeFromPatch(osTask(), { status: "done" })).toBeNull();
  });
});

describe("toTaskInfo", () => {
  it("hides the reconciliation timestamps from the client", () => {
    let record = osTask({ localEditedAt: T1, sourceUpdatedAt: T0 });
    let info = toTaskInfo(record);
    expect("localEditedAt" in info).toBe(false);
    expect("sourceUpdatedAt" in info).toBe(false);
    expect(info.title).toBe(record.title);
  });
});
