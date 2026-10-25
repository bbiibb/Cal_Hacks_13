import { describe, expect, it } from 'vitest'
import { ValueAnimator } from './ValueAnimator'
import { deviceStateForStep } from './TavrDeliverySystem'
import {
  DEFAULT_BALLOON_SHAPE,
  DEFAULT_VALVE_SHAPE,
  balloonLength,
  balloonProfile,
  leafletMesh,
  skirtHeight,
  stentNode,
  stentStruts,
  valveHeight,
  valveRadius,
} from './device_geometry'

const shape = DEFAULT_VALVE_SHAPE

describe('the valve frame', () => {
  it('widens and shortens as it opens', () => {
    expect(valveRadius(shape, 0)).toBeCloseTo(shape.crimpedRadius)
    expect(valveRadius(shape, 1)).toBeCloseTo(shape.expandedRadius)
    expect(valveRadius(shape, 1)).toBeGreaterThan(valveRadius(shape, 0.5))
    expect(valveHeight(shape, 1)).toBeLessThan(valveHeight(shape, 0))
  })

  it('puts every node on a ring around the axis, rings stacked from the inflow end', () => {
    const [x, y, z] = stentNode(shape, 1, 2, 3)
    expect(Math.hypot(x, z)).toBeCloseTo(shape.expandedRadius)
    expect(y).toBeCloseTo((valveHeight(shape, 1) * 2) / shape.rows)
    expect(stentNode(shape, 1, 0, 0)[1]).toBe(0)
  })

  it('has two struts for every node but the last ring, each joining neighbouring rings', () => {
    const struts = stentStruts(shape, 1)
    expect(struts).toHaveLength(shape.rows * shape.columns * 2)
    for (const [a, b] of struts) expect(Math.abs(b[1] - a[1])).toBeCloseTo(valveHeight(shape, 1) / shape.rows)
  })

  it('has a skirt that covers part of the height', () => {
    expect(skirtHeight(shape, 1)).toBeCloseTo(valveHeight(shape, 1) * shape.skirtFraction)
    expect(skirtHeight(shape, 1)).toBeLessThan(valveHeight(shape, 1))
  })
})

describe('the leaflets', () => {
  const radial = (m: { positions: number[] }, i: number) => Math.hypot(m.positions[i * 3], m.positions[i * 3 + 2])

  it('make three leaflets of triangles that all point at real vertices', () => {
    const mesh = leafletMesh(shape, 1, 0)
    expect(mesh.positions.length % 3).toBe(0)
    expect(mesh.indices.length % 3).toBe(0)
    expect(Math.max(...mesh.indices)).toBeLessThan(mesh.positions.length / 3)
    expect(Number.isFinite(Math.max(...mesh.positions))).toBe(true)
  })

  it('stay inside the frame', () => {
    for (const open of [0, 0.5, 1]) {
      const mesh = leafletMesh(shape, 1, open)
      for (let i = 0; i < mesh.positions.length / 3; i++) expect(radial(mesh, i)).toBeLessThanOrEqual(shape.expandedRadius + 1e-6)
    }
  })

  it('close in the middle and open toward the wall', () => {
    const closed = leafletMesh(shape, 1, 0)
    const open = leafletMesh(shape, 1, 1)
    const innermost = (m: typeof closed) => Math.min(...Array.from({ length: m.positions.length / 3 }, (_, i) => radial(m, i)))
    expect(innermost(closed)).toBeLessThan(0.005) // the free edges meet on the axis
    expect(innermost(open)).toBeGreaterThan(shape.expandedRadius * 0.5) // the middle is free for blood
  })
})

describe('the balloon', () => {
  const shapeB = DEFAULT_BALLOON_SHAPE

  it('is centered on its middle and as long as its parts', () => {
    const profile = balloonProfile(shapeB, 1)
    expect(profile[0]![1]).toBeCloseTo(-balloonLength(shapeB) / 2)
    expect(profile[profile.length - 1]![1]).toBeCloseTo(balloonLength(shapeB) / 2)
  })

  it('is wider when inflated, with the same neck at both ends', () => {
    const wrapped = balloonProfile(shapeB, 0)
    const full = balloonProfile(shapeB, 1)
    expect(Math.max(...full.map(([r]) => r))).toBeCloseTo(shapeB.inflatedRadius)
    expect(Math.max(...wrapped.map(([r]) => r))).toBeCloseTo(shapeB.deflatedRadius)
    expect(full[0]![0]).toBeCloseTo(shapeB.neckRadius)
    expect(full[full.length - 1]![0]).toBeCloseTo(shapeB.neckRadius)
  })

  it('opens the valve to its full size', () => {
    expect(shapeB.inflatedRadius).toBeGreaterThan(shape.expandedRadius)
    expect(shapeB.deflatedRadius).toBeLessThan(shape.crimpedRadius)
  })
})

describe('what the devices do at each step', () => {
  it('shows no device in the introduction and while only the guidewire is in', () => {
    for (const step of [0, 1]) {
      const s = deviceStateForStep(step)
      expect(s.catheterFill).toBe(0)
      expect(s.valveShown).toBe(false)
      expect(s.balloonShown).toBe(false)
    }
  })

  it('carries the crimped valve in step 2, with the balloon wrapped', () => {
    const s = deviceStateForStep(2)
    expect(s).toMatchObject({ catheterFill: 1, valveShown: true, valveExpansion: 0, balloonInflation: 0, valveOnCatheter: true })
  })

  it('inflates the balloon and opens the valve in step 3', () => {
    expect(deviceStateForStep(3)).toMatchObject({ balloonInflation: 1, valveExpansion: 1, valveOnCatheter: false })
  })

  it('leaves the open valve behind and withdraws the catheter in step 4', () => {
    expect(deviceStateForStep(4)).toMatchObject({ catheterFill: 0.4, balloonInflation: 0, valveExpansion: 1, valveShown: true })
  })

  it('shows only the working valve in step 5, and keeps it there after', () => {
    for (const step of [5, 6]) {
      expect(deviceStateForStep(step)).toMatchObject({ catheterFill: 0, balloonShown: false, valveShown: true, beating: true })
    }
  })
})

describe('ValueAnimator', () => {
  it('reaches its target, after its delay, and reports changes', () => {
    const a = new ValueAnimator(0)
    a.animateTo(1, 1000, 500)
    expect(a.update(0.25)).toBe(false) // still waiting
    expect(a.value).toBe(0)
    a.update(0.5)
    expect(a.value).toBeGreaterThan(0)
    expect(a.value).toBeLessThan(1)
    a.update(2)
    expect(a.value).toBe(1)
    expect(a.active).toBe(false)
  })

  it('reports a jump once, so the shape is rebuilt', () => {
    const a = new ValueAnimator(0)
    a.set(0.7)
    expect(a.update(0.016)).toBe(true)
    expect(a.update(0.016)).toBe(false)
    a.animateTo(0.3, 0)
    expect(a.value).toBe(0.3)
    expect(a.update(0.016)).toBe(true)
  })
})
