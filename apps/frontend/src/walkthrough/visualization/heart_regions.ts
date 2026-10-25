import type { RegionMap } from './regions'

/**
 * Anatomical names of the heart parts, as structure_id values (see structures.json).
 * Use these constants instead of retyping the strings.
 */
export const SUPERIOR_VENA_CAVA = 'superior_vena_cava'
export const PULMONARY_ARTERY = 'pulmonary_artery'
export const RIGHT_ATRIUM = 'right_atrium'
export const RIGHT_VENTRICLE = 'right_ventricle'
export const LEFT_VENTRICLE = 'left_ventricle'

/**
 * Where each part sits in heart_part_2.glb (the front half of the heart, cut open), in the file's own x-y units.
 * In this file x grows toward the patient's left and y grows upward; the apex is at the lower left of the screen.
 *
 * The outlines follow the cut edge of the model, which shows the walls and chambers of a four-chamber view:
 * the superior vena cava and right atrium share the channel on the patient's right, the pulmonary artery is the
 * tube beside it, the thick septum runs diagonally down toward the apex, and the left ventricle is the large
 * cavity beyond it. The front chambers are matched to the same positions, so borders are still approximate.
 * To adjust one, move its corner points; the order of the entries decides who wins where outlines overlap.
 * Not named yet, because the front half does not show them clearly: left atrium, pulmonary veins,
 * inferior vena cava and the tricuspid, mitral and pulmonary valves. The aorta and aortic valve have their own models.
 */
export const HEART_PART_2_REGIONS: RegionMap = {
  [SUPERIOR_VENA_CAVA]: [
    [-10, -47],
    [-34, -47],
    [-34, -100],
    [-11, -100],
  ],
  [PULMONARY_ARTERY]: [
    [-10, -47],
    [8, -47],
    [10, -98],
    [-9, -100],
  ],
  [RIGHT_ATRIUM]: [
    [-11, -100],
    [-34, -100],
    [-43, -125],
    [-43, -148],
    [-33, -162],
    [-12, -158],
    [0, -150],
    [-2, -126],
    [-4, -114],
  ],
  [RIGHT_VENTRICLE]: [
    [-9, -100],
    [10, -100],
    [8, -125],
    [14, -150],
    [30, -172],
    [38, -185],
    [5, -190],
    [-22, -180],
    [-36, -168],
    [-12, -98],
  ],
  [LEFT_VENTRICLE]: [
    [10, -100],
    [24, -92],
    [40, -103],
    [60, -120],
    [72, -132],
    [77, -155],
    [74, -175],
    [60, -185],
    [42, -190],
    [38, -185],
    [30, -172],
    [14, -150],
    [8, -125],
  ],
}
