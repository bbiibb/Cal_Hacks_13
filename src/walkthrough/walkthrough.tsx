import { useEffect, useMemo } from 'react'
import styles from './walkthrough.module.css'
import Visualization, { type CameraOptions } from './visualization/visualization'
import { Cube } from './visualization/objects/Cube'
import { OrbitCameraController } from './visualization/camera/OrbitCameraController'
import type { CameraControllerFactory } from './visualization/camera/CameraController'

const TILT: [number, number, number] = [0.5, 0.6, 0]
const NO_TILT: [number, number, number] = [0, 0, 0]

const CAMERA: CameraOptions = {
  position: [0, 1.5, 4],
}

const orbitCamera: CameraControllerFactory = (camera, domElement) =>
  new OrbitCameraController(camera, domElement, {
    target: [0, 0, 0],
    minDistance: 2,
    maxDistance: 12,
  })

function Walkthroughs() {
  const objects = useMemo(
    () => [
      new Cube({ size: 0.8, position: [-1.5, 0, 0], rotation: TILT }),
      new Cube({ size: 0.8, rotation: NO_TILT }),
      new Cube({ size: 0.8, rotation: TILT }).setPosition(1.5, 0, 0),
    ],
    []
  )

  useEffect(() => () => objects.forEach((o) => o.dispose()), [objects])

  return (
    <main className={styles.window}>
      <Visualization objects={objects} camera={CAMERA} controller={orbitCamera} />
    </main>
  )
}

export default Walkthroughs
