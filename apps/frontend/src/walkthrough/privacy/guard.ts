import { ChatError } from '../chat/chat_types'
import type { ChatReply } from '../chat/chat_types'
import { detectLayer1, resolveSpans } from './detectors'
import { parseFuzzySpans } from './fuzzy'
import type { FuzzyDetector, FuzzyStatus } from './fuzzy'
import { PlaceholderSession } from './tokenize'
import type { PiiSpan, PiiType, Redaction } from './types'
import { EncryptedVault } from './vault'
import type { Intake } from './vault'

/** Thrown instead of sending when the final scan still finds something PII-shaped. Never contains the value. */
export class PiiBlockedError extends ChatError {
  /** What kinds of information were found (never the values). */
  readonly types: PiiType[]

  constructor(types: PiiType[]) {
    super(
      'pii_blocked',
      'Your message looks like it contains personal information (such as an ID number, phone number or date of birth) that could not be hidden safely, so it was not sent. Please remove it and try again.',
    )
    this.name = 'PiiBlockedError'
    this.types = types
  }
}

/** Whether Layer 2 helped with one message. */
export type Layer2Outcome = 'used' | 'skipped' | 'failed' | 'off'

/** One line of "What left your device". It never holds a real value. */
export type AuditEntry = {
  id: number
  /** ISO 8601 time. */
  timestamp: string
  status: 'sent' | 'blocked'
  /** Exactly what was handed to the chat backend. Null when the message was blocked and nothing was sent. */
  sentText: string | null
  redactions: Redaction[]
  /** For blocked messages: the kinds that remained. */
  blockedTypes: PiiType[]
  layer2: Layer2Outcome
}

export type PrivacyStatus = {
  vault: 'initializing' | 'ready' | 'unavailable'
  /** True when an intake form is saved in the vault. */
  hasIntake: boolean
  /** "disabled" when no Layer 2 detector was configured. */
  fuzzy: FuzzyStatus | 'disabled'
  /** The line for the UI. */
  summary: string
  /** A longer, honest explanation of the current state. */
  detail: string
}

export type PiiGuardOptions = {
  /** Where the encrypted intake and session table live. Omit for a guard without persistence. */
  vault?: EncryptedVault
  /** Layer 2. Omit to run on deterministic rules only. */
  fuzzy?: FuzzyDetector
  /** Layer 2 is abandoned for a message after this many ms. Default 2000. */
  fuzzyTimeoutMs?: number
  /** Test seam: replaces the Layer 1 detector used for redaction. The final scan always uses the real one. */
  layer1?: (text: string, knownNames: readonly string[]) => PiiSpan[]
  maxAuditEntries?: number
  now?: () => Date
}

/** The message after redaction. */
export type ProtectedMessage = { text: string; redactions: Redaction[]; auditId: number }

export const PRIVACY_SUMMARY = 'Privacy: on-device vault, AI sees placeholders'

function fuzzyUsable(fuzzy: FuzzyDetector | undefined): fuzzy is FuzzyDetector {
  return fuzzy !== undefined && (fuzzy.status === undefined || fuzzy.status === 'ready')
}

/** Combines the layers. Rules win overlaps; model spans only fill in what rules did not cover. */
export function mergeSpans(rules: readonly PiiSpan[], model: readonly PiiSpan[], text: string): PiiSpan[] {
  const merged: PiiSpan[] = rules.map((s) => ({ ...s }))
  for (const candidate of [...model].sort((a, b) => a.start - b.start)) {
    // Same-type overlap: widen the rule span ("Jane" found by rules, "Jane Doe" by the model).
    const sameType = merged.find((s) => s.type === candidate.type && candidate.start <= s.end && s.start <= candidate.end)
    if (sameType) {
      sameType.start = Math.min(sameType.start, candidate.start)
      sameType.end = Math.max(sameType.end, candidate.end)
      continue
    }
    // Different type: keep only the parts no other span covers.
    let pieces: [number, number][] = [[candidate.start, candidate.end]]
    for (const s of merged) {
      pieces = pieces.flatMap(([a, b]): [number, number][] => {
        if (s.end <= a || s.start >= b) return [[a, b]]
        const left: [number, number][] = s.start > a ? [[a, s.start]] : []
        const right: [number, number][] = s.end < b ? [[s.end, b]] : []
        return [...left, ...right]
      })
    }
    for (const [a, b] of pieces) if (b - a >= 2) merged.push({ ...candidate, start: a, end: b })
  }
  // Widening can make spans touch; resolve again so none overlap.
  return resolveSpans(merged, text)
}

/**
 * The privacy layer. Create one with `createPiiGuard`, wrap a chat client with `guardedChatClient`, and
 * use the rest to build the UI. Nothing here is React-specific.
 */
export interface PiiGuard {
  /**
   * Live highlighting. Returns Layer 1 spans immediately. When the on-device model is ready it also checks in
   * the background and calls `onUpdate` with the merged spans; ignore the call if the text has changed since.
   */
  analyze(text: string, onUpdate?: (spans: PiiSpan[]) => void): PiiSpan[]
  /** Layer 1 plus Layer 2 (when usable), the same spans a send would redact. */
  analyzeFull(text: string): Promise<PiiSpan[]>

  /**
   * Redacts `text` for sending: detect, tokenize, final scan, audit.
   * @throws PiiBlockedError when the final scan still finds PII-shaped text (the audit log records it)
   */
  protect(text: string): Promise<ProtectedMessage>
  /** Fills placeholders in `text` from the local session table. Unknown placeholders stay unchanged. */
  rehydrate(text: string): string
  /** Rehydrates every text field of a reply that reaches the screen. Returns a copy. */
  rehydrateReply(reply: ChatReply): ChatReply

  /** The audit trail behind "What left your device". Entries never contain real values. */
  readonly auditLog: {
    entries(): readonly AuditEntry[]
    /** Calls `listener` after every change. Returns an unsubscribe function. */
    subscribe(listener: () => void): () => void
    clear(): void
  }

  /** The intake form, kept encrypted on this device. */
  readonly vault: {
    saveIntake(intake: Intake): Promise<void>
    /** The saved intake, for pre-filling the form on this device. */
    loadIntake(): Promise<Intake | null>
    /** Deletes the key, the intake, and this session's placeholder table. */
    clear(): Promise<void>
  }

  /** Current status. The object only changes identity when something changed (safe for useSyncExternalStore). */
  getStatus(): PrivacyStatus
  subscribeStatus(listener: () => void): () => void
  /** Starts downloading and compiling the on-device model (does nothing without a Layer 2 detector). */
  startFuzzy(): void
  /** Resolves once the vault has been read at startup. */
  readonly ready: Promise<void>
  dispose(): void
}

export function createPiiGuard(options: PiiGuardOptions = {}): PiiGuard {
  const { vault, fuzzy } = options
  const layer1 = options.layer1 ?? detectLayer1
  const fuzzyTimeoutMs = options.fuzzyTimeoutMs ?? 2000
  const maxEntries = options.maxAuditEntries ?? 200
  const now = options.now ?? (() => new Date())
  const session = new PlaceholderSession()
  const audit: AuditEntry[] = []
  const auditListeners = new Set<() => void>()
  const statusListeners = new Set<() => void>()
  let knownNames: string[] = []
  let nextAuditId = 1
  let vaultState: PrivacyStatus['vault'] = vault?.supported ? 'initializing' : 'unavailable'
  let hasIntake = false
  let status = computeStatus()

  function computeStatus(): PrivacyStatus {
    const fuzzyState = fuzzy ? (fuzzy.status ?? 'ready') : 'disabled'
    const detail =
      `Your name, date of birth and ID numbers are replaced with placeholders before a question leaves this device. ` +
      (vaultState === 'ready'
        ? 'Your details are stored encrypted in this browser. '
        : vaultState === 'initializing'
          ? 'The on-device vault is starting. '
          : 'The on-device vault is unavailable, so details are kept in memory only. ') +
      (fuzzyState === 'ready'
        ? 'An on-device model also looks for names the rules miss.'
        : fuzzyState === 'loading'
          ? 'The on-device name finder is loading; until then only fixed rules apply.'
          : fuzzyState === 'unavailable'
            ? 'The on-device name finder is unavailable; only fixed rules apply.'
            : 'Only fixed rules apply.')
    return { vault: vaultState, hasIntake, fuzzy: fuzzyState, summary: PRIVACY_SUMMARY, detail }
  }

  function refreshStatus(): void {
    const next = computeStatus()
    if (next.vault === status.vault && next.hasIntake === status.hasIntake && next.fuzzy === status.fuzzy) return
    status = next
    for (const listener of statusListeners) listener()
  }

  const unsubscribeFuzzy = fuzzy?.subscribe?.(refreshStatus)

  function setNames(intake: Intake | null): void {
    knownNames = intake
      ? [intake.firstName, intake.lastName, `${intake.firstName} ${intake.lastName}`].map((n) => n.trim()).filter((n) => n.length >= 2)
      : []
    hasIntake = intake !== null
  }

  const ready = (async () => {
    if (!vault?.supported) return
    try {
      setNames(await vault.loadIntake())
      session.restore(await vault.getRecord('session'))
      vaultState = 'ready'
    } catch {
      vaultState = 'unavailable'
    }
    refreshStatus()
  })()

  function record(entry: Omit<AuditEntry, 'id' | 'timestamp'>): number {
    const id = nextAuditId++
    audit.push({ ...entry, id, timestamp: now().toISOString() })
    if (audit.length > maxEntries) audit.splice(0, audit.length - maxEntries)
    for (const listener of auditListeners) listener()
    return id
  }

  /** Runs Layer 2 with a timeout. Never throws: any failure means "no extra spans". */
  async function runFuzzy(text: string): Promise<{ spans: PiiSpan[]; outcome: Layer2Outcome }> {
    if (!fuzzy) return { spans: [], outcome: 'off' }
    if (!fuzzyUsable(fuzzy)) return { spans: [], outcome: 'skipped' }
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const raw = await Promise.race([
        fuzzy.detect(text),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), fuzzyTimeoutMs)
        }),
      ])
      return { spans: parseFuzzySpans(raw, text.length), outcome: 'used' }
    } catch {
      return { spans: [], outcome: 'failed' }
    } finally {
      clearTimeout(timer)
    }
  }

  function rehydrateText(text: string): string {
    return session.rehydrate(text)
  }

  const guard: PiiGuard = {
    ready,

    analyze(text, onUpdate) {
      const rules = layer1(text, knownNames)
      if (onUpdate && fuzzyUsable(fuzzy)) {
        void runFuzzy(text).then(({ spans, outcome }) => {
          if (outcome === 'used') onUpdate(mergeSpans(rules, spans, text))
        })
      }
      return rules
    },

    async analyzeFull(text) {
      const rules = layer1(text, knownNames)
      const { spans } = await runFuzzy(text)
      return mergeSpans(rules, spans, text)
    },

    async protect(text) {
      await ready
      const rules = layer1(text, knownNames)
      const { spans, outcome } = await runFuzzy(text)
      const merged = mergeSpans(rules, spans, text)
      const { text: redacted, redactions } = session.tokenize(text, merged)

      // Fail closed: scan the exact outgoing text again with the real deterministic detectors.
      const residual = detectLayer1(redacted, knownNames)
      if (residual.length > 0) {
        const types = [...new Set(residual.map((s) => s.type))]
        record({ status: 'blocked', sentText: null, redactions, blockedTypes: types, layer2: outcome })
        throw new PiiBlockedError(types)
      }

      const auditId = record({ status: 'sent', sentText: redacted, redactions, blockedTypes: [], layer2: outcome })
      if (vault && vaultState === 'ready' && redactions.length > 0) {
        void vault.putRecord('session', session.snapshot()).catch(() => undefined)
      }
      return { text: redacted, redactions, auditId }
    },

    rehydrate: rehydrateText,

    rehydrateReply(reply) {
      const { response } = reply
      return {
        response: {
          ...response,
          message: rehydrateText(response.message),
          safety: rehydrateText(response.safety),
          doctor_question: rehydrateText(response.doctor_question),
          side_panel: response.side_panel
            ? { ...response.side_panel, title: rehydrateText(response.side_panel.title), body_markdown: rehydrateText(response.side_panel.body_markdown) }
            : null,
        },
        followUps: reply.followUps.map(rehydrateText),
      }
    },

    auditLog: {
      entries: () => audit,
      subscribe(listener) {
        auditListeners.add(listener)
        return () => auditListeners.delete(listener)
      },
      clear() {
        audit.length = 0
        for (const listener of auditListeners) listener()
      },
    },

    vault: {
      async saveIntake(intake) {
        if (!vault?.supported) throw new ChatError('vault_unavailable', 'The on-device vault is not available in this browser.')
        await vault.saveIntake(intake)
        setNames(intake)
        vaultState = 'ready'
        refreshStatus()
      },
      async loadIntake() {
        return vault?.supported ? vault.loadIntake() : null
      },
      async clear() {
        session.clear()
        setNames(null)
        await vault?.clear()
        refreshStatus()
      },
    },

    getStatus: () => status,
    subscribeStatus(listener) {
      statusListeners.add(listener)
      return () => statusListeners.delete(listener)
    },
    startFuzzy: () => fuzzy?.start?.(),
    dispose() {
      unsubscribeFuzzy?.()
      fuzzy?.dispose?.()
      auditListeners.clear()
      statusListeners.clear()
    },
  }
  return guard
}
