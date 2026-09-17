// The agent's view of a user's task list (Green Hat fork): the tool descriptions, the text the
// model reads, and the mapping from the tools' flatter inputs to the list's own types. The tools
// themselves are defined in agent.ts next to the other built-ins; the overseer supplies an
// AgentTaskList bound to the driving user (see AgentHooks.getTaskList).

import {
  OS_TASK_SOURCE,
  type AiToolCall,
  type NewTaskInput,
  type TaskImportItem,
  type TaskInfo,
  type TaskPatch,
} from "@gadgets/workshop-shared/api";

/** The slice of a user object the task tools use. Bound to one user by the overseer. */
export type AgentTaskList = {
  list(): Promise<TaskInfo[]>;
  create(input: NewTaskInput): Promise<TaskInfo>;
  /**
   * Add or update a task that mirrors a record in another system, keyed by that system and the
   * record's id there, exactly as a sync from it would.
   */
  mirror(source: string, sourceLabel: string | null, item: TaskImportItem): Promise<TaskInfo>;
  update(id: string, patch: TaskPatch): Promise<TaskInfo>;
  delete(id: string): Promise<void>;
};

type AddTaskInput = Extract<AiToolCall, {toolName: "addTask"}>["input"];
type UpdateTaskInput = Extract<AiToolCall, {toolName: "updateTask"}>["input"];

/** The system prompt's account of the list, so the agent reaches for it unprompted. */
export const TASK_LIST_PROMPT = `
# The user's task list

The user keeps a task list on their Home page: tasks they typed there and tasks their other Green Hat tools push in (each of those carries a source and a link back). Read it with \`listTasks\` whenever the user asks what they should work on, what is due, or refers to "my tasks" or "my task list"; add to it with \`addTask\` when they ask you to remember, schedule, or add something; and \`updateTask\` to mark something done, reschedule it, or change its priority. Prefer \`listTasks\` first so you act on the real ids and titles. The list belongs to the person driving this chat.

The list already exists: NEVER create a Gadget to hold the user's tasks, and do not build a to-do app when they ask you to add things to their task list — these tools are how you reach it. When the tasks you add come from another system (their CRM, a tracker), pass \`source\`, \`externalId\`, \`sourceLabel\` and \`url\` on each \`addTask\` so the nightly sync from that system recognises them instead of adding duplicates.
`.trim();

export const LIST_TASKS_TOOL_DESCRIPTION = `
Read the user's task list: every open task grouped by when it is due (overdue, today, upcoming, someday) and the recently completed ones, each with its id, due date, priority, tag and, for tasks from another tool, the tool and a link. Call this before changing tasks so you use real ids.
`.trim();

export const ADD_TASK_TOOL_DESCRIPTION = `
Add a task to the user's list. Give a short imperative title; set dueDate (YYYY-MM-DD) only when the user named a day, priority only when they signalled urgency, and tag for the project or area they mentioned. The task is created open, owned by the user, and shown on their Home page.

If the task mirrors a record in another system (a CRM task, a tracker issue), also pass source (that system's slug, lowercase: "crm" for the Green Hat CRM), externalId (the record's id there), sourceLabel (its display name, e.g. "Green Hat CRM") and url (a link to the record). The task is then keyed by that id, so adding it again updates it and the nightly sync from that system takes it over instead of duplicating it.
`.trim();

export const UPDATE_TASK_TOOL_DESCRIPTION = `
Change one of the user's tasks by id: mark it done (status "done") or reopen it, retitle it, reschedule it (dueDate YYYY-MM-DD, or "" for someday), set its priority ("high", "medium", "low", or "none"), tag, or notes. Fields you omit stay as they are. Tasks that came from another tool can be changed here too, but that tool remains the place they are really tracked and its next sync may bring its own version back.
`.trim();

export const DELETE_TASK_TOOL_DESCRIPTION = `
Delete one of the user's tasks by id. Prefer marking a task done over deleting it unless the user asks for deletion; a task from another tool returns on that tool's next sync unless it was closed there as well.
`.trim();

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function describeLine(task: TaskInfo): string {
  let parts = [`[${task.id}] ${task.title}`];
  if (task.dueDate) parts.push(`due ${task.dueDate}`);
  if (task.priority) parts.push(`${task.priority} priority`);
  if (task.tag) parts.push(`tag: ${task.tag}`);
  if (task.source !== OS_TASK_SOURCE) {
    parts.push(`from ${task.sourceLabel ?? task.source}` + (task.url ? ` <${task.url}>` : ""));
  }
  if (task.status === "done" && task.completedAt) parts.push(`done ${dateKey(task.completedAt)}`);
  let line = `* ${parts.join(" — ")}`;
  if (task.notes) line += `\n  ${task.notes.replace(/\s*\n\s*/g, " ").slice(0, 200)}`;
  return line;
}

/** The whole list as the model reads it. `now` fixes what "today" means; dates are UTC days. */
export function formatTaskList(tasks: TaskInfo[], now: Date): string {
  let today = dateKey(now);
  let overdue: TaskInfo[] = [];
  let due: TaskInfo[] = [];
  let upcoming: TaskInfo[] = [];
  let someday: TaskInfo[] = [];
  let completed: TaskInfo[] = [];
  for (let task of tasks) {
    if (task.status === "done") completed.push(task);
    else if (task.dueDate === null) someday.push(task);
    else if (task.dueDate < today) overdue.push(task);
    else if (task.dueDate === today) due.push(task);
    else upcoming.push(task);
  }
  let byDue = (a: TaskInfo, b: TaskInfo) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
  overdue.sort(byDue);
  upcoming.sort(byDue);
  completed.sort((a, b) => (b.completedAt?.valueOf() ?? 0) - (a.completedAt?.valueOf() ?? 0));

  let open = overdue.length + due.length + upcoming.length + someday.length;
  let sections: string[] = [`Today is ${today} (UTC). ${open} open task${open === 1 ? "" : "s"}.`];
  let section = (title: string, list: TaskInfo[]) => {
    if (list.length === 0) return;
    sections.push(`## ${title}\n${list.map(describeLine).join("\n")}`);
  };
  section("Overdue", overdue);
  section("Due today", due);
  section("Upcoming", upcoming);
  section("Someday (no date)", someday);
  section("Recently completed", completed.slice(0, 10));
  if (open === 0 && completed.length === 0) sections.push("The list is empty.");
  return sections.join("\n\n");
}

/** One task after a change, as the model reads it. */
export function describeTask(task: TaskInfo): string {
  return describeLine(task).replace(/^\* /, "");
}

/** The addTask tool's input as the list's own creation input. */
export function newTaskFromToolInput(input: AddTaskInput): NewTaskInput {
  return {
    title: input.title,
    notes: input.notes,
    dueDate: input.dueDate,
    priority: input.priority ?? null,
    tag: input.tag,
  };
}

/**
 * The addTask tool's input as a mirrored record, when it names a source. `externalId` is required
 * with `source`: without the record's id nothing could key the task for a later sync.
 */
export function mirrorFromToolInput(input: AddTaskInput)
    : { source: string; sourceLabel: string | null; item: TaskImportItem } | null {
  if (!input.source) return null;
  if (!input.externalId) {
    throw new Error("addTask: a task with a source also needs the record's externalId there.");
  }
  return {
    source: input.source,
    sourceLabel: input.sourceLabel ?? null,
    item: {
      externalId: input.externalId,
      title: input.title,
      notes: input.notes,
      dueDate: input.dueDate,
      priority: input.priority ?? null,
      tag: input.tag,
      url: input.url,
    },
  };
}

/** The updateTask tool's input as a patch: "" clears a date or tag, "none" clears the priority. */
export function patchFromToolInput(input: UpdateTaskInput): TaskPatch {
  let patch: TaskPatch = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.status !== undefined) patch.status = input.status;
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate === "" ? null : input.dueDate;
  if (input.priority !== undefined) patch.priority = input.priority === "none" ? null : input.priority;
  if (input.tag !== undefined) patch.tag = input.tag === "" ? null : input.tag;
  return patch;
}
