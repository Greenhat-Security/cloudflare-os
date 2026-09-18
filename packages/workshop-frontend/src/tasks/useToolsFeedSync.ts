import { useEffect, useRef } from 'react'
import { useAuthenticatedApi } from '../AuthContext'
import { fetchToolsFeed, groupFeedRows } from './toolsFeed'

// A tab left open re-reads the feed when it comes back into view, but not more often than this:
// the feed is the tools' database and every read ends in a write to the user's Durable Object,
// even if it is a no-op.
const MIN_INTERVAL_MS = 60_000

/**
 * Keep the user's list in step with the Green Hat tools' feed (Green Hat fork): on mount and
 * whenever the tab becomes visible again, read the feed with the browser's session and relay each
 * module's tasks over RPC, then let the caller reload the list. Quiet by design: a feed that is
 * unreachable or refuses is not an error the user can act on here.
 */
export function useToolsFeedSync(onSynced: () => void) {
  const { authenticatedApi } = useAuthenticatedApi()
  const lastSyncAt = useRef(0)
  const onSyncedRef = useRef(onSynced)
  onSyncedRef.current = onSynced

  useEffect(() => {
    // The tools answer only the deployed OS origin; a dev build on localhost would just fill the
    // console with CORS refusals.
    if (window.location.protocol !== 'https:') return
    let cancelled = false
    let inFlight = false

    const sync = async () => {
      if (inFlight || Date.now() - lastSyncAt.current < MIN_INTERVAL_MS) return
      inFlight = true
      try {
        const rows = await fetchToolsFeed()
        if (rows === null || cancelled) return
        lastSyncAt.current = Date.now()
        let changed = false
        for (const group of groupFeedRows(rows)) {
          const counts = await authenticatedApi.syncTasks(
            group.source, group.sourceLabel, group.tasks, true)
          if (cancelled) return
          if (counts.created || counts.updated || counts.removed) changed = true
        }
        if (changed) onSyncedRef.current()
      } catch (err) {
        // The list stays as it was; the next visit tries again.
        console.debug('Task feed sync skipped:', err)
      } finally {
        inFlight = false
      }
    }

    void sync()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [authenticatedApi])
}
