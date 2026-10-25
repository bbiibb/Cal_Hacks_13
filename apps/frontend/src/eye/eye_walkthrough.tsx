import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import styles from '../walkthrough/walkthrough.module.css'
import Visualization, { type CameraOptions } from '../walkthrough/visualization/visualization'
import type { SceneObject } from '../walkthrough/visualization/objects/SceneObject'
import { ModelObject } from '../walkthrough/visualization/objects/ModelObject'
import { OrbitCameraController } from '../walkthrough/visualization/camera/OrbitCameraController'
import type { CameraControllerFactory } from '../walkthrough/visualization/camera/CameraController'
import { SceneDirector, type StepLookup } from '../walkthrough/visualization/scene_director'
import { PartPicker } from '../walkthrough/visualization/part_picker'
import ChatPanel from '../walkthrough/chat/chat_panel'
import type { SceneAction } from '../walkthrough/chat/chat_types'
import { DemoChatClient } from '../walkthrough/chat/demo_chat_client'
import { disposePageGuard, getPageGuard } from '../walkthrough/chat/create_chat_client'
import { guardedChatClient } from '../walkthrough/privacy'
import StepSlider from '../walkthrough/step_slider/step_slider'
import {
  EYE_DEMO_CONTENT,
  EYE_PROCEDURE,
  EYE_STRUCTURES,
  EYE_TOPIC,
  eyeStructureInfo,
  eyeStructureName,
} from './eye_content'

const CAMERA: CameraOptions = {
  position: [0, 0.3, 3.1],
}

/**
 * Each part has its own soft color, because the layers of the eye are nested inside each other.
 * A model file is always scaled to a unit cube and centered, so each part says where it sits in the eye
 * (`position` is the middle of the part, `scale` its longest side).
 */
const PARTS: Record<string, { color: string; position: [number, number, number]; scale: number }> = {
  cornea: { color: '#d6ecf7', position: [0.94, 0.0097, -0.2489], scale: 1.1045 },
  iris: { color: '#9fb8e8', position: [0.7423, -0.003, -0.3303], scale: 1.4334 },
  lens: { color: '#f7e9b0', position: [0.8017, 0.0232, -0.1351], scale: 0.5099 },
  suspensory_ligaments: { color: '#d9b8e6', position: [0.805, 0.0205, -0.1856], scale: 0.6356 },
  sclera: { color: '#f4efe8', position: [-0.0129, 0.0012, -0.4874], scale: 1.9871 },
  choroid: { color: '#e8a9b0', position: [-0.0188, 0.0012, -0.4615], scale: 1.8302 },
  retina: { color: '#f6c9a8', position: [-0.0278, 0.0012, -0.4276], scale: 1.6368 },
  optic_nerve: { color: '#e4c79a', position: [-1.1416, -0.2283, -0.1064], scale: 0.8955 },
}

/** The eye parts, cut in half and cleaned up for the web (see docs/eye-prototype.md). */
function createEyeScene(): SceneObject[] {
  return Object.entries(PARTS).map(
    ([id, { color, position, scale }]) =>
      new ModelObject({
        path: `/models/eye/eye_${id}.glb`,
        position,
        scale,
        // The shells are open on the cut side, so both faces are drawn
        material: new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, side: THREE.DoubleSide }),
      })
  )
}

const lookupStep: StepLookup = (procedureSlug, stepIndex) =>
  procedureSlug === EYE_PROCEDURE.slug ? (EYE_PROCEDURE.steps[stepIndex]?.scene ?? null) : null

type Hover = { id: string; x: number; y: number }

/** A prototype walkthrough of the eye: the same page as the TAVR walkthrough, with demo answers and placeholder text. */
function EyeWalkthrough() {
  const [objects, setObjects] = useState<SceneObject[]>([])
  const [director] = useState(() => new SceneDirector(lookupStep))
  const [guard] = useState(() => getPageGuard())
  const [chatClient] = useState(() =>
    guardedChatClient(new DemoChatClient(EYE_PROCEDURE, EYE_STRUCTURES, EYE_DEMO_CONTENT), guard)
  )
  const [stepIndex, setStepIndex] = useState(0)
  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const stepRef = useRef(0)

  useEffect(() => {
    const onPageHide = (event: PageTransitionEvent) => {
      if (!event.persisted) disposePageGuard()
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [])

  const pin = useCallback(
    (structureId: string | null) => {
      setSelectedStructureId(structureId)
      director.setSelection(structureId)
    },
    [director]
  )

  const orbitCamera = useMemo<CameraControllerFactory>(
    () => (camera, domElement) => {
      const orbit = new OrbitCameraController(camera, domElement, { target: [0, 0, 0], minDistance: 0, maxDistance: 12 })
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
    const created = createEyeScene()
    setObjects(created)
    director.setObjects(created)
    const step = EYE_PROCEDURE.steps[stepRef.current]
    if (step) director.showStep(step.scene)
    return () => {
      director.setObjects([])
      created.forEach((o) => o.dispose())
    }
  }, [director])

  const changeStep = useCallback(
    (index: number) => {
      const step = EYE_PROCEDURE.steps[index]
      if (!step || index === stepRef.current) return
      stepRef.current = index
      director.showStep(step.scene)
      setStepIndex(index)
    },
    [director]
  )

  const applySceneActions = useCallback(
    (actions: SceneAction[]) => {
      const lastStep = actions.findLast((a) => a.type === 'goto_step')
      if (
        lastStep?.type === 'goto_step' &&
        lastStep.procedure_slug === EYE_PROCEDURE.slug &&
        EYE_PROCEDURE.steps[lastStep.step_index]
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

  return (
    <main className={styles.page}>
      <div className={styles.viewer}>
        <Visualization objects={objects} camera={CAMERA} controller={orbitCamera} />
        <p className={styles.hint}>Drag to turn · Scroll to zoom · Click a part</p>
        <p className={styles.credit}>
          3D model "Cross Section of Eye - Anatomy" by{' '}
          <a href="https://sketchfab.com/erikao" target="_blank" rel="noreferrer">
            Erik Ao
          </a>
          , CC BY 4.0, simplified for the web
        </p>
        <button type="button" className={styles.reset} onClick={() => director.resetView()}>
          Reset view
        </button>
        {hover && (
          <div className={styles.hoverLabel} style={{ left: hover.x, top: hover.y }} aria-hidden="true">
            {eyeStructureName(hover.id)}
          </div>
        )}
        <div className={styles.timeline}>
          <StepSlider steps={EYE_PROCEDURE.steps} value={stepIndex} onChange={changeStep} />
        </div>
      </div>
      <div className={styles.panel}>
        <ChatPanel
          client={chatClient}
          guard={guard}
          procedure={EYE_PROCEDURE}
          topic={EYE_TOPIC}
          stepIndex={stepIndex}
          selectedStructureId={selectedStructureId}
          hoveredStructureId={hover?.id ?? null}
          onUnpin={() => pin(null)}
          onSceneActions={applySceneActions}
          onSelectStructure={selectStructure}
          structureName={eyeStructureName}
          structureInfo={eyeStructureInfo}
        />
      </div>
    </main>
  )
}

export default EyeWalkthrough
