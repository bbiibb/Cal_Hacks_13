import * as THREE from 'three'

export type Transform = {
  position?: THREE.Vector3Tuple
  /** Euler angles in radians (XYZ order) */
  rotation?: THREE.Vector3Tuple
  /** Uniform number or per-axis tuple */
  scale?: number | THREE.Vector3Tuple
}

export type SceneObjectOptions = Transform & {
  /** Shorthand for content made of a single mesh. */
  geometry?: THREE.BufferGeometry
  material?: THREE.Material
}

export type Space = 'local' | 'world'

/** A plain THREE.Mesh: not skinned, instanced, batched, lines or points. */
export function isPlainMesh(node: THREE.Object3D): node is THREE.Mesh {
  return node.type === 'Mesh'
}

// Reused scratch objects, so per-frame rotation doesn't allocate
const _euler = new THREE.Euler()
const _delta = new THREE.Quaternion()
const _axis = new THREE.Vector3()

export abstract class SceneObject {
  /** Stable render node. Holds this object's transform; content is attached beneath it. */
  readonly root = new THREE.Group()
  /** Applied to every mesh in this object's content. Without one, the object is not rendered. */
  readonly material: THREE.Material | null

  private content: THREE.Object3D | null = null
  private meshList: THREE.Mesh[] = []

  constructor({
    geometry,
    material,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
  }: SceneObjectOptions = {}) {
    this.material = material ?? null

    this.setPosition(...position)
    this.setRotation(...rotation)
    if (typeof scale === 'number') {
      this.setScale(scale)
    } else {
      this.setScale(...scale)
    }

    if (geometry) this.setContent(new THREE.Mesh(geometry))
  }

  // Live transform state (stored on the root)
  get position(): THREE.Vector3 {
    return this.root.position
  }

  /** Orientation. Single source of truth for rotation. */
  get quaternion(): THREE.Quaternion {
    return this.root.quaternion
  }

  get scale(): THREE.Vector3 {
    return this.root.scale
  }

  // Content
  /** Every plain mesh in this object's content. */
  get meshes(): readonly THREE.Mesh[] {
    return this.meshList
  }

  /** True when there is something to draw: a material and at least one mesh. */
  get renderable(): boolean {
    return this.material !== null && this.meshList.length > 0
  }

  /**
   * Attach content beneath the root, replacing and disposing any previous content.
   * Every plain mesh in it receives this object's material.
   */
  protected setContent(content: THREE.Object3D | null): void {
    if (this.content) {
      this.root.remove(this.content)
      for (const mesh of this.meshList) mesh.geometry.dispose()
    }

    this.content = content
    this.meshList = []
    if (!content) return

    content.traverse((node) => {
      if (!isPlainMesh(node)) return
      if (this.material) node.material = this.material
      this.meshList.push(node)
    })
    this.root.add(content)
  }

  // Position
  setPosition(x: number, y: number, z: number): this {
    this.root.position.set(x, y, z)
    return this
  }

  translate(x: number, y: number, z: number): this {
    this.root.position.x += x
    this.root.position.y += y
    this.root.position.z += z
    return this
  }

  // Rotation (Euler in, quaternion inside)
  /** Set absolute orientation from Euler angles (radians). */
  setRotation(x: number, y: number, z: number): this {
    this.root.quaternion.setFromEuler(_euler.set(x, y, z))
    return this
  }

  /** Current orientation as Euler angles. Returns a copy; changing it does not rotate the object. */
  getRotation(target = new THREE.Euler()): THREE.Euler {
    return target.setFromQuaternion(this.root.quaternion)
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
    _delta.setFromAxisAngle(_axis.copy(axis).normalize(), angle)
    return this.applyRotation(_delta, space)
  }

  private applyRotation(delta: THREE.Quaternion, space: Space): this {
    if (space === 'local') {
      this.root.quaternion.multiply(delta)
    } else {
      this.root.quaternion.premultiply(delta)
    }
    this.root.quaternion.normalize() // prevent floating-point drift
    return this
  }

  // Scale
  setScale(x: number, y = x, z = x): this {
    this.root.scale.set(x, y, z)
    return this
  }

  // Lifecycle
  /** Called every frame. delta is seconds since the last frame. */
  update(_delta: number): void {}

  /** Free GPU resources. */
  dispose(): void {
    this.setContent(null)
    this.material?.dispose()
  }
}
