/**
 * Follow-up questions offered under an answer, per step of the TAVR walkthrough.
 * Every question here has a prepared demo answer, so a click always gets a useful reply.
 */
export const STEP_FOLLOW_UPS: readonly (readonly string[])[] = [
  ['What are the symptoms of a narrowed valve?', 'What is TAVR?', 'Why is my valve narrowed?'],
  ['What is TAVR?', 'What should I watch for at the groin site?', 'Will it hurt?'],
  ['How does the balloon work?', 'Is the contrast dye hard on my kidneys?', 'What are the side effects?'],
  ['Why might I need a pacemaker?', 'How is stroke risk reduced?', 'What happens to my old valve?'],
  ['Does anything stay in my body?', 'How long is recovery?', 'Will I need to take medicines afterwards?'],
  ['How does my new valve work?', 'Can the new valve leak?', 'How long does the new valve last?'],
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
