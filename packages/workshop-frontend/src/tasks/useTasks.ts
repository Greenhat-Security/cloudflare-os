import { useCallback, useEffect, useRef, useState } from 'react'
import { useKumoToastManager } from '@cloudflare/kumo'
import type { NewTaskInput, TaskInfo, TaskPatch } from '@gadgets/workshop-shared/api'
import { useAuthenticatedApi } from '../AuthContext'
import { classifyRpcError, logRpcFailure } from '../rpcErrors'

/**
 * The Home task list's data (Green Hat fork): one load over RPC, refreshed after every change and
 * whenever the tab comes back into view, since imports land while nobody is looking. Edits are
 * applied to the local copy first so a checkbox flips under the pointer; the server's answer then
 * replaces the row, and a failure puts the old row back and says so.
 */
export function useTasks() {
  const { authenticatedApi } = useAuthenticatedApi()
  // Read through a ref so the callbacks below depend only on the API stub: the load effect hangs
  // off `refresh`, and a toast manager that is a fresh object per render would otherwise make
  // that effect re-run on every render, which is a loop.
  const toasts = useKumoToastManager()
  const toastsRef = useRef(toasts)
  toastsRef.current = toasts
  const [tasks, setTasks] = useState<TaskInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  // Serialises loads: a refresh started before an earlier one answered must not be overwritten by
  // that earlier, staler answer.
  const loadSeq = useRef(0)

  const reportFailure = useCallback((title: string, err: unknown) => {
    logRpcFailure(`${title}:`, err)
    // Connection loss is shown by the reconnecting chip and refetched on reconnect; anything else
    // is worth a toast.
    if (classifyRpcError(err) !== 'connection') {
      toastsRef.current.add({
        title, description: err instanceof Error ? err.message : undefined, variant: 'error',
      })
    }
  }, [])

  const refresh = useCallback(async () => {
    const seq = ++loadSeq.current
    try {
      const list = await authenticatedApi.listTasks()
      if (seq !== loadSeq.current) return
      setTasks(list)
      setFailed(false)
    } catch (err) {
      if (seq !== loadSeq.current) return
      setFailed(true)
      reportFailure("Couldn't load tasks", err)
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
  }, [authenticatedApi, reportFailure])

  useEffect(() => {
    setLoading(true)
    void refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      // Whatever is still in flight answers a component that no longer exists.
      loadSeq.current++
    }
  }, [refresh])

  const createTask = useCallback(async (input: NewTaskInput): Promise<boolean> => {
    try {
      const created = await authenticatedApi.createTask(input)
      setTasks((prev) => [...prev, created])
      return true
    } catch (err) {
      reportFailure("Couldn't add the task", err)
      return false
    }
  }, [authenticatedApi, reportFailure])

  const updateTask = useCallback(async (task: TaskInfo, patch: TaskPatch): Promise<boolean> => {
    // Optimistic: show the change now, reconcile with the server's row when it lands.
    const now = new Date()
    const optimistic: TaskInfo = {
      ...task,
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.notes !== undefined && { notes: patch.notes }),
      ...(patch.priority !== undefined && { priority: patch.priority }),
      ...(patch.dueDate !== undefined && { dueDate: patch.dueDate }),
      ...(patch.tag !== undefined && { tag: patch.tag }),
      ...(patch.status !== undefined && {
        status: patch.status,
        completedAt: patch.status === 'done' ? (task.completedAt ?? now) : null,
      }),
      updatedAt: now,
    }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? optimistic : t)))
    try {
      const updated = await authenticatedApi.updateTask(task.id, patch)
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
      return true
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)))
      reportFailure("Couldn't update the task", err)
      return false
    }
  }, [authenticatedApi, reportFailure])

  const deleteTask = useCallback(async (task: TaskInfo): Promise<boolean> => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
    try {
      await authenticatedApi.deleteTask(task.id)
      return true
    } catch (err) {
      setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [...prev, task]))
      reportFailure("Couldn't delete the task", err)
      return false
    }
  }, [authenticatedApi, reportFailure])

  const clearCompleted = useCallback(async (): Promise<boolean> => {
    const before = tasks
    setTasks((prev) => prev.filter((t) => t.status !== 'done'))
    try {
      await authenticatedApi.clearCompletedTasks()
      return true
    } catch (err) {
      setTasks(before)
      reportFailure("Couldn't clear completed tasks", err)
      return false
    }
  }, [authenticatedApi, reportFailure, tasks])

  return { tasks, loading, failed, refresh, createTask, updateTask, deleteTask, clearCompleted }
}

export type TasksApi = ReturnType<typeof useTasks>
