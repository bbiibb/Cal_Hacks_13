import type { SceneAction } from './chat_types'

/*
 * Hard-coded TAVI answers used until the backend chatbot is connected.
 * Educational dummy content written from general public information. It is not medical advice and must be
 * reviewed by someone with medical knowledge before patients see it.
 */

export type DemoTopic = {
  id: string
  /** The question matches when any pattern matches. Topics are tried in order, so specific ones come first. */
  patterns: readonly RegExp[]
  /** The step this answer is about. The view moves there. */
  step: number
  /** Extra commands on top of the step change, for example a focus or a highlight. */
  actions: readonly SceneAction[]
  /** The answer text. null means "the step's own explanation, word for word" from the step data. */
  message: string | null
  safety: string
  doctorQuestion: string
  followUps: readonly string[]
}

const SLUG = 'tavr'

function focusOn(structureId: string): SceneAction {
  return { type: 'focus', structure_id: structureId, duration_ms: 1200 }
}

function highlight(...structureIds: string[]): SceneAction {
  return { type: 'highlight', structure_ids: structureIds, enabled: true }
}

export const DEMO_TOPICS: readonly DemoTopic[] = [
  {
    id: 'valve_lifetime',
    patterns: [
      /how long (does|do|will|would) (the |my |a |this )?(new )?valves? last/,
      /\b(lifespan|durab\w*|wear(s)? out|last forever)\b/,
    ],
    step: 4,
    actions: [focusOn('transcatheter_valve'), highlight('transcatheter_valve')],
    message:
      'Transcatheter valves have been used for about two decades, and studies that follow people over many years are still going on. Current results suggest they keep working well for many years.\n\nYou will have regular ultrasound checks so your team can see how the valve is doing. If it wears out one day, a second valve can sometimes be placed inside the first one.',
    safety: '',
    doctorQuestion: 'How long is my type of valve expected to last, and what are the options if it wears out?',
    followUps: ['How long is recovery?', 'Will I need to take medicines afterwards?', 'What are the side effects?'],
  },
  {
    id: 'pacemaker',
    patterns: [/\b(pacemaker|rhythm|heart ?beat|heart block|arrhythm\w*|palpitation\w*|electrical)\b/],
    step: 2,
    actions: [focusOn('aortic_annulus'), highlight('aortic_annulus')],
    message:
      "The heart's electrical wiring runs very close to the aortic annulus, the ring where the new valve is anchored. When the valve expands it can press on that wiring and slow the heartbeat.\n\nOften this settles by itself. If it does not, a small pacemaker may be fitted to keep the heartbeat steady. Your heart rhythm is watched closely for a few days after the procedure.",
    safety:
      'Tell your care team quickly if you feel dizzy, faint, or unusually tired after you go home. These can be signs of a slow heartbeat.',
    doctorQuestion: 'How will my heart rhythm be checked afterwards, and how likely is it that I will need a pacemaker?',
    followUps: ['What other side effects are there?', 'How long is recovery?', 'Show me the annulus'],
  },
  {
    id: 'stroke',
    patterns: [/\b(stroke|brain|debris|clots?|embol\w*)\b/],
    step: 2,
    actions: [focusOn('aortic_valve.calcification'), highlight('aortic_valve.calcification', 'aorta')],
    message:
      'The old valve is stiff with calcium. While the new valve is pushed into place, small pieces of calcium or tissue can break loose and travel with the blood toward the brain, which can cause a stroke. This is uncommon.\n\nTeams lower the risk by planning carefully from your scans, and some use a small filter that catches loose pieces during the procedure. Your team also decides whether you need medicine afterwards to stop clots forming on the new valve.',
    safety:
      'A drooping face, weakness in an arm, or trouble speaking are emergency signs. Call your local emergency number straight away if they happen.',
    doctorQuestion: 'What will be done to lower my stroke risk during and after the procedure?',
    followUps: ['Will I need to take medicines afterwards?', 'What other side effects are there?', 'Why might I need a pacemaker?'],
  },
  {
    id: 'access_site',
    patterns: [/\b(bleed\w*|bruis\w*|groin|leg|wound|puncture|insertion|access|femoral|incision|scar|cut)\b/],
    step: 0,
    actions: [highlight('aorta')],
    message:
      'In most TAVI procedures the thin tube goes in through an artery at the top of the leg, in the groin, through a small puncture rather than a large cut. At the end the puncture is closed, and you lie flat for a few hours so it can seal.\n\nBruising there is common and usually fades within a couple of weeks. Less often there is bleeding or damage to the artery, which the team checks for before you go home.',
    safety: 'If the site bleeds heavily or swells quickly, press firmly on it and get help right away.',
    doctorQuestion: 'Which artery will be used for my procedure, and how should I look after the site at home?',
    followUps: ['How long is recovery?', 'Is the contrast dye hard on my kidneys?', 'Go to the next step'],
  },
  {
    id: 'kidneys',
    patterns: [/\b(kidney\w*|dye|contrast|x-?rays?|imaging)\b/],
    step: 1,
    actions: [],
    message:
      'During the procedure the team guides the valve with live X-ray pictures and a contrast dye that makes the blood vessels show up. Your kidneys then clear the dye from your body.\n\nIf your kidneys already work less well, the dye can strain them for a while. The team checks your kidney blood tests before and after, uses as little dye as they can, and may give you extra fluids.',
    safety: 'Tell your care team if you have kidney problems or have reacted to contrast dye before.',
    doctorQuestion: 'Do my kidney tests mean I need extra precautions with the contrast dye?',
    followUps: ['What should I watch for at the groin site?', 'What other side effects are there?', 'Go to the next step'],
  },
  {
    id: 'leak',
    patterns: [/\b(leak\w*|regurgit\w*|paravalvular|murmur|seal\w*)\b/],
    step: 4,
    actions: [focusOn('transcatheter_valve'), highlight('transcatheter_valve', 'aortic_annulus')],
    message:
      'The new valve presses against the old, calcified valve to seal itself in place. Because calcium is uneven, a small gap can sometimes remain at the edge and let a little blood leak backward.\n\nA mild leak is often harmless. The team checks the seal with ultrasound during and after the procedure, and can expand the valve further if needed.',
    safety: '',
    doctorQuestion: 'How will you check that my new valve is sealing well, and how often will I have follow-up scans?',
    followUps: ['How long does the new valve last?', 'What other side effects are there?', 'How long is recovery?'],
  },
  {
    id: 'step_removal',
    patterns: [/\b(withdraw\w*|deflat\w*)\b/, /\bremov\w* (the )?(delivery )?(equipment|catheter|wire|guidewire|tools?|balloon)\b/],
    step: 3,
    actions: [],
    message: null,
    safety: '',
    doctorQuestion: 'How will my care team check the new valve before the procedure is finished?',
    followUps: ['Does anything stay in my body?', 'How long is recovery?', 'Go to the next step'],
  },
  {
    id: 'stays_in_body',
    patterns: [
      /\b(stays?|remains?|left) (in|inside)\b/,
      /\b(permanent\w*|come out|comes out|taken out|removed)\b/,
      /\bold valve\b/,
    ],
    step: 3,
    actions: [focusOn('transcatheter_valve'), highlight('transcatheter_valve')],
    message:
      'Only the new valve stays in your body. It is fixed inside your old valve for good, and the old leaflets stay too, pressed flat against the wall.\n\nThe balloon, the delivery catheter, and the guidewire are only tools. They are taken out at the end of the procedure, which is what this step shows.',
    safety: '',
    doctorQuestion: 'What kind of valve will I get, and is there anything I should carry with me, such as a valve card?',
    followUps: ['How long does the new valve last?', 'Can the new valve leak?', 'How long is recovery?'],
  },
  {
    id: 'medicines',
    patterns: [/\b(medicines?|medication\w*|blood thinners?|aspirin|pills?|drugs?|tablets?|warfarin)\b/],
    step: 4,
    actions: [],
    message:
      'After TAVI most people take medicine for a while to stop clots forming on the new valve. Which medicine, and for how long, depends on your health and on the other medicines you take, so your care team decides this with you.',
    safety: 'Do not start, stop, or change any medicine without talking to your care team first.',
    doctorQuestion: 'Which medicines will I take after the procedure, and for how long?',
    followUps: ['How is stroke risk reduced?', 'How long is recovery?', 'What are the side effects?'],
  },
  {
    id: 'anaesthesia',
    patterns: [/\b(an(a)?esth\w*|asleep|awake|sedat\w*|hurts?|painful|pain|uncomfortable|sore)\b/],
    step: 0,
    actions: [],
    message:
      'Many TAVI procedures are done with sedation: medicine that makes you relaxed and drowsy while the groin is numbed, so you keep breathing on your own. Some hospitals use general anaesthesia instead, where you are fully asleep.\n\nYou should not feel the valve being placed. Afterwards the groin may be sore and bruised for a few days.',
    safety: '',
    doctorQuestion: 'Will I be sedated or fully asleep, and how will my pain be managed afterwards?',
    followUps: ['What should I watch for at the groin site?', 'How long is recovery?', 'What are the side effects?'],
  },
  {
    id: 'step_guidewire',
    patterns: [/\b(guide ?wires?|wires?|rail)\b/],
    step: 0,
    actions: [],
    message: null,
    safety: '',
    doctorQuestion: 'Which artery will the wire and catheter go through in my case?',
    followUps: ['What should I watch for at the groin site?', 'Will it hurt?', 'Go to the next step'],
  },
  {
    id: 'step_delivery',
    patterns: [
      /\b(catheters?|compress\w*|folded|fold|deliver\w*|positioned|positioning)\b/,
      /\b(bring|brings|bringing|brought|carry|carries|carried) (the |my |your )?(new |replacement )?valve\b/,
    ],
    step: 1,
    actions: [],
    message: null,
    safety: '',
    doctorQuestion: 'How will the team check that the new valve is in exactly the right place?',
    followUps: ['How does the balloon work?', 'Is the contrast dye hard on my kidneys?', 'Go to the next step'],
  },
  {
    id: 'step_expansion',
    patterns: [/\b(balloons?|inflat\w*|expand\w*|expansion)\b/],
    step: 2,
    actions: [],
    message: null,
    safety: '',
    doctorQuestion: 'Will my new valve be expanded with a balloon, and are there risks during this step?',
    followUps: ['Why might I need a pacemaker?', 'How is stroke risk reduced?', 'What happens to my old valve?'],
  },
  {
    id: 'step_function',
    patterns: [/how (does|do|will) (the |my |your )?(new )?valve work/, /\b(leaflets?|flaps?|valve function)\b/],
    step: 4,
    actions: [],
    message: null,
    safety: '',
    doctorQuestion: 'How will my new valve be checked at my follow-up visits?',
    followUps: ['Can the new valve leak?', 'How long does the new valve last?', 'Will I need to take medicines afterwards?'],
  },
  {
    id: 'side_effects',
    patterns: [
      /\b(side ?effects?|risks?|risky|complications?|dangers?|dangerous|safe|safety|downsides?)\b/,
      /what (can|could) go wrong/,
    ],
    step: 2,
    actions: [highlight('aortic_valve', 'aortic_annulus')],
    message:
      "Most people recover from TAVI without serious problems, but like any heart procedure it has possible side effects. The ones care teams talk about most are:\n\n• Bleeding or bruising where the tube went in, usually the groin.\n• Changes to the heart's rhythm. Some people need a pacemaker afterwards.\n• A small risk of stroke, because bits of calcium can break loose while the valve is placed.\n• A small leak around the edge of the new valve.\n• Strain on the kidneys from the contrast dye used for X-ray pictures.\n\nAsk me about any of them to learn more.",
    safety: 'Your own risk depends on your health, so go over these with your care team before the procedure.',
    doctorQuestion: 'Which of these side effects am I most at risk of, and what is done to prevent them?',
    followUps: ['Why might I need a pacemaker?', 'How is stroke risk reduced?', 'What should I watch for at the groin site?'],
  },
  {
    id: 'recovery',
    patterns: [
      /\b(recover\w*|discharge\w*|go home|hospital stay|walk|walking|driv\w*|exercise|back to normal|back to work|lift\w*)\b/,
      /how long (will|do|does|until|before)/,
    ],
    step: 4,
    actions: [],
    message:
      'Recovery after TAVI is usually quicker than after open-heart surgery, because there is no large cut in the chest. Many people are up and walking within a day and go home after a few days.\n\nYou are usually asked to avoid heavy lifting for a short time while the groin heals. You will also have follow-up visits and an ultrasound scan of the new valve. Your care team gives you instructions that fit your own recovery.',
    safety:
      'Call your care team if you get a fever, swelling or bleeding at the groin, or new shortness of breath after you go home.',
    doctorQuestion: 'When can I drive, lift things, and go back to my usual activities?',
    followUps: ['Will I need to take medicines afterwards?', 'How long does the new valve last?', 'What are the side effects?'],
  },
  {
    id: 'stenosis',
    patterns: [/\b(narrow\w*|stenosis|calcium|calcif\w*|stiff)\b/, /why (do|would) i need/],
    step: 0,
    actions: [focusOn('aortic_valve.calcification')],
    message:
      'In aortic stenosis the aortic valve, which lets blood out of the heart, becomes stiff and narrow. This is often because calcium builds up on its leaflets over many years. The left ventricle then has to push harder to force blood through the small opening.\n\nOver time this can cause breathlessness, chest tightness, tiredness, or fainting. TAVI places a new valve inside the old one to open the way again.',
    safety: '',
    doctorQuestion: 'How severe is my valve narrowing, and what happens if I wait?',
    followUps: ['What is TAVI?', 'Go to the next step', 'What are the side effects?'],
  },
  {
    id: 'overview',
    patterns: [
      /\bwhat (is|are) (a |the )?(tavi|tavr|this procedure|the procedure)\b/,
      /how does (it|tavi|tavr|the procedure) work/,
      /\b(overview|tell me about tavi|tell me about tavr)\b/,
    ],
    step: 0,
    actions: [],
    message:
      'TAVI, also called TAVR, replaces a narrowed aortic valve without open-heart surgery. This walkthrough shows it in five steps:\n\n1. A thin wire is guided from the groin to the heart.\n2. A catheter carries the folded new valve into position.\n3. A balloon expands the new valve inside the old one.\n4. The balloon, catheter, and wire are taken out.\n5. The new valve opens and closes with each heartbeat.\n\nDrag the slider under the 3D model, or ask me to go to a step.',
    safety: '',
    doctorQuestion: 'Is TAVI the best option for me, or should I also consider open-heart valve surgery?',
    followUps: ['Why is my valve narrowed?', 'What are the side effects?', 'Go to step 2'],
  },
]

/** Answer for a question that no topic matches. */
export const FALLBACK_MESSAGE =
  "I have prepared answers about TAVI's side effects, recovery, and each step of the procedure, but not about that yet. Try one of the questions below, or ask your care team."

/** Answer when the patient describes emergency symptoms happening now. */
export const URGENT_MESSAGE =
  'If this is happening now, call your local emergency number (911 in the US) or go to the nearest emergency department. Do not wait for an answer here.'

export { SLUG as DEMO_PROCEDURE_SLUG }
