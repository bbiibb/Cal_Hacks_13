import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { AuditEntry, PiiGuard, PiiSpan, PrivacyStatus } from '../privacy'

/** The guard's status, kept in step with `getStatus()` (its identity only changes when something changed). */
export function usePrivacyStatus(guard: PiiGuard): PrivacyStatus {
  return useSyncExternalStore(guard.subscribeStatus, guard.getStatus)
}

/**
 * The audit entries. The guard mutates its array in place, so this keeps a copy that is replaced after
 * every change, which is what `useSyncExternalStore` needs to notice an update.
 */
export function useAuditEntries(guard: PiiGuard): readonly AuditEntry[] {
  const version = useRef(0)
  const cache = useRef<{ version: number; list: readonly AuditEntry[] }>({ version: -1, list: [] })

  const subscribe = useCallback(
    (onChange: () => void) =>
      guard.auditLog.subscribe(() => {
        version.current += 1
        onChange()
      }),
    [guard],
  )
  const getSnapshot = useCallback(() => {
    // Entries may have been added before the subscription started, so compare lengths as well
    if (cache.current.version !== version.current || cache.current.list.length !== guard.auditLog.entries().length) {
      cache.current = { version: version.current, list: [...guard.auditLog.entries()] }
    }
    return cache.current.list
  }, [guard])
  return useSyncExternalStore(subscribe, getSnapshot)
}

/**
 * Spans for the draft being typed. Layer 1 spans are computed right away on every change; when the
 * on-device model is ready its merged answer replaces them shortly after typing pauses. An answer for
 * older text is never shown.
 */
export function useDraftSpans(guard: PiiGuard, text: string, modelDelayMs = 300): PiiSpan[] {
  const rules = useMemo(() => guard.analyze(text), [guard, text])
  const [merged, setMerged] = useState<{ text: string; spans: PiiSpan[] } | null>(null)

  useEffect(() => {
    if (text === '') return
    let current = true
    const timer = setTimeout(() => {
      guard.analyze(text, (spans) => {
        if (current) setMerged({ text, spans })
      })
    }, modelDelayMs)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [guard, text, modelDelayMs])

  return merged !== null && merged.text === text ? merged.spans : rules
}
