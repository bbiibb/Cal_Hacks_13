import type { CSSProperties } from 'react'
import styles from './step_slider.module.css'

type SliderStep = {
  index: number
  title: string
  /** Label under the slider. Kept short so it fits. */
  short_title: string
}

type Props = {
  steps: readonly SliderStep[]
  value: number
  onChange: (index: number) => void
}

/**
 * The procedure timeline under the 3D view: drag the handle, click a label, or use the arrows to change step.
 * The part already passed is filled with color, and the current label is bold.
 */
function StepSlider({ steps, value, onChange }: Props) {
  const last = steps.length - 1
  const current = steps[value]
  const style = {
    '--steps': steps.length,
    '--p': last > 0 ? value / last : 0,
  } as CSSProperties

  return (
    <div className={styles.slider} style={style}>
      <button
        type="button"
        className={styles.arrow}
        onClick={() => onChange(value - 1)}
        disabled={value <= 0}
        aria-label="Previous step"
      >
        ‹
      </button>
      <div className={styles.track}>
        <input
          type="range"
          className={styles.range}
          min={0}
          max={last}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Procedure step"
          aria-valuetext={current ? `Step ${value + 1} of ${steps.length}: ${current.title}` : undefined}
        />
        <ol className={styles.labels}>
          {steps.map((step) => (
            <li key={step.index}>
              <button
                type="button"
                className={[
                  styles.label,
                  step.index === value ? styles.current : '',
                  step.index < value ? styles.passed : '',
                ].join(' ')}
                onClick={() => onChange(step.index)}
                title={step.title}
                aria-current={step.index === value ? 'step' : undefined}
              >
                <span className={styles.full}>{step.short_title}</span>
                <span className={styles.number} aria-hidden="true">
                  {step.index + 1}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <button
        type="button"
        className={styles.arrow}
        onClick={() => onChange(value + 1)}
        disabled={value >= last}
        aria-label="Next step"
      >
        ›
      </button>
    </div>
  )
}

export default StepSlider
