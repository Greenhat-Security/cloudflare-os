import { useCallback, useEffect, useMemo, useState } from 'react'
import { DropdownMenu } from '@cloudflare/kumo'
import {
  ArrowClockwise,
  CaretDown,
  CaretRight,
  Check,
  Checks,
  DotsThree,
  Plus,
  Trash,
} from '@phosphor-icons/react'
import type { TaskInfo, TaskPatch } from '@gadgets/workshop-shared/api'
import { MENU_CONTENT, MENU_ITEM, MENU_ITEM_DANGER, MENU_POSITIONER_STYLE } from '../components/menuStyles'
import DeleteConfirmationDialog from '../components/DeleteConfirmationDialog'
import TaskEditorDialog, { type TaskEditorValues } from './TaskEditorDialog'
import TaskRow from './TaskRow'
import {
  TASK_HORIZONS,
  groupTasks,
  localDateKey,
  type TaskGroup,
  type TaskGroupId,
  type TaskHorizon,
} from './taskGrouping'
import { useTasks } from './useTasks'

const STORAGE_KEY_HORIZON = 'gadgets:tasks-horizon'
const STORAGE_KEY_COLLAPSED = 'gadgets:tasks-collapsed'

// The reference design opens Today and folds the rest.
const DEFAULT_COLLAPSED: Record<TaskGroupId, boolean> = {
  now: false,
  upcoming: true,
  someday: true,
  completed: true,
}

function readHorizon(): TaskHorizon {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_HORIZON)
    return TASK_HORIZONS.some((h) => h.id === stored) ? (stored as TaskHorizon) : 'today'
  } catch {
    return 'today'
  }
}

function readCollapsed(): Record<TaskGroupId, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_COLLAPSED)
    if (!stored) return DEFAULT_COLLAPSED
    const parsed = JSON.parse(stored) as Partial<Record<TaskGroupId, boolean>>
    return { ...DEFAULT_COLLAPSED, ...parsed }
  } catch {
    return DEFAULT_COLLAPSED
  }
}

/** The calendar day where the viewer is, kept honest across midnight for a tab left open. */
function useToday(): string {
  const [today, setToday] = useState(() => localDateKey(new Date()))
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = localDateKey(new Date())
      setToday((prev) => (prev === next ? prev : next))
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return today
}

function SkeletonRows() {
  return (
    <ul aria-hidden className="flex flex-col gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3 px-2 py-2">
          <span className="h-[18px] w-[18px] rounded-full bg-kumo-fill" />
          <span className="h-3.5 flex-1 rounded bg-kumo-fill" style={{ maxWidth: `${60 - i * 12}%` }} />
        </li>
      ))}
    </ul>
  )
}

function SectionHeader({
  group,
  collapsed,
  onToggle,
  onMarkAllDone,
  onClearCompleted,
}: {
  group: TaskGroup
  collapsed: boolean
  onToggle: () => void
  onMarkAllDone: () => void
  onClearCompleted: () => void
}) {
  const Caret = collapsed ? CaretRight : CaretDown
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={`task-section-${group.id}`}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-kumo-tint"
      >
        <Caret size={12} weight="bold" className="shrink-0 text-kumo-inactive" />
        <span className="text-[13px] leading-[18px] font-medium tracking-[-0.25px] text-kumo-default">
          {group.label}
        </span>
        <span className="text-[12px] leading-4 text-kumo-inactive" data-testid={`task-count-${group.id}`}>
          {group.tasks.length}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenu.Trigger
          render={
            <button
              type="button"
              aria-label={`${group.label} actions`}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-kumo-inactive transition-colors hover:bg-kumo-fill hover:text-kumo-default"
            >
              <DotsThree size={16} weight="bold" />
            </button>
          }
        />
        <DropdownMenu.Content className={MENU_CONTENT} style={MENU_POSITIONER_STYLE}>
          {group.id === 'completed' ? (
            <DropdownMenu.Item
              variant="danger"
              onClick={onClearCompleted}
              className={MENU_ITEM_DANGER}
              disabled={group.tasks.length === 0}
            >
              <Trash size={13} className="mr-2" /> Clear completed
            </DropdownMenu.Item>
          ) : (
            <DropdownMenu.Item onClick={onMarkAllDone} className={MENU_ITEM} disabled={group.tasks.length === 0}>
              <Checks size={13} className="mr-2" /> Mark all done
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  )
}

/**
 * The Home task list (Green Hat fork): every task the user owns, whether typed in here or pushed
 * from another Green Hat tool, in four sections by when it is due. The dropdown in the header
 * widens the first section from today to the week or the month.
 */
export default function TaskList() {
  const { tasks, loading, failed, refresh, createTask, updateTask, deleteTask, clearCompleted } = useTasks()
  const today = useToday()
  const [horizon, setHorizon] = useState<TaskHorizon>(readHorizon)
  const [collapsed, setCollapsed] = useState<Record<TaskGroupId, boolean>>(readCollapsed)
  const [editing, setEditing] = useState<TaskInfo | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  const groups = useMemo(() => groupTasks(tasks, today, horizon), [tasks, today, horizon])
  const horizonLabel = TASK_HORIZONS.find((h) => h.id === horizon)?.label ?? 'Today'

  const chooseHorizon = useCallback((next: TaskHorizon) => {
    setHorizon(next)
    try { localStorage.setItem(STORAGE_KEY_HORIZON, next) } catch {}
  }, [])

  const toggleSection = useCallback((id: TaskGroupId) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(STORAGE_KEY_COLLAPSED, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const openEditor = useCallback((task: TaskInfo | null) => {
    setEditing(task)
    setEditorOpen(true)
  }, [])

  const submitEditor = useCallback(async (values: TaskEditorValues): Promise<boolean> => {
    if (editing) return updateTask(editing, values)
    return createTask(values)
  }, [createTask, editing, updateTask])

  const toggleDone = useCallback((task: TaskInfo) => {
    void updateTask(task, { status: task.status === 'done' ? 'open' : 'done' })
  }, [updateTask])

  const patch = useCallback((task: TaskInfo, change: TaskPatch) => {
    void updateTask(task, change)
  }, [updateTask])

  const markAllDone = useCallback((group: TaskGroup) => {
    for (const task of group.tasks) void updateTask(task, { status: 'done' })
  }, [updateTask])

  const empty = !loading && !failed && tasks.length === 0

  return (
    <section
      aria-label="Task list"
      className="overflow-hidden rounded-xl border border-kumo-line bg-kumo-elevated"
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="text-[17px] leading-6 font-semibold tracking-[-0.3px] text-kumo-default">Task List</h2>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenu.Trigger
              render={
                <button
                  type="button"
                  aria-label={`Horizon: ${horizonLabel}`}
                  className="flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2 text-[13px] leading-[18px] tracking-[-0.25px] text-kumo-default transition-colors hover:bg-kumo-tint"
                >
                  {horizonLabel}
                  <CaretDown size={11} weight="bold" className="text-kumo-inactive" />
                </button>
              }
            />
            <DropdownMenu.Content className={MENU_CONTENT} style={MENU_POSITIONER_STYLE}>
              {TASK_HORIZONS.map((option) => (
                <DropdownMenu.Item key={option.id} onClick={() => chooseHorizon(option.id)} className={MENU_ITEM}>
                  <Check size={13} className={`mr-2 ${option.id === horizon ? '' : 'invisible'}`} />
                  {option.label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu>
          <button
            type="button"
            onClick={() => openEditor(null)}
            className="press inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-kumo-brand px-3 text-[13px] leading-[18px] font-medium tracking-[-0.25px] text-kumo-inverse transition-colors hover:bg-kumo-brand-hover"
          >
            <Plus size={13} weight="bold" />
            Add task
          </button>
        </div>
      </header>

      {/* Capped so the composer below stays within reach on a laptop; a long section scrolls
          inside the panel. Tall enough that four section headers plus a full "Today" fit. */}
      <div className="max-h-[440px] overflow-y-auto border-t border-kumo-line">
        {loading ? (
          <SkeletonRows />
        ) : failed ? (
          <div className="flex items-center justify-between gap-3 px-4 py-4 text-[13px] leading-[18px] text-kumo-subtle">
            <span>Your tasks couldn't be loaded.</span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-kumo-default transition-colors hover:bg-kumo-tint"
            >
              <ArrowClockwise size={13} /> Retry
            </button>
          </div>
        ) : empty ? (
          <div className="px-4 py-5 text-center text-[13px] leading-[18px] tracking-[-0.25px] text-kumo-subtle">
            Nothing here yet. Add a task, or let your other Green Hat tools send theirs in.
          </div>
        ) : (
          <div className="divide-y divide-kumo-line">
            {groups.map((group) => (
              <div key={group.id}>
                <SectionHeader
                  group={group}
                  collapsed={collapsed[group.id]}
                  onToggle={() => toggleSection(group.id)}
                  onMarkAllDone={() => markAllDone(group)}
                  onClearCompleted={() => setClearing(true)}
                />
                {!collapsed[group.id] && (
                  <div id={`task-section-${group.id}`} className="px-3 pb-2">
                    {group.tasks.length === 0 ? (
                      <p className="px-3 pb-2 text-[12px] leading-4 text-kumo-inactive">
                        {group.id === 'completed' ? 'Nothing completed yet.' : 'Nothing due.'}
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-0.5">
                        {group.tasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            today={today}
                            onToggle={toggleDone}
                            onEdit={openEditor}
                            onPatch={patch}
                            onDelete={(t) => void deleteTask(t)}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <TaskEditorDialog open={editorOpen} task={editing} onOpenChange={setEditorOpen} onSubmit={submitEditor} />
      <DeleteConfirmationDialog
        open={clearing}
        title="Clear completed tasks?"
        description="Every completed task on your list is deleted. Tasks from other tools come back if those tools still list them."
        confirmLabel="Clear"
        confirmingLabel="Clearing…"
        onOpenChange={setClearing}
        onConfirm={() => {
          setClearing(false)
          void clearCompleted()
        }}
      />
    </section>
  )
}
