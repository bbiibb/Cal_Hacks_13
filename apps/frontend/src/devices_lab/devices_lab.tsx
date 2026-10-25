import { useEffect, useMemo, useState } from 'react'
import Visualization from '../walkthrough/visualization/visualization'
import type { SceneObject } from '../walkthrough/visualization/objects/SceneObject'
import { Balloon } from '../walkthrough/visualization/objects/Balloon'
import { TavrValve } from '../walkthrough/visualization/objects/TavrValve'
import { DeliveryCatheter } from '../walkthrough/visualization/objects/DeliveryCatheter'
import { TavrDeliverySystem } from '../walkthrough/visualization/objects/TavrDeliverySystem'
import { OrbitCameraController } from '../walkthrough/visualization/camera/OrbitCameraController'
import type { CameraControllerFactory } from '../walkthrough/visualization/camera/CameraController'
import styles from './devices_lab.module.css'

type Mode = 'gallery' | 'balloon' | 'valve' | 'catheter' | 'together'

type Parts = {
  gallery: SceneObject[]
  balloon: Balloon
  valve: TavrValve
  catheter: DeliveryCatheter
  together: TavrDeliverySystem
}

const MODES: { id: Mode; label: string }[] = [
  { id: 'gallery', label: 'All states side by side' },
  { id: 'balloon', label: 'Balloon' },
  { id: 'valve', label: 'Valve' },
  { id: 'catheter', label: 'Delivery catheter' },
  { id: 'together', label: 'Together, by step' },
]

/** A gently curved path that ends going down, like the way through the aorta to the valve. */
const PATH: [number, number, number][] = [
  [-0.9, 0.7, 0],
  [-0.5, 0.75, 0],
  [-0.1, 0.45, 0],
  [0, 0, 0],
  [0.02, -0.4, 0],
  [0.04, -0.8, 0],
]

const orbit: CameraControllerFactory = (camera, domElement) => {
  const controller = new OrbitCameraController(camera, domElement, { target: [0, 0, 0], minDistance: 0.2, maxDistance: 6 })
  return { update: (delta) => controller.update(delta), dispose: () => controller.dispose() }
}

/**
 * A workbench for the TAVR devices: each one on its own with sliders for what it can do, and all of them together
 * driven by the step buttons. Open it at /devices-lab. It is for checking the models, not part of the walkthrough.
 */
function DevicesLab() {
  // ?mode=valve&expansion=0.5&open=1&inflation=1&fill=1&step=3 opens the page in that state
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const number = (name: string, fallback: number) => (query.has(name) ? Number(query.get(name)) : fallback)
  const [mode, setMode] = useState<Mode>((query.get('mode') as Mode | null) ?? 'gallery')
  const [inflation, setInflation] = useState(number('inflation', 0))
  const [expansion, setExpansion] = useState(number('expansion', 1))
  const [leafletOpen, setLeafletOpen] = useState(number('open', 0))
  const [beating, setBeating] = useState(false)
  const [fill, setFill] = useState(number('fill', 1))
  const [step, setStep] = useState(number('step', 2))

  // Created and disposed together, so every mount (including React's double mount in development) gets live objects
  const [parts, setParts] = useState<Parts | null>(null)
  useEffect(() => {
    // The same devices in the states they pass through, side by side
    const stateful: [number, number][] = [
      [0, 0],
      [0.5, 0],
      [1, 0],
      [1, 1],
    ]
    const gallery: SceneObject[] = stateful.map(([expansion, open], i) => {
      const valve = new TavrValve({ expansion, leafletOpen: open })
      valve.setPosition(-0.55 + i * 0.33, 0.25, 0)
      return valve
    })
    ;[0, 0.5, 1].forEach((inflation, i) => {
      const balloon = new Balloon({ inflation })
      balloon.setPosition(-0.45 + i * 0.4, -0.3, 0)
      gallery.push(balloon)
    })
    const created: Parts = {
      gallery,
      balloon: new Balloon({ inflation: 0 }),
      valve: new TavrValve({ expansion: 1 }),
      catheter: new DeliveryCatheter({ points: PATH, stopAt: [0, 0, 0], fill: 1 }),
      together: new TavrDeliverySystem({ points: PATH, stopAt: [0, 0, 0], step: 2 }),
    }
    setParts(created)
    return () => [...created.gallery, created.balloon, created.valve, created.catheter, created.together].forEach((p) => p.dispose())
  }, [])

  const objects = useMemo<SceneObject[]>(() => (parts ? (mode === 'gallery' ? parts.gallery : [parts[mode]]) : []), [parts, mode])

  useEffect(() => void parts?.balloon.setInflation(inflation), [parts, inflation])
  useEffect(() => void parts?.valve.setExpansion(expansion), [parts, expansion])
  useEffect(() => {
    if (!parts) return
    if (beating) parts.valve.startBeating()
    else {
      parts.valve.stopBeating()
      parts.valve.setLeafletOpen(leafletOpen)
    }
  }, [parts, beating, leafletOpen])
  useEffect(() => void parts?.catheter.setFill(fill), [parts, fill])
  useEffect(() => void parts?.together.setStep(step), [parts, step])

  return (
    <main className={styles.page}>
      <div className={styles.view}>
        <Visualization objects={objects} camera={{ position: [0, 0.35, 1.5], fov: 45 }} controller={orbit} />
      </div>
      <aside className={styles.panel}>
        <h1 className={styles.title}>TAVR devices</h1>
        <div className={styles.modes} role="radiogroup" aria-label="Device">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              className={mode === m.id ? styles.modeOn : styles.mode}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'balloon' && (
          <Slider label="Inflation" value={inflation} onChange={setInflation} />
        )}
        {mode === 'valve' && (
          <>
            <Slider label="Expansion (crimped to open)" value={expansion} onChange={setExpansion} />
            <Slider label="Leaflets (closed to open)" value={leafletOpen} onChange={setLeafletOpen} disabled={beating} />
            <label className={styles.check}>
              <input type="checkbox" checked={beating} onChange={(e) => setBeating(e.target.checked)} /> Beating
            </label>
          </>
        )}
        {mode === 'catheter' && <Slider label="Insertion" value={fill} onChange={setFill} />}
        {mode === 'together' && (
          <div className={styles.steps}>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" className={step === n ? styles.stepOn : styles.stepBtn} onClick={() => setStep(n)}>
                Step {n}
              </button>
            ))}
            <p className={styles.note}>2: crimped valve carried in · 3: balloon opens the valve · 4: catheter withdrawn · 5: valve at work</p>
          </div>
        )}
      </aside>
    </main>
  )
}

function Slider({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className={styles.slider}>
      <span>{label}</span>
      <input type="range" min={0} max={1} step={0.01} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

export default DevicesLab
