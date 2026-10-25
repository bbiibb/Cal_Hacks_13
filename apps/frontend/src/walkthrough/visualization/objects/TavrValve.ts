import * as THREE from 'three'
import { SceneObject, type Transform } from './SceneObject'
import { ValueAnimator } from './ValueAnimator'
import {
  DEFAULT_VALVE_SHAPE,
  leafletMesh,
  skirtHeight,
  stentStruts,
  valveHeight,
  valveRadius,
  type ValveShape,
} from './device_geometry'

export type TavrValveOptions = Transform & {
  shape?: Partial<ValveShape>
  /** 0 = crimped onto the balloon, 1 = fully open. */
  expansion?: number
  /** 0 = leaflets closed, 1 = open. */
  leafletOpen?: number
}

/** One heartbeat of the leaflets, in seconds: a quick opening, a slower closing, a short rest. */
const BEAT_SECONDS = 1.6

const UP = new THREE.Vector3(0, 1, 0)
const _from = new THREE.Vector3()
const _to = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _mid = new THREE.Vector3()
const _matrix = new THREE.Matrix4()
const _quaternion = new THREE.Quaternion()
const _scale = new THREE.Vector3()

/**
 * The replacement valve: a metal frame of diamond cells, a white cloth skirt at the inflow end, and three leaflets.
 * Built along the Y axis with the inflow (skirt) end at y = 0. Opening it (`expansion`) widens and shortens the
 * frame; the leaflets (`leafletOpen`) open and close inside it.
 */
export class TavrValve extends SceneObject {
  readonly shape: ValveShape

  private readonly expansionAnimator: ValueAnimator
  private readonly openAnimator: ValueAnimator
  private beating = false
  private beatTime = 0
  private shown = true

  private readonly stent: THREE.InstancedMesh
  private readonly skirt: THREE.Mesh
  private readonly leaflets: THREE.Mesh
  private readonly materials: THREE.Material[]

  constructor({ shape, expansion = 1, leafletOpen = 0, ...transform }: TavrValveOptions = {}) {
    super(transform)
    this.shape = { ...DEFAULT_VALVE_SHAPE, ...shape }
    this.expansionAnimator = new ValueAnimator(THREE.MathUtils.clamp(expansion, 0, 1))
    this.openAnimator = new ValueAnimator(THREE.MathUtils.clamp(leafletOpen, 0, 1))

    const stentMaterial = new THREE.MeshStandardMaterial({ color: '#c9cdd6', metalness: 0.85, roughness: 0.3 })
    const skirtMaterial = new THREE.MeshStandardMaterial({ color: '#f1f0ec', roughness: 0.95, metalness: 0, side: THREE.DoubleSide })
    const leafletMaterial = new THREE.MeshStandardMaterial({ color: '#cdbf8f', roughness: 0.7, metalness: 0, side: THREE.DoubleSide })
    this.materials = [stentMaterial, skirtMaterial, leafletMaterial]

    const strutCount = this.shape.rows * this.shape.columns * 2
    this.stent = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1), stentMaterial, strutCount)
    this.stent.frustumCulled = false // the instances move, and the bounds of the base shape would be wrong

    this.skirt = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32, 1, true), skirtMaterial)
    this.leaflets = new THREE.Mesh(new THREE.BufferGeometry(), leafletMaterial)

    const content = new THREE.Group()
    content.add(this.skirt, this.leaflets, this.stent)
    this.setContent(content)
    this.rebuild()
  }

  /** This object keeps its own materials, so it is drawn whenever it is shown. */
  get renderable(): boolean {
    return this.shown
  }

  get expansion(): number {
    return this.expansionAnimator.value
  }

  get leafletOpen(): number {
    return this.openAnimator.value
  }

  /** The current height of the frame, which shrinks as it opens. */
  get height(): number {
    return valveHeight(this.shape, this.expansionAnimator.value)
  }

  get radius(): number {
    return valveRadius(this.shape, this.expansionAnimator.value)
  }

  setShown(shown: boolean): this {
    this.shown = shown
    return this
  }

  setExpansion(expansion: number): this {
    this.expansionAnimator.set(THREE.MathUtils.clamp(expansion, 0, 1))
    this.rebuild()
    return this
  }

  animateExpansionTo(expansion: number, durationMs = 1500, delayMs = 0): this {
    this.expansionAnimator.animateTo(THREE.MathUtils.clamp(expansion, 0, 1), durationMs, delayMs)
    return this
  }

  setLeafletOpen(open: number): this {
    this.openAnimator.set(THREE.MathUtils.clamp(open, 0, 1))
    this.rebuild()
    return this
  }

  animateLeafletOpenTo(open: number, durationMs = 600, delayMs = 0): this {
    this.openAnimator.animateTo(THREE.MathUtils.clamp(open, 0, 1), durationMs, delayMs)
    return this
  }

  /** Make the leaflets open and close like a beating heart, until `stopBeating`. */
  startBeating(): this {
    this.beating = true
    return this
  }

  stopBeating(): this {
    this.beating = false
    this.openAnimator.animateTo(0, 500)
    return this
  }

  update(delta: number): void {
    super.update(delta)
    let changed = this.expansionAnimator.update(delta)
    if (this.beating) {
      this.beatTime = (this.beatTime + delta) % BEAT_SECONDS
      const phase = this.beatTime / BEAT_SECONDS
      // Open quickly in the first quarter, close more slowly, then rest
      const open = phase < 0.2 ? phase / 0.2 : phase < 0.65 ? 1 - (phase - 0.2) / 0.45 : 0
      this.openAnimator.set(open)
      changed = true
    } else if (this.openAnimator.update(delta)) {
      changed = true
    }
    if (changed) this.rebuild()
  }

  dispose(): void {
    this.stent.geometry.dispose()
    this.stent.dispose()
    for (const material of this.materials) material.dispose()
    super.dispose()
  }

  /** Lay the frame, the skirt and the leaflets out for the current expansion and leaflet opening. */
  private rebuild(): void {
    const expansion = this.expansionAnimator.value
    const radius = valveRadius(this.shape, expansion)

    // The frame: one thin cylinder per strut, stretched between its two nodes
    const struts = stentStruts(this.shape, expansion)
    struts.forEach(([a, b], i) => {
      _from.set(a[0], a[1], a[2])
      _to.set(b[0], b[1], b[2])
      _dir.subVectors(_to, _from)
      const length = _dir.length()
      _mid.addVectors(_from, _to).multiplyScalar(0.5)
      _quaternion.setFromUnitVectors(UP, _dir.divideScalar(length || 1))
      _scale.set(this.shape.strutRadius, length, this.shape.strutRadius)
      this.stent.setMatrixAt(i, _matrix.compose(_mid, _quaternion, _scale))
    })
    this.stent.count = struts.length
    this.stent.instanceMatrix.needsUpdate = true

    // The skirt: a short sleeve around the inflow end
    const skirt = skirtHeight(this.shape, expansion)
    this.skirt.scale.set(radius + 0.004, skirt, radius + 0.004)
    this.skirt.position.y = skirt / 2

    // The leaflets
    const { positions, indices } = leafletMesh(this.shape, expansion, this.openAnimator.value)
    const geometry = this.leaflets.geometry
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
  }
}
