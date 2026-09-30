import { useRef, useState } from 'react'
import { DropdownMenu, Tooltip } from '@cloudflare/kumo'
import {
  ArrowSquareOut,
  CalendarBlank,
  CalendarPlus,
  Check,
  DotsThree,
  Flag,
  PencilSimple,
  Tag,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react'
import { OS_TASK_SOURCE, type TaskInfo, type TaskPatch, type TaskPriority } from '@gadgets/workshop-shared/api'
import { MENU_CONTENT, MENU_ITEM, MENU_ITEM_DANGER, MENU_POSITIONER_STYLE } from '../components/menuStyles'
import { addDays, describeDueDate, describeTaskSource } from './taskGrouping'
import { PRIORITY_CLASS, PRIORITY_LABEL } from './taskPriority'

const isCutOff = (element: HTMLElement | null) => element !== null && element.scrollWidth > element.clientWidth

const PRIORITY_CHOICES: (TaskPriority | null)[] = ['high', 'medium', 'low', null]

function Chip({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'danger' }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 text-[12px] leading-4 tracking-[-0.2px]',
        tone === 'danger' ? 'text-kumo-danger' : 'text-kumo-subtle',
      ].join(' ')}
    >
      {children}
    </span>
  )
}

/**
 * One task (Green Hat fork): a round checkbox, the title, small chips for when it is due and what
 * it is about, the priority flag, and an overflow menu with everything else. Clicking the title or
 * its chips opens the task's details. Imported tasks say where they came from and can be opened
 * there.
 */
export default function TaskRow({
  task,
  today,
  onToggle,
  onOpen,
  onEdit,
  onPatch,
  onDelete,
}: {
  task: TaskInfo
  today: string
  onToggle: (task: TaskInfo) => void
  onOpen: (task: TaskInfo) => void
  onEdit: (task: TaskInfo) => void
  onPatch: (task: TaskInfo, patch: TaskPatch) => void
  onDelete: (task: TaskInfo) => void
}) {
  const done = task.status === 'done'
  const due = task.dueDate === null ? null : describeDueDate(task.dueDate, today)
  const imported = task.source !== OS_TASK_SOURCE
  const titleRef = useRef<HTMLSpanElement>(null)
  const [fullTitleShown, setFullTitleShown] = useState(false)

  return (
    <li
      data-testid={`task-row-${task.id}`}
      className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-kumo-tint"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Reopen "${task.title}"` : `Mark "${task.title}" done`}
        onClick={() => onToggle(task)}
        className={[
          'flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors',
          done
            ? 'border-kumo-brand bg-kumo-brand text-kumo-inverse'
            : 'border-kumo-interact text-transparent hover:border-kumo-brand hover:text-kumo-brand',
        ].join(' ')}
      >
        <Check size={11} weight="bold" />
      </button>

      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => onOpen(task)}
        className="min-w-0 flex-1 cursor-pointer text-left"
      >
        <Tooltip
          content={<span className="block max-w-sm break-words">{task.title}</span>}
          open={fullTitleShown}
          // Only a title the row has cut short gets the tooltip; a whole one would just repeat itself.
          onOpenChange={(open) => setFullTitleShown(open && isCutOff(titleRef.current))}
          className="cursor-pointer"
          render={
            <span
              ref={titleRef}
              className={[
                'block truncate text-[13px] leading-[18px] tracking-[-0.25px]',
                done ? 'text-kumo-inactive line-through' : 'text-kumo-default',
              ].join(' ')}
            />
          }
        >
          {task.title}
        </Tooltip>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {due && (
            <Chip tone={due.overdue && !done ? 'danger' : 'default'}>
              <CalendarBlank size={12} />
              {due.overdue && !done ? `Overdue · ${due.label}` : due.label}
            </Chip>
          )}
          {task.tag && (
            <Chip>
              <Tag size={12} />
              {task.tag}
            </Chip>
          )}
          {imported && (
            <span className="inline-flex items-center rounded-sm border border-kumo-line px-1 text-[10px] font-medium uppercase leading-4 tracking-[0.04em] text-kumo-inactive">
              {describeTaskSource(task)}
            </span>
          )}
          {task.writeBackError && (
            <span
              className="inline-flex items-center gap-1 text-[12px] leading-4 tracking-[-0.2px] text-kumo-warning"
              title={task.writeBackError}
            >
              <WarningCircle size={12} weight="fill" />
              Not saved to {describeTaskSource(task)}
            </span>
          )}
        </span>
      </button>

      {task.url && (
        <a
          href={task.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open in ${describeTaskSource(task)}`}
          title={`Open in ${describeTaskSource(task)}`}
          className="shrink-0 text-kumo-inactive opacity-0 transition-opacity hover:text-kumo-default group-hover:opacity-100 focus:opacity-100"
        >
          <ArrowSquareOut size={13} />
        </a>
      )}

      {task.priority && (
        <span
          className={`flex shrink-0 items-center gap-1 text-[12px] leading-4 ${PRIORITY_CLASS[task.priority]}`}
          title={`${PRIORITY_LABEL[task.priority]} priority`}
        >
          <Flag size={13} weight="fill" />
          <span className="hidden sm:inline">{PRIORITY_LABEL[task.priority]}</span>
        </span>
      )}

      <DropdownMenu>
        <DropdownMenu.Trigger
          render={
            <button
              type="button"
              aria-label={`Actions for "${task.title}"`}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-kumo-subtle opacity-0 transition-[opacity,color,background-color] group-hover:opacity-100 hover:bg-kumo-fill hover:text-kumo-default focus:opacity-100 data-[popup-open]:opacity-100"
            >
              <DotsThree size={16} weight="bold" />
            </button>
          }
        />
        <DropdownMenu.Content className={MENU_CONTENT} style={MENU_POSITIONER_STYLE}>
          <DropdownMenu.Item onClick={() => onEdit(task)} className={MENU_ITEM}>
            <PencilSimple size={13} className="mr-2" /> Edit
          </DropdownMenu.Item>
          <DropdownMenu.Item onClick={() => onToggle(task)} className={MENU_ITEM}>
            <Check size={13} className="mr-2" /> {done ? 'Reopen' : 'Mark done'}
          </DropdownMenu.Item>
          {task.url && (
            <DropdownMenu.LinkItem href={task.url} target="_blank" rel="noreferrer" className={MENU_ITEM}>
              <ArrowSquareOut size={13} className="mr-2" /> Open in {describeTaskSource(task)}
            </DropdownMenu.LinkItem>
          )}
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            onClick={() => onPatch(task, { dueDate: today })}
            className={MENU_ITEM}
            disabled={task.dueDate === today}
          >
            <CalendarBlank size={13} className="mr-2" /> Due today
          </DropdownMenu.Item>
          <DropdownMenu.Item onClick={() => onPatch(task, { dueDate: addDays(today, 1) })} className={MENU_ITEM}>
            <CalendarPlus size={13} className="mr-2" /> Due tomorrow
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onClick={() => onPatch(task, { dueDate: null })}
            className={MENU_ITEM}
            disabled={task.dueDate === null}
          >
            <CalendarBlank size={13} className="mr-2" /> Someday
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          {PRIORITY_CHOICES.map((priority) => (
            <DropdownMenu.Item
              key={priority ?? 'none'}
              onClick={() => onPatch(task, { priority })}
              className={MENU_ITEM}
              disabled={task.priority === priority}
            >
              <Flag
                size={13}
                weight={priority ? 'fill' : 'regular'}
                className={`mr-2 ${priority ? PRIORITY_CLASS[priority] : 'text-kumo-inactive'}`}
              />
              {priority ? `${PRIORITY_LABEL[priority]} priority` : 'No priority'}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator />
          <DropdownMenu.Item variant="danger" onClick={() => onDelete(task)} className={MENU_ITEM_DANGER}>
            <Trash size={13} className="mr-2" /> Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    </li>
  )
}
