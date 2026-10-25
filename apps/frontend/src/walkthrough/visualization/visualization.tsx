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
    scene.background = new THREE.Color(0xf4f1ee)
    sceneRef.current = scene

    // Bright fill from all around: lifts the dark undersides
    const fillLight = new THREE.HemisphereLight(0xffffff, 0xe8dff0, 2)
    scene.add(fillLight)

    // Gentler key light
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8)
    keyLight.position.set(3, 5, 4)
    scene.add(keyLight)

    // Soft light from the other side, so no face goes fully dark
    const backLight = new THREE.DirectionalLight(0xffffff, 0.8)
    backLight.position.set(-4, 2, -3)
    scene.add(backLight)

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

    const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true })
    renderer.localClippingEnabled = true
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
        obj.root.visible = obj.renderable // no material or no meshes: skipped when drawing
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

  // Every object's root joins the scene; content attached later (e.g. a loaded model) appears automatically
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    for (const obj of objects) scene.add(obj.root)
    objectsRef.current = objects

    return () => {
      for (const obj of objects) scene.remove(obj.root)
      objectsRef.current = []
    }
  }, [objects])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}

export default Visualization
