import * as THREE from 'three'
import { SceneObject, type Transform } from './SceneObject'
import { ValueAnimator } from './ValueAnimator'

export type DeliveryCatheterOptions = Transform & {
  /** The path of the catheter, from outside the body into the heart. At least 2 points, in this object's space. */
  points: THREE.Vector3Tuple[]
  /**
   * The point where the middle of the balloon and valve sits when the catheter is fully inserted (fill = 1).
   * The path should run on past it, so the tip has somewhere to go.
   */
  stopAt: THREE.Vector3Tuple
  /** How far it is inserted: 0 = outside the body, 1 = the valve at `stopAt`. */
  fill?: number
  /** Radius of the dark blue outer tube and of the thinner, lighter shaft inside the balloon. */
  sheathRadius?: number
  shaftRadius?: number
  /** Distance from the middle of the head back to where the outer tube ends (the start of the balloon). */
  sheathGap?: number
  /** Length of the shaft that continues past the middle of the head: through the balloon, then the soft tip. */
  tipStart?: number
  tipLength?: number
}

const UP = new THREE.Vector3(0, 1, 0)
const SHEATH_SEGMENTS = 160
const SHEATH_RADIAL = 14

/**
 * The delivery catheter: a dark blue tube that follows a path from outside the body to the valve, a thinner blue
 * shaft inside the balloon, and a soft rounded tip beyond it. The balloon and the valve are separate objects that
 * ride on the head of this one (see TavrDeliverySystem); `headPose` says where the head is.
 */
export class DeliveryCatheter extends SceneObject {
  private readonly curve: THREE.CatmullRomCurve3
  private readonly length: number
  /** Where along the path (0 to 1) the head is when fully inserted. */
  private readonly stopU: number
  private readonly fillAnimator: ValueAnimator
  private readonly sheathGap: number
  private readonly shaftRadius: number

  private readonly sheath: THREE.Mesh
  private readonly flex: THREE.Mesh
  private readonly head = new THREE.Group()
  private readonly materials: THREE.Material[]
  private shown = true

  constructor({
    points,
    stopAt,
    fill = 1,
    sheathRadius = 0.022,
    shaftRadius = 0.013,
    sheathGap = 0.195,
    tipStart = 0.195,
    tipLength = 0.14,
    ...transform
  }: DeliveryCatheterOptions) {
    super(transform)
    if (points.length < 2) throw new Error('DeliveryCatheter needs at least 2 points')

    this.shaftRadius = shaftRadius
    this.sheathGap = sheathGap
    this.fillAnimator = new ValueAnimator(THREE.MathUtils.clamp(fill, 0, 1))
    this.curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
      false,
      'centripetal'
    )
    this.length = this.curve.getLength()
    this.stopU = this.nearestU(new THREE.Vector3(...stopAt))

    const sheathMaterial = new THREE.MeshStandardMaterial({ color: '#1f3a93', roughness: 0.4, metalness: 0.1 })
    const shaftMaterial = new THREE.MeshStandardMaterial({ color: '#3b6fe0', roughness: 0.35, metalness: 0.05 })
    this.materials = [sheathMaterial, shaftMaterial]

    this.sheath = new THREE.Mesh(
      new THREE.TubeGeometry(this.curve, SHEATH_SEGMENTS, sheathRadius, SHEATH_RADIAL, false),
      sheathMaterial
    )
    this.flex = new THREE.Mesh(new THREE.BufferGeometry(), shaftMaterial)

    // The head: the shaft that runs on through the balloon, and the soft rounded tip at its end
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius * 0.85, shaftRadius * 0.85, tipStart, 12), shaftMaterial)
    inner.position.y = tipStart / 2
    const tip = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          [shaftRadius * 0.85, 0],
          [shaftRadius * 1.5, tipLength * 0.22],
          [shaftRadius * 1.45, tipLength * 0.55],
          [shaftRadius * 0.9, tipLength * 0.88],
          [0.001, tipLength],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        14
      ),
      shaftMaterial
    )
    tip.position.y = tipStart
    this.head.add(inner, tip)

    const content = new THREE.Group()
    content.add(this.sheath, this.flex, this.head)
    this.setContent(content)
    this.applyFill()
  }

  get fill(): number {
    return this.fillAnimator.value
  }

  /** This object keeps its own materials, and is drawn whenever it is shown and in the body. */
  get renderable(): boolean {
    return this.shown && this.fillAnimator.value > 0
  }

  setShown(shown: boolean): this {
    this.shown = shown
    return this
  }

  setFill(fill: number): this {
    this.fillAnimator.set(THREE.MathUtils.clamp(fill, 0, 1))
    this.applyFill()
    return this
  }

  /** Advance or withdraw smoothly to a fill between 0 and 1. */
  animateFillTo(fill: number, durationMs = 1800, delayMs = 0): this {
    this.fillAnimator.animateTo(THREE.MathUtils.clamp(fill, 0, 1), durationMs, delayMs)
    return this
  }

  /** Where the middle of the head is, and which way it points (toward the heart), for a given fill. */
  headPose(fill = this.fillAnimator.value, position = new THREE.Vector3(), quaternion = new THREE.Quaternion()) {
    const u = THREE.MathUtils.clamp(fill, 0, 1) * this.stopU
    this.curve.getPointAt(u, position)
    const tangent = this.curve.getTangentAt(u).normalize()
    quaternion.setFromUnitVectors(UP, tangent)
    return { position, quaternion }
  }

  update(delta: number): void {
    super.update(delta)
    if (this.fillAnimator.update(delta)) this.applyFill()
  }

  dispose(): void {
    this.sheath.geometry.dispose()
    this.flex.geometry.dispose()
    this.head.traverse((node) => {
      if (node instanceof THREE.Mesh) node.geometry.dispose()
    })
    for (const material of this.materials) material.dispose()
    super.dispose()
  }

  /** The fraction of the path closest to a point. */
  private nearestU(point: THREE.Vector3): number {
    const steps = 800
    const sample = new THREE.Vector3()
    let best = 1
    let bestDistance = Infinity
    for (let i = 0; i <= steps; i++) {
      const u = i / steps
      const distance = this.curve.getPointAt(u, sample).distanceToSquared(point)
      if (distance < bestDistance) {
        bestDistance = distance
        best = u
      }
    }
    return best
  }

  /** Show the right length of the outer tube, the shaft that bridges to the head, and put the head in place. */
  private applyFill(): void {
    const fill = this.fillAnimator.value
    const headU = fill * this.stopU
    const sheathEndU = Math.max(0, headU - this.sheathGap / this.length)

    // The outer tube is one tube; drawing a fraction of it means drawing the first part of its triangles
    const drawn = Math.floor(sheathEndU * SHEATH_SEGMENTS)
    this.sheath.geometry.setDrawRange(0, drawn * SHEATH_RADIAL * 6)
    this.sheath.visible = drawn > 0

    // The lighter shaft joins the end of the outer tube to the head
    const span = headU - sheathEndU
    this.flex.visible = span > 1e-4
    if (this.flex.visible) {
      const samples = Array.from({ length: 8 }, (_, i) => this.curve.getPointAt(sheathEndU + (span * i) / 7))
      this.flex.geometry.dispose()
      this.flex.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(samples), 24, this.shaftRadius, 10, false)
    }

    this.headPose(fill, this.head.position, this.head.quaternion)
    this.head.visible = fill > 0
  }
}
