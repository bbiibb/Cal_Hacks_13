/*
 * The shapes of the TAVR devices as plain numbers, so they can be tested without a graphics context.
 * Every device is built along its own Y axis. Sizes are in scene units (the aortic annulus is about 0.24 wide).
 */

export type Vec3 = readonly [number, number, number]

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const clamp01 = (t: number): number => Math.min(Math.max(t, 0), 1)
export const smoothstep = (t: number): number => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

// ---------------------------------------------------------------------------------------------------------------
// The valve: a metal frame (stent), a white cloth skirt at the inflow end, and three leaflets inside
// ---------------------------------------------------------------------------------------------------------------

export type ValveShape = {
  /** Radius and height of the frame when it is squeezed onto the balloon. */
  crimpedRadius: number
  crimpedHeight: number
  /** Radius and height once the balloon has opened it. The frame gets shorter as it widens. */
  expandedRadius: number
  expandedHeight: number
  /** Cells around the frame. */
  columns: number
  /** Rows of cells along the frame. */
  rows: number
  /** The part of the height that the skirt covers, from the inflow end. */
  skirtFraction: number
  /** Thickness of a frame strut. */
  strutRadius: number
}

export const DEFAULT_VALVE_SHAPE: ValveShape = {
  crimpedRadius: 0.045,
  crimpedHeight: 0.2,
  expandedRadius: 0.115,
  expandedHeight: 0.15,
  columns: 12,
  rows: 3,
  skirtFraction: 0.42,
  strutRadius: 0.0032,
}

/** `expansion` is 0 for crimped and 1 for fully open. */
export function valveRadius(shape: ValveShape, expansion: number): number {
  return lerp(shape.crimpedRadius, shape.expandedRadius, clamp01(expansion))
}

export function valveHeight(shape: ValveShape, expansion: number): number {
  return lerp(shape.crimpedHeight, shape.expandedHeight, clamp01(expansion))
}

/** Where a frame node sits: ring `ring` (0 = inflow end), column `column`. Odd rings are shifted half a cell. */
export function stentNode(shape: ValveShape, expansion: number, ring: number, column: number): Vec3 {
  const r = valveRadius(shape, expansion)
  const angle = ((column + (ring % 2) * 0.5) / shape.columns) * Math.PI * 2
  return [r * Math.cos(angle), (valveHeight(shape, expansion) * ring) / shape.rows, r * Math.sin(angle)]
}

/** Every strut of the frame as a pair of end points: a lattice of diamonds that widens and shortens as it opens. */
export function stentStruts(shape: ValveShape, expansion: number): [Vec3, Vec3][] {
  const struts: [Vec3, Vec3][] = []
  const n = shape.columns
  for (let ring = 0; ring < shape.rows; ring++) {
    for (let column = 0; column < n; column++) {
      const from = stentNode(shape, expansion, ring, column)
      // A node joins the two nodes of the next ring that sit half a cell to either side of it
      const [a, b] = ring % 2 === 0 ? [column - 1, column] : [column, column + 1]
      for (const next of [a, b]) {
        struts.push([from, stentNode(shape, expansion, ring + 1, ((next % n) + n) % n)])
      }
    }
  }
  return struts
}

/** The height of the skirt, from the inflow end. */
export function skirtHeight(shape: ValveShape, expansion: number): number {
  return valveHeight(shape, expansion) * shape.skirtFraction
}

export type Mesh3 = { positions: number[]; indices: number[] }

const LEAFLETS = 3
const ARC_STEPS = 14
const SPAN_STEPS = 6

/**
 * The three leaflets. Each hangs from the frame wall along a curved line and has a free edge that runs between
 * two commissures (where the leaflets meet the wall). Closed (`open` = 0) the free edges meet in the middle of
 * the valve; open (`open` = 1) they lie close to the wall and leave the middle free for blood.
 */
export function leafletMesh(shape: ValveShape, expansion: number, open: number): Mesh3 {
  const r = valveRadius(shape, expansion)
  const h = valveHeight(shape, expansion)
  const o = smoothstep(open)
  const yTop = h * 0.88 // the commissures
  const yBase = h * 0.3 // the lowest point of the attachment line
  const yMeet = h * 0.62 // where the free edges meet when closed

  const positions: number[] = []
  const indices: number[] = []
  for (let leaflet = 0; leaflet < LEAFLETS; leaflet++) {
    const start = (leaflet / LEAFLETS) * Math.PI * 2
    const span = (Math.PI * 2) / LEAFLETS
    const first = positions.length / 3
    for (let i = 0; i <= ARC_STEPS; i++) {
      const u = i / ARC_STEPS
      const angle = start + u * span
      const wallR = r * 0.96
      // Attachment line on the wall: high at the commissures, low in the middle
      const attach: Vec3 = [wallR * Math.cos(angle), lerp(yBase, yTop, (2 * u - 1) ** 2), wallR * Math.sin(angle)]
      // Free edge when closed: from one commissure to the middle and out to the next
      const side = u <= 0.5 ? u * 2 : (1 - u) * 2 // 0 at a commissure, 1 in the middle
      const closed: Vec3 = [
        lerp(wallR * Math.cos(start + (u <= 0.5 ? 0 : span)), 0, side),
        lerp(yTop, yMeet, side),
        lerp(wallR * Math.sin(start + (u <= 0.5 ? 0 : span)), 0, side),
      ]
      // Free edge when open: along the wall, a little inside it
      const openR = r * 0.86
      const opened: Vec3 = [openR * Math.cos(angle), lerp(yTop, yTop * 0.97, side), openR * Math.sin(angle)]
      const free: Vec3 = [lerp(closed[0], opened[0], o), lerp(closed[1], opened[1], o), lerp(closed[2], opened[2], o)]
      for (let j = 0; j <= SPAN_STEPS; j++) {
        const v = j / SPAN_STEPS
        // The leaflets bulge a little toward the inflow end, like a cup, and flatten when they open
        const sag = -h * 0.1 * Math.sin(Math.PI * v) * Math.sin(Math.PI * u) * (1 - 0.6 * o)
        positions.push(lerp(attach[0], free[0], v), lerp(attach[1], free[1], v) + sag, lerp(attach[2], free[2], v))
      }
    }
    const row = SPAN_STEPS + 1
    for (let i = 0; i < ARC_STEPS; i++) {
      for (let j = 0; j < SPAN_STEPS; j++) {
        const a = first + i * row + j
        indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1)
      }
    }
  }
  return { positions, indices }
}

// ---------------------------------------------------------------------------------------------------------------
// The balloon: a long bulb with a taper at each end, centered on its middle
// ---------------------------------------------------------------------------------------------------------------

export type BalloonShape = {
  /** Radius of the wrapped balloon and of the inflated body. */
  deflatedRadius: number
  inflatedRadius: number
  bodyLength: number
  /** Length of the taper on the proximal (aorta) side and on the distal (heart) side. */
  proximalTaper: number
  distalTaper: number
  /** Radius where the balloon meets the catheter shaft. */
  neckRadius: number
}

export const DEFAULT_BALLOON_SHAPE: BalloonShape = {
  deflatedRadius: 0.036,
  inflatedRadius: 0.128,
  bodyLength: 0.17,
  proximalTaper: 0.1,
  distalTaper: 0.12,
  neckRadius: 0.014,
}

export function balloonLength(shape: BalloonShape): number {
  return shape.proximalTaper + shape.bodyLength + shape.distalTaper
}

/**
 * The outline of the balloon as (radius, y) pairs from the proximal end (y = -length / 2) to the distal end,
 * for a lathe. `inflation` is 0 for wrapped and 1 for full.
 */
export function balloonProfile(shape: BalloonShape, inflation: number, steps = 8): [number, number][] {
  const radius = lerp(shape.deflatedRadius, shape.inflatedRadius, clamp01(inflation))
  const half = balloonLength(shape) / 2
  const profile: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    profile.push([lerp(shape.neckRadius, radius, smoothstep(t)), -half + t * shape.proximalTaper])
  }
  profile.push([radius, -half + shape.proximalTaper + shape.bodyLength])
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    profile.push([lerp(radius, shape.neckRadius, smoothstep(t)), -half + shape.proximalTaper + shape.bodyLength + t * shape.distalTaper])
  }
  return profile
}
