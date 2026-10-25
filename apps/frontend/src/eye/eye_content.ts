import { ProcedureSchema, StructureSchema } from '@cal-hacks/shared'
import procedureJson from '@cal-hacks/shared/fixtures/procedure.eye.json'
import structuresJson from '@cal-hacks/shared/fixtures/structures.eye.json'
import type { DemoContent } from '../walkthrough/chat/demo_chat_client'
import type { DemoTopic } from '../walkthrough/chat/demo_answers'

/*
 * The eye anatomy walkthrough (a prototype): a short tour of the main parts of the eye, with placeholder text.
 * Read from the shared fixtures and checked against the contract on load, like the TAVR content.
 */
export const EYE_PROCEDURE = ProcedureSchema.parse(procedureJson)
export const EYE_STRUCTURES = StructureSchema.array().parse(structuresJson)

const BY_ID = new Map(EYE_STRUCTURES.map((s) => [s.id, s]))

export function eyeStructureName(structureId: string): string {
  return BY_ID.get(structureId)?.name_en ?? structureId
}

export function eyeStructureInfo(structureId: string): { name: string; description: string } | null {
  const structure = BY_ID.get(structureId)
  return structure ? { name: structure.name_en, description: structure.description } : null
}

const STARTER_QUESTIONS = ['How does the eye work?', 'What does the retina do?', 'Where is the lens?', 'What is the iris?']

const STEP_FOLLOW_UPS: readonly (readonly string[])[] = [
  ['What does the cornea do?', 'What does the retina do?', 'How does the eye focus?'],
  ['What is the iris?', 'Where is the lens?', 'What does the cornea do?'],
  ['How does the eye focus?', 'What does the retina do?', 'Show me the lens'],
  ['What does the retina do?', 'What is the sclera?', 'Show me the optic nerve'],
  ['What is the optic nerve?', 'How does the eye work?', 'Show me the cornea'],
]

function topic(id: string, patterns: RegExp[], step: number, message: string, followUps: string[]): DemoTopic {
  return { id, patterns, step, actions: [], message, safety: '', doctorQuestion: '', followUps }
}

const TOPICS: readonly DemoTopic[] = [
  topic(
    'how_the_eye_works',
    [/how (does|do) (the|an|my) eye(s)? (work|see)/, /\bhow (do|can) (we|i) see\b/],
    0,
    'Your eye works like a camera. Light enters through the cornea, the pupil lets in the right amount of light, the lens focuses it, and the retina at the back turns it into signals. The optic nerve sends them to your brain. This is a prototype with placeholder text.',
    ['What does the retina do?', 'How does the eye focus?']
  ),
  topic(
    'focusing',
    [/\bhow (does|do) (the|my) eye(s)? focus\b/, /\bfocus(ing)?\b/],
    2,
    'The cornea does most of the bending of light, and the lens fine-tunes the focus. Tiny fibers called suspensory ligaments let the lens change shape for near and far objects. This is a prototype with placeholder text.',
    ['Where is the lens?', 'What does the retina do?']
  ),
]

const STRUCTURE_WORDS: readonly (readonly [RegExp, string[]])[] = [
  [/\boptic nerve\b|\bnerve\b/, ['optic_nerve']],
  [/\b(suspensory|ligaments?|zonules?|fibers?)\b/, ['suspensory_ligaments']],
  [/\b(cornea|clear dome)\b/, ['cornea']],
  [/\b(iris|pupil)\b/, ['iris']],
  [/\blens\b/, ['lens']],
  [/\b(sclera|white of the eye|outer wall)\b/, ['sclera']],
  [/\bchoroid\b/, ['choroid']],
  [/\bretina\b/, ['retina']],
]

export const EYE_DEMO_CONTENT: DemoContent = {
  structureWords: STRUCTURE_WORDS,
  topics: TOPICS,
  fallback:
    'This is a prototype, so I only know a little about the eye. Ask about a part (for example "what is the iris?"), say "show me the retina", or say "go to step 3".',
  starterQuestions: STARTER_QUESTIONS,
  followUpsForStep: (stepIndex) => [...(STEP_FOLLOW_UPS[stepIndex] ?? STARTER_QUESTIONS)],
  partFollowUps: ['What is happening in this step?', 'How does the eye work?', 'Reset the view'],
  answerPartQuestions: true,
}

export const EYE_TOPIC = {
  name: 'the eye',
  welcome:
    'Hi! This is a prototype tour of the eye. Ask what a part does, or tell me to move the view, for example "zoom in" or "go to step 3". Point at the 3D model to see what each part is.',
  starterQuestions: STARTER_QUESTIONS,
  placeholder: 'Ask about a part of the eye, or a step…',
}
