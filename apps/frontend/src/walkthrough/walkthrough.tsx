import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './walkthrough.module.css'
import Visualization, { type CameraOptions } from './visualization/visualization'
import type { SceneObject } from './visualization/objects/SceneObject'
import { ModelObject } from './visualization/objects/ModelObject'
import { SlicedModelObject } from './visualization/objects/SlicedModelObject'
import { OrbitCameraController } from './visualization/camera/OrbitCameraController'
import type { CameraControllerFactory } from './visualization/camera/CameraController'
import { SceneDirector, type StepLookup } from './visualization/scene_director'
import { PartPicker } from './visualization/part_picker'
import ChatPanel from './chat/chat_panel'
import type { SceneAction } from './chat/chat_types'
import { createGuardedChat, disposePageGuard } from './chat/create_chat_client'
import StepSlider from './step_slider/step_slider'
import { structureInfo, structureName, TAVI_PROCEDURE, TAVI_STRUCTURES } from './tavi_content'

const CAMERA: CameraOptions = {
  position: [0, 1.5, 4],
}

const orbitCamera: CameraControllerFactory = (camera, domElement) =>
  new OrbitCameraController(camera, domElement, {
    target: [0, 0, 0],
    minDistance: 0,
    maxDistance: 12,
  })

const heartTranslate: [number, number, number] = [-0.5, -0.5, -0.5];

/** Builds a fresh set of scene objects. Called once per mount. */
function createSceneObjects(): SceneObject[] {
  return [
    new SlicedModelObject({
      path: '/models/bicuspidic_aortic_root_with_calcifications.glb',
      color: '#FFE3CC', // pastel peach
      position: [0.7 + heartTranslate[0], 0.78 + heartTranslate[1], 0.5 + heartTranslate[2]],
      rotation: [-3.14159 / 15, 0, -3.14159 / 3.8],
      scale: [0.75, 0.75, 0.75],
      slice: { space: 'world', point: [0, 0, 0.08], normal: [0, 0, 1] },
    }),
    new ModelObject({
      path: '/models/heart_part_2.glb',
      color: '#FFD3DE', // pastel pink
      position: [0 + heartTranslate[0], -1 + heartTranslate[1], 0 + heartTranslate[2]],
      rotation: [0, 3.14159, 0],
      scale: [3, 3, 3],
    }),
    /*new ModelObject({
      path: '/models/normal_aortic_arch.glb',
      color: '#CFE6FA', // pastel blue
      position: [2 + heartTranslate[0], 0 + heartTranslate[1], 0 + heartTranslate[2]],
      scale: [2, 2, 2],
    }),*/
    new SlicedModelObject({
      path: '/models/aortic_arch_fixed.glb',
      color: '#C8EED8', // pastel mint
      position: [1.13, 0.75, 0],
      rotation: [3.14159 / 3.5, 0, -3.14159 / 3],
      scale: [1.6, 1.6, 1.6],
      slice: { space: 'world', point: [0, 0, 0.08], normal: [0, 0, 1] },
    }).rotate(0, -3.14159 / 4, 0, 'local').rotate(0, 0, 3.14159 / 15, 'world'),
  ]
}

const lookupStep: StepLookup = (procedureSlug, stepIndex) =>
  procedureSlug === TAVI_PROCEDURE.slug ? (TAVI_PROCEDURE.steps[stepIndex]?.scene ?? null) : null

type Hover = { id: string; x: number; y: number }

function Walkthroughs() {
  const [objects, setObjects] = useState<SceneObject[]>([])
  const [director] = useState(() => new SceneDirector(lookupStep))
  const [{ client: chatClient, guard: piiGuard }] = useState(() => createGuardedChat(TAVI_PROCEDURE, TAVI_STRUCTURES))
  const [stepIndex, setStepIndex] = useState(0)

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
    const created = createSceneObjects()
    setObjects(created)
    director.setObjects(created)
    const step = TAVI_PROCEDURE.steps[stepRef.current]
    if (step) director.showStep(step.scene)
    return () => {
      director.setObjects([])
      created.forEach((o) => o.dispose())
    }
  }, [director])

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
