/**
 * Named areas inside one model file.
 *
 * Some model files are a single mesh, so the file cannot tell the chambers apart. A region map cuts such a
 * model into named parts by position: each part is a polygon in the model file's own x-y plane (the units of
 * the GLB file, before the model is scaled or moved). A point belongs to the first polygon that contains it.
 * Once the 3D owner exports one mesh per part, delete the map and bind the mesh names instead.
 */
export type Polygon = readonly (readonly [number, number])[]

/** structure_id -> area. Order matters: where areas overlap, the earlier one wins. */
export type RegionMap = Readonly<Record<string, Polygon>>

/** A region index of 0 means "none"; the first region is 1. */
export const NO_REGION = 0

/** The most regions one model can have: the glow mask is a 32-bit integer and bit 0 is "none". */
export const MAX_REGIONS = 31

export function insidePolygon(polygon: Polygon, x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** The region index (1-based) at a point of the model file, or NO_REGION. */
export function regionIndexAt(polygons: readonly Polygon[], x: number, y: number): number {
  for (let i = 0; i < polygons.length; i++) {
    if (insidePolygon(polygons[i], x, y)) return i + 1
  }
  return NO_REGION
}
