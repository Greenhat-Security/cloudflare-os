import { describe, expect, it } from 'vitest'
import type { TaskInfo } from '@gadgets/workshop-shared/api'
import {
  addDays,
  daysBetween,
  describeDueDate,
  describeTaskSource,
  groupTasks,
  localDateKey,
} from './taskGrouping'

const TODAY = '2026-09-17'
let seq = 0

function task(overrides: Partial<TaskInfo>): TaskInfo {
  const updatedAt = new Date(2026, 8, 1, 0, 0, seq++)
  return {
    id: `t${seq}`,
    title: `Task ${seq}`,
    notes: '',
    status: 'open',
    priority: null,
    dueDate: null,
    tag: null,
    source: 'os',
    sourceLabel: null,
    url: null,
    createdAt: updatedAt,
    updatedAt,
    completedAt: null,
    ...overrides,
  }
}

describe('date keys', () => {
  it('formats local calendar days and walks them', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-09-17', '2026-09-20')).toBe(3)
    expect(daysBetween('2026-09-17', '2026-09-10')).toBe(-7)
  })

  it('names near days and dates far ones', () => {
    expect(describeDueDate(TODAY, TODAY)).toEqual({ label: 'Today', overdue: false })
    expect(describeDueDate('2026-09-18', TODAY)).toEqual({ label: 'Tomorrow', overdue: false })
    expect(describeDueDate('2026-09-16', TODAY)).toEqual({ label: 'Yesterday', overdue: true })
    expect(describeDueDate('2026-09-10', TODAY).overdue).toBe(true)
    expect(describeDueDate('2026-09-19', TODAY).label).toMatch(/^[A-Z][a-z]{2}$/)
    expect(describeDueDate('2026-10-05', TODAY).label).not.toMatch(/2026/)
    expect(describeDueDate('2027-01-05', TODAY).label).toMatch(/2027/)
  })
})

describe('groupTasks', () => {
  const overdue = task({ title: 'Overdue', dueDate: '2026-09-10', priority: 'low' })
  const todayHigh = task({ title: 'Today high', dueDate: TODAY, priority: 'high' })
  const todayNone = task({ title: 'Today none', dueDate: TODAY })
  const friday = task({ title: 'Friday', dueDate: '2026-09-18' })
  const threeWeeks = task({ title: 'Three weeks', dueDate: '2026-10-08' })
  const nextMonth = task({ title: 'Next month', dueDate: '2026-10-20' })
  const somedayHigh = task({ title: 'Someday high', priority: 'high' })
  const somedayOld = task({ title: 'Someday old', updatedAt: new Date(2025, 0, 1) })
  const done = task({ title: 'Done', status: 'done', completedAt: new Date(2026, 8, 16) })
  const doneLater = task({ title: 'Done later', status: 'done', completedAt: new Date(2026, 8, 17) })
  const all = [
    somedayOld, done, nextMonth, todayNone, friday, threeWeeks, doneLater, somedayHigh, overdue, todayHigh,
  ]

  it('puts overdue and today first, then upcoming, someday and completed', () => {
    const groups = groupTasks(all, TODAY, 'today')
    expect(groups.map((g) => [g.id, g.label, g.tasks.map((t) => t.title)])).toEqual([
      ['now', 'Today', ['Overdue', 'Today high', 'Today none']],
      ['upcoming', 'Upcoming', ['Friday', 'Three weeks', 'Next month']],
      ['someday', 'Someday', ['Someday high', 'Someday old']],
      ['completed', 'Completed', ['Done later', 'Done']],
    ])
  })

  it('widens the first section with the horizon', () => {
    const week = groupTasks(all, TODAY, 'week')
    expect(week[0].label).toBe('This week')
    expect(week[0].tasks.map((t) => t.title)).toEqual(['Overdue', 'Today high', 'Today none', 'Friday'])
    expect(week[1].tasks.map((t) => t.title)).toEqual(['Three weeks', 'Next month'])
    const month = groupTasks(all, TODAY, 'month')
    expect(month[0].label).toBe('This month')
    expect(month[0].tasks.map((t) => t.title))
      .toEqual(['Overdue', 'Today high', 'Today none', 'Friday', 'Three weeks'])
    expect(month[1].tasks.map((t) => t.title)).toEqual(['Next month'])
  })

  it('returns every section even when empty', () => {
    expect(groupTasks([], TODAY, 'today').map((g) => g.tasks.length)).toEqual([0, 0, 0, 0])
  })
})

describe('describeTaskSource', () => {
  it('prefers the importer label and otherwise titles the slug', () => {
    expect(describeTaskSource(task({ source: 'crm', sourceLabel: 'Green Hat CRM' }))).toBe('Green Hat CRM')
    expect(describeTaskSource(task({ source: 'daisy-notes' }))).toBe('Daisy Notes')
  })
})
