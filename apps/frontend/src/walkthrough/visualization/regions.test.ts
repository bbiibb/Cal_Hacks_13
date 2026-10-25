import { describe, expect, it } from 'vitest'
import { HEART_PART_2_REGIONS } from './heart_regions'
import { NO_REGION, insidePolygon, regionIndexAt } from './regions'
import { MODEL_BINDINGS } from './scene_bindings'
import { TAVI_STRUCTURES } from '../tavi_content'

const SQUARE = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
] as const

describe('regions', () => {
  it('tells whether a point is inside an outline', () => {
    expect(insidePolygon(SQUARE, 5, 5)).toBe(true)
    expect(insidePolygon(SQUARE, 11, 5)).toBe(false)
    expect(insidePolygon(SQUARE, -1, 5)).toBe(false)
  })

  it('gives the first outline that holds the point, 1-based', () => {
    const shifted = SQUARE.map(([x, y]) => [x + 5, y] as const)
    expect(regionIndexAt([SQUARE, shifted], 7, 5)).toBe(1)
    expect(regionIndexAt([SQUARE, shifted], 12, 5)).toBe(2)
    expect(regionIndexAt([SQUARE, shifted], 30, 5)).toBe(NO_REGION)
  })
})

describe('heart regions', () => {
  it('only use structures that exist', () => {
    const known = new Set(TAVI_STRUCTURES.map((s) => s.id))
    for (const id of Object.keys(HEART_PART_2_REGIONS)) expect(known.has(id)).toBe(true)
  })

  it('are bound to the model they were drawn for', () => {
    const binding = MODEL_BINDINGS['/models/heart_part_2.glb']
    expect(binding.regions).toBe(HEART_PART_2_REGIONS)
    expect(binding.structures).toEqual(Object.keys(HEART_PART_2_REGIONS))
  })

  it('name the chambers at known spots of the model', () => {
    const names = Object.keys(HEART_PART_2_REGIONS)
    const at = (x: number, y: number) => {
      const index = regionIndexAt(Object.values(HEART_PART_2_REGIONS), x, y)
      return index === NO_REGION ? null : names[index - 1]
    }
    expect(at(-20, -70)).toBe('superior_vena_cava')
    expect(at(0, -70)).toBe('aorta')
    expect(at(17, -75)).toBe('pulmonary_artery')
    expect(at(-25, -130)).toBe('right_atrium')
    expect(at(5, -170)).toBe('right_ventricle')
    expect(at(55, -150)).toBe('left_ventricle')
    expect(at(0, -30)).toBeNull()
  })
})
