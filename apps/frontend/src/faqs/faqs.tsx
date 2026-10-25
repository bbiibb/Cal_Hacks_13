import { FAQ_GROUPS } from './faq_content'
import styles from './faqs.module.css'

/** Frequently asked questions: about TAVR, the days around it, its risks, and how to use this site. */
function Faqs() {
  return (
    <main className={styles.main}>
      <div className={styles.page}>
        <h1 className={styles.heading}>FAQs</h1>
        <p className={styles.intro}>
          Short answers to common questions. The answers about TAVR follow the same information guide the chatbot uses. This is
          education, not medical advice: ask your care team about anything that is specific to you.
        </p>

        {FAQ_GROUPS.map((group) => (
          <section key={group.id} className={styles.group} aria-labelledby={`faq-group-${group.id}`}>
            <h2 className={styles.groupTitle} id={`faq-group-${group.id}`}>
              {group.title}
            </h2>
            <div className={styles.list}>
              {group.faqs.map((faq) => (
                <details key={faq.id} className={styles.item}>
                  <summary className={styles.question}>{faq.question}</summary>
                  <div className={styles.answer}>
                    {faq.answer.map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}

export default Faqs
