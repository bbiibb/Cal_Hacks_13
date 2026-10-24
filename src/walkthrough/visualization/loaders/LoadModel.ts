import * as THREE from 'three'

/** Loads a file and returns its scene graph. */
export type ModelLoader = (url: string) => Promise<THREE.Object3D>

// Loaders are imported on demand, so unused formats never reach the bundle.
const loaders: Record<string, ModelLoader> = {
  glb: loadGLTF,
  gltf: loadGLTF,
  obj: async (url) => {
    const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js')
    return new OBJLoader().loadAsync(url)
  },
  fbx: async (url) => {
    const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js')
    return new FBXLoader().loadAsync(url)
  },
  stl: async (url) => {
    const { STLLoader } = await import('three/addons/loaders/STLLoader.js')
    return new THREE.Mesh(await new STLLoader().loadAsync(url))
  },
  ply: async (url) => {
    const { PLYLoader } = await import('three/addons/loaders/PLYLoader.js')
    return new THREE.Mesh(await new PLYLoader().loadAsync(url))
  },
}

async function loadGLTF(url: string): Promise<THREE.Object3D> {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
  const gltf = await new GLTFLoader().loadAsync(url)
  return gltf.scene
}

function extensionOf(path: string): string {
  const clean = path.split(/[?#]/)[0]
  const dot = clean.lastIndexOf('.')
  return dot === -1 ? '' : clean.slice(dot + 1).toLowerCase()
}

/** Add or replace the loader for a file extension (without the dot). */
export function registerModelLoader(extension: string, loader: ModelLoader): void {
  loaders[extension.toLowerCase()] = loader
}

export function supportedModelFormats(): string[] {
  return Object.keys(loaders)
}

/** Load a model by URL, choosing the loader from its file extension. */
export async function loadModel(path: string): Promise<THREE.Object3D> {
  const extension = extensionOf(path)
  const loader = loaders[extension]
  if (!loader) {
    throw new Error(
      `Unsupported model format "${extension || path}". Supported: ${supportedModelFormats().join(', ')}`
    )
  }
  return loader(path)
}
