/*
 * The questions on the FAQs page. The answers about TAVR follow the team's TAVR information guide (the same facts the
 * chatbot answers from, packages/shared/fixtures/knowledge.tavr.json); the rest describes this website.
 * Plain text only, one paragraph per entry in `answer`.
 */
export type Faq = {
  id: string
  question: string
  /** Each string is one paragraph. */
  answer: string[]
}

export type FaqGroup = {
  id: string
  title: string
  faqs: Faq[]
}

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: 'about-tavr',
    title: 'About TAVR',
    faqs: [
      {
        id: 'what-is-tavr',
        question: 'What is TAVR?',
        answer: [
          'TAVR (transcatheter aortic valve replacement, also called TAVI) is a treatment that replaces a narrowed aortic valve that does not open fully. It is minimally invasive: it uses smaller cuts than open-heart valve surgery.',
          'A team of heart doctors and surgeons decides together with you whether it is the best treatment.',
        ],
      },
      {
        id: 'old-valve',
        question: 'Is my old valve taken out?',
        answer: [
          'No. In TAVR the doctor places the new valve inside your old, damaged aortic valve without removing it. The new valve takes over controlling blood flow.',
        ],
      },
      {
        id: 'how-delivered',
        question: 'How does the new valve get to my heart?',
        answer: [
          'Like a stent, the replacement valve is guided through an artery inside a thin, flexible tube called a catheter. The valve is compressed while it travels and expanded once it reaches the diseased valve.',
          'When it expands it pushes the old valve leaflets aside, and the new valve starts regulating blood flow. You can watch these steps in the TAVR walkthrough.',
        ],
      },
      {
        id: 'chest-opened',
        question: 'Will my chest be opened?',
        answer: [
          'Traditional valve replacement often needs open-heart surgery that opens the chest. TAVR can be done through small openings that leave the chest bones in place. It is less traumatic to the body, usually means a shorter hospital stay, and gives a treatment option to people who are not healthy enough for traditional surgery.',
        ],
      },
      {
        id: 'awake',
        question: 'Am I awake during the procedure?',
        answer: [
          'TAVR is usually done with a local anaesthetic, so you are awake but feel no pain. Your care team explains the plan for your procedure.',
        ],
      },
    ],
  },
  {
    id: 'before-after',
    title: 'Before and after the procedure',
    faqs: [
      {
        id: 'symptoms',
        question: 'What are the symptoms of aortic stenosis?',
        answer: [
          'Aortic stenosis means the aortic valve has narrowed and cannot open fully, so the heart must pump harder. Symptoms include shortness of breath (especially during activity), chest pain or pressure, dizziness or fainting, fatigue or weakness, and palpitations.',
        ],
      },
      {
        id: 'candidate',
        question: 'Who may be a candidate for TAVR?',
        answer: [
          'Your team looks at a confirmed diagnosis of severe aortic stenosis, symptoms that affect your quality of life, a high risk from open-heart surgery (for example older age, lung disease, diabetes, kidney disease, or earlier heart surgery), the shape and size of your valve and blood vessels, and your heart function.',
          'Only your heart team can say whether TAVR is right for you.',
        ],
      },
      {
        id: 'bring',
        question: 'What should I bring to the hospital?',
        answer: [
          'A written list of your medicines and supplements, loose comfortable clothing for the trip home (no tight belts or stiff jeans that press on the groin), your ID and insurance information, and your CPAP machine if you use one. Leave valuables and jewelry at home.',
        ],
      },
      {
        id: 'stay',
        question: 'How long are the hospital stay and the recovery?',
        answer: [
          'The hospital stay is usually 1 to 2 days. Recovery typically takes a few weeks, and most patients return to normal daily activities within a month, though individual recovery times vary. Follow your doctor’s recommendations.',
        ],
      },
      {
        id: 'exercise',
        question: 'When can I exercise again?',
        answer: [
          'You can gradually resume exercise after TAVR. Start with light activities such as walking, and follow your healthcare professional’s guidelines for slowly increasing the intensity and length of workouts.',
        ],
      },
    ],
  },
  {
    id: 'risks',
    title: 'Risks and safety',
    faqs: [
      {
        id: 'risks',
        question: 'What are the risks of TAVR?',
        answer: [
          'Each complication varies with your health, your heart and blood vessel anatomy, the valve used, and the procedure. The risks include bleeding, blood vessel injury, valve leak or slipping, stroke, heart rhythm problems needing a pacemaker, kidney injury, heart attack, infection, and death.',
          'Published percentages describe specific groups of patients over a defined period and are not your personal risk. Your heart team can explain which risks matter for you.',
        ],
      },
      {
        id: 'durability',
        question: 'How long does the new valve last?',
        answer: [
          'The TAVR information guide gives no fixed number of years. Younger patients are more likely to outlive a TAVR valve, which may later need a valve-in-valve procedure. Ask your heart team what to expect for you.',
        ],
      },
      {
        id: 'emergency',
        question: 'When should I get emergency help?',
        answer: [
          'Get emergency medical help immediately for chest pain or pressure, severe or sudden shortness of breath, or fainting. Call your local emergency number right away (for example 911 in the United States).',
        ],
      },
    ],
  },
  {
    id: 'this-site',
    title: 'Using this site',
    faqs: [
      {
        id: 'three-d',
        question: 'What can I do in the 3D view?',
        answer: [
          'Drag to turn the heart and scroll to zoom. Point at a part to see its name, and click it to pin it and read what it is. The slider under the model moves between the five steps of the procedure, and “Reset view” returns to the starting view.',
        ],
      },
      {
        id: 'chatbot',
        question: 'What can I ask the chatbot?',
        answer: [
          'Ask about the procedure, side effects, recovery, or the step you are looking at. You can also give it commands such as “zoom in”, “rotate left 90 degrees”, “go to step 3”, or “show me the right atrium”. The part it talks about changes color in the 3D view and the camera moves to it, and the sources behind an answer are listed under it.',
        ],
      },
      {
        id: 'slow-fast',
        question: 'What do Slow and Fast mean?',
        answer: [
          'Under the chat you can choose how it answers. Slow uses an AI model that runs on this computer: it is free and nothing leaves the computer, but it takes longer. Fast uses a cloud AI model: it answers sooner, but it is a paid service, so the page asks before you turn it on.',
        ],
      },
      {
        id: 'privacy',
        question: 'Is my personal information kept private?',
        answer: [
          'Before a question leaves your device, the page replaces personal details such as names, birth dates and ID numbers with placeholders, and the answer is filled back in on your device. “What left your device” under the chat shows exactly what was sent. A conversation is deleted when you close the window, and conversations nobody has used for a couple of hours are deleted automatically.',
          'Voice questions are switched off while this privacy layer is on.',
        ],
      },
      {
        id: 'medical-advice',
        question: 'Is this medical advice?',
        answer: [
          'No. This site is education, not medical advice. It explains what TAVR is and how it works; it cannot diagnose you, estimate your personal risk, or tell you to start or stop a medicine. Always follow your care team’s instructions, and ask them anything that is specific to you.',
        ],
      },
      {
        id: 'languages',
        question: 'Which languages are supported?',
        answer: [
          'English only for now.',
        ],
      },
    ],
  },
]
