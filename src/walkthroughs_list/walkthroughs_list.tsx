import { useNavigate } from 'react-router-dom'
import WalkthroughCard from './walkthrough_card'
import styles from './walkthroughs_list.module.css'

type WalkthroughItem = {
  id: string
  title: string
  /** Route opened when the card is selected. */
  to: string
  imageSrc?: string
  imageAlt?: string
}

// Static for now. Later this list can come from the backend (conditions and procedures).
const WALKTHROUGHS: WalkthroughItem[] = [
  { id: 'tavi', title: 'TAVI', to: '/walkthrough' },
]

// Keeps the grid full (two rows of three) while more procedures are on the way.
const GRID_SLOTS = 6

function WalkthroughsList() {
  const navigate = useNavigate()
  const placeholders = Math.max(0, GRID_SLOTS - WALKTHROUGHS.length)

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>Interactive Walkthroughs</h1>
      <section className={styles.grid}>
        {WALKTHROUGHS.map((item) => (
          <WalkthroughCard
            key={item.id}
            title={item.title}
            imageSrc={item.imageSrc}
            imageAlt={item.imageAlt}
            onSelect={() => navigate(item.to)}
          />
        ))}
        {Array.from({ length: placeholders }, (_, i) => (
          <WalkthroughCard key={`soon-${i}`} comingSoon />
        ))}
      </section>
    </main>
  )
}

export default WalkthroughsList
