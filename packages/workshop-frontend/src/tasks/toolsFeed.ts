// The Green Hat tools' own task feed (Green Hat fork). tools.greenhatsec.com serves
// `/api/my-tasks`: the signed-in user's open tasks across Exponential, GreenSpot and Greentype,
// merged. The user's browser holds the session for it, so the OS reads the feed from the browser
// and relays it into the user's list over RPC (`AuthenticatedApi.syncTasks`), one source per
// module, replacing what each module listed last time. Nothing here needs a credential of its
// own; a browser that is not signed in to the tools gets a refusal and the list is left alone.

import type { TaskImportItem } from '@gadgets/workshop-shared/api'
import { GREENHAT_TOOLS_ORIGIN } from '../components/AppShell/moduleRailItems'

/** Where the feed is read from. Fifty is the feed's own maximum. */
export const TOOLS_FEED_URL = `${GREENHAT_TOOLS_ORIGIN}/api/my-tasks?limit=50`

/** One row of the feed, as far as this side reads it. Everything but `id` and `module` is optional. */
export type ToolsFeedRow = {
  id: string
  module: string
  title?: string | null
  identifier?: string | null
  status?: string | null
  due_at?: string | null
  updated_at?: string | null
  project_name?: string | null
}

/** One module's slice of the feed, ready for `syncTasks`. */
export type ToolsFeedSource = {
  source: string
  sourceLabel: string
  tasks: TaskImportItem[]
}

type ModuleSpec = {
  label: string
  /** Where a row's task lives in the tool; null when the tool has no per-task page. */
  taskUrl: (id: string) => string | null
  /** What to show as the row's tag, given the feed's project name. */
  tag: (projectName: string | null) => string | null
}

// The modules the feed merges. Every one is always synced, even when it contributed no rows, so
// a task closed in the tool leaves the OS list on the next sync.
const MODULES: Record<string, ModuleSpec> = {
  exponential: {
    label: 'Exponential',
    taskUrl: (id) => `${GREENHAT_TOOLS_ORIGIN}/exponential/tasks/${encodeURIComponent(id)}`,
    tag: (projectName) => projectName,
  },
  greenspot: {
    label: 'GreenSpot',
    taskUrl: (id) => `${GREENHAT_TOOLS_ORIGIN}/greenspot/tasks/${encodeURIComponent(id)}`,
    // The feed reports "GreenSpot" as the project of every CRM task; the source badge says that.
    tag: () => null,
  },
  greentype: {
    label: 'Greentype',
    taskUrl: () => `${GREENHAT_TOOLS_ORIGIN}/greentype`,
    tag: () => null,
  },
}

const DONE_STATUSES = new Set(['done', 'completed', 'cancelled', 'canceled'])

function dateKeyOf(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value)
  return match ? match[1] : null
}

function instantOf(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return undefined
  return new Date(value).toISOString()
}

/**
 * Turn the feed's rows into one sync per module. Rows from modules this side does not know are
 * ignored; rows without an id or a title are skipped rather than failing the whole sync.
 */
export function groupFeedRows(rows: unknown): ToolsFeedSource[] {
  const bySource = new Map<string, ToolsFeedSource>()
  for (const [source, spec] of Object.entries(MODULES)) {
    bySource.set(source, { source, sourceLabel: spec.label, tasks: [] })
  }
  if (Array.isArray(rows)) {
    for (const raw of rows) {
      if (!raw || typeof raw !== 'object') continue
      const row = raw as ToolsFeedRow
      const spec = MODULES[row.module]
      const group = bySource.get(row.module)
      if (!spec || !group) continue
      if (typeof row.id !== 'string' || !row.id) continue
      const title = typeof row.title === 'string' ? row.title.trim() : ''
      if (!title) continue
      const projectName = typeof row.project_name === 'string' && row.project_name.trim()
        ? row.project_name.trim()
        : null
      const identifier = typeof row.identifier === 'string' && row.identifier.trim()
        ? row.identifier.trim()
        : null
      const notes = [identifier, projectName].filter((s): s is string => s !== null).join(' · ')
      const status = typeof row.status === 'string' && DONE_STATUSES.has(row.status.toLowerCase())
        ? 'done'
        : 'open'
      const item: TaskImportItem = {
        externalId: row.id,
        title,
        status,
        dueDate: dateKeyOf(row.due_at),
        tag: spec.tag(projectName),
        url: spec.taskUrl(row.id),
      }
      if (notes) item.notes = notes
      const updatedAt = instantOf(row.updated_at)
      if (updatedAt) item.updatedAt = updatedAt
      group.tasks.push(item)
    }
  }
  return [...bySource.values()]
}

/**
 * Read the feed with the browser's own session. Resolves to null when the tools cannot be reached
 * or refuse (not signed in there, another origin, a dev build), which the caller treats as
 * "leave the list alone", never as "the user has no tasks".
 */
export async function fetchToolsFeed(fetchImpl: typeof fetch = fetch): Promise<unknown[] | null> {
  try {
    const response = await fetchImpl(TOOLS_FEED_URL, {
      credentials: 'include',
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return null
    const body = (await response.json()) as { tasks?: unknown }
    return Array.isArray(body.tasks) ? body.tasks : null
  } catch {
    return null
  }
}
