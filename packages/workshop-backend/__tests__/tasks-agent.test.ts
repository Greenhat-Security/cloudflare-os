import { describe, expect, it } from "vitest";
import type { TaskInfo } from "@gadgets/workshop-shared/api";
import {
  describeTask,
  formatTaskList,
  mirrorFromToolInput,
  newTaskFromToolInput,
  patchFromToolInput,
} from "../src/tasks-agent.js";

const NOW = new Date("2026-09-17T15:00:00Z");
let seq = 0;

function task(overrides: Partial<TaskInfo>): TaskInfo {
  seq++;
  let at = new Date(2026, 8, 1, 0, 0, seq);
  return {
    id: `t${seq}`, title: `Task ${seq}`, notes: "", status: "open", priority: null, dueDate: null,
    tag: null, source: "os", sourceLabel: null, url: null, createdAt: at, updatedAt: at, completedAt: null,
    ...overrides,
  };
}

describe("formatTaskList", () => {
  it("groups by urgency with ids, sources and links the model can act on", () => {
    let text = formatTaskList([
      task({ id: "a", title: "Overdue thing", dueDate: "2026-09-10", priority: "high", tag: "Audit" }),
      task({ id: "b", title: "Today thing", dueDate: "2026-09-17" }),
      task({ id: "crm:7", title: "Call Archie", dueDate: "2026-09-20", source: "crm",
        sourceLabel: "Green Hat CRM", url: "https://crm.greenhatsec.com/object/task/7" }),
      task({ id: "c", title: "Someday thing", notes: "Line one\nline two" }),
      task({ id: "d", title: "Done thing", status: "done", completedAt: new Date("2026-09-16T10:00:00Z") }),
    ], NOW);
    expect(text).toContain("Today is 2026-09-17 (UTC). 4 open tasks.");
    expect(text).toMatch(/## Overdue\n\* \[a\] Overdue thing — due 2026-09-10 — high priority — tag: Audit/);
    expect(text).toMatch(/## Due today\n\* \[b\] Today thing — due 2026-09-17/);
    expect(text).toMatch(/## Upcoming\n\* \[crm:7\] Call Archie — due 2026-09-20 — from Green Hat CRM <https:\/\/crm\.greenhatsec\.com\/object\/task\/7>/);
    expect(text).toMatch(/## Someday \(no date\)\n\* \[c\] Someday thing\n  Line one line two/);
    expect(text).toMatch(/## Recently completed\n\* \[d\] Done thing — done 2026-09-16/);
  });

  it("says so when there is nothing", () => {
    expect(formatTaskList([], NOW)).toContain("The list is empty.");
  });
});

describe("tool input mapping", () => {
  it("creates open tasks with only what the model set", () => {
    expect(newTaskFromToolInput({ title: "Ship it" })).toEqual({
      title: "Ship it", notes: undefined, dueDate: undefined, priority: null, tag: undefined,
    });
    expect(newTaskFromToolInput({ title: "Ship it", dueDate: "2026-09-18", priority: "low", tag: "Sales" }))
        .toMatchObject({ dueDate: "2026-09-18", priority: "low", tag: "Sales" });
  });

  it("maps clearing sentinels to null and leaves omitted fields out of the patch", () => {
    expect(patchFromToolInput({ id: "t", status: "done" })).toEqual({ status: "done" });
    expect(patchFromToolInput({ id: "t", dueDate: "", priority: "none", tag: "" }))
        .toEqual({ dueDate: null, priority: null, tag: null });
    expect(patchFromToolInput({ id: "t", dueDate: "2026-09-19", priority: "high", tag: "Audit", title: "x", notes: "n" }))
        .toEqual({ dueDate: "2026-09-19", priority: "high", tag: "Audit", title: "x", notes: "n" });
  });

  it("turns a sourced add into a mirrored record and insists on the record's id", () => {
    expect(mirrorFromToolInput({ title: "Call Archie" })).toBeNull();
    expect(mirrorFromToolInput({
      title: "Call Archie", source: "crm", externalId: "42", sourceLabel: "Green Hat CRM",
      url: "https://crm.example/object/task/42", dueDate: "2026-09-18", priority: "low", tag: "Sales",
    })).toEqual({
      source: "crm", sourceLabel: "Green Hat CRM",
      item: {
        externalId: "42", title: "Call Archie", notes: undefined, dueDate: "2026-09-18", priority: "low",
        tag: "Sales", url: "https://crm.example/object/task/42",
      },
    });
    expect(() => mirrorFromToolInput({ title: "x", source: "crm" })).toThrow(/externalId/);
  });

  it("describes a changed task on one line", () => {
    expect(describeTask(task({ id: "z", title: "Renamed", status: "done",
        completedAt: new Date("2026-09-17T12:00:00Z") })))
        .toBe("[z] Renamed — done 2026-09-17");
  });
});
