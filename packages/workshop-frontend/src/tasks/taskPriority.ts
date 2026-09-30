import type { TaskPriority } from '@gadgets/workshop-shared/api'

/** The word shown beside a priority's flag. */
export const PRIORITY_LABEL: Record<TaskPriority, string> = { high: 'High', medium: 'Medium', low: 'Low' }

/**
 * The flag's colour is the priority's whole meaning at a glance: red, amber, blue, as in the
 * reference design.
 */
export const PRIORITY_CLASS: Record<TaskPriority, string> = {
  high: 'text-kumo-danger',
  medium: 'text-kumo-warning',
  low: 'text-kumo-info',
}
