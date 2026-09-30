import type { ReactNode } from 'react'
import { Dialog } from '@cloudflare/kumo'
import { ArrowSquareOut, Flag, WarningCircle, X } from '@phosphor-icons/react'
import { OS_TASK_SOURCE, type TaskInfo } from '@gadgets/workshop-shared/api'
import { WorkshopButton, WorkshopIconButton } from '../components/WorkshopControls'
import { formatFullTimestamp } from '../utils/formatTimestamp'
import { describeDueDateInFull, describeTaskSource } from './taskGrouping'
import { PRIORITY_CLASS, PRIORITY_LABEL } from './taskPriority'

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt className="text-kumo-subtle">{label}</dt>
    <dd className="min-w-0 break-words text-kumo-default">{children}</dd>
  </>
)

const TaskDetails = ({
  task,
  today,
  onToggle,
  onEdit,
}: {
  task: TaskInfo
  today: string
  onToggle: (task: TaskInfo) => void
  onEdit: (task: TaskInfo) => void
}) => {
  const done = task.status === 'done'
  const source = describeTaskSource(task)
  const due = task.dueDate === null ? null : describeDueDateInFull(task.dueDate, today)
  const overdue = due !== null && due.overdue && !done

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-kumo-line px-5 py-4">
        <div className="min-w-0">
          <Dialog.Title className="break-words text-[15px] leading-5 font-medium tracking-[-0.3px] text-kumo-default">
            {task.title}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-[12px] leading-4 tracking-[-0.2px] text-kumo-subtle">
            {done && task.completedAt ? `Done ${formatFullTimestamp(task.completedAt)}` : 'Open'}
            {' · '}
            {task.source === OS_TASK_SOURCE ? 'On your own list' : `From ${source}`}
          </Dialog.Description>
        </div>
        <Dialog.Close
          render={(props) => (
            <WorkshopIconButton {...props} className="!h-7 !w-7" aria-label="Close">
              <X size={16} />
            </WorkshopIconButton>
          )}
        />
      </div>

      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-5 py-4">
        <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px] leading-[18px] tracking-[-0.25px]">
          <Field label="Due">
            {due === null ? 'Someday' : (
              <span className={overdue ? 'text-kumo-danger' : undefined}>
                {overdue ? `Overdue · ${due.label}` : due.label}
              </span>
            )}
          </Field>
          <Field label="Priority">
            {task.priority ? (
              <span className={`inline-flex items-center gap-1 ${PRIORITY_CLASS[task.priority]}`}>
                <Flag size={13} weight="fill" />
                {PRIORITY_LABEL[task.priority]}
              </span>
            ) : 'None'}
          </Field>
          {task.tag && <Field label="Tag">{task.tag}</Field>}
          <Field label="Added">{formatFullTimestamp(task.createdAt)}</Field>
          <Field label="Updated">{formatFullTimestamp(task.updatedAt)}</Field>
        </dl>

        <div>
          <h3 className="mb-1 text-[12px] leading-4 font-medium tracking-[-0.2px] text-kumo-subtle">Notes</h3>
          {task.notes ? (
            <p className="whitespace-pre-wrap break-words text-[13px] leading-5 tracking-[-0.25px] text-kumo-default">
              {task.notes}
            </p>
          ) : (
            <p className="text-[13px] leading-5 tracking-[-0.25px] text-kumo-inactive">No notes.</p>
          )}
        </div>

        {task.writeBackError && (
          <p className="flex items-start gap-1.5 text-[12px] leading-4 tracking-[-0.2px] text-kumo-warning">
            <WarningCircle size={14} weight="fill" className="mt-px shrink-0" />
            <span>Your last change here was not saved to {source}: {task.writeBackError}</span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-kumo-line bg-kumo-base px-5 py-3">
        {task.url ? (
          <a
            href={task.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-0 items-center gap-1 text-[13px] leading-[18px] tracking-[-0.25px] text-kumo-brand hover:text-kumo-brand-hover"
          >
            <ArrowSquareOut size={13} className="shrink-0" />
            <span className="truncate">Open in {source}</span>
          </a>
        ) : <span />}
        <div className="flex shrink-0 items-center gap-2">
          <WorkshopButton type="button" onClick={() => onToggle(task)}>
            {done ? 'Reopen' : 'Mark done'}
          </WorkshopButton>
          <WorkshopButton tone="primary" type="button" onClick={() => onEdit(task)}>
            Edit
          </WorkshopButton>
        </div>
      </div>
    </>
  )
}

/**
 * Everything about one task (Green Hat fork), opened by clicking its row: the whole title, when it
 * is due, its notes, and where it came from. Read-only; Edit hands the task to the editor.
 */
const TaskDetailsDialog = ({
  open,
  task,
  today,
  onOpenChange,
  onToggle,
  onEdit,
}: {
  open: boolean
  task: TaskInfo | null
  today: string
  onOpenChange: (open: boolean) => void
  onToggle: (task: TaskInfo) => void
  onEdit: (task: TaskInfo) => void
}) => (
  <Dialog.Root open={open && task !== null} onOpenChange={onOpenChange}>
    <Dialog
      className="responsive-dialog !z-[1000] !w-[min(520px,calc(100vw-32px))] overflow-hidden bg-kumo-base p-0 !top-[12%] !-translate-y-0"
      size="sm"
    >
      {task && <TaskDetails task={task} today={today} onToggle={onToggle} onEdit={onEdit} />}
    </Dialog>
  </Dialog.Root>
)

export default TaskDetailsDialog
