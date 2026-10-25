import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './walkthrough.module.css'
import Visualization, { type CameraOptions } from './visualization/visualization'
import type { SceneObject } from './visualization/objects/SceneObject'
import { ModelObject } from './visualization/objects/ModelObject'
import { OrbitCameraController } from './visualization/camera/OrbitCameraController'
import type { CameraControllerFactory } from './visualization/camera/CameraController'
import { SceneDirector, type StepLookup } from './visualization/scene_director'
import ChatPanel from './chat/chat_panel'
import type { SceneAction } from './chat/chat_types'
import { createChatClient } from './chat/create_chat_client'
import { structureName, TAVI_PROCEDURE, TAVI_STRUCTURES } from './tavi_content'

const CAMERA: CameraOptions = {
  position: [0, 1.5, 4],
}

/** Builds a fresh set of scene objects. Called once per mount. */
function createSceneObjects(): SceneObject[] {
  return [
    new ModelObject({
      path: '/models/bicuspidic_aortic_root_with_calcifications.glb',
      color: '#FFE3CC', // pastel peach
      position: [0, 0, 0],
      scale: [2, 2, 2],
    }),
    new ModelObject({
      path: '/models/heart_part_1.glb',
      color: '#FFD3DE', // pastel pink
      position: [-2, 0, 0],
      scale: [2, 2, 2],
    }),
    new ModelObject({
      path: '/models/normal_aortic_arch.glb',
      color: '#CFE6FA', // pastel blue
      position: [2, 0, 0],
      scale: [2, 2, 2],
    }),
    new ModelObject({
      path: '/models/aortic_arch.glb',
      color: '#C8EED8', // pastel mint
      position: [-4, 0, 0],
      scale: [2, 2, 2],
    }),
  ]
}

const lookupStep: StepLookup = (procedureSlug, stepIndex) =>
  procedureSlug === TAVI_PROCEDURE.slug ? (TAVI_PROCEDURE.steps[stepIndex]?.scene ?? null) : null

function Walkthroughs() {
  const [objects, setObjects] = useState<SceneObject[]>([])
  const [director] = useState(() => new SceneDirector(lookupStep))
  const [chatClient] = useState(() => createChatClient(TAVI_PROCEDURE, TAVI_STRUCTURES))
  const [stepIndex, setStepIndex] = useState(0)
  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null)
  // The latest step, so a remount of the 3D objects shows the step the patient is on
  const stepRef = useRef(stepIndex)
  useEffect(() => {
    stepRef.current = stepIndex
  }, [stepIndex])

  // The orbit camera, shared with the director so chat commands can move it
  const orbitCamera = useMemo<CameraControllerFactory>(
    () => (camera, domElement) => {
      const orbit = new OrbitCameraController(camera, domElement, {
        target: [0, 0, 0],
        minDistance: 0,
        maxDistance: 12,
      })
      director.attachCamera(orbit)
      return {
        update: (delta) => {
          orbit.update(delta)
          director.tick(delta)
        },
        dispose: () => {
          director.detachCamera(orbit)
          orbit.dispose()
        },
      }
    },
    [director]
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
      if (!step) return
      director.showStep(step.scene)
      setStepIndex(index)
    },
    [director]
  )

  const applySceneActions = useCallback(
    (actions: SceneAction[]) => {
      // Move the step panel right away; the director moves the 3D view
      const lastStep = actions.findLast((a) => a.type === 'goto_step')
      if (
        lastStep?.type === 'goto_step' &&
        lastStep.procedure_slug === TAVI_PROCEDURE.slug &&
        TAVI_PROCEDURE.steps[lastStep.step_index]
      ) {
        setStepIndex(lastStep.step_index)
      }
      void director.apply(actions)
    },
    [director]
  )

  const selectStructure = useCallback(
    (structureId: string) => {
      setSelectedStructureId(structureId)
      void director.apply([
        { type: 'focus', structure_id: structureId },
        { type: 'highlight', structure_ids: [structureId], enabled: true },
      ])
    },
    [director]
  )

  return (
    <main className={styles.page}>
      <div className={styles.viewer}>
        <Visualization objects={objects} camera={CAMERA} controller={orbitCamera} />
        <p className={styles.hint}>Drag to turn · Scroll to zoom</p>
      </div>
      <div className={styles.panel}>
        <ChatPanel
          client={chatClient}
          procedure={TAVI_PROCEDURE}
          stepIndex={stepIndex}
          selectedStructureId={selectedStructureId}
          onStepChange={changeStep}
          onSceneActions={applySceneActions}
          onSelectStructure={selectStructure}
          structureName={structureName}
        />
      </div>
    </main>
  )
}

export default Walkthroughs
