/**
 * Follow-up questions offered under an answer, per step of the TAVI walkthrough.
 * Every question here has a prepared demo answer, so a click always gets a useful reply.
 */
export const STEP_FOLLOW_UPS: readonly (readonly string[])[] = [
  ['What is TAVI?', 'Why is my valve narrowed?', 'What are the side effects?'],
  ['What should I watch for at the groin site?', 'Is the contrast dye hard on my kidneys?', 'Go to the next step'],
  ['Why might I need a pacemaker?', 'How is stroke risk reduced?', 'Can the new valve leak?'],
  ['Does anything stay in my body?', 'How long is recovery?', 'How long does the new valve last?'],
]

/** Questions shown before the patient has asked anything. */
export const STARTER_QUESTIONS: readonly string[] = [
  'What are the side effects?',
  'What is happening in this step?',
  'How long is recovery?',
  'Does anything stay in my body?',
]

export function followUpsForStep(stepIndex: number): string[] {
  return [...(STEP_FOLLOW_UPS[stepIndex] ?? STARTER_QUESTIONS)]
}
