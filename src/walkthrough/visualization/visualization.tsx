import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { SceneObject } from './objects/SceneObject'
import type { CameraControllerFactory } from './camera/CameraController'

export type CameraOptions = {
  position?: THREE.Vector3Tuple
  fov?: number
  near?: number
  far?: number
}

type Props = {
  objects: SceneObject[]
  /** Initial camera setup. Read once on mount. */
  camera?: CameraOptions
  /** Creates the camera controller. Read once on mount. Omit for a static camera. */
  controller?: CameraControllerFactory
}

function Visualization({ objects, camera, controller }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const objectsRef = useRef<SceneObject[]>([])
  const initialConfig = useRef({ camera, controller })

  // Renderer, scene, camera, controller and render loop: created once
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)
    sceneRef.current = scene

    const {
      position = [0, 0, 3],
      fov = 75,
      near = 0.1,
      far = 1000,
    } = initialConfig.current.camera ?? {}

    const perspective = new THREE.PerspectiveCamera(
      fov,
      mount.clientWidth / mount.clientHeight,
      near,
      far
    )
    perspective.position.set(...position)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    const cameraController =
      initialConfig.current.controller?.(perspective, renderer.domElement) ?? null

    let last: number | null = null
    renderer.setAnimationLoop((time) => {
      const delta = last === null ? 0 : (time - last) / 1000
      last = time

      // 1. Objects
      for (const obj of objectsRef.current) {
        obj.update(delta)
        if (!obj.mesh) continue // nothing to render
        obj.syncMesh()
      }

      // 2. Camera
      cameraController?.update(delta)

      // 3. Draw
      renderer.render(scene, perspective)
    })

    const resizeObserver = new ResizeObserver(() => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      if (!width || !height) return

      perspective.aspect = width / height
      perspective.updateProjectionMatrix()
      renderer.setSize(width, height)
    })
    resizeObserver.observe(mount)

    return () => {
      renderer.setAnimationLoop(null)
      cameraController?.dispose()
      resizeObserver.disconnect()
      renderer.dispose()
      renderer.domElement.remove()
      sceneRef.current = null
    }
  }, [])

  // Add renderable objects to the scene; mesh-less objects are skipped
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    for (const obj of objects) {
      if (obj.mesh) scene.add(obj.mesh)
    }
    objectsRef.current = objects

    return () => {
      for (const obj of objects) {
        if (obj.mesh) scene.remove(obj.mesh)
      }
      objectsRef.current = []
    }
  }, [objects])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}

export default Visualization