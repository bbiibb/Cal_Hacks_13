import * as THREE from 'three'
import { SceneObject, type Transform } from './SceneObject'

type CubeOptions = Transform & {
  size?: number
}

export class Cube extends SceneObject {
  constructor({ size = 1, ...transform }: CubeOptions = {}) {
    super({
      ...transform,
      geometry: new THREE.BoxGeometry(size, size, size),
      material: new THREE.MeshNormalMaterial(),
    })
  }
}
