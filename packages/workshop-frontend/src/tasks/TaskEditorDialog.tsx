import { useEffect, useState, type FormEvent } from 'react'
import { Dialog, Select } from '@cloudflare/kumo'
import { X } from '@phosphor-icons/react'
import {
  MAX_TASK_NOTES_LENGTH,
  MAX_TASK_TAG_LENGTH,
  MAX_TASK_TITLE_LENGTH,
  type TaskInfo,
  type TaskPatch,
  type TaskPriority,
} from '@gadgets/workshop-shared/api'
import {
  WorkshopButton,
  WorkshopIconButton,
  WorkshopInput,
  WorkshopInputArea,
} from '../components/WorkshopControls'
import { describeTaskSource } from './taskGrouping'

/** What the editor hands back: a full set of fields, usable as NewTaskInput or as a patch. */
export type TaskEditorValues = Required<Pick<TaskPatch, 'title' | 'notes' | 'priority' | 'dueDate' | 'tag'>>

const PRIORITY_OPTIONS: { value: TaskPriority | 'none'; label: string }[] = [
  { value: 'none', label: 'No priority' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

/**
 * Add or edit a task (Green Hat fork). One dialog for both: with a `task` it starts from that
 * task's fields and says "Save", without one it starts blank and says "Add task". The caller does
 * the RPC and reports success by resolving true, which closes the dialog.
 */
export default function TaskEditorDialog({
  open,
  task,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  task: TaskInfo | null
  onOpenChange: (open: boolean) => void
  onSubmit: (values: TaskEditorValues) => Promise<boolean>
}) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<TaskPriority | 'none'>('none')
  const [tag, setTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset the form each time the dialog opens, from the task being edited or to blank.
  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? '')
    setNotes(task?.notes ?? '')
    setDueDate(task?.dueDate ?? '')
    setPriority(task?.priority ?? 'none')
    setTag(task?.tag ?? '')
    setSaving(false)
    setError(null)
  }, [open, task])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Give the task a title.')
      return
    }
    setSaving(true)
    setError(null)
    const ok = await onSubmit({
      title: trimmedTitle,
      notes: notes.trim(),
      priority: priority === 'none' ? null : priority,
      dueDate: dueDate || null,
      tag: tag.trim() || null,
    })
    setSaving(false)
    if (ok) onOpenChange(false)
  }

  const imported = task !== null && task.source !== 'os'

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next)
      }}
    >
      <Dialog
        className="responsive-dialog !z-[1000] !w-[min(480px,calc(100vw-32px))] overflow-hidden bg-kumo-base p-0 !top-[16%] !-translate-y-0"
        size="sm"
      >
        <form onSubmit={submit} noValidate>
          <div className="flex items-start justify-between gap-4 border-b border-kumo-line px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-[15px] leading-5 font-medium tracking-[-0.3px] text-kumo-default">
                {task ? 'Edit task' : 'Add task'}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] leading-4 tracking-[-0.2px] text-kumo-subtle">
                {imported
                  ? `From ${describeTaskSource(task)}. Changes made here last until that system's next sync updates the task.`
                  : 'A task on your own list. Tasks from your other tools arrive on their own.'}
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={(props) => (
                <WorkshopIconButton {...props} className="!h-7 !w-7" disabled={saving} aria-label="Close">
                  <X size={16} />
                </WorkshopIconButton>
              )}
            />
          </div>

          <div className="flex flex-col gap-4 px-5 py-4">
            <WorkshopInput
              label="Title"
              placeholder="What needs doing?"
              value={title}
              maxLength={MAX_TASK_TITLE_LENGTH}
              onChange={(e) => { setTitle(e.target.value); setError(null) }}
              error={error ?? undefined}
              variant={error ? 'error' : 'default'}
              autoFocus
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <WorkshopInput
                label="Due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                description="Leave empty for someday."
              />
              <Select
                label="Priority"
                className="w-full text-sm"
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority | 'none')}
                renderValue={(v) => PRIORITY_OPTIONS.find((o) => o.value === v)?.label ?? String(v)}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <Select.Option key={option.value} value={option.value}>
                    {option.label}
                  </Select.Option>
                ))}
              </Select>
            </div>
            <WorkshopInput
              label="Tag"
              placeholder="Audit, Sales, Greenhat…"
              value={tag}
              maxLength={MAX_TASK_TAG_LENGTH}
              onChange={(e) => setTag(e.target.value)}
            />
            <WorkshopInputArea
              label="Notes"
              placeholder="Anything worth remembering"
              value={notes}
              maxLength={MAX_TASK_NOTES_LENGTH}
              onChange={(e) => setNotes(e.target.value)}
              autoResize
              minRows={2}
              maxRows={6}
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-kumo-line bg-kumo-base px-5 py-3">
            <Dialog.Close
              render={(props) => (
                <WorkshopButton {...props} className="!h-9" disabled={saving} type="button">
                  Cancel
                </WorkshopButton>
              )}
            />
            <WorkshopButton tone="primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : task ? 'Save' : 'Add task'}
            </WorkshopButton>
          </div>
        </form>
      </Dialog>
    </Dialog.Root>
  )
}
