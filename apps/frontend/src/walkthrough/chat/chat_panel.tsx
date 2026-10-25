import { memo, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Procedure } from '@cal-hacks/shared'
import type { ChatClient, ChatResponse, SceneAction } from './chat_types'
import { ChatError, MAX_CHAT_MESSAGE_LENGTH } from './chat_types'
import { STARTER_QUESTIONS } from './follow_ups'
import styles from './chat_panel.module.css'

type Message =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; text: string; response?: ChatResponse; followUps: string[] }
  | { id: number; role: 'error'; text: string; retry: string }

type Props = {
  client: ChatClient
  procedure: Procedure
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

const WELCOME =
  'Hi! I can walk you through TAVI and its possible side effects. Ask a question, or tell me to move the view, for example "zoom in" or "go to step 3". Point at the 3D model to see what each part is.'

/** Friendly wording for the error codes the backend uses. */
function errorText(error: unknown): string {
  if (error instanceof ChatError) {
    if (error.code === 'llm_rate_limited') return 'The assistant is busy right now. Please try again in a moment.'
    return error.message
  }
  return 'Something went wrong. Please try again.'
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
  procedure,
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
    { id: 0, role: 'assistant', text: WELCOME, followUps: [...STARTER_QUESTIONS] },
  ])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const nextId = useRef(1)
  const logRef = useRef<HTMLDivElement>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

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

    setMessages((list) => [...list, { id: nextId.current++, role: 'user', text: message }])
    setInput('')
    setPending(true)

    try {
      const { response, followUps } = await client.ask({
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
      setMessages((list) => [...list, { id: nextId.current++, role: 'error', text: errorText(error), retry: message }])
    } finally {
      if (mounted.current) setPending(false)
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
    <aside className={styles.panel} aria-label="TAVI assistant">
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Ask about TAVI</h2>
          <p className={styles.subtitle}>Questions, side effects, and the 3D view</p>
        </div>
        <span
          className={client.mode === 'live' ? styles.badgeLive : styles.badgeDemo}
          title={client.mode === 'live' ? 'Answers come from the assistant' : 'Prepared answers, no AI involved'}
        >
          {client.mode === 'live' ? 'Live' : 'Demo answers'}
        </span>
      </header>

      {step && (
        <section className={styles.step} aria-label="Current step">
          <p className={styles.stepLabel}>
            Step {stepIndex + 1} of {procedure.steps.length}
          </p>
          <h3 className={styles.stepTitle}>{step.title}</h3>
          <p className={styles.stepBody}>{step.side_panel.body_markdown}</p>
          {step.side_panel.related_structure_ids.length > 0 && (
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
          if (m.role === 'error') {
            return (
              <div key={m.id} className={styles.errorBubble}>
                <p className={styles.paragraph}>{m.text}</p>
                <button type="button" className={styles.retry} onClick={() => void send(m.retry)} disabled={pending}>
                  Try again
                </button>
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
        <textarea
          id="tavi-chat-input"
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_CHAT_MESSAGE_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder="Ask about side effects, recovery, or a step…"
          rows={2}
          maxLength={MAX_CHAT_MESSAGE_LENGTH}
        />
        <div className={styles.composerRow}>
          <span className={styles.counter} aria-live="polite">
            {remaining <= 100 ? `${remaining} characters left` : ''}
          </span>
          <button type="submit" className={styles.send} disabled={pending || input.trim() === ''}>
            Send
          </button>
        </div>
      </form>

      <p className={styles.disclaimer}>
        Educational information only, not medical advice. Always follow your care team's instructions.
      </p>
    </aside>
  )
}

export default memo(ChatPanel)
