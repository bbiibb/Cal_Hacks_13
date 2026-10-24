import { useEffect, useState } from 'react'
import styles from './walkthrough.module.css'
import Visualization, { type CameraOptions } from './visualization/visualization'
import type { SceneObject } from './visualization/objects/SceneObject'
import { ModelObject } from './visualization/objects/ModelObject'
import { OrbitCameraController } from './visualization/camera/OrbitCameraController'
import type { CameraControllerFactory } from './visualization/camera/CameraController'

const TILT: [number, number, number] = [0.5, 0.6, 0]

const CAMERA: CameraOptions = {
  position: [0, 1.5, 4],
}

const orbitCamera: CameraControllerFactory = (camera, domElement) =>
  new OrbitCameraController(camera, domElement, {
    target: [0, 0, 0],
    minDistance: 0,
    maxDistance: 12,
  })

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

function Walkthroughs() {
  const [objects, setObjects] = useState<SceneObject[]>([])

  // Creation and disposal share one lifecycle, so every mount gets live objects
  useEffect(() => {
    const created = createSceneObjects()
    setObjects(created)
    return () => created.forEach((o) => o.dispose())
  }, [])

  return (
    <main className={styles.window}>
      <Visualization objects={objects} camera={CAMERA} controller={orbitCamera} />
    </main>
  )
}

export default Walkthroughs
