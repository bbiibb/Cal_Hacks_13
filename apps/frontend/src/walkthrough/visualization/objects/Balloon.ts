import * as THREE from 'three'
import { SceneObject, type Transform } from './SceneObject'
import { ValueAnimator } from './ValueAnimator'
import { DEFAULT_BALLOON_SHAPE, balloonProfile, type BalloonShape } from './device_geometry'

export type BalloonOptions = Transform & {
  shape?: Partial<BalloonShape>
  /** 0 = wrapped under the valve, 1 = fully inflated. */
  inflation?: number
  color?: THREE.ColorRepresentation
}

/**
 * The balloon that opens the valve: see-through, with a taper at each end, centered on its own middle and
 * built along the Y axis (+Y points toward the heart). Inflating it widens the body.
 */
export class Balloon extends SceneObject {
  readonly shape: BalloonShape

  private readonly inflationAnimator: ValueAnimator
  private mesh: THREE.Mesh
  private shown = true

  constructor({ shape, inflation = 0, color = '#bcd6ff', ...transform }: BalloonOptions = {}) {
    super({
      ...transform,
      material: new THREE.MeshStandardMaterial({
        color,
        roughness: 0.15,
        metalness: 0,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    })
    this.shape = { ...DEFAULT_BALLOON_SHAPE, ...shape }
    this.inflationAnimator = new ValueAnimator(THREE.MathUtils.clamp(inflation, 0, 1))
    this.mesh = new THREE.Mesh(this.buildGeometry())
    this.mesh.renderOrder = 5 // after the opaque valve and shaft, so they show through
    this.setContent(this.mesh)
  }

  get inflation(): number {
    return this.inflationAnimator.value
  }

  get renderable(): boolean {
    return this.shown && super.renderable
  }

  /** Show or hide the whole balloon. */
  setShown(shown: boolean): this {
    this.shown = shown
    return this
  }

  setInflation(inflation: number): this {
    this.inflationAnimator.set(THREE.MathUtils.clamp(inflation, 0, 1))
    this.rebuild()
    return this
  }

  /** Move smoothly to an inflation between 0 and 1. */
  animateInflationTo(inflation: number, durationMs = 1500, delayMs = 0): this {
    this.inflationAnimator.animateTo(THREE.MathUtils.clamp(inflation, 0, 1), durationMs, delayMs)
    return this
  }

  update(delta: number): void {
    super.update(delta)
    if (this.inflationAnimator.update(delta)) this.rebuild()
  }

  private rebuild(): void {
    this.mesh.geometry.dispose()
    this.mesh.geometry = this.buildGeometry()
  }

  private buildGeometry(): THREE.LatheGeometry {
    const points = balloonProfile(this.shape, this.inflationAnimator.value).map(([r, y]) => new THREE.Vector2(r, y))
    return new THREE.LatheGeometry(points, 28)
  }
}
