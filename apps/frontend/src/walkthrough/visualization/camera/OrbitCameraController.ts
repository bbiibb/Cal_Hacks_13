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

/**
 * A camera placement described around an orbit point.
 * radius = distance to the target, theta = angle around the vertical axis, phi = angle down from straight above.
 */
export type OrbitPose = {
  target: THREE.Vector3
  radius: number
  theta: number
  phi: number
}

type Tween = {
  from: OrbitPose
  to: OrbitPose
  elapsed: number
  duration: number
}

const TWO_PI = Math.PI * 2
const POLAR_MARGIN = 0.05
const MIN_RADIUS = 0.15

const _offset = new THREE.Vector3()
const _spherical = new THREE.Spherical()

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function clonePose(pose: OrbitPose): OrbitPose {
  return { ...pose, target: pose.target.clone() }
}

export class OrbitCameraController implements CameraController {
  readonly camera: THREE.PerspectiveCamera
  private readonly controls: OrbitControls
  private tween: Tween | null = null
  private readonly cancelTween = () => {
    this.tween = null
  }

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

    // The user grabbing the view always wins over a scripted camera move
    controls.addEventListener('start', this.cancelTween)

    this.camera = camera
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

  /** True while a scripted camera move is playing. */
  get animating(): boolean {
    return this.tween !== null
  }

  /**
   * The camera placement as an orbit pose.
   * With `planned` (the default), a move in progress reports where it will end,
   * so commands given one after another build on each other.
   */
  getPose(planned = true): OrbitPose {
    if (planned && this.tween) return clonePose(this.tween.to)
    return this.poseFromPosition(this.camera.position, this.controls.target)
  }

  /** Describe a camera position looking at a target as an orbit pose. */
  poseFromPosition(position: THREE.Vector3, target: THREE.Vector3): OrbitPose {
    _spherical.setFromVector3(_offset.subVectors(position, target))
    return {
      target: target.clone(),
      radius: _spherical.radius,
      theta: _spherical.theta,
      phi: _spherical.phi,
    }
  }

  /** Keep a pose inside the distance and vertical-angle limits of this controller. */
  clampPose(pose: OrbitPose): OrbitPose {
    const { minDistance, maxDistance, minPolarAngle, maxPolarAngle } = this.controls
    return {
      target: pose.target.clone(),
      radius: THREE.MathUtils.clamp(pose.radius, Math.max(minDistance, MIN_RADIUS), maxDistance),
      theta: pose.theta,
      phi: THREE.MathUtils.clamp(
        pose.phi,
        Math.max(minPolarAngle, POLAR_MARGIN),
        Math.min(maxPolarAngle, Math.PI - POLAR_MARGIN)
      ),
    }
  }

  /** Glide the camera to a pose. A duration of 0 jumps there at once. */
  animateTo(pose: OrbitPose, durationMs: number): void {
    const to = this.clampPose(pose)
    const from = this.getPose(false)
    // Turn the short way round, so a small rotation never becomes a full spin
    from.theta += TWO_PI * Math.round((to.theta - from.theta) / TWO_PI)

    if (durationMs <= 0) {
      this.tween = null
      this.applyPose(to)
      return
    }
    this.tween = { from, to, elapsed: 0, duration: durationMs / 1000 }
  }

  /** Stop a scripted camera move where it is. */
  stopAnimation(): void {
    this.tween = null
  }

  update(delta: number): void {
    const tween = this.tween
    if (tween) {
      tween.elapsed += delta
      const t = Math.min(1, tween.elapsed / tween.duration)
      const e = easeInOutCubic(t)
      this.applyPose({
        target: new THREE.Vector3().lerpVectors(tween.from.target, tween.to.target, e),
        radius: THREE.MathUtils.lerp(tween.from.radius, tween.to.radius, e),
        theta: THREE.MathUtils.lerp(tween.from.theta, tween.to.theta, e),
        phi: THREE.MathUtils.lerp(tween.from.phi, tween.to.phi, e),
      })
      if (t >= 1) this.tween = null
    }
    this.controls.update()
  }

  dispose(): void {
    this.tween = null
    this.controls.removeEventListener('start', this.cancelTween)
    this.controls.dispose()
  }

  private applyPose(pose: OrbitPose): void {
    _spherical.set(pose.radius, pose.phi, pose.theta)
    this.controls.target.copy(pose.target)
    this.camera.position.copy(pose.target).add(_offset.setFromSpherical(_spherical))
  }
}
