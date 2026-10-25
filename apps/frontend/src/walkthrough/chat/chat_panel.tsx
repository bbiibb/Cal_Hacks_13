import { memo, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Procedure } from '@cal-hacks/shared'
import type { ChatClient, ChatResponse, ChatSpeed, SceneAction } from './chat_types'
import { ChatError, MAX_CHAT_MESSAGE_LENGTH } from './chat_types'
import { STARTER_QUESTIONS } from './follow_ups'
import { canRecordVoice, MAX_RECORDING_MS, VoiceError, VoiceRecorder } from './voice_recorder'
import type { PiiGuard } from '../privacy'
import { PiiBlockedError } from '../privacy'
import PrivacyDock from './privacy_dock'
import PrivacyInput from './privacy_input'
import SpeedToggle from './speed_toggle'
import styles from './chat_panel.module.css'
import privacyStyles from './privacy.module.css'

type Message =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; text: string; response?: ChatResponse; followUps: string[] }
  | { id: number; role: 'error'; text: string; retry: string | null }
  /** A question the privacy layer refused to send. It offers no retry and keeps no copy of the text. */
  | { id: number; role: 'blocked'; text: string }

type Props = {
  client: ChatClient
  /** The on-device privacy guard the client is wrapped with. Adds highlighting, the audit panel and the intake form. */
  guard?: PiiGuard
  procedure: Procedure
  /** The topic named in the panel title and the welcome text. Defaults to TAVR. */
  topic?: { name: string; welcome: string; starterQuestions: readonly string[]; placeholder: string }
  stepIndex: number
  /** The part the patient pinned, sent with each question as context. */
  selectedStructureId: string | null
  /** The part under the pointer in the 3D view, if any. */
  hoveredStructureId: string | null
  onUnpin: () => void
  /** Commands from an answer, to be applied to the 3D view. */
  onSceneActions: (actions: SceneAction[]) => void
  /** The patient clicked a part name. */
  onSelectStructure: (structureId: string) => void
  structureName: (structureId: string) => string
  structureInfo: (structureId: string) => { name: string; description: string } | null
}

const TAVR_TOPIC = {
  name: 'TAVR',
  welcome:
    'Hi! I can walk you through TAVR and its possible side effects. Ask a question, or tell me to move the view, for example "zoom in" or "go to step 3". Point at the 3D model to see what each part is.',
  starterQuestions: STARTER_QUESTIONS,
  placeholder: 'Ask about side effects, recovery, or a step…',
}

/** Friendly wording for the error codes the backend uses. */
function errorText(error: unknown): string {
  if (error instanceof ChatError) {
    if (error.code === 'llm_rate_limited') return 'The assistant is busy right now. Please try again in a moment.'
    if (error.code === 'llm_not_configured') {
      return 'The assistant is not set up on the server yet. If you chose fast mode, try slow mode instead.'
    }
    return error.message
  }
  return 'Something went wrong. Please try again.'
}

/** Friendly wording for a failed voice question. */
function voiceErrorText(error: unknown): string {
  if (error instanceof VoiceError) return error.message
  if (error instanceof ChatError) {
    if (error.code === 'no_speech_detected') {
      return "I couldn't hear a question. Try again a little closer to the microphone, or type it instead."
    }
    if (error.code === 'server_error' || error.code === 'upload_failed') {
      return 'Voice questions are not working right now. Please type your question instead.'
    }
  }
  return errorText(error)
}

/** 0:07 style time for the recording timer. */
function formatSeconds(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** Parts the answer highlighted, shown as buttons that focus the 3D view on them. */
function highlightedParts(response: ChatResponse): string[] {
  const ids = response.scene_actions.flatMap((a) => (a.type === 'highlight' && a.enabled ? a.structure_ids : []))
  const fromPanel = response.side_panel?.related_structure_ids ?? []
  return [...new Set([...ids, ...fromPanel])].slice(0, 6)
}

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n{2,}/)
        .filter((p) => p.trim() !== '')
        .map((p, i) => (
          <p key={i} className={styles.paragraph}>
            {p}
          </p>
        ))}
    </>
  )
}

function ChatPanel({
  client,
  guard,
  procedure,
  topic = TAVR_TOPIC,
  stepIndex,
  selectedStructureId,
  hoveredStructureId,
  onUnpin,
  onSceneActions,
  onSelectStructure,
  structureName,
  structureInfo,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: 'assistant', text: topic.welcome, followUps: [...topic.starterQuestions] },
  ])
  const [input, setInput] = useState('')
  const [speed, setSpeed] = useState<ChatSpeed>('slow')
  const [stepOpen, setStepOpen] = useState(true)
  const [pending, setPending] = useState(false)
  const [voice, setVoice] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const [seconds, setSeconds] = useState(0)
  const nextId = useRef(1)
  const logRef = useRef<HTMLDivElement>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const voiceSupported = client.askByVoice !== undefined
  const voiceAvailable = voiceSupported && canRecordVoice()
  const recorderRef = useRef(new VoiceRecorder()) // construction is cheap and touches nothing until start()
  const voiceBusy = useRef(false)
  // Release the microphone if the panel goes away mid-recording
  useEffect(() => {
    const active = recorderRef.current
    return () => active.cancel()
  }, [])

  // Count the seconds of a recording
  useEffect(() => {
    if (voice !== 'recording') return
    const timer = setInterval(() => setSeconds((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [voice])

  // Keep the newest message in view
  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])

  const step = procedure.steps[stepIndex]
  // Pointing at a part shows it; otherwise the pinned part stays on show
  const shownPartId = hoveredStructureId ?? selectedStructureId
  const shownPart = shownPartId ? structureInfo(shownPartId) : null
  const shownIsPinned = shownPartId !== null && shownPartId === selectedStructureId

  async function send(raw: string) {
    const message = raw.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH)
    if (message === '' || pending) return

    const userId = nextId.current++
    setMessages((list) => [...list, { id: userId, role: 'user', text: message }])
    setInput('')
    setPending(true)

    try {
      const { response, followUps } = await client.ask({
        speed,
        message,
        context: {
          procedure_slug: procedure.slug,
          step_index: stepIndex,
          selected_structure_id: selectedStructureId,
        },
      })
      if (!mounted.current) return
      setMessages((list) => [
        ...list,
        { id: nextId.current++, role: 'assistant', text: response.message, response, followUps },
      ])
      onSceneActions(response.scene_actions)
    } catch (error) {
      if (!mounted.current) return
      console.error('Chat: the question could not be answered', error)
      if (error instanceof PiiBlockedError) {
        // Drop the typed text from the log: it was not sent, and there is nothing to retry as is
        setMessages((list) => [
          ...list.map((m): Message => (m.id === userId ? { id: m.id, role: 'user', text: 'Message not sent (see below)' } : m)),
          { id: nextId.current++, role: 'blocked', text: error.message },
        ])
        return
      }
      setMessages((list) => [...list, { id: nextId.current++, role: 'error', text: errorText(error), retry: message }])
    } finally {
      if (mounted.current) setPending(false)
    }
  }

  function currentContext() {
    return { procedure_slug: procedure.slug, step_index: stepIndex, selected_structure_id: selectedStructureId }
  }

  async function submitVoice(audio: Blob) {
    if (!client.askByVoice || voiceBusy.current) return
    voiceBusy.current = true
    setVoice('transcribing')
    setPending(true)
    try {
      const { transcript, response, followUps } = await client.askByVoice(audio, currentContext(), speed)
      if (!mounted.current) return
      setMessages((list) => [
        ...list,
        { id: nextId.current++, role: 'user', text: transcript },
        { id: nextId.current++, role: 'assistant', text: response.message, response, followUps },
      ])
      onSceneActions(response.scene_actions)
    } catch (error) {
      if (!mounted.current) return
      console.error('Chat: the voice question could not be answered', error)
      setMessages((list) => [...list, { id: nextId.current++, role: 'error', text: voiceErrorText(error), retry: null }])
    } finally {
      voiceBusy.current = false
      if (mounted.current) {
        setPending(false)
        setVoice('idle')
      }
    }
  }

  // A recording that reaches the maximum length is sent as if the patient stopped it
  useEffect(() => {
    recorderRef.current.onAutoStop = (audio) => void submitVoice(audio)
  })

  async function toggleRecording() {
    const active = recorderRef.current
    if (pending) return
    if (voice === 'recording') {
      try {
        const audio = await active.stop()
        if (mounted.current) void submitVoice(audio) // ignored if the auto-stop already sent it
      } catch (error) {
        if (!mounted.current) return
        setVoice('idle')
        setMessages((list) => [...list, { id: nextId.current++, role: 'error', text: voiceErrorText(error), retry: null }])
      }
      return
    }
    try {
      await active.start()
      setSeconds(0)
      if (mounted.current) setVoice('recording')
    } catch (error) {
      if (!mounted.current) return
      setMessages((list) => [...list, { id: nextId.current++, role: 'error', text: voiceErrorText(error), retry: null }])
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void send(input)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter starts a new line
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send(input)
    }
  }

  const lastMessageId = messages[messages.length - 1]?.id
  const remaining = MAX_CHAT_MESSAGE_LENGTH - input.length

  return (
    <aside className={styles.panel} aria-label={`${topic.name} assistant`}>
      <header className={styles.header}>
        <h2 className={styles.title}>Ask about {topic.name}</h2>
        <span
          className={client.mode === 'live' ? styles.badgeLive : styles.badgeDemo}
          title={client.mode === 'live' ? 'Answers come from the assistant' : 'Prepared answers, no AI involved'}
        >
          {client.mode === 'live' ? 'Live' : 'Demo answers'}
        </span>
      </header>

      {step && (
        <section className={styles.step} aria-label="Current step">
          <div className={styles.stepHead}>
            <p className={styles.stepLabel}>
              Step {stepIndex} of {procedure.steps.length - 1}
            </p>
            <button
              type="button"
              className={styles.stepToggle}
              onClick={() => setStepOpen((open) => !open)}
              aria-expanded={stepOpen}
            >
              {stepOpen ? 'Hide details' : 'Show details'}
            </button>
          </div>
          <h3 className={styles.stepTitle}>{step.title}</h3>
          {stepOpen && <p className={styles.stepBody}>{step.side_panel.body_markdown}</p>}
          {stepOpen && step.side_panel.related_structure_ids.length > 0 && (
            <div className={styles.parts}>
              {step.side_panel.related_structure_ids.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={id === selectedStructureId ? styles.partChipActive : styles.partChip}
                  onClick={() => onSelectStructure(id)}
                >
                  {structureName(id)}
                </button>
              ))}
            </div>
          )}
          <div className={styles.partBox} aria-live="polite">
            {shownPart ? (
              <>
                <div className={styles.partHeader}>
                  <span className={styles.partName}>{shownPart.name}</span>
                  {shownIsPinned && (
                    <button type="button" className={styles.unpin} onClick={onUnpin}>
                      Unpin
                    </button>
                  )}
                </div>
                <p className={styles.partText} title={shownPart.description}>
                  {shownPart.description}
                </p>
              </>
            ) : (
              <p className={styles.partHint}>Point at the 3D model to see what each part is. Click to pin it.</p>
            )}
          </div>
        </section>
      )}

      <div className={styles.log} ref={logRef} role="log" aria-live="polite" aria-busy={pending}>
        {messages.map((m) => {
          if (m.role === 'user') {
            return (
              <div key={m.id} className={styles.userBubble}>
                {m.text}
              </div>
            )
          }
          if (m.role === 'blocked') {
            return (
              <div key={m.id} className={privacyStyles.blockedBubble} role="alert">
                <p className={privacyStyles.blockedTitle}>Not sent, to keep you private</p>
                <p className={privacyStyles.blockedText}>{m.text}</p>
              </div>
            )
          }
          if (m.role === 'error') {
            return (
              <div key={m.id} className={styles.errorBubble}>
                <p className={styles.paragraph}>{m.text}</p>
                {m.retry !== null && (
                  <button type="button" className={styles.retry} onClick={() => void send(m.retry!)} disabled={pending}>
                    Try again
                  </button>
                )}
              </div>
            )
          }

          const r = m.response
          const parts = r ? highlightedParts(r) : []
          return (
            <div key={m.id} className={styles.assistantBlock}>
              {r?.urgent && (
                <div className={styles.urgent} role="alert">
                  <strong>This may be an emergency.</strong> Call your local emergency number now (911 in the US).
                </div>
              )}
              <div className={styles.assistantBubble}>
                <Paragraphs text={m.text} />
              </div>
              {r && r.safety !== '' && !r.urgent && (
                <div className={styles.safety}>
                  <span className={styles.calloutLabel}>Good to know</span>
                  {r.safety}
                </div>
              )}
              {r && r.doctor_question !== '' && (
                <div className={styles.doctor}>
                  <span className={styles.calloutLabel}>Question for your care team</span>
                  {r.doctor_question}
                </div>
              )}
              {parts.length > 0 && (
                <div className={styles.parts}>
                  <span className={styles.partsLabel}>Shown in 3D:</span>
                  {parts.map((id) => (
                    <button key={id} type="button" className={styles.partChip} onClick={() => onSelectStructure(id)}>
                      {structureName(id)}
                    </button>
                  ))}
                </div>
              )}
              {r && r.sources.length > 0 && (
                <ul className={styles.sources}>
                  {r.sources.map((s, i) => (
                    <li key={i}>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.title}
                        </a>
                      ) : (
                        s.title
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {m.id === lastMessageId && m.followUps.length > 0 && !pending && (
                <div className={styles.followUps} aria-label="Suggested questions">
                  {m.followUps.map((q) => (
                    <button key={q} type="button" className={styles.followUp} onClick={() => void send(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {pending && (
          <div className={styles.typing} aria-label="The assistant is answering">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      <form className={styles.composer} onSubmit={handleSubmit}>
        <label htmlFor="tavi-chat-input" className={styles.visuallyHidden}>
          Your question
        </label>
        {guard ? (
          <PrivacyInput
            id="tavi-chat-input"
            value={input}
            onChange={setInput}
            onKeyDown={handleKeyDown}
            placeholder={topic.placeholder}
            guard={guard}
          />
        ) : (
          <textarea
            id="tavi-chat-input"
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_CHAT_MESSAGE_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder={topic.placeholder}
            rows={2}
            maxLength={MAX_CHAT_MESSAGE_LENGTH}
          />
        )}
        <div className={styles.composerRow}>
          <span className={styles.counter} aria-live="polite">
            {remaining <= 100 ? `${remaining} characters left` : ''}
          </span>
          <div className={styles.actions}>
            {voiceSupported && (
              <button
                type="button"
                className={voice === 'recording' ? styles.micRecording : styles.mic}
                onClick={() => void toggleRecording()}
                disabled={!voiceAvailable || voice === 'transcribing' || (pending && voice !== 'recording')}
                aria-pressed={voice === 'recording'}
                aria-label={
                  !voiceAvailable
                    ? 'Voice questions are not supported in this browser'
                    : voice === 'recording'
                      ? `Stop recording, ${formatSeconds(seconds)} so far`
                      : voice === 'transcribing'
                        ? 'Listening to your question'
                        : 'Ask by voice'
                }
                title={voiceAvailable ? undefined : 'Voice questions are not supported in this browser'}
              >
                {voice === 'recording' ? (
                  <>
                    <span className={styles.recordDot} aria-hidden="true" />
                    <span aria-hidden="true">
                      {formatSeconds(seconds)} / {formatSeconds(MAX_RECORDING_MS / 1000)}
                    </span>
                  </>
                ) : voice === 'transcribing' ? (
                  <span aria-hidden="true">Transcribing…</span>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">
                    <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
                  </svg>
                )}
              </button>
            )}
            <button type="submit" className={styles.send} disabled={pending || voice !== 'idle' || input.trim() === ''}>
              Send
            </button>
          </div>
        </div>
      </form>

      {client.mode === 'live' && <SpeedToggle value={speed} onChange={setSpeed} />}

      {guard && <PrivacyDock guard={guard} />}

      <p className={styles.disclaimer}>
        Educational information only, not medical advice. Always follow your care team's instructions.
      </p>
    </aside>
  )
}

export default memo(ChatPanel)
