import * as THREE from 'three'

/** Anything that drives the camera: orbit, first-person, scripted, etc. */
export interface CameraController {
  /** Called once per frame, after scene objects update and before rendering. */
  update(delta: number): void
  /** Remove input listeners and release resources. */
  dispose(): void
}

/** Creates a controller for the renderer's camera and canvas. */
export type CameraControllerFactory = (
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement
) => CameraController
