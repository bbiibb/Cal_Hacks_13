import * as THREE from 'three'
import { SceneObject, isPlainMesh, type Transform } from './SceneObject'
import { loadModel } from '../loaders/LoadModel'

export type ModelObjectOptions = Transform & {
  /** Browser-accessible URL of the model file. */
  path: string
  /** Solid, unlit color. Ignored when `material` is given. */
  color?: THREE.ColorRepresentation
  material?: THREE.Material
}


export type ModelStatus = 'loading' | 'ready' | 'error' | 'disposed'

export class ModelObject extends SceneObject {
  readonly path: string
  /** Resolves when the model is attached; rejects if loading fails. */
  readonly loaded: Promise<void>

  private _status: ModelStatus = 'loading'
  private _error: unknown = null

  constructor({ path, color, material, ...transform }: ModelObjectOptions) {
    super({
        ...transform,
        material:
        material ??
        (color !== undefined
            ? new THREE.MeshStandardMaterial({
                color,
                roughness: 0.55,
                metalness: 0,
            })
            : undefined),
    })

    this.path = path
    this.loaded = this.load()
    this.loaded.catch(() => {})
  }


  get status(): ModelStatus {
    return this._status
  }

  get error(): unknown {
    return this._error
  }

  dispose(): void {
    this._status = 'disposed'
    super.dispose()
  }

  private async load(): Promise<void> {
    try {
      const source = await loadModel(this.path)
      if (this._status === 'disposed') return

      const meshes = extractPlainMeshes(source)
      if (!meshes) throw new Error(`No plain meshes found in "${this.path}"`)

      this.setContent(normalizeToUnitCube(meshes))
      this._status = 'ready'
    } catch (error) {
      if (this._status === 'disposed') return
      this._status = 'error'
      this._error = error
      console.error(`ModelObject: failed to load "${this.path}"`, error)
      throw error
    }
  }
}

/**
 * Rebuild the loaded hierarchy keeping only plain meshes and the nodes above them.
 * Node names and local transforms are preserved; the file's materials are dropped.
 * Returns null if the file contains no plain meshes.
 */
function extractPlainMeshes(source: THREE.Object3D): THREE.Object3D | null {
  source.updateMatrixWorld(true)
  return copyNode(source)
}

function copyNode(source: THREE.Object3D): THREE.Object3D | null {
  const keepMesh = isPlainMesh(source) && source.geometry.getAttribute('position') !== undefined

  let copy: THREE.Object3D
  if (keepMesh) {
    const geometry = (source as THREE.Mesh).geometry
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
    copy = new THREE.Mesh(geometry)
  } else {
    copy = new THREE.Group()
  }

  copy.name = source.name
  source.matrix.decompose(copy.position, copy.quaternion, copy.scale)

  for (const child of source.children) {
    const childCopy = copyNode(child)
    if (childCopy) copy.add(childCopy)
  }

  // Prune branches that contain no meshes (lights, cameras, empties, skinned meshes, ...)
  if (!keepMesh && copy.children.length === 0) return null
  return copy
}

/**
 * Wrap content so it is centered at the origin and its longest side is 1.
 * The content's own transforms are untouched:  normalize (scale) -> center (offset) -> content
 */
function normalizeToUnitCube(content: THREE.Object3D): THREE.Object3D {
  content.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(content, true)
  const size = box.getSize(new THREE.Vector3())
  const longest = Math.max(size.x, size.y, size.z)

  if (box.isEmpty() || !Number.isFinite(longest) || longest <= 0) {
    throw new Error('Model has empty or invalid bounds')
  }

  const center = new THREE.Group()
  center.name = 'center'
  center.position.copy(box.getCenter(new THREE.Vector3())).negate()
  center.add(content)

  const normalize = new THREE.Group()
  normalize.name = 'normalize'
  normalize.scale.setScalar(1 / longest)
  normalize.add(center)

  return normalize
}
