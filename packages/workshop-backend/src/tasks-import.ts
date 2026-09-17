// `POST /api/tasks/import` (Green Hat fork): how tasks from Green Hat's other tools reach a user's
// list. An automation (a nightly job against the CRM, say) posts one source's view of its tasks,
// each addressed to a user by email, and the Workshop writes them into that user's Durable Object.
//
// Two gates, both required in production. Cloudflare Access fronts the public hostname, so the
// caller has to arrive through the Access app with a service token, and the Workshop checks the
// resulting assertion the way it does for browsers (a service token's JWT carries `common_name`
// instead of `email`; either is accepted here). Then the caller has to present the deployment's
// TASKS_IMPORT_TOKEN secret as a bearer, so that Access alone (a misconfigured bypass policy, a
// stolen service token) is not enough. The user emails in the body are the only routing: no
// session, no identity is minted from this request.
//
// Body (JSON, 512 KB at most, 500 tasks at most):
//   {
//     "source": "crm",                 // the importing tool's id: lowercase slug
//     "sourceLabel": "Green Hat CRM",  // optional display name for the badge on each row
//     "assignee": "a@greenhatsec.com", // default owner of every task; a task may name its own
//     "replace": true,                 // default true: drop this source's tasks not listed here
//     "tasks": [{
//       "externalId": "42",            // the tool's own id, stable across syncs
//       "title": "...", "notes": "...",
//       "status": "open" | "done", "priority": "high" | "medium" | "low" | null,
//       "dueDate": "2026-09-18" | null, "tag": "Sales" | null,
//       "url": "https://crm.greenhatsec.com/...",
//       "updatedAt": "2026-09-17T09:00:00Z",  // optional; lets a newer edit in the OS win
//       "assignee": "b@greenhatsec.com"        // optional per-task owner
//     }]
//   }
//
// Response: 200 with per-user counts. Users without an OS account are reported under `skipped`,
// never created. Validation failures are 400 with the field path.

import { z } from "zod";
import type { JWTPayload } from "jose";
import { createLogger } from "@gadgets/backend-utils/logger";
import {
  MAX_TASK_NOTES_LENGTH,
  MAX_TASK_SYNC_ITEMS,
  MAX_TASK_TAG_LENGTH,
  MAX_TASK_TITLE_LENGTH,
  TASK_PRIORITIES,
  type TaskImportCounts,
  type TaskImportItem,
} from "@gadgets/workshop-shared/api";
import { verifyCfAccessJwt, type CfAccessEnv } from "./access.js";
import {
  MAX_TASK_EXTERNAL_ID_LENGTH,
  MAX_TASK_SOURCE_LABEL_LENGTH,
  MAX_TASK_URL_LENGTH,
  TASK_DUE_DATE_PATTERN,
  TASK_SOURCE_PATTERN,
  TaskInputError,
  normalizeTaskSource,
  normalizeTaskSourceLabel,
} from "./tasks.js";
import type { UserDurableObject } from "./user.js";

/** The endpoint's path on the Workshop; the router forwards it as it does every `/api/*` path. */
export const TASK_IMPORT_PATH = "/api/tasks/import";

/** Largest request body accepted. */
export const MAX_TASK_IMPORT_BODY_BYTES = 512 * 1024;

/** Most tasks one request may carry; the same cap as the browser sync path. */
export const MAX_TASK_IMPORT_TASKS = MAX_TASK_SYNC_ITEMS;

type TaskImportLogFields = { source?: string; users?: number; tasks?: number };
const logger = createLogger<TaskImportLogFields>({ component: "workshop.tasks-import" });

/** What the handler needs from the Worker's environment. */
export type TaskImportEnv = Readonly<{
  /** The shared secret an importer presents as a bearer. Unset means the endpoint is off. */
  TASKS_IMPORT_TOKEN?: string;
}> & CfAccessEnv;

/** The user Durable Object namespace, so the handler can be driven by a test binding. */
export type TaskImportUsers = Pick<DurableObjectNamespace<UserDurableObject>, "idFromName" | "get">;

type AccessVerifier = (request: Request, env: CfAccessEnv) => Promise<JWTPayload | null>;

const email = z.email().max(254);

const importedTaskSchema = z.object({
  externalId: z.string().min(1).max(MAX_TASK_EXTERNAL_ID_LENGTH),
  assignee: email.optional(),
  title: z.string().min(1).max(MAX_TASK_TITLE_LENGTH),
  notes: z.string().max(MAX_TASK_NOTES_LENGTH).optional(),
  status: z.enum(["open", "done"]).optional(),
  priority: z.enum(TASK_PRIORITIES).nullable().optional(),
  dueDate: z.string().regex(TASK_DUE_DATE_PATTERN, "expected YYYY-MM-DD").nullable().optional(),
  tag: z.string().max(MAX_TASK_TAG_LENGTH).nullable().optional(),
  url: z.string().max(MAX_TASK_URL_LENGTH).nullable().optional(),
  updatedAt: z.iso.datetime({ offset: true }).optional(),
});

const importSchema = z.object({
  source: z.string().regex(TASK_SOURCE_PATTERN, "expected a lowercase slug"),
  sourceLabel: z.string().min(1).max(MAX_TASK_SOURCE_LABEL_LENGTH).optional(),
  assignee: email.optional(),
  replace: z.boolean().optional(),
  tasks: z.array(importedTaskSchema).max(MAX_TASK_IMPORT_TASKS),
});

/** The body of a successful import. */
export type TaskImportResult = {
  source: string;
  /** One entry per user the payload addressed and who has an account here. */
  users: Array<{ assignee: string } & TaskImportCounts>;
  /** Addresses the payload named that have no account on this deployment; nothing was written. */
  skipped: Array<{ assignee: string; reason: string }>;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  let bytesA = new TextEncoder().encode(a);
  let bytesB = new TextEncoder().encode(b);
  if (bytesA.byteLength !== bytesB.byteLength) return false;
  return crypto.subtle.timingSafeEqual(bytesA, bytesB);
}

async function readBoundedJson(request: Request): Promise<unknown | "too-large" | "invalid"> {
  let declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_TASK_IMPORT_BODY_BYTES) {
    return "too-large";
  }
  if (!request.body) return "invalid";
  let reader = request.body.getReader();
  let chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      let { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_TASK_IMPORT_BODY_BYTES) {
        await reader.cancel();
        return "too-large";
      }
      chunks.push(value);
    }
    let bytes = new Uint8Array(length);
    let offset = 0;
    for (let chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return "invalid";
  } finally {
    reader.releaseLock();
  }
}

/** Handles `POST /api/tasks/import`. See the file comment for the contract. */
export async function handleTaskImportRequest(
    request: Request, env: TaskImportEnv, users: TaskImportUsers,
    verifyAccess: AccessVerifier = verifyCfAccessJwt): Promise<Response> {
  if (request.method !== "POST") {
    return json(405, { error: "Task import accepts POST only." });
  }

  let expectedToken = env.TASKS_IMPORT_TOKEN;
  if (!expectedToken) {
    return json(503, {
      error: "Task import is not enabled on this deployment: the TASKS_IMPORT_TOKEN secret is not " +
          "set on the Workshop Worker.",
    });
  }
  let authorization = request.headers.get("authorization") ?? "";
  let presented = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  if (!presented || !timingSafeEqual(presented, expectedToken)) {
    return json(401, { error: "Task import requires the deployment's import token as a bearer." });
  }

  if (env.CF_ACCESS_AUD) {
    // Access is enforced at the edge, so a missing assertion means the request did not come
    // through the Access app (or came through a bypass rule). A service token's assertion has no
    // email; the Workshop's browser path insists on one, this path does not.
    let payload = await verifyAccess(request, env);
    if (!payload) {
      return json(403, {
        error: "Task import must be called through the deployment's Cloudflare Access app with " +
            "a service token (CF-Access-Client-Id / CF-Access-Client-Secret).",
      });
    }
  }

  let contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return json(415, { error: "Task import bodies are application/json." });
  }
  let body = await readBoundedJson(request);
  if (body === "too-large") {
    return json(413, { error: `Task import bodies are at most ${MAX_TASK_IMPORT_BODY_BYTES} bytes.` });
  }
  if (body === "invalid") {
    return json(400, { error: "Task import body is not valid JSON." });
  }

  let parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, {
      error: "Task import body failed validation.",
      issues: parsed.error.issues.map(issue => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    });
  }
  let payload = parsed.data;

  let source: string;
  let sourceLabel: string | null;
  try {
    source = normalizeTaskSource(payload.source);
    sourceLabel = normalizeTaskSourceLabel(payload.sourceLabel);
  } catch (err) {
    if (err instanceof TaskInputError) return json(400, { error: err.message });
    throw err;
  }

  // Route each task to its owner. Addresses are lowercased: that is how Access presents them and
  // therefore how the user Durable Objects are named.
  let byAssignee = new Map<string, TaskImportItem[]>();
  for (let [index, task] of payload.tasks.entries()) {
    let assignee = (task.assignee ?? payload.assignee)?.trim().toLowerCase();
    if (!assignee) {
      return json(400, {
        error: "Every task needs an assignee: set one on the task or a default on the payload.",
        issues: [{ path: `tasks.${index}.assignee`, message: "missing" }],
      });
    }
    let { assignee: _assignee, ...item } = task;
    let list = byAssignee.get(assignee);
    if (!list) byAssignee.set(assignee, list = []);
    list.push(item);
  }
  // A payload whose only content is a default assignee with no tasks still means "this user has
  // nothing from this source now", which with `replace` clears their entries.
  if (byAssignee.size === 0 && payload.assignee) {
    byAssignee.set(payload.assignee.trim().toLowerCase(), []);
  }

  let replace = payload.replace ?? true;
  let result: TaskImportResult = { source, users: [], skipped: [] };
  for (let [assignee, items] of byAssignee) {
    let user = users.get(users.idFromName(assignee));
    let counts: TaskImportCounts | null;
    try {
      counts = await user.importTasks(source, sourceLabel, items, replace);
    } catch (err) {
      // The Durable Object rethrows rule violations (a bad due date, a full list) as plain errors;
      // they are the caller's to fix, so they come back as 400 with the message intact.
      let message = err instanceof Error ? err.message : String(err);
      logger.warn("task import rejected by user object", {
        event: "tasks.import.rejected", source, error: err,
      });
      return json(400, { error: message, assignee });
    }
    if (counts === null) {
      result.skipped.push({ assignee, reason: "no account on this deployment" });
    } else {
      result.users.push({ assignee, ...counts });
    }
  }

  logger.info("tasks imported", {
    event: "tasks.import.completed", source, users: result.users.length, tasks: payload.tasks.length,
  });
  return json(200, result);
}
