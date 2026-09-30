// How the Home task list is arranged (Green Hat fork). Pure: the panel hands the tasks and the
// viewer's calendar day in, and gets sections back. Dates are `YYYY-MM-DD` strings throughout, so
// "today" is whatever day it is where the viewer sits, with no timezone arithmetic on the server.

import type { TaskInfo, TaskPriority } from '@gadgets/workshop-shared/api'

/**
 * How far ahead the first section reaches. "Today" is the default and the reference design; the
 * wider ones pull the coming days into the same section so a week's plan reads as one list.
 */
export type TaskHorizon = 'today' | 'week' | 'month'

export const TASK_HORIZONS: { id: TaskHorizon; label: string; daysAhead: number }[] = [
  { id: 'today', label: 'Today', daysAhead: 0 },
  { id: 'week', label: 'This week', daysAhead: 6 },
  { id: 'month', label: 'This month', daysAhead: 29 },
]

export type TaskGroupId = 'now' | 'upcoming' | 'someday' | 'completed'

export type TaskGroup = {
  id: TaskGroupId
  label: string
  tasks: TaskInfo[]
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }

function priorityRank(priority: TaskPriority | null): number {
  return priority === null ? 3 : PRIORITY_RANK[priority]
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** The calendar day of `date` where the viewer is, as `YYYY-MM-DD`. */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Parse a `YYYY-MM-DD` key as a local-time Date at midnight. */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** The key `days` days after `key` (negative moves back). */
export function addDays(key: string, days: number): string {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + days)
  return localDateKey(date)
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const ms = parseDateKey(to).getTime() - parseDateKey(from).getTime()
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

/**
 * The words on a row's date chip. Near days get names, far ones a date; anything before today is
 * flagged so the chip can go red and the group put it first.
 */
export function describeDueDate(dueDate: string, today: string): { label: string; overdue: boolean } {
  const delta = daysBetween(today, dueDate)
  if (delta === 0) return { label: 'Today', overdue: false }
  if (delta === 1) return { label: 'Tomorrow', overdue: false }
  if (delta === -1) return { label: 'Yesterday', overdue: true }
  const date = parseDateKey(dueDate)
  if (delta > 1 && delta < 7) {
    return { label: date.toLocaleDateString(undefined, { weekday: 'short' }), overdue: false }
  }
  const sameYear = dueDate.slice(0, 4) === today.slice(0, 4)
  const label = date.toLocaleDateString(undefined,
    sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
  return { label, overdue: delta < 0 }
}

/**
 * The due date spelled out for a task's details: the whole date and how far it is from today,
 * e.g. "Thursday, October 1, 2026 · tomorrow". Overdue on the same terms as the row's chip.
 */
export function describeDueDateInFull(dueDate: string, today: string): { label: string; overdue: boolean } {
  const delta = daysBetween(today, dueDate)
  const date = parseDateKey(dueDate).toLocaleDateString(undefined,
    { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const distance =
    delta === 0 ? 'today'
      : delta === 1 ? 'tomorrow'
      : delta === -1 ? 'yesterday'
      : delta > 0 ? `in ${delta} days`
      : `${-delta} days ago`
  return { label: `${date} · ${distance}`, overdue: delta < 0 }
}

function compareTitles(a: TaskInfo, b: TaskInfo): number {
  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
}

function compareDue(a: TaskInfo, b: TaskInfo): number {
  // Dated before undated; earlier before later.
  if (a.dueDate === b.dueDate) return 0
  if (a.dueDate === null) return 1
  if (b.dueDate === null) return -1
  return a.dueDate < b.dueDate ? -1 : 1
}

function comparePriority(a: TaskInfo, b: TaskInfo): number {
  return priorityRank(a.priority) - priorityRank(b.priority)
}

/**
 * Sort open tasks for display: what is due soonest first, the most urgent within a day, then by
 * title so the order is stable. Undated tasks fall back to urgency, then recency.
 */
export function compareOpenTasks(a: TaskInfo, b: TaskInfo): number {
  return compareDue(a, b) || comparePriority(a, b) ||
    (a.dueDate === null ? b.updatedAt.getTime() - a.updatedAt.getTime() : 0) ||
    compareTitles(a, b)
}

function compareCompleted(a: TaskInfo, b: TaskInfo): number {
  const at = a.completedAt?.getTime() ?? 0
  const bt = b.completedAt?.getTime() ?? 0
  return bt - at || compareTitles(a, b)
}

/**
 * Split the list into the four sections of the panel. The first section holds everything due on
 * or before the horizon's last day, overdue tasks included (they are the most "now" of all);
 * "Upcoming" is what is dated beyond it; "Someday" is undated; "Completed" is done. Every section
 * is returned even when empty so the panel's layout does not jump as tasks move.
 */
export function groupTasks(tasks: TaskInfo[], today: string, horizon: TaskHorizon): TaskGroup[] {
  const spec = TASK_HORIZONS.find((h) => h.id === horizon) ?? TASK_HORIZONS[0]
  const lastDay = addDays(today, spec.daysAhead)
  const now: TaskInfo[] = []
  const upcoming: TaskInfo[] = []
  const someday: TaskInfo[] = []
  const completed: TaskInfo[] = []
  for (const task of tasks) {
    if (task.status === 'done') completed.push(task)
    else if (task.dueDate === null) someday.push(task)
    else if (task.dueDate <= lastDay) now.push(task)
    else upcoming.push(task)
  }
  now.sort(compareOpenTasks)
  upcoming.sort(compareOpenTasks)
  someday.sort(compareOpenTasks)
  completed.sort(compareCompleted)
  return [
    { id: 'now', label: spec.label, tasks: now },
    { id: 'upcoming', label: 'Upcoming', tasks: upcoming },
    { id: 'someday', label: 'Someday', tasks: someday },
    { id: 'completed', label: 'Completed', tasks: completed },
  ]
}

/** A readable name for where a task came from, for the badge on imported rows. */
export function describeTaskSource(task: TaskInfo): string {
  if (task.sourceLabel) return task.sourceLabel
  return task.source.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
