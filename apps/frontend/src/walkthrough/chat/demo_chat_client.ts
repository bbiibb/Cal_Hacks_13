import type { Procedure, Structure } from '@cal-hacks/shared'
import type { ChatClient, ChatReply, ChatRequest, ChatResponse, SceneAction } from './chat_types'
import { MAX_ROTATE_DEGREES, MIN_ROTATE_DEGREES } from './chat_types'
import { DEMO_TOPICS, FALLBACK_MESSAGE, URGENT_MESSAGE, type DemoTopic } from './demo_answers'
import { followUpsForStep, STARTER_QUESTIONS } from './follow_ups'

/** A short pause, so the demo feels like a conversation rather than an instant lookup. */
const REPLY_DELAY_MS = 450

const EMERGENCY_SYMPTOMS =
  /\b(chest pain|chest pressure|chest tightness|can'?t breathe|cannot breathe|trouble breathing|struggling to breathe|fainted|fainting|passed out|passing out|face (is )?droop\w*|slurred speech|heavy bleeding|bleeding (a lot|heavily)|won'?t stop bleeding)\b/
const HAPPENING_NOW = /\b(i am|i'm|im|i have|i've|having|right now|now|currently|just|my)\b/
const ABOUT_THE_FUTURE = /\b(will|would|could|might|after|afterwards|risk|chance|possible|likely|normal|if)\b/

/** Words that point at a part of the model. More specific phrases come first. */
const STRUCTURE_WORDS: readonly [RegExp, string[]][] = [
  [/\b(new valve|transcatheter|tavi valve|tavr valve|replacement valve|artificial valve)\b/, ['transcatheter_valve']],
  [/\b(frame|stent)\b/, ['transcatheter_valve.frame']],
  [/\b(calcium|calcification|calcified)\b/, ['aortic_valve.calcification']],
  [/\bannulus\b/, ['aortic_annulus']],
  [/\b(aortic )?root\b/, ['aorta.root']],
  [/\bcoronar\w*\b/, ['left_coronary_artery', 'right_coronary_artery']],
  [/\bright ventricle\b/, ['right_ventricle']],
  [/\bright atrium\b/, ['right_atrium']],
  [/\bvena cava\b/, ['superior_vena_cava']],
  [/\bpulmonary (artery|trunk)\b/, ['pulmonary_artery']],
  [/\b(left )?ventricle\b|\bheart muscle\b|\bpumping chamber\b/, ['left_ventricle']],
  [/\baorta\b/, ['aorta']],
  [/\b(old valve|native valve|aortic valve|valve)\b/, ['aortic_valve']],
]

/** What a demo client knows about one topic: part words, prepared answers and suggested questions. */
export type DemoContent = {
  structureWords: readonly (readonly [RegExp, string[]])[]
  topics: readonly DemoTopic[]
  fallback: string
  starterQuestions: readonly string[]
  followUpsForStep: (stepIndex: number) => string[]
  /** Questions offered after an answer about a part. */
  partFollowUps: readonly string[]
  /** Answer any question that names a part ("what does the retina do?") with that part's description. */
  answerPartQuestions?: boolean
}

/** The TAVR content, used unless another is given. */
export const TAVR_DEMO_CONTENT: DemoContent = {
  structureWords: STRUCTURE_WORDS,
  topics: DEMO_TOPICS,
  fallback: FALLBACK_MESSAGE,
  starterQuestions: STARTER_QUESTIONS,
  followUpsForStep,
  partFollowUps: ['What is happening in this step?', 'What are the side effects?', 'Reset the view'],
}

const SHOW_INTENT = /\b(show|where|point|find|look at|focus|highlight|zoom (in )?on)\b/
const CURRENT_STEP_INTENT =
  /\b(this step|happening here|happening now|what am i (looking at|seeing)|what is this|what's this|explain this|this part)\b/

/**
 * Answers TAVR questions from the hard-coded demo content, and understands simple view commands
 * such as "zoom in", "rotate left 90 degrees", or "go to step 3".
 * Used when no backend is configured, so the chat panel works offline and in demos.
 */
export class DemoChatClient implements ChatClient {
  readonly mode = 'demo' as const
  private readonly procedure: Procedure
  private readonly structures: Map<string, Structure>
  private readonly content: DemoContent

  constructor(procedure: Procedure, structures: readonly Structure[], content: DemoContent = TAVR_DEMO_CONTENT) {
    this.content = content
    this.procedure = procedure
    this.structures = new Map(structures.map((s) => [s.id, s]))
  }

  async ask(request: ChatRequest): Promise<ChatReply> {
    await new Promise((resolve) => setTimeout(resolve, REPLY_DELAY_MS))
    return this.answer(request)
  }

  /** The answer without the delay. Separate so it is easy to test. */
  answer({ message, context }: ChatRequest): ChatReply {
    const text = message.toLowerCase().replace(/\s+/g, ' ').trim()

    if (isEmergency(text)) {
      return {
        response: emptyResponse({ message: URGENT_MESSAGE, safety: URGENT_MESSAGE, urgent: true }),
        followUps: [],
      }
    }

    const commands = this.viewCommands(text, context.step_index)
    const structureIds = SHOW_INTENT.test(text) ? findStructures(text, this.content.structureWords) : []
    const topic = this.content.topics.find((t) => t.patterns.some((p) => p.test(text)))

    // A question about a part ("where is the new valve?") wins over a general topic
    if (structureIds.length > 0) {
      return this.structureReply(structureIds, commands)
    }
    if (topic) {
      return this.topicReply(topic, commands)
    }
    if (this.content.answerPartQuestions) {
      const named = findStructures(text, this.content.structureWords)
      if (named.length > 0) return this.structureReply(named, commands)
    }
    if (CURRENT_STEP_INTENT.test(text)) {
      return this.stepReply(context.step_index, context.selected_structure_id, commands)
    }
    if (commands.actions.length > 0) {
      return {
        response: emptyResponse({ message: commands.notes.join(' '), scene_actions: commands.actions }),
        followUps: this.content.followUpsForStep(commands.stepIndex ?? context.step_index),
      }
    }
    return {
      response: emptyResponse({ message: this.content.fallback }),
      followUps: [...this.content.starterQuestions],
    }
  }

  private topicReply(topic: DemoTopic, commands: ViewCommands): ChatReply {
    const actions: SceneAction[] = [this.gotoStep(topic.step), ...topic.actions, ...commands.actions]
    return {
      response: emptyResponse({
        message: topic.message ?? this.stepText(topic.step),
        scene_actions: actions,
        safety: topic.safety,
        doctor_question: topic.doctorQuestion,
        side_panel: null,
      }),
      followUps: [...topic.followUps],
    }
  }

  private structureReply(structureIds: string[], commands: ViewCommands): ChatReply {
    const parts = structureIds.flatMap((id) => {
      const structure = this.structures.get(id)
      return structure ? [structure] : []
    })
    const first = parts[0]
    const message = parts.map((p) => `The ${p.name_en.toLowerCase()}: ${p.description}`).join('\n\n')
    const actions: SceneAction[] = [
      { type: 'focus', structure_id: structureIds[0]!, duration_ms: 1000 },
      { type: 'highlight', structure_ids: structureIds, enabled: true },
      ...commands.actions,
    ]
    return {
      response: emptyResponse({
        message: message || this.content.fallback,
        scene_actions: actions,
        side_panel: first
          ? { title: first.name_en, body_markdown: first.description, related_structure_ids: structureIds }
          : null,
      }),
      followUps: [...this.content.partFollowUps],
    }
  }

  private stepReply(stepIndex: number, selectedId: string | null, commands: ViewCommands): ChatReply {
    const step = this.procedure.steps[stepIndex] ?? this.procedure.steps[0]!
    const selected = selectedId ? this.structures.get(selectedId) : undefined
    const about = selected ? `\n\nThe part you selected is the ${selected.name_en.toLowerCase()}. ${selected.description}` : ''
    return {
      response: emptyResponse({
        message: `${this.stepText(step.index)}${about}`,
        scene_actions: [
          { type: 'highlight', structure_ids: step.side_panel.related_structure_ids, enabled: true },
          ...commands.actions,
        ],
        side_panel: step.side_panel,
      }),
      followUps: this.content.followUpsForStep(step.index),
    }
  }

  /** A step's title and its explanation, word for word from the step data. */
  private stepText(stepIndex: number): string {
    const step = this.procedure.steps[stepIndex]
    if (!step) return this.content.fallback
    return `Step ${step.index} of ${this.procedure.steps.length - 1}: ${step.title}\n\n${step.side_panel.body_markdown}`
  }

  private gotoStep(stepIndex: number): SceneAction {
    return { type: 'goto_step', procedure_slug: this.procedure.slug, step_index: stepIndex }
  }

  /** Zoom, rotate, reset, see-through, and step commands found in the text, with a note for each. */
  private viewCommands(text: string, currentStep: number): ViewCommands {
    const result: ViewCommands = { actions: [], notes: [], stepIndex: null }
    const lastStep = this.procedure.steps.length - 1

    let target: number | null = null
    const numbered = text.match(/\bstep (\d+)\b/)
    if (numbered) target = Number(numbered[1])
    else if (/\b(next step|go forward|continue|move on)\b/.test(text)) target = currentStep + 1
    else if (/\b(previous step|go back a step|back a step|step back)\b/.test(text)) target = currentStep - 1
    else if (/\bfirst step\b/.test(text)) target = 1
    else if (/\b(final|last) step\b/.test(text)) target = lastStep

    if (target !== null) {
      if (target >= 0 && target <= lastStep) {
        const step = this.procedure.steps[target]!
        result.actions.push(this.gotoStep(target))
        result.notes.push(this.stepText(step.index))
        result.stepIndex = target
      } else {
        result.notes.push(`This walkthrough has steps 0 to ${lastStep}.`)
      }
    }

    const zoomIn = /\b(zoom in|closer|magnify|enlarge|bigger)\b/.test(text)
    const zoomOut = /\b(zoom out|further away|farther away|smaller|wider view)\b/.test(text)
    if (zoomIn || zoomOut) {
      const amount = /\b(a lot|much|way|lots)\b/.test(text)
        ? 'large'
        : /\b(a little|slightly|a bit|a touch)\b/.test(text)
          ? 'small'
          : 'medium'
      result.actions.push({ type: 'zoom', direction: zoomIn ? 'in' : 'out', amount })
      result.notes.push(zoomIn ? 'Zooming in.' : 'Zooming out.')
    }

    if (/\b(rotate|spin|orbit)\b|\bturn\b(?! off)/.test(text)) {
      const direction = /\bleft\b/.test(text)
        ? 'left'
        : /\bup\b/.test(text)
          ? 'up'
          : /\bdown\b/.test(text)
            ? 'down'
            : 'right'
      const degreesMatch = text.match(/(\d+)\s*(°|deg|degrees?)/)
      const around = /\b(around|over|other side|behind|back side)\b/.test(text)
      const degrees = degreesMatch ? Number(degreesMatch[1]) : around ? 180 : 45
      const clamped = Math.min(MAX_ROTATE_DEGREES, Math.max(MIN_ROTATE_DEGREES, degrees))
      result.actions.push({ type: 'rotate', direction, degrees: clamped })
      result.notes.push(`Turning the view ${direction} by ${clamped} degrees.`)
    }

    if (/\b(reset|default view|starting view|original view|re-?center)\b/.test(text)) {
      result.actions.push({ type: 'reset_view' })
      result.notes.push('Back to the starting view.')
    }

    if (/\b(clear|remove|stop|turn off)\b.*\bhighlight\w*\b|\bunhighlight\b/.test(text)) {
      const all = [...this.structures.keys()]
      if (all.length > 0) result.actions.push({ type: 'highlight', structure_ids: all, enabled: false })
      result.notes.push('Highlights cleared.')
    }

    const seeThrough = /\b(see.?through|transparent|fade)\b/.test(text)
    const solid = /\b(solid|opaque|show it again|unhide)\b/.test(text)
    if (seeThrough || solid) {
      const ids = findStructures(text, this.content.structureWords)
      for (const id of ids) {
        result.actions.push({ type: 'set_opacity', structure_id: id, opacity: seeThrough ? 0.25 : 1 })
      }
      if (ids.length > 0) result.notes.push(seeThrough ? 'Making it see-through.' : 'Making it solid again.')
    }

    return result
  }
}

type ViewCommands = {
  actions: SceneAction[]
  /** One sentence per command, used as the reply when the question was only a command. */
  notes: string[]
  /** The step a step command moves to, if any. */
  stepIndex: number | null
}

function isEmergency(text: string): boolean {
  return EMERGENCY_SYMPTOMS.test(text) && HAPPENING_NOW.test(text) && !ABOUT_THE_FUTURE.test(text)
}

function findStructures(text: string, words: DemoContent['structureWords']): string[] {
  for (const [pattern, ids] of words) {
    if (pattern.test(text)) return ids
  }
  return []
}

function emptyResponse(fields: Partial<ChatResponse>): ChatResponse {
  return {
    message: '',
    scene_actions: [],
    side_panel: null,
    sources: [],
    safety: '',
    doctor_question: '',
    urgent: false,
    ...fields,
  }
}
