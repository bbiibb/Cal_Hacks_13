import * as THREE from 'three'
import { SceneObject, isPlainMesh, type Transform } from './SceneObject'
import { loadModel } from '../loaders/LoadModel'
import { NO_REGION, MAX_REGIONS, regionIndexAt, type RegionMap } from '../regions'

export type ModelObjectOptions = Transform & {
  /** Browser-accessible URL of the model file. */
  path: string
  /** Solid, unlit color. Ignored when `material` is given. */
  color?: THREE.ColorRepresentation
  material?: THREE.Material
  /**
   * Named areas inside the model (see regions.ts), for a file that is a single mesh.
   * Lets the model tell which area a point belongs to, glow one area, and report where an area is.
   */
  regions?: RegionMap
}


const _vertex = new THREE.Vector3()

export type ModelStatus = 'loading' | 'ready' | 'error' | 'disposed'

export class ModelObject extends SceneObject {
  readonly path: string
  /** Resolves when the model is attached; rejects if loading fails. */
  readonly loaded: Promise<void>

  private _status: ModelStatus = 'loading'
  private _error: unknown = null

  private readonly regionIds: readonly string[]
  private readonly regionPolygons: readonly (readonly (readonly [number, number])[])[]
  /** Where each region lies, in the space of the mesh it was found on. */
  private readonly regionBoxes = new Map<string, { mesh: THREE.Mesh; box: THREE.Box3 }[]>()
  private readonly glowMask = { value: 0 }
  private readonly glowStrength = { value: 0 }

  constructor({ path, color, material, regions, ...transform }: ModelObjectOptions) {
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
    const regionEntries = Object.entries(regions ?? {})
    if (regionEntries.length > MAX_REGIONS) throw new Error(`ModelObject: at most ${MAX_REGIONS} regions`)
    this.regionIds = regionEntries.map(([id]) => id)
    this.regionPolygons = regionEntries.map(([, polygon]) => polygon)
    this.loaded = this.load()
    this.loaded.catch(() => {})
  }


  get status(): ModelStatus {
    return this._status
  }

  get error(): unknown {
    return this._error
  }

  /** True when the model is split into named regions. */
  get hasRegions(): boolean {
    return this.regionIds.length > 0
  }

  /** The names of the model's regions. */
  get regionNames(): readonly string[] {
    return this.regionIds
  }

  /** The region that a ray hit lies in, or null when it is outside every region. */
  regionAt(hit: THREE.Intersection): string | null {
    if (!this.hasRegions) return null
    const local = hit.object.worldToLocal(hit.point.clone())
    const index = regionIndexAt(this.regionPolygons, local.x, local.y)
    return index === NO_REGION ? null : this.regionIds[index - 1]
  }

  /** Where a region is, in world space, or null when it is unknown or the model is not loaded. */
  regionBounds(regionId: string): THREE.Box3 | null {
    const parts = this.regionBoxes.get(regionId)
    if (!parts) return null
    const bounds = new THREE.Box3()
    for (const { mesh, box } of parts) {
      mesh.updateWorldMatrix(true, false)
      bounds.union(box.clone().applyMatrix4(mesh.matrixWorld))
    }
    return bounds.isEmpty() ? null : bounds
  }

  /** Make exactly these regions glow. `strength` is the glow brightness, 0 to 1. */
  setRegionGlow(regionIds: ReadonlySet<string>, strength: number): void {
    let mask = 0
    this.regionIds.forEach((id, i) => {
      if (regionIds.has(id)) mask |= 1 << (i + 1)
    })
    this.glowMask.value = mask
    this.glowStrength.value = strength
  }

  dispose(): void {
    this._status = 'disposed'
    super.dispose()
  }

  /**
   * Tag every vertex with the region it lies in, remember where each region is, and let the material
   * add a glow to the tagged regions.
   */
  private assignRegions(): void {
    for (const mesh of this.meshes) {
      const position = mesh.geometry.getAttribute('position')
      const tags = new Float32Array(position.count)
      const boxes = this.regionIds.map(() => new THREE.Box3())
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i)
        const y = position.getY(i)
        const index = regionIndexAt(this.regionPolygons, x, y)
        tags[i] = index
        if (index !== NO_REGION) boxes[index - 1].expandByPoint(_vertex.set(x, y, position.getZ(i)))
      }
      mesh.geometry.setAttribute('aRegion', new THREE.BufferAttribute(tags, 1))
      this.regionIds.forEach((id, i) => {
        if (boxes[i].isEmpty()) return
        const parts = this.regionBoxes.get(id) ?? []
        parts.push({ mesh, box: boxes[i] })
        this.regionBoxes.set(id, parts)
      })
    }
    this.installRegionGlow()
  }

  private installRegionGlow(): void {
    const material = this.material
    if (!(material instanceof THREE.MeshStandardMaterial)) return

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uGlowMask = this.glowMask
      shader.uniforms.uGlowStrength = this.glowStrength
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aRegion;\nflat varying float vRegion;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRegion = aRegion;')
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nflat varying float vRegion;\nuniform int uGlowMask;\nuniform float uGlowStrength;'
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          if (((uGlowMask >> int(vRegion + 0.5)) & 1) == 1) totalEmissiveRadiance += vec3(1.0, 0.702, 0.278) * uGlowStrength;`
        )
    }
    material.customProgramCacheKey = () => 'model-region-glow'
    material.needsUpdate = true
  }

  private async load(): Promise<void> {
    try {
      const source = await loadModel(this.path)
      if (this._status === 'disposed') return

      const meshes = extractPlainMeshes(source)
      if (!meshes) throw new Error(`No plain meshes found in "${this.path}"`)

      this.setContent(normalizeToUnitCube(meshes))
      if (this.hasRegions) this.assignRegions()
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
