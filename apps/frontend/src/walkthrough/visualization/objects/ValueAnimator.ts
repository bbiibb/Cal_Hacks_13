/** Moves a number smoothly to a new value over time, optionally after a delay. Used for fills, inflation and expansion. */
export class ValueAnimator {
  private _value: number
  /** Set when the value was changed by `set`, so the next `update` reports it. */
  private dirty = false
  private animation: { from: number; to: number; elapsed: number; delay: number; duration: number } | null = null

  constructor(value = 0) {
    this._value = value
  }

  get value(): number {
    return this._value
  }

  /** True while a move is waiting for its delay or still running. */
  get active(): boolean {
    return this.animation !== null
  }

  /** Jump to a value and cancel any move in progress. */
  set(value: number): void {
    this.animation = null
    this._value = value
    this.dirty = true
  }

  /** Move to a value. A new call replaces the move in progress. */
  animateTo(to: number, durationMs = 1200, delayMs = 0): void {
    if (durationMs <= 0 && delayMs <= 0) return this.set(to)
    if (to === this._value && this.animation === null) return
    this.animation = { from: this._value, to, elapsed: 0, delay: delayMs / 1000, duration: Math.max(durationMs, 1) / 1000 }
  }

  /** Advance by `delta` seconds. Returns true when the value changed. */
  update(delta: number): boolean {
    const a = this.animation
    if (!a) {
      const jumped = this.dirty
      this.dirty = false
      return jumped
    }
    a.elapsed += delta
    const t = Math.min(Math.max((a.elapsed - a.delay) / a.duration, 0), 1)
    const eased = t * t * (3 - 2 * t) // ease in and out
    const next = a.from + (a.to - a.from) * eased
    const changed = next !== this._value || this.dirty
    this.dirty = false
    this._value = next
    if (t >= 1) this.animation = null
    return changed
  }
}
