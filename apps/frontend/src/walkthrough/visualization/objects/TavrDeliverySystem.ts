import * as THREE from 'three'
import { SceneObject, type Transform } from './SceneObject'
import { Balloon } from './Balloon'
import { DeliveryCatheter, type DeliveryCatheterOptions } from './DeliveryCatheter'
import { TavrValve } from './TavrValve'

/** What every device is doing in one step of the walkthrough. */
export type DeviceState = {
  /** How far the catheter is inserted, 0 to 1. */
  catheterFill: number
  balloonShown: boolean
  /** 0 = wrapped, 1 = inflated. */
  balloonInflation: number
  valveShown: boolean
  /** 0 = crimped, 1 = open. */
  valveExpansion: number
  /** True while the valve rides on the catheter; false once it has been set and the catheter lets go. */
  valveOnCatheter: boolean
  /** The leaflets open and close with the heartbeat. */
  beating: boolean
}

/**
 * The devices at each step (step 0 is the introduction, steps 1 to 5 the procedure):
 * 0 and 1 show no device here (step 1 has only the guidewire), 2 carries the crimped valve to the annulus,
 * 3 inflates the balloon and opens the valve, 4 deflates the balloon and withdraws the catheter,
 * 5 shows the valve working on its own.
 */
export function deviceStateForStep(step: number): DeviceState {
  const none: DeviceState = {
    catheterFill: 0,
    balloonShown: false,
    balloonInflation: 0,
    valveShown: false,
    valveExpansion: 0,
    valveOnCatheter: true,
    beating: false,
  }
  switch (step) {
    case 2:
      return { ...none, catheterFill: 1, balloonShown: true, valveShown: true }
    case 3:
      return { ...none, catheterFill: 1, balloonShown: true, balloonInflation: 1, valveShown: true, valveExpansion: 1, valveOnCatheter: false }
    case 4:
      return { ...none, catheterFill: 0.4, balloonShown: true, valveShown: true, valveExpansion: 1, valveOnCatheter: false }
    default:
      return step >= 5 ? { ...none, valveShown: true, valveExpansion: 1, valveOnCatheter: false, beating: true } : none
  }
}

export type TavrDeliverySystemOptions = Transform &
  Pick<DeliveryCatheterOptions, 'points' | 'stopAt'> & {
    /** The step to open at, with no animation. Defaults to step 0. */
    step?: number
  }

const _position = new THREE.Vector3()
const _quaternion = new THREE.Quaternion()
const _axis = new THREE.Vector3()
/** Turns the valve around so that its skirt (inflow end) points toward the heart, the way it sits on the balloon. */
const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)

/**
 * The balloon-expandable valve and its delivery equipment working together: the catheter with the balloon and the
 * crimped valve on its head, the balloon opening the valve, and the catheter leaving the valve behind.
 * Each device is its own object (DeliveryCatheter, Balloon, TavrValve); this one places them and moves them
 * through the steps. Drive it with `setStep`.
 */
export class TavrDeliverySystem extends SceneObject {
  readonly catheter: DeliveryCatheter
  readonly balloon: Balloon
  readonly valve: TavrValve

  private onCatheter = true

  constructor({ points, stopAt, step = 0, ...transform }: TavrDeliverySystemOptions) {
    super(transform)
    this.catheter = new DeliveryCatheter({ points, stopAt })
    this.balloon = new Balloon()
    this.valve = new TavrValve({ expansion: 0 })
    this.root.add(this.catheter.root, this.balloon.root, this.valve.root)
    this.setStep(step, true)
  }

  /** The parts draw themselves, so the whole is always "renderable". */
  get renderable(): boolean {
    return true
  }

  /** Move the devices to what a step needs. They move smoothly, unless `immediate`. */
  setStep(step: number, immediate = false): this {
    const s = deviceStateForStep(step)
    const ms = (duration: number) => (immediate ? 0 : duration)
    const inflationFalls = s.balloonInflation < this.balloon.inflation

    this.balloon.setShown(s.balloonShown)
    this.valve.setShown(s.valveShown)
    this.onCatheter = s.valveOnCatheter

    // The catheter waits for the balloon to deflate before it is withdrawn
    this.catheter.animateFillTo(s.catheterFill, ms(1800), ms(inflationFalls ? 900 : 0))
    this.balloon.animateInflationTo(s.balloonInflation, ms(1500))
    this.valve.animateExpansionTo(s.valveExpansion, ms(1500))
    if (s.beating) this.valve.startBeating()
    else this.valve.stopBeating()

    if (immediate) this.valve.setLeafletOpen(0)
    this.place()
    return this
  }

  update(delta: number): void {
    super.update(delta)
    this.catheter.update(delta)
    this.balloon.update(delta)
    this.valve.update(delta)
    this.place()
    for (const part of [this.catheter, this.balloon, this.valve]) part.root.visible = part.renderable
  }

  dispose(): void {
    this.catheter.dispose()
    this.balloon.dispose()
    this.valve.dispose()
    super.dispose()
  }

  /** Put the balloon and the valve on the head of the catheter, or the valve where it was set. */
  private place(): void {
    const head = this.catheter.headPose(this.catheter.fill, _position, _quaternion)
    this.balloon.root.position.copy(head.position)
    this.balloon.root.quaternion.copy(head.quaternion)

    const pose = this.onCatheter ? head : this.catheter.headPose(1, _position, _quaternion)
    _axis.set(0, 1, 0).applyQuaternion(pose.quaternion)
    // The valve's own origin is its inflow end; after the turn its middle is half its height along the axis
    this.valve.root.position.copy(pose.position).addScaledVector(_axis, this.valve.height / 2)
    this.valve.root.quaternion.copy(pose.quaternion).multiply(FLIP)
  }
}
