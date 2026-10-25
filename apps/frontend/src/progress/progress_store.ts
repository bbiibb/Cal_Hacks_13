import { useSyncExternalStore } from 'react'
import { DbConnection, tables } from './module_bindings'
import type { ProgressRecord } from './progress_helpers'

/**
 * Connection to the SpacetimeDB progress module (packages/progress).
 *
 * - The identity is anonymous: the server hands out a token, and we keep it in localStorage so
 *   the same browser gets the same progress back. No names or personal details are sent.
 * - Progress is optional. If the server is unreachable or the database does not exist, nothing
 *   is shown and nothing breaks; we keep retrying quietly with a growing delay.
 */

export type ProgressStatus =
  /** Not started, or waiting to try again. */
  | 'offline'
  | 'connecting'
  /** Connected and the first copy of the person's progress has arrived. */
  | 'live'

export type ProgressState = {
  status: ProgressStatus
  /** Saved progress by procedure slug. */
  records: Readonly<Record<string, ProgressRecord>>
}

const URI = import.meta.env.VITE_SPACETIME_URI || 'ws://127.0.0.1:3000'
const DATABASE = import.meta.env.VITE_SPACETIME_DB || 'ask-ray-progress'
const TOKEN_KEY = `ask-ray-progress-token:${URI}:${DATABASE}`

const RETRY_FIRST_MS = 2_000
const RETRY_MAX_MS = 60_000

let state: ProgressState = { status: 'offline', records: {} }
const listeners = new Set<() => void>()

let started = false
let connection: DbConnection | null = null
let retryTimer: ReturnType<typeof setTimeout> | undefined
let retryDelay = RETRY_FIRST_MS
/** Saves made while offline. Only the latest step per procedure matters. */
const pendingSaves = new Map<string, { stepIndex: number; totalSteps: number }>()

function setState(next: Partial<ProgressState>) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

function readToken(): string | undefined {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? undefined
  } catch {
    return undefined
  }
}

function writeToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Private windows or blocked storage: progress then lasts only for this tab
  }
}

function scheduleRetry() {
  if (retryTimer !== undefined) return
  retryTimer = setTimeout(() => {
    retryTimer = undefined
    connect()
  }, retryDelay)
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS)
}

function goOffline() {
  connection = null
  setState({ status: 'offline', records: {} })
  scheduleRetry()
}

function readRecords(conn: DbConnection): Record<string, ProgressRecord> {
  const records: Record<string, ProgressRecord> = {}
  for (const row of conn.db.myProgress.iter()) {
    records[row.procedureSlug] = {
      procedureSlug: row.procedureSlug,
      currentStep: row.currentStep,
      viewedSteps: [...row.viewedSteps].sort((a, b) => a - b),
      updatedAtMs: Number(row.updatedAt.microsSinceUnixEpoch / 1000n),
    }
  }
  return records
}

function flushPending(conn: DbConnection) {
  for (const [procedureSlug, { stepIndex, totalSteps }] of pendingSaves) {
    send(conn, procedureSlug, stepIndex, totalSteps)
  }
  pendingSaves.clear()
}

function send(conn: DbConnection, procedureSlug: string, stepIndex: number, totalSteps: number) {
  try {
    // The call may return a promise; a rejected save is not worth interrupting anyone for
    void Promise.resolve(conn.reducers.saveProgress({ procedureSlug, stepIndex, totalSteps })).catch(() => {})
  } catch {
    // Progress is a nice-to-have
  }
}

function connect() {
  if (connection) return
  setState({ status: 'connecting' })
  try {
    const conn = DbConnection.builder()
      .withUri(URI)
      .withDatabaseName(DATABASE)
      .withToken(readToken())
      .withAutomaticReconnect()
      .onConnect((c, _identity, token) => {
        writeToken(token)
        const refresh = () => {
          if (connection === c) setState({ records: readRecords(c) })
        }
        c.db.myProgress.onInsert(refresh)
        c.db.myProgress.onUpdate(refresh)
        c.db.myProgress.onDelete(refresh)
        c.subscriptionBuilder()
          .onApplied(() => {
            if (connection !== c) return
            retryDelay = RETRY_FIRST_MS
            setState({ status: 'live', records: readRecords(c) })
            flushPending(c)
          })
          // For example the database exists but has a different module
          .onError(() => {
            if (connection !== c) return
            goOffline()
            c.disconnect()
          })
          .subscribe(tables.myProgress)
      })
      .onConnectError(() => {
        if (connection === conn) goOffline()
      })
      .onDisconnect((_ctx, _error, nextReconnectAttempt) => {
        if (connection !== conn) return
        if (nextReconnectAttempt === undefined) {
          goOffline()
        } else {
          // The SDK is reconnecting by itself; hide stale data meanwhile
          setState({ status: 'connecting', records: {} })
        }
      })
      .onAutomaticReconnect(() => {
        // The subscription is kept by the SDK; refresh from the local copy
        if (connection === conn) setState({ status: 'live', records: readRecords(conn) })
      })
      .build()
    connection = conn
  } catch {
    goOffline()
  }
}

/** Starts the connection once. Safe to call from any component, any number of times. */
export function startProgress() {
  if (started || typeof window === 'undefined') return
  started = true
  connect()
}

/** Remembers that the person is now looking at `stepIndex`. Sent right away, or when the connection is ready. */
export function saveProgress(procedureSlug: string, stepIndex: number, totalSteps: number) {
  startProgress()
  if (connection && state.status === 'live') {
    send(connection, procedureSlug, stepIndex, totalSteps)
  } else {
    pendingSaves.set(procedureSlug, { stepIndex, totalSteps })
  }
}

/** Forgets the person's progress in one procedure. */
export function resetProgress(procedureSlug: string) {
  pendingSaves.delete(procedureSlug)
  if (!connection || state.status !== 'live') return
  try {
    void Promise.resolve(connection.reducers.resetProgress({ procedureSlug })).catch(() => {})
  } catch {
    // Nothing to do: the card simply stays
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The connection state and the saved progress. Starts the connection on first use. */
export function useProgress(): ProgressState {
  startProgress()
  return useSyncExternalStore(subscribe, () => state, () => state)
}
