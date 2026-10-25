import * as THREE from 'three'

/** How often the pointer is checked against the models while it moves. The models are large, so not every frame. */
const HOVER_INTERVAL_MS = 80
/** A press that moves less than this is a click; more is a drag to turn the view. */
const CLICK_TOLERANCE_PX = 5

export type PartPickerHandlers = {
  /** The part under the pointer changed or moved. x and y are relative to the canvas. */
  onHover: (structureId: string | null, x: number, y: number) => void
  /** The patient clicked or tapped. null means empty space. */
  onPick: (structureId: string | null) => void
}

/** Finds the part under a ray from the camera. */
export type PickFunction = (raycaster: THREE.Raycaster) => string | null

/**
 * Lets the patient point at the 3D model: hovering reports the part under the pointer, and a click (not a drag)
 * picks it. Works with the mouse and with touch.
 */
export class PartPicker {
  private readonly camera: THREE.PerspectiveCamera
  private readonly element: HTMLElement
  private readonly pick: PickFunction
  private readonly handlers: PartPickerHandlers
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private timer: ReturnType<typeof setTimeout> | null = null
  private last = { x: 0, y: 0 }
  private down: { x: number; y: number } | null = null
  private hovered: string | null = null

  constructor(camera: THREE.PerspectiveCamera, element: HTMLElement, pick: PickFunction, handlers: PartPickerHandlers) {
    this.camera = camera
    this.element = element
    this.pick = pick
    this.handlers = handlers
    element.addEventListener('pointermove', this.handleMove)
    element.addEventListener('pointerdown', this.handleDown)
    element.addEventListener('pointerup', this.handleUp)
    element.addEventListener('pointerleave', this.handleLeave)
  }

  dispose(): void {
    this.element.removeEventListener('pointermove', this.handleMove)
    this.element.removeEventListener('pointerdown', this.handleDown)
    this.element.removeEventListener('pointerup', this.handleUp)
    this.element.removeEventListener('pointerleave', this.handleLeave)
    if (this.timer) clearTimeout(this.timer)
    this.element.style.cursor = ''
  }

  private readonly handleMove = (event: PointerEvent) => {
    // While a button is held the patient is turning the view, so hide the hover label
    if (event.buttons !== 0 || event.pointerType === 'touch') {
      this.setHovered(null, 0, 0)
      return
    }
    this.last = this.relative(event)
    this.timer ??= setTimeout(() => {
      this.timer = null
      const id = this.partAt(this.last.x, this.last.y)
      this.setHovered(id, this.last.x, this.last.y)
    }, HOVER_INTERVAL_MS)
  }

  private readonly handleDown = (event: PointerEvent) => {
    this.down = event.button === 0 ? this.relative(event) : null
  }

  private readonly handleUp = (event: PointerEvent) => {
    const start = this.down
    this.down = null
    if (!start || event.button !== 0) return
    const end = this.relative(event)
    if (Math.hypot(end.x - start.x, end.y - start.y) > CLICK_TOLERANCE_PX) return
    this.handlers.onPick(this.partAt(end.x, end.y))
  }

  private readonly handleLeave = () => {
    this.setHovered(null, 0, 0)
  }

  private setHovered(id: string | null, x: number, y: number): void {
    if (id === null && this.hovered === null) return
    this.hovered = id
    this.element.style.cursor = id ? 'pointer' : ''
    this.handlers.onHover(id, x, y)
  }

  private relative(event: PointerEvent): { x: number; y: number } {
    const rect = this.element.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  private partAt(x: number, y: number): string | null {
    const rect = this.element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    this.pointer.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    return this.pick(this.raycaster)
  }
}
