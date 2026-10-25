import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import '@fontsource/sora/400.css'
import '@fontsource/sora/600.css'
import { TAVI_PROCEDURE } from '../walkthrough/tavi_content'
import ProgressCard from '../progress/progress_card'
import styles from './landing.module.css'

/** Short step names come from the procedure content, so this page cannot drift from the walkthrough. */
const STEP_NAMES = TAVI_PROCEDURE.steps.map((step) => step.short_title)

type Icon = 'cube' | 'pointer' | 'chat' | 'book' | 'lock' | 'clipboard'

/** Small line icons, drawn here so the page needs no icon library. */
function Glyph({ name }: { name: Icon }) {
  const paths: Record<Icon, ReactNode> = {
    cube: (
      <>
        <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
        <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
      </>
    ),
    pointer: (
      <>
        <path d="m5 3 6.5 16 2.3-6.7L20.5 10 5 3Z" />
      </>
    ),
    chat: (
      <>
        <path d="M4 5h16v11H9l-5 4V5Z" />
        <path d="M8 9.5h8M8 12.5h5" />
      </>
    ),
    book: (
      <>
        <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" />
        <path d="M5 17a3 3 0 0 1 3-3h10M9 8h5" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
        <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
      </>
    ),
    clipboard: (
      <>
        <rect x="6" y="5" width="12" height="15.5" rx="2" />
        <path d="M9.5 5V4h5v1M9.5 11h5M9.5 14.5h3" />
      </>
    ),
  }
  return (
    <svg className={styles.glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

/**
 * A picture of the walkthrough, drawn with HTML so it stays sharp on every screen.
 * The words are real examples of what the chat says.
 */
function ProductPreview() {
  return (
    <div className={styles.preview} role="img" aria-label="Preview of a walkthrough: a 3D heart model with a step timeline, and a chat answering a question about pacemakers.">
      <div className={styles.previewBar} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={styles.previewBody} aria-hidden="true">
        <div className={styles.stage}>
          <svg className={styles.illustration} viewBox="70 22 340 158" aria-hidden="true">
            <defs>
              <linearGradient id="lp-mint" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#e9f8f2" />
                <stop offset="1" stopColor="#a8dccb" />
              </linearGradient>
              <linearGradient id="lp-rose" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fde6ec" />
                <stop offset="1" stopColor="#ecaabf" />
              </linearGradient>
              <linearGradient id="lp-sand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff4c9" />
                <stop offset="1" stopColor="#f3cf6b" />
              </linearGradient>
              <linearGradient id="lp-blue" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#e4ecff" />
                <stop offset="1" stopColor="#a3b4ee" />
              </linearGradient>
            </defs>
            {/* heart */}
            <path d="M150 62c0-26-38-34-46-6-9 32 22 60 46 92 24-32 55-60 46-92-8-28-46-20-46 6Z" fill="url(#lp-rose)" opacity="0.92" />
            {/* aorta arch */}
            <path d="M92 150C70 90 100 40 150 38c34-1 52 20 58 48" fill="none" stroke="url(#lp-mint)" strokeWidth="20" strokeLinecap="round" />
            {/* the valve */}
            <path d="M232 92h84c0 40-18 70-42 70s-42-30-42-70Z" fill="url(#lp-sand)" />
            <ellipse cx="274" cy="92" rx="42" ry="10" fill="#fff4c9" stroke="#f0cd6a" strokeWidth="2" />
            {/* the vessel, branching */}
            <path d="M356 168c0-30 2-58 2-84M358 112c-18-14-26-32-28-52M360 100c16-12 28-26 34-46" fill="none" stroke="url(#lp-blue)" strokeWidth="16" strokeLinecap="round" />
          </svg>
          <p className={styles.caption}>
            Step 2 of {STEP_NAMES.length - 1} · {STEP_NAMES[2]}
          </p>
          <div className={styles.timeline}>
            {STEP_NAMES.map((name, i) => (
              <span key={name} className={i === 2 ? `${styles.tick} ${styles.tickOn}` : styles.tick}>
                <i />
                {i}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.chat}>
          <p className={styles.chatTitle}>Ask about TAVR</p>
          <p className={styles.bubbleUser}>Will I need a pacemaker afterwards?</p>
          <p className={styles.bubbleBot}>
            About 8% to 20% of patients need a pacemaker, depending on the type and brand of valve. These percentages
            describe groups of patients, not your personal risk.
          </p>
          <p className={styles.source}>Source: Risk: heart rhythm problems and pacemaker</p>
          <p className={styles.careTeam}>
            <b>Question for your care team</b>
            What are the chances of needing a pacemaker?
          </p>
        </div>
      </div>
    </div>
  )
}

const STEPS = [
  {
    title: 'Watch it in 3D',
    text: 'Move through your procedure one step at a time. Turn the heart, zoom in, and take as long as you like.',
  },
  {
    title: 'Point at any part',
    text: 'Select a part of the heart or an instrument to see a plain-language explanation of what it is and why it matters.',
  },
  {
    title: 'Ask in your own words',
    text: 'Type or speak a question. The answer comes with its source, and the 3D view moves to show what it means.',
  },
]

const FEATURES: { icon: Icon; title: string; text: string }[] = [
  { icon: 'cube', title: 'Step-by-step 3D', text: 'A clear, calm view of each stage, from the first wire to the working valve.' },
  { icon: 'chat', title: 'Ask by typing or speaking', text: 'Questions about side effects, recovery, or what you are seeing, answered in simple words.' },
  { icon: 'book', title: 'Answers that show their source', text: 'Replies are based on a written patient guide, and say so when they do not know.' },
  { icon: 'clipboard', title: 'Questions for your care team', text: 'Each answer can suggest a question to take to your doctor, so your visit is easier.' },
  { icon: 'lock', title: 'Private by design', text: 'No tracking cookies. Personal details are removed from your questions, and the conversation is deleted when you close the window.' },
  { icon: 'pointer', title: 'At your own pace', text: 'Come back as often as you want, before the day and after. No sign-up is needed.' },
]

function Landing() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Patient education for heart procedures</p>
          <h1 id="hero-title" className={styles.title}>
            Know what to expect, <span className={styles.titleAccent}>before the day.</span>
          </h1>
          <p className={styles.lead}>
            See your procedure step by step in 3D, learn what every part is, and ask questions in your own words. Calm,
            clear, and at your own pace.
          </p>
          <div className={styles.actions}>
            <Link to="/walkthrough" className={styles.primary}>
              Start the walkthrough
              <span aria-hidden="true">→</span>
            </Link>
            <Link to="/walkthroughs-list" className={styles.secondary}>
              Browse walkthroughs
            </Link>
          </div>
          <ul className={styles.reassure}>
            <li>No sign-up needed</li>
            <li>Answers show their source</li>
            <li>Educational, not medical advice</li>
          </ul>
        </div>
        <ProductPreview />
      </section>

      {/* Shows only when saved progress exists; a login feature can pass displayName here later */}
      <ProgressCard />

      <section className={styles.section} aria-labelledby="how-title">
        <h2 id="how-title" className={styles.sectionTitle}>
          How it works
        </h2>
        <p className={styles.sectionLead}>Three simple steps, no medical background needed.</p>
        <ol className={styles.steps}>
          {STEPS.map((step, i) => (
            <li key={step.title} className={styles.stepCard}>
              <span className={styles.stepNumber}>{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="features-title">
        <h2 id="features-title" className={styles.sectionTitle}>
          Made to put you at ease
        </h2>
        <p className={styles.sectionLead}>Everything is designed around one idea: you should understand what is about to happen.</p>
        <ul className={styles.features}>
          {FEATURES.map((feature) => (
            <li key={feature.title} className={styles.featureCard}>
              <span className={styles.iconWrap}>
                <Glyph name={feature.icon} />
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="featured-title">
        <div className={styles.featured}>
          <div className={styles.featuredText}>
            <p className={styles.eyebrow}>Available now</p>
            <h2 id="featured-title" className={styles.featuredTitle}>
              TAVR: replacing a narrowed aortic valve
            </h2>
            <p className={styles.featuredLead}>
              Transcatheter aortic valve replacement places a new valve inside the old one through a thin tube, without
              opening the chest. Start with why a narrowed valve needs replacing, then follow all {STEP_NAMES.length - 1} steps.
            </p>
            <Link to="/walkthrough" className={styles.primary}>
              Open the walkthrough
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <ol className={styles.featuredSteps}>
            {STEP_NAMES.map((name, i) => (
              <li key={name}>
                <span>{i}</span>
                {name}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.notice} aria-label="About this information">
        <p>
          <strong>For education only.</strong> ask-ray explains how procedures work in general. It cannot diagnose, give
          advice about medicines, or tell you what is right for you. Always follow your care team's instructions, and call
          your local emergency number if you have chest pain, trouble breathing, or feel faint.
        </p>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <span className={styles.logo} aria-hidden="true">
            as<span>X</span>-ray
          </span>
          <p>Helping patients understand their procedures.</p>
        </div>
        <nav aria-label="Footer" className={styles.footerNav}>
          <Link to="/walkthroughs-list">Walkthroughs</Link>
          <Link to="/about">About us</Link>
          <Link to="/faqs">FAQs</Link>
          <Link to="/contact">Contact</Link>
        </nav>
        <p className={styles.legal}>© 2026 ask-ray. Educational content, not medical advice.</p>
      </footer>
    </main>
  )
}

export default Landing
