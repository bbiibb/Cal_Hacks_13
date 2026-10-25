import * as THREE from 'three'
import { SceneObject, type Transform } from './SceneObject'

export type CurveFollowerOptions = Transform & {
  /** Points the curve passes through, in this object's local space. At least 2. */
  points: THREE.Vector3Tuple[]
  /** Radius of the tube. */
  radius?: number
  /** How much of the curve is drawn: 0 = nothing, 0.5 = halfway, 1 = all the way to the last point. */
  fill?: number
  color?: THREE.ColorRepresentation
  material?: THREE.Material
  /** Segments along the whole curve. More = smoother bends and finer fill steps. */
  segments?: number
  /** Segments around the tube. */
  radialSegments?: number
}

export class CurveFollower extends SceneObject {
  readonly radius: number

  private readonly radialSegments: number
  private readonly segmentsOverride: number | undefined
  private curve: THREE.CatmullRomCurve3 | null = null
  private tube: THREE.Mesh | null = null
  private startCap: THREE.Mesh | null = null
  private endCap: THREE.Mesh | null = null
  private tubularSegments = 0
  private _fill: number
  private fillAnimation: { from: number; to: number; elapsed: number; duration: number } | null = null

  constructor({
    points,
    radius = 0.05,
    fill = 1,
    color,
    material,
    segments,
    radialSegments = 16,
    ...transform
  }: CurveFollowerOptions) {
    super({
      ...transform,
      material:
        material ??
        (color !== undefined
          ? new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0 })
          : undefined),
    })

    this.radius = radius
    this.radialSegments = radialSegments
    this.segmentsOverride = segments
    this._fill = THREE.MathUtils.clamp(fill, 0, 1)
    this.setPoints(points)
  }

  get fill(): number {
    return this._fill
  }

  /** How much of the curve is drawn, 0 to 1. Cheap: safe to call every frame. */
    /** Jump straight to a fill, 0 to 1. Cancels any fill animation. */
  setFill(fill: number): this {
    this.fillAnimation = null
    this._fill = THREE.MathUtils.clamp(fill, 0, 1)
    this.applyFill()
    return this
  }

  /** Move the fill smoothly to a new value, 0 to 1. A new call replaces any animation in progress. */
  animateFillTo(fill: number, durationMs = 1500): this {
    const to = THREE.MathUtils.clamp(fill, 0, 1)
    if (durationMs <= 0 || to === this._fill) return this.setFill(to)
    this.fillAnimation = { from: this._fill, to, elapsed: 0, duration: durationMs / 1000 }
    return this
  }

  update(delta: number): void {
    super.update(delta)
    const animation = this.fillAnimation
    if (!animation) return

    animation.elapsed += delta
    const t = Math.min(animation.elapsed / animation.duration, 1)
    const eased = t * t * (3 - 2 * t) // ease in and out
    this._fill = animation.from + (animation.to - animation.from) * eased
    this.applyFill()
    if (t >= 1) this.fillAnimation = null
  }

  /** Replace the path. Rebuilds the tube; not meant for every frame. */
  setPoints(points: THREE.Vector3Tuple[]): this {
    if (points.length < 2) throw new Error('CurveFollower needs at least 2 points')

    // Centripetal Catmull-Rom: passes through every point without loops or overshoot at sharp turns
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
      false,
      'centripetal'
    )
    const tubularSegments = this.segmentsOverride ?? Math.max(64, (points.length - 1) * 32)

    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, tubularSegments, this.radius, this.radialSegments, false)
    )
    tube.name = 'tube'

    // Rounded ends: one sphere at the start, one that rides the end of the filled part
    const capGeometry = new THREE.SphereGeometry(
      this.radius,
      this.radialSegments,
      Math.max(4, Math.round(this.radialSegments / 2))
    )
    const startCap = new THREE.Mesh(capGeometry)
    startCap.name = 'start-cap'
    curve.getPointAt(0, startCap.position)

    const endCap = new THREE.Mesh(capGeometry)
    endCap.name = 'end-cap'

    const content = new THREE.Group()
    content.add(tube, startCap, endCap)

    this.curve = curve
    this.tube = tube
    this.startCap = startCap
    this.endCap = endCap
    this.tubularSegments = tubularSegments

    this.setContent(content) // replaces and disposes the previous tube
    this.applyFill()
    return this
  }

  /** Point on the curve at `t` (0 to 1, by distance along the curve), in this object's local space. */
  getPointAt(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    return this.curve ? this.curve.getPointAt(THREE.MathUtils.clamp(t, 0, 1), target) : target
  }

  /**
   * The tube's triangles are stored in order along the curve, one ring per segment,
   * so drawing a fraction of the curve means drawing only the first part of the index buffer.
   */
  private applyFill(): void {
    if (!this.curve || !this.tube || !this.startCap || !this.endCap) return

    const drawnSegments = Math.round(this._fill * this.tubularSegments)
    this.tube.geometry.setDrawRange(0, drawnSegments * this.radialSegments * 6)

    const visible = drawnSegments > 0
    this.startCap.visible = visible
    this.endCap.visible = visible
    if (visible) this.curve.getPointAt(drawnSegments / this.tubularSegments, this.endCap.position)
  }
}
