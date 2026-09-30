// @vitest-environment jsdom
/* eslint-disable react/react-in-jsx-scope */

import { act, cloneElement, type ReactElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedApi, TaskInfo } from '@gadgets/workshop-shared/api'
import { localDateKey } from './taskGrouping'

const testState = vi.hoisted(() => ({
  toastAdd: vi.fn<(toast: { title: string; variant?: string }) => void>(),
}))

// Kumo's compound components (menus, dialogs, selects, tooltips) are portal-and-positioner
// machinery that has nothing to prove here and does not settle under jsdom; stand-ins keep the
// list's own behaviour testable. Menus stay closed, so their contents render nothing; an open
// dialog renders its contents in place, and a tooltip renders only its trigger.
vi.mock('@cloudflare/kumo', () => {
  const passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>
  const nothing = () => null
  const DropdownMenu = Object.assign(passthrough, {
    Trigger: ({ render }: { render: ReactElement }) => render,
    Content: nothing,
    Item: passthrough,
    LinkItem: passthrough,
    Separator: nothing,
  })
  const Tooltip = ({ render, children }: { render?: ReactElement; children?: ReactNode }) =>
    render ? cloneElement(render, undefined, children) : <>{children}</>
  const Dialog = Object.assign(passthrough, {
    Root: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? <>{children}</> : null),
    Title: passthrough,
    Description: passthrough,
    Close: nothing,
  })
  const Select = Object.assign(passthrough, { Option: passthrough })
  const Button = (props: Record<string, unknown>) => <button {...props} />
  const Input = (props: Record<string, unknown>) => <input {...props} />
  const InputArea = (props: Record<string, unknown>) => <textarea {...props} />
  return {
    useKumoToastManager: () => ({ add: testState.toastAdd }),
    Tooltip,
    TooltipProvider: passthrough,
    DropdownMenu,
    Dialog,
    Select,
    Button,
    Input,
    InputArea,
  }
})

const api = {
  listTasks: vi.fn<AuthenticatedApi['listTasks']>(),
  createTask: vi.fn<AuthenticatedApi['createTask']>(),
  updateTask: vi.fn<AuthenticatedApi['updateTask']>(),
  deleteTask: vi.fn<AuthenticatedApi['deleteTask']>(),
  clearCompletedTasks: vi.fn<AuthenticatedApi['clearCompletedTasks']>(),
}
vi.mock('../AuthContext', () => ({
  useAuthenticatedApi: () => ({ authenticatedApi: api, currentUser: null, isAdmin: false, logout: () => {} }),
}))
// The tools' feed sync has its own tests and would otherwise reach for the network here.
vi.mock('./useToolsFeedSync', () => ({ useToolsFeedSync: () => {} }))

import TaskList from './TaskList'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const today = localDateKey(new Date())
let seq = 0
function task(overrides: Partial<TaskInfo>): TaskInfo {
  seq++
  const at = new Date(2026, 8, 1, 0, 0, seq)
  return {
    id: `t${seq}`, title: `Task ${seq}`, notes: '', status: 'open', priority: null, dueDate: null,
    tag: null, source: 'os', sourceLabel: null, url: null, createdAt: at, updatedAt: at, completedAt: null,
    ...overrides,
  }
}

describe('TaskList', () => {
  let root: Root | undefined
  let container: HTMLDivElement | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(async () => {
    await act(async () => root?.unmount())
    container?.remove()
  })

  async function render() {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root!.render(<TaskList />))
  }

  const count = (id: string) => container!.querySelector(`[data-testid="task-count-${id}"]`)?.textContent

  it('groups the tasks it loads and folds everything but today', async () => {
    api.listTasks.mockResolvedValue([
      task({ title: 'Review SOC 2 evidence for HR-5', dueDate: today, priority: 'high', tag: 'Audit' }),
      task({ title: 'Update investor deck', dueDate: today, priority: 'medium' }),
      task({ title: 'Later', dueDate: '2099-01-01' }),
      task({ title: 'Whenever' }),
      task({ title: 'Shipped', status: 'done', completedAt: new Date() }),
      task({ title: 'From the CRM', dueDate: today, source: 'crm', sourceLabel: 'Green Hat CRM',
        url: 'https://crm.greenhatsec.com/tasks/1' }),
    ])
    await render()

    expect(count('now')).toBe('3')
    expect(count('upcoming')).toBe('1')
    expect(count('someday')).toBe('1')
    expect(count('completed')).toBe('1')

    const titles = [...container!.querySelectorAll('li[data-testid^="task-row-"]')].map((li) =>
      li.querySelector('span.truncate')?.textContent)
    // Only the open "today" section is expanded; the highest priority leads.
    expect(titles).toEqual(['Review SOC 2 evidence for HR-5', 'Update investor deck', 'From the CRM'])
    expect(container!.textContent).toContain('Green Hat CRM')
    expect(container!.querySelector('a[href="https://crm.greenhatsec.com/tasks/1"]')).not.toBeNull()
  })

  it('marks a task done through the checkbox and shows the server row', async () => {
    const open = task({ title: 'Follow up with Archie App', dueDate: today, priority: 'low', tag: 'Sales' })
    api.listTasks.mockResolvedValue([open])
    api.updateTask.mockImplementation(async (_id, patch) =>
      ({ ...open, ...patch, completedAt: new Date() } as TaskInfo))
    await render()

    const checkbox = container!.querySelector<HTMLButtonElement>('[role="checkbox"]')!
    expect(checkbox.getAttribute('aria-checked')).toBe('false')
    await act(async () => checkbox.click())

    expect(api.updateTask).toHaveBeenCalledWith(open.id, { status: 'done' })
    expect(count('now')).toBe('0')
    expect(count('completed')).toBe('1')
    expect(testState.toastAdd).not.toHaveBeenCalled()
  })

  it('puts a task back and says so when the server refuses', async () => {
    const open = task({ title: 'Stubborn', dueDate: today })
    api.listTasks.mockResolvedValue([open])
    api.updateTask.mockRejectedValue(new Error('No such task.'))
    await render()

    await act(async () => container!.querySelector<HTMLButtonElement>('[role="checkbox"]')!.click())

    expect(count('now')).toBe('1')
    expect(testState.toastAdd).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
  })

  it('shows the empty state when there is nothing on the list', async () => {
    api.listTasks.mockResolvedValue([])
    await render()
    expect(container!.textContent).toContain('Nothing here yet')
  })

  const button = (label: string) =>
    [...container!.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)
  const openDetailsOf = (title: string) =>
    [...container!.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]')]
      .find((b) => b.textContent?.includes(title))!.click()

  it('opens everything about a task from its row', async () => {
    api.listTasks.mockResolvedValue([
      task({
        title: 'PNE: reply to Greg Nelson about the 2027 AGM site tour booking', dueDate: today,
        priority: 'high', tag: 'Email', notes: 'He asked on Sep 24.\nOffer Oct 14 or Oct 21.',
        source: 'crm', sourceLabel: 'Green Hat CRM', url: 'https://crm.greenhatsec.com/tasks/9',
        writeBackError: 'The CRM refused the change.',
      }),
    ])
    await render()
    expect(container!.textContent).not.toContain('Offer Oct 14')

    await act(async () => openDetailsOf('PNE: reply to Greg Nelson'))

    const text = container!.textContent
    expect(text).toContain('He asked on Sep 24.\nOffer Oct 14 or Oct 21.')
    expect(text).toContain('From Green Hat CRM')
    expect(text).toMatch(/ · today/)
    expect(text).toContain('The CRM refused the change.')
    const links = [...container!.querySelectorAll('a[href="https://crm.greenhatsec.com/tasks/9"]')]
    expect(links.some((a) => a.textContent === 'Open in Green Hat CRM')).toBe(true)
  })

  it('keeps the details on a task through a change made from them', async () => {
    const open = task({ title: 'Send Shawn the meeting notes', dueDate: today })
    api.listTasks.mockResolvedValue([open])
    api.updateTask.mockImplementation(async (_id, patch) =>
      ({ ...open, ...patch, completedAt: new Date() } as TaskInfo))
    await render()

    await act(async () => openDetailsOf('Send Shawn the meeting notes'))
    await act(async () => button('Mark done')!.click())

    expect(api.updateTask).toHaveBeenCalledWith(open.id, { status: 'done' })
    // The row has moved into the folded Completed section, but its details stay open and current.
    expect(count('completed')).toBe('1')
    expect(button('Reopen')).toBeDefined()
    expect(container!.textContent).toMatch(/Done \S/)
  })

  it('hands a task from its details to the editor', async () => {
    api.listTasks.mockResolvedValue([task({ title: 'Reply to Eugene Lau', dueDate: today })])
    await render()

    await act(async () => openDetailsOf('Reply to Eugene Lau'))
    await act(async () => button('Edit')!.click())

    expect(button('Mark done')).toBeUndefined()
    expect(container!.textContent).toContain('Edit task')
    expect([...container!.querySelectorAll('input')].some((i) => i.value === 'Reply to Eugene Lau')).toBe(true)
  })
})
