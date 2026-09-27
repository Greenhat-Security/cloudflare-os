import { describe, expect, it, vi } from 'vitest'
import { TOOLS_FEED_URL, fetchToolsFeed, groupFeedRows } from './toolsFeed'

// The shape `/api/my-tasks` in greenhat_tools returns (see app/api/my-tasks/route.ts there).
const FEED = [
  {
    id: 'exp-1', identifier: 'EXP-12', task_sequence: 12, title: 'Ship the v2 board',
    status: 'in_progress', updated_at: '2026-09-16T18:30:00.000Z', created_at: '2026-09-01T00:00:00.000Z',
    due_at: '2026-09-19T00:00:00.000Z', project_id: 'p1', project_name: 'Exponential v2',
    team_name: 'Platform', module: 'exponential',
  },
  {
    id: 'crm-7', identifier: null, title: 'Call Archie', status: 'open',
    updated_at: '2026-09-17T09:00:00.000Z', created_at: null, due_at: '2026-09-18T00:00:00.000Z',
    project_id: null, project_name: 'GreenSpot', team_name: 'GreenSpot', module: 'greenspot',
  },
  {
    id: 'gt-3', identifier: null, title: '  Draft the trust page  ', status: 'todo',
    updated_at: 'not a date', created_at: null, due_at: null, project_id: null,
    project_name: 'Greentype', team_name: 'Greentype', module: 'greentype',
  },
  { id: 'x-1', title: 'From a module this side does not know', module: 'matrix' },
  { id: '', title: 'No id', module: 'exponential' },
  { id: 'exp-2', title: '   ', module: 'exponential' },
  'not a row',
]

describe('groupFeedRows', () => {
  it('maps every known module, skipping rows it cannot place', () => {
    const groups = groupFeedRows(FEED)
    expect(groups.map((g) => [g.source, g.sourceLabel, g.tasks.length])).toEqual([
      ['exponential', 'GreenPM', 1],
      ['greenspot', 'GreenSpot', 1],
      ['greentype', 'Greentype', 1],
    ])
    const [exp, spot, type] = groups
    expect(exp.tasks[0]).toEqual({
      externalId: 'exp-1',
      title: 'Ship the v2 board',
      status: 'open',
      dueDate: '2026-09-19',
      tag: 'Exponential v2',
      url: 'https://pm.greenhatsec.com/exponential/tasks/exp-1',
      notes: 'EXP-12 · Exponential v2',
      updatedAt: '2026-09-16T18:30:00.000Z',
    })
    expect(spot.tasks[0]).toMatchObject({
      externalId: 'crm-7', tag: null, url: 'https://tools.greenhatsec.com/greenspot/tasks/crm-7',
      dueDate: '2026-09-18', notes: 'GreenSpot',
    })
    expect(type.tasks[0]).toMatchObject({
      externalId: 'gt-3', title: 'Draft the trust page', dueDate: null, tag: null,
      url: 'https://tools.greenhatsec.com/greentype',
    })
    expect('updatedAt' in type.tasks[0]).toBe(false)
  })

  it('returns every module even for an empty or malformed feed, so replacing clears them', () => {
    expect(groupFeedRows([]).map((g) => g.tasks.length)).toEqual([0, 0, 0])
    expect(groupFeedRows({ nope: true }).map((g) => g.source)).toEqual(['exponential', 'greenspot', 'greentype'])
  })

  it('treats closed statuses as done', () => {
    const [exp] = groupFeedRows([{ id: 'a', title: 'x', module: 'exponential', status: 'Done' }])
    expect(exp.tasks[0].status).toBe('done')
  })
})

describe('fetchToolsFeed', () => {
  it('reads the feed with the browser session and hands back its rows', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ tasks: FEED, count: FEED.length }), { status: 200 }))
    await expect(fetchToolsFeed(fetchImpl)).resolves.toHaveLength(FEED.length)
    expect(fetchImpl).toHaveBeenCalledWith(TOOLS_FEED_URL, expect.objectContaining({ credentials: 'include' }))
  })

  it('is null, not empty, when the tools refuse or cannot be reached', async () => {
    await expect(fetchToolsFeed(async () => new Response('nope', { status: 401 }))).resolves.toBeNull()
    await expect(fetchToolsFeed(async () => { throw new TypeError('Failed to fetch') })).resolves.toBeNull()
    await expect(fetchToolsFeed(async () => new Response('{}', { status: 200 }))).resolves.toBeNull()
  })
})
