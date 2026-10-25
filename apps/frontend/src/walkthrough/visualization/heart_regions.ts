import type { RegionMap } from './regions'

/**
 * Anatomical names of the heart parts, as structure_id values (see structures.json).
 * Use these constants instead of retyping the strings.
 */
export const SUPERIOR_VENA_CAVA = 'superior_vena_cava'
export const AORTA = 'aorta'
export const PULMONARY_ARTERY = 'pulmonary_artery'
export const RIGHT_ATRIUM = 'right_atrium'
export const RIGHT_VENTRICLE = 'right_ventricle'
export const LEFT_VENTRICLE = 'left_ventricle'

/**
 * Where each part sits in heart_part_2.glb (the front half of the heart, cut open), in the file's own x-y units.
 * In this file x grows toward the patient's left and y grows upward; the apex is at the lower left of the screen.
 *
 * The outlines follow the cut edge of the model, which shows a four-chamber view. From the patient's right to left
 * along the top: the superior vena cava, the ascending aorta (the heart's own stub of it, so it carries the id of
 * the aorta model) and the pulmonary artery, whose lumen is the round opening. The right atrium lies under the
 * vena cava, the thick septum runs diagonally down toward the apex, the left ventricle is the large cavity beyond
 * it, and the right ventricle fills the space in front of the septum up to the pulmonary artery.
 * The front chambers are matched to the same positions, so borders are still approximate.
 *
 * To adjust one, move its corner points; the order of the entries decides who wins where outlines overlap.
 * Open the walkthrough with ?regions in the address to see every region in its own color.
 * Not named yet, because the front half does not show them clearly: left atrium, pulmonary veins,
 * inferior vena cava and the tricuspid, mitral and pulmonary valves. The aortic valve has its own model.
 */
export const HEART_PART_2_REGIONS: RegionMap = {
  [SUPERIOR_VENA_CAVA]: [
    [-10, -47],
    [-34, -47],
    [-34, -100],
    [-11, -100],
  ],
  [AORTA]: [
    [-10, -47],
    [8, -47],
    [9, -103],
    [-9, -105],
  ],
  [PULMONARY_ARTERY]: [
    [7, -47],
    [13, -50],
    [22, -60],
    [29, -70],
    [30, -82],
    [26, -90],
    [14, -92],
    [6, -84],
    [5, -68],
    [6, -55],
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
    [-9, -104],
    [9, -103],
    [12, -96],
    [26, -92],
    [30, -96],
    [24, -112],
    [10, -126],
    [14, -150],
    [30, -172],
    [38, -185],
    [5, -190],
    [-22, -180],
    [-36, -168],
    [-12, -98],
  ],
  [LEFT_VENTRICLE]: [
    [30, -96],
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
    [10, -126],
    [24, -112],
  ],
}
