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
export const MODEL_STRUCTURES: Readonly<Record<string, readonly string[]>> = {
  '/models/bicuspidic_aortic_root_with_calcifications.glb': [
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
  '/models/aortic_arch.glb': ['aorta', 'aorta.ascending'],
  '/models/heart_part_1.glb': ['left_ventricle'],
  '/models/heart_part_2.glb': ['left_ventricle'],
}
