// Per-user tasks (Green Hat fork): the rules both writers share. The user Durable Object applies
// them to what the browser sends over RPC, and the import endpoint applies them to what an
// automation posts. capnweb-validate already checks the RPC *shapes*, so what lives here is the
// part a type cannot say: trimming, lengths, a due date being a real calendar day, a URL being one
// an agent may follow, and how a patch or an import lands on an existing record.

import {
  MAX_TASK_NOTES_LENGTH,
  MAX_TASK_TAG_LENGTH,
  MAX_TASK_TITLE_LENGTH,
  OS_TASK_SOURCE,
  TASK_PRIORITIES,
  type NewTaskInput,
  type TaskImportItem,
  type TaskInfo,
  type TaskPatch,
  type TaskPriority,
  type TaskStatus,
} from "@gadgets/workshop-shared/api";
import type { TaskChange } from "@gadgets/workshop-shared/task-import-gateway";

/** `YYYY-MM-DD`; the calendar check is in normalizeTaskDueDate. */
export const TASK_DUE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Importing tools name themselves with a short slug: lowercase, digits, hyphens, 32 characters. */
export const TASK_SOURCE_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** Longest id an importer may use for one of its records. */
export const MAX_TASK_EXTERNAL_ID_LENGTH = 200;

/** Longest link back to a source record. */
export const MAX_TASK_URL_LENGTH = 2048;

/** Longest display name an importer may give its system. */
export const MAX_TASK_SOURCE_LABEL_LENGTH = 60;

/**
 * What the user Durable Object stores per task: the client-facing record plus two timestamps that
 * decide who wins when the OS and an importing tool disagree (see reconcileImportedTask).
 */
export type TaskRecord = TaskInfo & {
  /** Last time the user changed the task in the OS. Unset until they do. */
  localEditedAt?: Date;
  /** The source system's own modification time for an imported task, when the importer sent one. */
  sourceUpdatedAt?: Date;
};

/** Thrown for input the types allow but the rules do not; the message is meant for the user. */
export class TaskInputError extends Error {}

export function normalizeTaskTitle(title: string): string {
  let trimmed = title.trim();
  if (!trimmed) throw new TaskInputError("A task needs a title.");
  if (trimmed.length > MAX_TASK_TITLE_LENGTH) {
    throw new TaskInputError(`Task titles are at most ${MAX_TASK_TITLE_LENGTH} characters.`);
  }
  return trimmed;
}

export function normalizeTaskNotes(notes: string | undefined): string {
  let trimmed = (notes ?? "").trim();
  if (trimmed.length > MAX_TASK_NOTES_LENGTH) {
    throw new TaskInputError(`Task notes are at most ${MAX_TASK_NOTES_LENGTH} characters.`);
  }
  return trimmed;
}

export function normalizeTaskTag(tag: string | null | undefined): string | null {
  let trimmed = (tag ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_TASK_TAG_LENGTH) {
    throw new TaskInputError(`Task tags are at most ${MAX_TASK_TAG_LENGTH} characters.`);
  }
  return trimmed;
}

export function normalizeTaskPriority(priority: TaskPriority | null | undefined): TaskPriority | null {
  if (priority === undefined || priority === null) return null;
  if (!TASK_PRIORITIES.includes(priority)) {
    throw new TaskInputError(`Task priority must be one of ${TASK_PRIORITIES.join(", ")}.`);
  }
  return priority;
}

/**
 * A due date is a calendar day, `YYYY-MM-DD`, that exists: `2026-02-30` is rejected rather than
 * rolled into March, because the client compares these as strings and a phantom date would sort
 * but never match a real day.
 */
export function normalizeTaskDueDate(dueDate: string | null | undefined): string | null {
  if (dueDate === undefined || dueDate === null || dueDate === "") return null;
  if (!TASK_DUE_DATE_PATTERN.test(dueDate)) {
    throw new TaskInputError("Due dates are written YYYY-MM-DD.");
  }
  let [year, month, day] = dueDate.split("-").map(Number);
  let parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day) {
    throw new TaskInputError(`${dueDate} is not a calendar date.`);
  }
  return dueDate;
}

/** Only web links: a task's "open in" action hands the URL straight to the browser. */
export function normalizeTaskUrl(url: string | null | undefined): string | null {
  let trimmed = (url ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_TASK_URL_LENGTH) {
    throw new TaskInputError(`Task links are at most ${MAX_TASK_URL_LENGTH} characters.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new TaskInputError("Task links must be absolute URLs.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new TaskInputError("Task links must be http or https URLs.");
  }
  return parsed.toString();
}

export function normalizeTaskSource(source: string): string {
  if (!TASK_SOURCE_PATTERN.test(source)) {
    throw new TaskInputError(
        "Task sources are lowercase slugs of letters, digits and hyphens, up to 32 characters.");
  }
  if (source === OS_TASK_SOURCE) {
    throw new TaskInputError(`"${OS_TASK_SOURCE}" is the OS's own source id; an importer needs another.`);
  }
  return source;
}

export function normalizeTaskSourceLabel(label: string | null | undefined): string | null {
  let trimmed = (label ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_TASK_SOURCE_LABEL_LENGTH) {
    throw new TaskInputError(`Source labels are at most ${MAX_TASK_SOURCE_LABEL_LENGTH} characters.`);
  }
  return trimmed;
}

/**
 * The stable id of an imported task. Prefixing with the source keeps two tools that both number
 * their records from 1 apart, and makes every id of a source enumerable by prefix.
 */
export function importedTaskId(source: string, externalId: string): string {
  let trimmed = externalId.trim();
  if (!trimmed) throw new TaskInputError("Every imported task needs an externalId.");
  if (trimmed.length > MAX_TASK_EXTERNAL_ID_LENGTH) {
    throw new TaskInputError(`externalId is at most ${MAX_TASK_EXTERNAL_ID_LENGTH} characters.`);
  }
  return `${source}:${trimmed}`;
}

/** A brand-new OS task, validated. */
export function newOsTask(id: string, input: NewTaskInput, now: Date): TaskRecord {
  return {
    id,
    title: normalizeTaskTitle(input.title),
    notes: normalizeTaskNotes(input.notes),
    status: "open",
    priority: normalizeTaskPriority(input.priority),
    dueDate: normalizeTaskDueDate(input.dueDate),
    tag: normalizeTaskTag(input.tag),
    source: OS_TASK_SOURCE,
    sourceLabel: null,
    url: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

/** The record after a user's patch. Pure: the caller stores the result. */
export function applyTaskPatch(task: TaskRecord, patch: TaskPatch, now: Date): TaskRecord {
  let next: TaskRecord = { ...task, updatedAt: now, localEditedAt: now };
  if (patch.title !== undefined) next.title = normalizeTaskTitle(patch.title);
  if (patch.notes !== undefined) next.notes = normalizeTaskNotes(patch.notes);
  if (patch.priority !== undefined) next.priority = normalizeTaskPriority(patch.priority);
  if (patch.dueDate !== undefined) next.dueDate = normalizeTaskDueDate(patch.dueDate);
  if (patch.tag !== undefined) next.tag = normalizeTaskTag(patch.tag);
  if (patch.status !== undefined && patch.status !== task.status) {
    next.status = patch.status;
    next.completedAt = patch.status === "done" ? now : null;
  }
  return next;
}

/**
 * The record an import lands as, or null when the existing record should stay as it is.
 *
 * The source system is the authority on its own tasks, so by default its version replaces what
 * is here. The one exception is a user who edited the task in the OS (marked it done, moved its
 * date) after the source last touched it: when the importer dates its records, that newer local
 * edit is kept, so a nightly sync does not quietly undo the afternoon's work. An importer that
 * sends no `updatedAt` always wins, which is the documented behaviour of the endpoint.
 */
export function reconcileImportedTask(
    existing: TaskRecord | undefined, id: string, source: string, sourceLabel: string | null,
    item: TaskImportItem, now: Date): TaskRecord | null {
  let sourceUpdatedAt = item.updatedAt === undefined ? undefined : new Date(item.updatedAt);
  if (sourceUpdatedAt !== undefined && Number.isNaN(sourceUpdatedAt.valueOf())) {
    throw new TaskInputError(`updatedAt "${item.updatedAt}" is not an ISO 8601 instant.`);
  }
  if (existing?.localEditedAt && sourceUpdatedAt &&
      existing.localEditedAt.valueOf() >= sourceUpdatedAt.valueOf()) {
    return null;
  }
  let status: TaskStatus = item.status ?? "open";
  let next: TaskRecord = {
    id,
    title: normalizeTaskTitle(item.title),
    notes: normalizeTaskNotes(item.notes),
    status,
    priority: normalizeTaskPriority(item.priority),
    dueDate: normalizeTaskDueDate(item.dueDate),
    tag: normalizeTaskTag(item.tag),
    source,
    sourceLabel,
    url: normalizeTaskUrl(item.url),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    completedAt: status === "done" ? (existing?.completedAt ?? now) : null,
  };
  if (sourceUpdatedAt) next.sourceUpdatedAt = sourceUpdatedAt;
  // The source overrode whatever the user had changed; a later import must not resurrect it.
  delete next.localEditedAt;
  if (existing && sameTaskContent(existing, next)) return null;
  return next;
}

/** Whether two records say the same thing, timestamps aside, so an unchanged sync writes nothing. */
export function sameTaskContent(a: TaskRecord, b: TaskRecord): boolean {
  return a.title === b.title && a.notes === b.notes && a.status === b.status &&
      a.priority === b.priority && a.dueDate === b.dueDate && a.tag === b.tag &&
      a.source === b.source && a.sourceLabel === b.sourceLabel && a.url === b.url &&
      (a.sourceUpdatedAt?.valueOf() ?? null) === (b.sourceUpdatedAt?.valueOf() ?? null) &&
      // An unchanged record that still carries a local edit must lose it once the source has
      // caught up, so that a future sync is not silently ignored.
      a.localEditedAt === undefined;
}

/**
 * The part of a patch that a task's source system should hear about: only the fields the patch
 * set, and only those the sources have an equivalent for. Null when nothing needs writing back
 * (an OS task, or a patch that touched only priority or tag).
 */
export function taskChangeFromPatch(task: TaskRecord, patch: TaskPatch): TaskChange | null {
  if (task.source === OS_TASK_SOURCE) return null;
  let externalId = task.id.slice(task.source.length + 1);
  if (!externalId) return null;
  let change: TaskChange = { source: task.source, externalId };
  let any = false;
  if (patch.title !== undefined) { change.title = task.title; any = true; }
  if (patch.status !== undefined) { change.status = task.status; any = true; }
  if (patch.dueDate !== undefined) { change.dueDate = task.dueDate; any = true; }
  if (patch.notes !== undefined) { change.notes = task.notes; any = true; }
  return any ? change : null;
}

/** What the client is shown: the stored record minus the reconciliation timestamps. */
export function toTaskInfo(record: TaskRecord): TaskInfo {
  let { localEditedAt: _local, sourceUpdatedAt: _source, ...info } = record;
  return info;
}
