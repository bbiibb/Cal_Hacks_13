import * as THREE from 'three'

export type Transform = {
  position?: THREE.Vector3Tuple
  /** Euler angles in radians (XYZ order) */
  rotation?: THREE.Vector3Tuple
  /** Uniform number or per-axis tuple */
  scale?: number | THREE.Vector3Tuple
}

export type SceneObjectOptions = Transform & {
  geometry?: THREE.BufferGeometry
  material?: THREE.Material
}

export type Space = 'local' | 'world'

// Reused scratch objects, so per-frame rotation doesn't allocate
const _euler = new THREE.Euler()
const _delta = new THREE.Quaternion()

export abstract class SceneObject {
  // Transform: owned here, whether or not the object has a mesh
  readonly position = new THREE.Vector3()
  /** Orientation. Single source of truth for rotation. */
  readonly quaternion = new THREE.Quaternion()
  readonly scale = new THREE.Vector3(1, 1, 1)

  // Rendering: a mesh exists only when both geometry and material are provided
  readonly geometry: THREE.BufferGeometry | null
  readonly material: THREE.Material | null
  readonly mesh: THREE.Mesh | null

  constructor({
    geometry,
    material,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
  }: SceneObjectOptions = {}) {
    this.geometry = geometry ?? null
    this.material = material ?? null
    this.mesh =
      this.geometry && this.material
        ? new THREE.Mesh(this.geometry, this.material)
        : null

    this.setPosition(...position)
    this.setRotation(...rotation)
    if (typeof scale === 'number') {
      this.setScale(scale)
    } else {
      this.setScale(...scale)
    }
    this.syncMesh()
  }

  // Position
  setPosition(x: number, y: number, z: number): this {
    this.position.set(x, y, z)
    return this
  }

  translate(x: number, y: number, z: number): this {
    this.position.x += x
    this.position.y += y
    this.position.z += z
    return this
  }

  // Rotation (Euler in, quaternion inside)
  /** Set absolute orientation from Euler angles (radians). */
  setRotation(x: number, y: number, z: number): this {
    this.quaternion.setFromEuler(_euler.set(x, y, z))
    return this
  }

  /** Current orientation as Euler angles. Returns a copy; changing it does not rotate the object. */
  getRotation(target = new THREE.Euler()): THREE.Euler {
    return target.setFromQuaternion(this.quaternion)
  }

  /**
   * Rotate by Euler angles (radians), composed onto the current orientation.
   * 'local' rotates around the object's own axes, 'world' around the scene axes.
   */
  rotate(x: number, y: number, z: number, space: Space = 'local'): this {
    _delta.setFromEuler(_euler.set(x, y, z))
    return this.applyRotation(_delta, space)
  }

  /** Rotate by an angle (radians) around an arbitrary axis. */
  rotateOnAxis(axis: THREE.Vector3, angle: number, space: Space = 'local'): this {
    _delta.setFromAxisAngle(axis.clone().normalize(), angle)
    return this.applyRotation(_delta, space)
  }

  private applyRotation(delta: THREE.Quaternion, space: Space): this {
    if (space === 'local') {
      this.quaternion.multiply(delta)
    } else {
      this.quaternion.premultiply(delta)
    }
    this.quaternion.normalize() // prevent floating-point drift
    return this
  }

  // Scale
  setScale(x: number, y = x, z = x): this {
    this.scale.set(x, y, z)
    return this
  }

  /** Copy this object's transform onto its mesh. Called by the renderer each frame. */
  syncMesh(): void {
    if (!this.mesh) return
    this.mesh.position.copy(this.position)
    this.mesh.quaternion.copy(this.quaternion)
    this.mesh.scale.copy(this.scale)
  }

  // Lifecycle
  /** Called every frame. delta is seconds since the last frame. */
  update(_delta: number): void {}

  /** Free GPU resources. */
  dispose(): void {
    this.geometry?.dispose()
    this.material?.dispose()
  }
}
