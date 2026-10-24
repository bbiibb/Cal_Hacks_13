import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { CameraController } from './CameraController'

export type OrbitCameraOptions = {
  /** Point the camera orbits around. */
  target?: THREE.Vector3Tuple
  enableDamping?: boolean
  dampingFactor?: number
  enablePan?: boolean
  enableZoom?: boolean
  minDistance?: number
  maxDistance?: number
  /** Vertical orbit limits in radians (0 = straight down from above, PI = from below). */
  minPolarAngle?: number
  maxPolarAngle?: number
}

export class OrbitCameraController implements CameraController {
  private readonly controls: OrbitControls

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    {
      target = [0, 0, 0],
      enableDamping = true,
      dampingFactor = 0.08,
      enablePan = true,
      enableZoom = true,
      minDistance = 0,
      maxDistance = Infinity,
      minPolarAngle = 0,
      maxPolarAngle = Math.PI,
    }: OrbitCameraOptions = {}
  ) {
    const controls = new OrbitControls(camera, domElement)
    controls.enableDamping = enableDamping
    controls.dampingFactor = dampingFactor
    controls.enablePan = enablePan
    controls.enableZoom = enableZoom
    controls.minDistance = minDistance
    controls.maxDistance = maxDistance
    controls.minPolarAngle = minPolarAngle
    controls.maxPolarAngle = maxPolarAngle
    controls.target.set(...target)
    controls.update() // face the target before the first frame

    this.controls = controls
  }

  /** Pause or resume user input. */
  get enabled(): boolean {
    return this.controls.enabled
  }

  set enabled(value: boolean) {
    this.controls.enabled = value
  }

  /** Move the orbit point. Takes effect on the next frame. */
  setTarget(x: number, y: number, z: number): this {
    this.controls.target.set(x, y, z)
    return this
  }

  getTarget(target = new THREE.Vector3()): THREE.Vector3 {
    return target.copy(this.controls.target)
  }

  update(_delta: number): void {
    this.controls.update()
  }

  dispose(): void {
    this.controls.dispose()
  }
}
