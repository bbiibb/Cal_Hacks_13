import { HEART_PART_2_REGIONS } from './heart_regions'
import type { RegionMap } from './regions'

/**
 * Which structure_id values each model file stands for.
 *
 * The contract says a structure_id matches a GLB mesh name one to one, but the current model files use names
 * such as "aortalvot" and "Object_2". Until the models are re-exported with contract names, the scene
 * director treats a whole model file as the stand-in for these structures. Unknown ids are ignored.
 *
 * Proxies worth knowing:
 * - There is no model of the new (transcatheter) valve yet, so it points at the aortic root, where it sits.
 * - The coronary arteries branch off the aortic root, so they point there too.
 */
export type ModelBinding = {
  /** The part shown when the patient points at this model. */
  primary: string
  /** Every structure this model stands for. */
  structures: readonly string[]
  /**
   * For a single-mesh model that holds several named parts: where each part is (see regions.ts).
   * The model must be created with the same map. Pointing at the model then names the part under the pointer.
   */
  regions?: RegionMap
}

export const MODEL_BINDINGS: Readonly<Record<string, ModelBinding>> = {
  '/models/bicuspidic_aortic_root_with_calcifications.glb': {
    primary: 'aortic_valve',
    structures: [
      'aorta.root',
      'aortic_annulus',
      'aortic_valve',
      'aortic_valve.leaflet_right',
      'aortic_valve.leaflet_left',
      'aortic_valve.leaflet_noncoronary',
      'aortic_valve.calcification',
      'left_coronary_artery',
      'right_coronary_artery',
      'transcatheter_valve',
      'transcatheter_valve.frame',
      'transcatheter_valve.leaflets',
    ],
  },
  '/models/aortic_arch.glb': { primary: 'aorta', structures: ['aorta', 'aorta.ascending'] },
  '/models/aortic_arch_fixed.glb': { primary: 'aorta', structures: ['aorta', 'aorta.ascending'] },
  '/models/heart_part_1.glb': { primary: 'left_ventricle', structures: ['left_ventricle'] },
  '/models/eye/eye_cornea.glb': { primary: 'cornea', structures: ['cornea'] },
  '/models/eye/eye_iris.glb': { primary: 'iris', structures: ['iris'] },
  '/models/eye/eye_lens.glb': { primary: 'lens', structures: ['lens'] },
  '/models/eye/eye_suspensory_ligaments.glb': { primary: 'suspensory_ligaments', structures: ['suspensory_ligaments'] },
  '/models/eye/eye_sclera.glb': { primary: 'sclera', structures: ['sclera'] },
  '/models/eye/eye_choroid.glb': { primary: 'choroid', structures: ['choroid'] },
  '/models/eye/eye_retina.glb': { primary: 'retina', structures: ['retina'] },
  '/models/eye/eye_optic_nerve.glb': { primary: 'optic_nerve', structures: ['optic_nerve'] },
  '/models/heart_part_2.glb': {
    primary: 'left_ventricle',
    structures: Object.keys(HEART_PART_2_REGIONS),
    regions: HEART_PART_2_REGIONS,
  },
}

/** The structures a model file stands for, or none. */
export function structuresOf(path: string): readonly string[] {
  return MODEL_BINDINGS[path]?.structures ?? []
}
