// Green Hat fork: the service-binding contract by which a Worker in the same account pushes tasks
// from another system onto users' lists, without going through the public hostname (and so
// without Cloudflare Access or the import bearer). The body is the same as `POST
// /api/tasks/import` takes; see workshop-backend/src/tasks-import.ts for the field-by-field rules.

import type { TaskImportCounts, TaskImportItem } from "./api.js";

/** One tool's tasks, each addressed to a user by email (or all to the payload's `assignee`). */
export type TaskImportPayload = {
  /** The importing tool's slug: lowercase letters, digits and hyphens; never "os". */
  source: string;
  /** Display name for the badge on each row. */
  sourceLabel?: string;
  /** Default owner of every task, by email. */
  assignee?: string;
  /** Drop this source's tasks the payload no longer lists (per user in the payload). Default true. */
  replace?: boolean;
  tasks: Array<TaskImportItem & {
    /** This task's owner, by email, when it differs from the payload's default. */
    assignee?: string;
  }>;
};

/** What an import came to. */
export type TaskImportResult = {
  source: string;
  /** One entry per user the payload addressed who has an account on this deployment. */
  users: Array<{ assignee: string } & TaskImportCounts>;
  /** Addresses the payload named that have no account here; nothing was written for them. */
  skipped: Array<{ assignee: string; reason: string }>;
};

/** Service-binding RPC interface used by task-syncing Workers (`entrypoint: "TaskImportGateway"`). */
export interface TaskImportGateway {
  /**
   * Import one source's tasks. Rejects (throws) on a payload that fails validation, with the
   * message naming the field; otherwise every addressed user is written and the result says so.
   */
  importTasks(payload: TaskImportPayload): Promise<TaskImportResult>;
}
