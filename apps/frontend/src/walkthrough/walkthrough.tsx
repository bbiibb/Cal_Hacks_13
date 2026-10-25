import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import styles from './walkthrough.module.css'
import { parseStepParam, STEP_PARAM } from '../progress/progress_helpers'
import { useSaveProgress } from '../progress/use_save_progress'
import Visualization, { type CameraOptions } from './visualization/visualization'
import type { SceneObject } from './visualization/objects/SceneObject'
import { ModelObject } from './visualization/objects/ModelObject'
import { SlicedModelObject } from './visualization/objects/SlicedModelObject'
import { CurveFollower } from './visualization/objects/CurveFollower'
import { TavrDeliverySystem } from './visualization/objects/TavrDeliverySystem'
import { OrbitCameraController } from './visualization/camera/OrbitCameraController'
import type { CameraControllerFactory } from './visualization/camera/CameraController'
import { SceneDirector, type StepLookup } from './visualization/scene_director'
import { HEART_PART_2_REGIONS } from './visualization/heart_regions'
import { PartPicker } from './visualization/part_picker'
import ChatPanel from './chat/chat_panel'
import type { SceneAction } from './chat/chat_types'
import { createGuardedChat, disposePageGuard } from './chat/create_chat_client'
import StepSlider from './step_slider/step_slider'
import { structureInfo, structureName, TAVI_PROCEDURE, TAVI_STRUCTURES } from './tavi_content'

const CAMERA: CameraOptions = {
  position: [0, 1.5, 4],
}

/** Every model has this one color, so the heart reads as a whole; parts change color only when pointed at. */
const MODEL_COLOR = '#FFD3DE'

const heartTranslate: [number, number, number] = [-0.5, -0.5, -0.5]

/**
 * The way in for the wire and the catheter: along the aortic arch, down the ascending aorta, and through the middle
 * of the aortic root model, ending in the narrowed opening of the old valve (the lumen of the model gets narrower and
 * bends toward the heart; these points follow its center).
 */
const ROUTE_TO_OLD_VALVE: [number, number, number][] = [
  [-1, 0, -0.15],
  [-0.6, 0.7, -0.07],
  [-0.05, 0.6, -0.07],
  [-0.1, 0, -0.07],
  [-0.2, -0.4, -0.07],
  [-0.15, -0.7, 0.03],
  [-0.14, -1, 0.03],
  [-0.17, -1.1, 0.05],
  [-0.22, -1.2, 0.07],
  [-0.27, -1.27, 0.08],
  [-0.31, -1.32, 0.085], // the narrowed opening of the old valve (the gap between its calcified leaflets)
]

/** The catheter goes on a little way into the heart, past the old valve. */
const TAVR_DEVICE_PATH: [number, number, number][] = [...ROUTE_TO_OLD_VALVE, [-0.34, -1.5, 0.1], [-0.38, -1.75, 0.11]]

/** Where the middle of the new valve sits once it is placed: across the old valve, with most of it above the opening. */
const TAVR_VALVE_POSITION: [number, number, number] = [-0.31, -1.32, 0.085]

/** The green catheter is out of sight in step 0 (only the heart), fully in from step 1, and gone on the last step. */
function greenCatheterFillAt(stepIndex: number): number {
  return stepIndex === 0 || stepIndex >= TAVI_PROCEDURE.steps.length - 1 ? 0 : 1
}

/** A curve whose fill follows the current step. */
type StepCurve = {
  follower: CurveFollower
  fillAt: (stepIndex: number) => number
}

/** Builds a fresh scene, opened at the given step. Called once per mount. */
function createScene(initialStep: number): { objects: SceneObject[]; curves: StepCurve[]; devices: TavrDeliverySystem } {
  // The delivery catheter with the balloon and the valve: they follow the current step
  const devices = new TavrDeliverySystem({ points: TAVR_DEVICE_PATH, stopAt: TAVR_VALVE_POSITION, step: initialStep })

  // The green catheter: in for the whole procedure, withdrawn on the last step
  const greenCatheter = new CurveFollower({
    points: [
      ...ROUTE_TO_OLD_VALVE,
      [-0.34, -1.5, 0.1],
      [-0.38, -1.75, 0.11],
      [-0.55, -2.05, 0.14],
      [-0.8, -2.15, 0.15],
      [-0.9, -2.15, 0.15],
      [-0.9, -1.9, 0.15],
      [-0.88, -1.9, 0.15],
    ],
    radius: 0.01,
    fill: greenCatheterFillAt(initialStep),
    color: '#ccf0c4', // pastel green
  })

  const objects: SceneObject[] = [
    // The aortic root sits on the heart's aortic valve, at the base of the heart's own ascending aorta
    new SlicedModelObject({
      path: '/models/bicuspidic_aortic_root_with_calcifications.glb',
      color: MODEL_COLOR,
      position: [-0.278, -1.297, 0.089],
      rotation: [0, 3.14159, 0], // the heart is shown from behind, so every model is turned half a turn like it
      scale: [0.75, 0.75, 0.75],
      slice: { space: 'world', point: [0, 0, 0.08], normal: [0, 0, 1] },
    }),
    new ModelObject({
      path: '/models/heart_part_2.glb',
      color: MODEL_COLOR,
      position: [0 + heartTranslate[0], -1 + heartTranslate[1], 0 + heartTranslate[2]],
      rotation: [0, 3.14159, 0],
      scale: [3, 3, 3],
      regions: HEART_PART_2_REGIONS,
    }),
    /*new ModelObject({
      path: '/models/normal_aortic_arch.glb',
      color: '#CFE6FA', // pastel blue
      position: [2 + heartTranslate[0], 0 + heartTranslate[1], 0 + heartTranslate[2]],
      scale: [2, 2, 2],
    }),*/
    // The aortic arch continues the heart's ascending aorta from its cut top; its branch vessels point up
    new SlicedModelObject({
      path: '/models/aortic_arch_fixed.glb',
      color: MODEL_COLOR,
      position: [-0.165, 0.798, 0.019],
      rotation: [-0.1745, 3.14159, 0.3595],
      scale: [1.6, 1.6, 1.6],
      slice: { space: 'world', point: [0, 0, 0.08], normal: [0, 0, 1] },
    }),
    devices,
    greenCatheter,
  ]

  return {
    objects,
    curves: [{ follower: greenCatheter, fillAt: greenCatheterFillAt }],
    devices,
  }
}

const lookupStep: StepLookup = (procedureSlug, stepIndex) =>
  procedureSlug === TAVI_PROCEDURE.slug ? (TAVI_PROCEDURE.steps[stepIndex]?.scene ?? null) : null

type Hover = { id: string; x: number; y: number }

function Walkthroughs() {
  const [objects, setObjects] = useState<SceneObject[]>([])
  const [director] = useState(() => new SceneDirector(lookupStep))
  const [{ client: chatClient, guard: piiGuard }] = useState(() => createGuardedChat(TAVI_PROCEDURE, TAVI_STRUCTURES))
  // ?step=N (from "Continue" on the landing page) opens the walkthrough at that step; otherwise it starts at step 0, the introduction
  const [searchParams] = useSearchParams()
  const [stepIndex, setStepIndex] = useState(
    () => parseStepParam(searchParams.get(STEP_PARAM), TAVI_PROCEDURE.steps.length) ?? 0
  )
  useSaveProgress(TAVI_PROCEDURE.slug, stepIndex, TAVI_PROCEDURE.steps.length)

  // The conversation lasts until the window is closed: then the backend deletes it
  useEffect(() => {
    const onPageHide = (event: PageTransitionEvent) => {
      chatClient.close?.()
      // A page kept for back/forward navigation (persisted) is restored later, so keep its guard
      if (!event.persisted) disposePageGuard()
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [chatClient])
  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null)
  const [hover, setHover] = useState<Hover | null>(null)

  // The latest step, so a remount of the 3D objects shows the step the patient is on
  const stepRef = useRef(stepIndex)
  useEffect(() => {
    stepRef.current = stepIndex
  }, [stepIndex])

  // The live catheters, so step changes can move them
  const curvesRef = useRef<StepCurve[]>([])
  // The delivery catheter, balloon and valve, which follow the step too
  const devicesRef = useRef<TavrDeliverySystem | null>(null)

  const pin = useCallback(
    (structureId: string | null) => {
      setSelectedStructureId(structureId)
      director.setSelection(structureId)
    },
    [director]
  )

  // The orbit camera, shared with the director so chat commands can move it, plus pointing at parts
  const orbitCamera = useMemo<CameraControllerFactory>(
    () => (camera, domElement) => {
      const orbit = new OrbitCameraController(camera, domElement, {
        target: [0, 0, 0],
        minDistance: 0,
        maxDistance: 12,
      })
      director.attachCamera(orbit)
      const picker = new PartPicker(camera, domElement, (raycaster) => director.pickStructure(raycaster), {
        onHover: (id, x, y) => setHover(id ? { id, x, y } : null),
        onPick: (id) => pin(id),
      })
      return {
        update: (delta) => {
          orbit.update(delta)
          director.tick(delta)
        },
        dispose: () => {
          picker.dispose()
          director.detachCamera(orbit)
          orbit.dispose()
        },
      }
    },
    [director, pin]
  )

  // Creation and disposal share one lifecycle, so every mount gets live objects
  useEffect(() => {
    const { objects: created, curves, devices } = createScene(stepRef.current)
    curvesRef.current = curves
    devicesRef.current = devices
    // Open the page with ?regions to color each named part of a model, for checking where the regions lie
    if (new URLSearchParams(window.location.search).has('regions')) {
      for (const object of created) if (object instanceof ModelObject) object.setRegionDebug(true)
    }
    setObjects(created)
    director.setObjects(created)
    const step = TAVI_PROCEDURE.steps[stepRef.current]
    if (step) director.showStep(step.scene)
    return () => {
      curvesRef.current = []
      devicesRef.current = null
      director.setObjects([])
      created.forEach((o) => o.dispose())
    }
  }, [director])

  // Each catheter advances or withdraws to its depth for the current step
  useEffect(() => {
    for (const { follower, fillAt } of curvesRef.current) follower.animateFillTo(fillAt(stepIndex))
    devicesRef.current?.setStep(stepIndex)
  }, [stepIndex])

  const changeStep = useCallback(
    (index: number) => {
      const step = TAVI_PROCEDURE.steps[index]
      if (!step || index === stepRef.current) return
      stepRef.current = index
      director.showStep(step.scene)
      setStepIndex(index)
    },
    [director]
  )

  const applySceneActions = useCallback(
    (actions: SceneAction[]) => {
      // Move the slider and the step panel right away; the director moves the 3D view
      const lastStep = actions.findLast((a) => a.type === 'goto_step')
      if (
        lastStep?.type === 'goto_step' &&
        lastStep.procedure_slug === TAVI_PROCEDURE.slug &&
        TAVI_PROCEDURE.steps[lastStep.step_index]
      ) {
        stepRef.current = lastStep.step_index
        setStepIndex(lastStep.step_index)
      }
      void director.apply(actions)
    },
    [director]
  )

  const selectStructure = useCallback(
    (structureId: string) => {
      pin(structureId)
      void director.apply([{ type: 'focus', structure_id: structureId }])
    },
    [director, pin]
  )

  const unpin = useCallback(() => pin(null), [pin])

  return (
    <main className={styles.page}>
      <div className={styles.viewer}>
        <Visualization objects={objects} camera={CAMERA} controller={orbitCamera} />
        <p className={styles.hint}>Drag to turn · Scroll to zoom · Click a part</p>
        <button type="button" className={styles.reset} onClick={() => director.resetView()}>
          Reset view
        </button>
        {hover && (
          <div className={styles.hoverLabel} style={{ left: hover.x, top: hover.y }} aria-hidden="true">
            {structureName(hover.id)}
          </div>
        )}
        <div className={styles.timeline}>
          <StepSlider steps={TAVI_PROCEDURE.steps} value={stepIndex} onChange={changeStep} />
        </div>
      </div>
      <div className={styles.panel}>
        <ChatPanel
          client={chatClient}
          guard={piiGuard}
          procedure={TAVI_PROCEDURE}
          stepIndex={stepIndex}
          selectedStructureId={selectedStructureId}
          hoveredStructureId={hover?.id ?? null}
          onUnpin={unpin}
          onSceneActions={applySceneActions}
          onSelectStructure={selectStructure}
          structureName={structureName}
          structureInfo={structureInfo}
        />
      </div>
    </main>
  )
}

export default Walkthroughs
