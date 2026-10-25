import * as THREE from 'three'
import type { Scene } from '@cal-hacks/shared'
import type { SceneAction } from '../chat/chat_types'
import { MAX_ROTATE_DEGREES, MIN_ROTATE_DEGREES } from '../chat/chat_types'
import type { OrbitCameraController, OrbitPose } from './camera/OrbitCameraController'
import { ModelObject } from './objects/ModelObject'
import type { SceneObject } from './objects/SceneObject'
import { MODEL_STRUCTURES } from './scene_bindings'

const HIGHLIGHT_COLOR = new THREE.Color('#ffb347')
const NO_GLOW = new THREE.Color(0x000000)
/** A highlighted part pulses between these glow strengths, so it stands out even on pastel colors. */
const GLOW_MIN = 0.2
const GLOW_MAX = 0.8
/** Pulses per second, in radians. */
const GLOW_SPEED = 3.2

/** Camera distance multipliers for "zoom in". "Zoom out" uses the inverse. */
const ZOOM_FACTORS = { small: 0.85, medium: 0.7, large: 0.5 } as const

/** How long a camera move takes when the command does not say. */
const DEFAULT_MOVE_MS = 800
/** Extra room around a focused part, so it does not touch the edges of the view. */
const FOCUS_MARGIN = 1.15

/** Finds the scene of a step, or null if the step does not exist. */
export type StepLookup = (procedureSlug: string, stepIndex: number) => Scene | null

export type ApplyResult = {
  /** The step the commands moved to, or null if they did not change the step. */
  stepIndex: number | null
  /** Commands that could not be carried out, with the reason. Logged for debugging. */
  ignored: string[]
}

type ShowStepOptions = {
  /** Also move the camera to the highlighted parts. Defaults to true. */
  camera?: boolean
}

const CAMERA_ACTIONS = new Set<SceneAction['type']>(['focus', 'zoom', 'rotate', 'reset_view'])

/**
 * Applies chatbot commands and step scenes to the 3D view.
 * It owns the highlight and opacity state of each structure and drives the orbit camera.
 */
export class SceneDirector {
  private readonly lookupStep: StepLookup
  private controller: OrbitCameraController | null = null
  private home: OrbitPose | null = null
  private models: ModelObject[] = []
  private byStructure = new Map<string, ModelObject[]>()
  private highlighted = new Set<string>()
  private opacity = new Map<string, number>()
  /** Bumped whenever the models change, so a late async focus on old models is dropped. */
  private generation = 0
  private glowing: THREE.MeshStandardMaterial[] = []
  private glowTime = 0
  private readonly reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(lookupStep: StepLookup) {
    this.lookupStep = lookupStep
  }

  /** Use this camera. Its current placement becomes the "reset view" placement. */
  attachCamera(controller: OrbitCameraController): void {
    this.controller = controller
    this.home = controller.getPose(false)
  }

  detachCamera(controller: OrbitCameraController): void {
    if (this.controller === controller) this.controller = null
  }

  /** The objects in the scene. Only models listed in scene_bindings take part. */
  setObjects(objects: readonly SceneObject[]): void {
    this.generation++
    this.models = objects.filter((o): o is ModelObject => o instanceof ModelObject)
    this.byStructure = new Map()
    for (const model of this.models) {
      for (const id of MODEL_STRUCTURES[model.path] ?? []) {
        const list = this.byStructure.get(id) ?? []
        list.push(model)
        this.byStructure.set(id, list)
      }
    }
    this.refreshMaterials()
  }

  /** True if some model in the scene stands for this structure. */
  hasStructure(structureId: string): boolean {
    return this.byStructure.has(structureId)
  }

  /** Show a step: its highlights and opacities replace the current ones. */
  showStep(scene: Scene, { camera = true }: ShowStepOptions = {}): void {
    this.highlighted = new Set(scene.structures.filter((s) => s.highlight).map((s) => s.id))
    this.opacity = new Map(scene.structures.map((s) => [s.id, s.opacity]))
    this.refreshMaterials()

    if (!camera) return
    const focusIds = [...this.highlighted].filter((id) => this.hasStructure(id))
    if (focusIds.length > 0) {
      void this.focusStructures(focusIds, scene.camera.duration_ms)
    } else {
      this.resetView(scene.camera.duration_ms)
    }
  }

  /** Carry out chatbot commands in order. */
  async apply(actions: readonly SceneAction[]): Promise<ApplyResult> {
    const result: ApplyResult = { stepIndex: null, ignored: [] }
    // When the answer moves the camera itself, a step change keeps the camera where the answer puts it
    const answerMovesCamera = actions.some((a) => CAMERA_ACTIONS.has(a.type))

    for (const action of actions) {
      const problem = await this.applyOne(action, answerMovesCamera, result)
      if (problem) result.ignored.push(`${action.type}: ${problem}`)
    }

    if (result.ignored.length > 0) {
      console.warn('SceneDirector: some commands were ignored', result.ignored)
    }
    return result
  }

  /** Call once per frame. Pulses the glow of highlighted parts. */
  tick(delta: number): void {
    if (this.glowing.length === 0) return
    this.glowTime += delta
    const wave = this.reduceMotion ? 1 : 0.5 + 0.5 * Math.sin(this.glowTime * GLOW_SPEED)
    const intensity = GLOW_MIN + (GLOW_MAX - GLOW_MIN) * wave
    for (const material of this.glowing) material.emissiveIntensity = intensity
  }

  /** Back to the camera placement the page started with. */
  resetView(durationMs = DEFAULT_MOVE_MS): void {
    if (this.controller && this.home) this.controller.animateTo(this.home, durationMs)
  }

  /** Returns a reason when the command cannot be carried out, or null when it was applied. */
  private async applyOne(
    action: SceneAction,
    answerMovesCamera: boolean,
    result: ApplyResult
  ): Promise<string | null> {
    switch (action.type) {
      case 'goto_step': {
        const scene = this.lookupStep(action.procedure_slug, action.step_index)
        if (!scene) return `unknown step ${action.procedure_slug}#${action.step_index}`
        this.showStep(scene, { camera: !answerMovesCamera })
        result.stepIndex = action.step_index
        return null
      }
      case 'focus': {
        if (!this.hasStructure(action.structure_id)) return `no model for ${action.structure_id}`
        await this.focusStructures([action.structure_id], action.duration_ms ?? DEFAULT_MOVE_MS)
        return null
      }
      case 'highlight': {
        const known = action.structure_ids.filter((id) => this.hasStructure(id))
        for (const id of known) {
          if (action.enabled) this.highlighted.add(id)
          else this.highlighted.delete(id)
        }
        this.refreshMaterials()
        const missing = action.structure_ids.filter((id) => !this.hasStructure(id))
        return missing.length > 0 ? `no model for ${missing.join(', ')}` : null
      }
      case 'set_opacity': {
        if (!this.hasStructure(action.structure_id)) return `no model for ${action.structure_id}`
        this.opacity.set(action.structure_id, THREE.MathUtils.clamp(action.opacity, 0, 1))
        this.refreshMaterials()
        return null
      }
      case 'zoom': {
        const controller = this.controller
        if (!controller) return 'no camera'
        const factor = ZOOM_FACTORS[action.amount]
        const pose = controller.getPose()
        pose.radius *= action.direction === 'in' ? factor : 1 / factor
        controller.animateTo(pose, DEFAULT_MOVE_MS)
        return null
      }
      case 'rotate': {
        const controller = this.controller
        if (!controller) return 'no camera'
        const degrees = THREE.MathUtils.clamp(action.degrees, MIN_ROTATE_DEGREES, MAX_ROTATE_DEGREES)
        const radians = THREE.MathUtils.degToRad(degrees)
        const pose = controller.getPose()
        // The direction is where the camera travels around the model: "up" looks from higher above
        if (action.direction === 'left') pose.theta -= radians
        if (action.direction === 'right') pose.theta += radians
        if (action.direction === 'up') pose.phi -= radians
        if (action.direction === 'down') pose.phi += radians
        controller.animateTo(pose, DEFAULT_MOVE_MS)
        return null
      }
      case 'reset_view': {
        if (!this.controller) return 'no camera'
        this.resetView()
        return null
      }
      default: {
        const unknown: never = action
        return `unknown command ${JSON.stringify(unknown)}`
      }
    }
  }

  /** Point the camera at the models standing for these structures, close enough to fill the view. */
  private async focusStructures(structureIds: readonly string[], durationMs: number): Promise<void> {
    const models = [...new Set(structureIds.flatMap((id) => this.byStructure.get(id) ?? []))]
    if (models.length === 0) return

    const generation = this.generation
    await Promise.all(models.map((m) => m.loaded.catch(() => undefined)))
    const controller = this.controller
    if (generation !== this.generation || !controller) return

    const box = new THREE.Box3()
    for (const model of models) {
      if (model.status !== 'ready') continue
      model.root.updateWorldMatrix(true, true)
      box.expandByObject(model.root)
    }
    if (box.isEmpty()) return

    const sphere = box.getBoundingSphere(new THREE.Sphere())
    const camera = controller.camera
    const verticalFov = THREE.MathUtils.degToRad(camera.fov)
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect)
    const halfFov = Math.min(verticalFov, horizontalFov) / 2

    const pose = controller.getPose()
    pose.target = sphere.center
    pose.radius = (sphere.radius / Math.sin(halfFov)) * FOCUS_MARGIN
    controller.animateTo(pose, durationMs)
  }

  /** Push the highlight and opacity state into each model's material. */
  private refreshMaterials(): void {
    this.glowing = []
    for (const model of this.models) {
      const material = model.material
      if (!(material instanceof THREE.MeshStandardMaterial)) continue

      const ids = MODEL_STRUCTURES[model.path] ?? []
      if (ids.length === 0) continue

      const glow = ids.some((id) => this.highlighted.has(id))
      // Several structures share one model, so the model is as visible as its most visible structure
      const levels = ids.flatMap((id) => {
        const level = this.opacity.get(id)
        return level === undefined ? [] : [level]
      })
      const opacity = levels.length > 0 ? Math.max(...levels) : 1
      const transparent = opacity < 0.999

      if (material.transparent !== transparent) {
        material.transparent = transparent
        material.needsUpdate = true
      }
      material.opacity = opacity
      material.depthWrite = !transparent
      material.emissive.copy(glow ? HIGHLIGHT_COLOR : NO_GLOW)
      material.emissiveIntensity = glow ? GLOW_MAX : 1
      if (glow) this.glowing.push(material)
    }
  }
}
