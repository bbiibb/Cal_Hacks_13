import { useEffect, useState } from 'react'
import styles from './walkthrough.module.css'
import Visualization, { type CameraOptions } from './visualization/visualization'
import type { SceneObject } from './visualization/objects/SceneObject'
import { ModelObject } from './visualization/objects/ModelObject'
import { OrbitCameraController } from './visualization/camera/OrbitCameraController'
import type { CameraControllerFactory } from './visualization/camera/CameraController'

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
    new ModelObject({
      path: '/models/bicuspidic_aortic_root_with_calcifications.glb',
      color: '#FFE3CC', // pastel peach
      position: [0.7 + heartTranslate[0], 0.78 + heartTranslate[1], 0.5 + heartTranslate[2]],
      rotation: [-3.14159 / 15, 0, -3.14159 / 3.8],
      scale: [0.75, 0.75, 0.75],
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
    new ModelObject({
      path: '/models/aortic_arch.glb',
      color: '#C8EED8', // pastel mint
      position: [1.13, 0.75, 0],
      rotation: [3.14159 / 3.5, 0, -3.14159 / 3],
      scale: [1.6, 1.6, 1.6],
    }).rotate(0, -3.14159 / 4, 0, 'local').rotate(0, 0, 3.14159 / 15, 'world'),
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
