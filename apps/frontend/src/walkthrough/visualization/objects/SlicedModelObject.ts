import * as THREE from 'three'
import { ModelObject, type ModelObjectOptions } from './ModelObject'

/**
 * 'model': the cut is attached to the model and moves, rotates and scales with it.
 *          Units are the normalized model (-0.5..0.5).
 * 'world': the cut is fixed in the scene, applied after the object's transform. Units are scene units.
 */
export type SliceSpace = 'model' | 'world'

export type SliceOptions = {
  /** A point on the cutting plane. Only its distance along the normal matters. */
  point?: THREE.Vector3Tuple
  /** Points into the half that gets hidden. */
  normal: THREE.Vector3Tuple
  /** Coordinate space of point and normal. Default 'model'. */
  space?: SliceSpace
}

export type SlicedModelObjectOptions = ModelObjectOptions & {
  slice: SliceOptions
}

// Each sliced object draws three passes back to back: stencil, cap, model.
// A unique render-order range per object keeps different objects' passes from interleaving.
let nextRenderOrder = 1
const PASSES = 3

/** Large enough to cover the normalized model (a unit cube) wherever the plane sits. */
const CAP_SIZE = 2

const _keepNormal = new THREE.Vector3()
const _hideNormal = new THREE.Vector3()
const _inverse = new THREE.Matrix4()
const _planeFacing = new THREE.Vector3(0, 0, 1)

export class SlicedModelObject extends ModelObject {
  /** Point on the cutting plane, in sliceSpace. */
  readonly slicePoint = new THREE.Vector3()
  /** Unit vector pointing into the hidden half, in sliceSpace. */
  readonly sliceNormal = new THREE.Vector3(0, 1, 0)

  /** The cut in the object's local space: places the cap. Updated each frame. */
  private readonly localPlane = new THREE.Plane()
  /** The cut in world space: shared by every material that clips. Updated each frame. */
  private readonly worldPlane = new THREE.Plane()
  private readonly renderOrderBase: number
  private readonly stencilBack: THREE.MeshBasicMaterial
  private readonly stencilFront: THREE.MeshBasicMaterial
  private readonly cap: THREE.Mesh<THREE.PlaneGeometry, THREE.Material> | null
  private _sliceSpace: SliceSpace = 'model'
  private _sliceEnabled = true

  constructor({ slice, ...options }: SlicedModelObjectOptions) {
    super(options)

    this.renderOrderBase = nextRenderOrder
    nextRenderOrder += PASSES

    this.stencilBack = createStencilMaterial(THREE.BackSide, THREE.IncrementWrapStencilOp, this.worldPlane)
    this.stencilFront = createStencilMaterial(THREE.FrontSide, THREE.DecrementWrapStencilOp, this.worldPlane)

    // The cap copies the material before the material gets its clipping plane
    this.cap = this.material ? this.createCap(this.material) : null
    if (this.material) this.material.clippingPlanes = [this.worldPlane]

    this.setSlice(slice.point ?? [0, 0, 0], slice.normal, slice.space ?? 'model')
  }

  // Slice controls
  get sliceSpace(): SliceSpace {
    return this._sliceSpace
  }

  get sliceEnabled(): boolean {
    return this._sliceEnabled
  }

  /** Move the cut. The normal points into the hidden half. */
  setSlice(point: THREE.Vector3Tuple, normal: THREE.Vector3Tuple, space: SliceSpace = this._sliceSpace): this {
    this.slicePoint.set(...point)
    this.sliceNormal.set(...normal).normalize()
    this._sliceSpace = space
    return this
  }

  /** Hide the other half instead. */
  flipSlice(): this {
    this.sliceNormal.negate()
    return this
  }

  setSliceEnabled(enabled: boolean): this {
    this._sliceEnabled = enabled
    if (this.material) this.material.clippingPlanes = enabled ? [this.worldPlane] : []
    this.stencilBack.visible = enabled
    this.stencilFront.visible = enabled
    if (this.cap) this.cap.visible = enabled
    return this
  }

  // Lifecycle
  update(delta: number): void {
    super.update(delta)

    // Three.js keeps the plane's positive side, so the plane faces away from the hidden half.
    // The plane is defined in one space and carried into the other: world space for clipping,
    // local space for placing the cap.
    this.root.updateWorldMatrix(true, false)
    _keepNormal.copy(this.sliceNormal).negate()

    if (this._sliceSpace === 'model') {
      this.localPlane.setFromNormalAndCoplanarPoint(_keepNormal, this.slicePoint)
      this.worldPlane.copy(this.localPlane).applyMatrix4(this.root.matrixWorld)
    } else {
      this.worldPlane.setFromNormalAndCoplanarPoint(_keepNormal, this.slicePoint)
      _inverse.copy(this.root.matrixWorld).invert()
      this.localPlane.copy(this.worldPlane).applyMatrix4(_inverse)
    }

    this.placeCap()
  }

  dispose(): void {
    super.dispose()
    this.stencilBack.dispose()
    this.stencilFront.dispose()
    if (this.cap) {
      this.cap.geometry.dispose()
      this.cap.material.dispose()
    }
  }

  // Every loaded mesh gets two invisible stencil passes and draws after this object's cap
  protected setContent(content: THREE.Object3D | null): void {
    super.setContent(content)

    for (const mesh of this.meshes) {
      mesh.renderOrder = this.renderOrderBase + 2
      mesh.add(
        this.createStencilMesh(mesh.geometry, this.stencilBack),
        this.createStencilMesh(mesh.geometry, this.stencilFront)
      )
    }
  }

  // Internals
  private createStencilMesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
    const stencil = new THREE.Mesh(geometry, material)
    stencil.name = 'slice-stencil'
    stencil.renderOrder = this.renderOrderBase
    stencil.raycast = () => {} // helper geometry: never a pick target
    return stencil
  }

  private createCap(material: THREE.Material): THREE.Mesh<THREE.PlaneGeometry, THREE.Material> {
    const capMaterial = material.clone()
    capMaterial.clippingPlanes = []
    capMaterial.side = THREE.DoubleSide
    capMaterial.stencilWrite = true
    capMaterial.stencilRef = 0
    capMaterial.stencilFunc = THREE.NotEqualStencilFunc // draw only where the cut exposes the inside
    capMaterial.stencilFail = THREE.ReplaceStencilOp
    capMaterial.stencilZFail = THREE.ReplaceStencilOp
    capMaterial.stencilZPass = THREE.ReplaceStencilOp

    const cap = new THREE.Mesh(new THREE.PlaneGeometry(CAP_SIZE, CAP_SIZE), capMaterial)
    cap.name = 'slice-cap'
    cap.renderOrder = this.renderOrderBase + 1
    cap.frustumCulled = false // must always draw, so the stencil is always reset afterwards
    cap.onAfterRender = (renderer) => renderer.clearStencil()
    this.root.add(cap)
    return cap
  }

  /** Lay the cap on the local cutting plane, centered on the point nearest the model's center. */
  private placeCap(): void {
    if (!this.cap) return
    this.localPlane.coplanarPoint(this.cap.position)
    _hideNormal.copy(this.localPlane.normal).negate()
    this.cap.quaternion.setFromUnitVectors(_planeFacing, _hideNormal)
  }
}

/** Invisible pass that counts, per pixel, how many surfaces enclose the cut plane. */
function createStencilMaterial(
  side: THREE.Side,
  op: THREE.StencilOp,
  plane: THREE.Plane
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    side,
    clippingPlanes: [plane],
    colorWrite: false,
    depthWrite: false,
    depthTest: false,
    stencilWrite: true,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilFail: op,
    stencilZFail: op,
    stencilZPass: op,
  })
}
