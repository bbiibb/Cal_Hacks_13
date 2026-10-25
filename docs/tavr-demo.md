# TAVR Demo Plan (First Version)

The first topic of the patient-education demo is **TAVR (Transcatheter Aortic Valve Replacement)**.
We simplify the procedure of placing a new valve inside a narrowed aortic valve with a catheter into five steps, preceded by an introduction (step 0) that explains the symptoms that make the procedure necessary.
`packages/shared/fixtures/procedure.tavr.json` (slug: `tavr`) holds this plan. The step explanations are the team's patient explanation (the "Explanation" document), used word for word.
Everything is **educational content** and is neither real patient data nor medical advice. The explanations still need review by someone with medical knowledge.

## Scenes (Steps)

| index | Title | short_title | What it shows | Instruments | animation_clip |
|---|---|---|---|---|---|
| 0 | When your aortic valve narrows | Symptoms | **Introduction.** Only the heart, with no instruments and the new valve hidden. The panel explains aortic stenosis and the symptoms that lead to TAVR (shortness of breath, chest pain or pressure, dizziness or fainting, tiredness, palpitations) | none | none |
| 1 | Guiding a wire to your heart | Guidewire | A wire from the groin follows the aortic arch and passes through the narrowed valve | `guidewire` | `advance_guidewire` |
| 2 | Bringing your new valve into position | Valve delivery | A catheter carries the compressed new valve along the wire into the old valve | `guidewire`, `delivery_catheter` | `deliver_valve` |
| 3 | Expanding your new valve | Expansion | A balloon expands the metal frame, which pushes the old leaflets aside and anchors the new valve | `delivery_catheter`, `balloon` | `expand_valve` |
| 4 | Removing the delivery equipment | Removal | The balloon is deflated, and the catheter and wire are withdrawn | `guidewire`, `delivery_catheter` | `withdraw_equipment` |
| 5 | How your new valve works | Valve function | The frame holds the valve; its leaflets open with each heartbeat and close between beats | none | `valve_function` (loop) |

The valve type is decided by the explanation: a **balloon-expandable** valve.

## 3D asset status

A `structure_id` should match a GLB mesh name one to one. The models in use are single meshes (`heart_part_2.glb`, the aortic root and the aortic arch), so `scene_bindings.ts` stands one model file in for a structure, and the heart's chambers and vessels are told apart by outlines (`heart_regions.ts`). Re-export one mesh per part to replace these stand-ins.

| Subject | id | Status |
|---|---|---|
| Original aortic valve (three leaflets, calcification) | `aortic_valve`, `aortic_valve.leaflet_*`, `aortic_valve.calcification` | In the scene: the aortic root model stands for all of them |
| Aorta, aortic root, annulus, left ventricle, coronary arteries | `aorta*`, `aortic_annulus`, `left_ventricle`, `*_coronary_artery` | Aorta (arch model and the heart's own ascending part) and left ventricle are in the scene. The annulus and coronary arteries point at the aortic root model |
| Right atrium, right ventricle, superior vena cava, pulmonary artery | same names | In the scene, as outlines on the heart model |
| Delivery equipment | `guidewire`, `delivery_catheter` (instruments) | Being built by a teammate |
| Frame of the new valve | `transcatheter_valve.frame` | Not modeled yet (points at the aortic root model) |
| **Leaflets of the new valve** | `transcatheter_valve.leaflets` | **No model yet (TODO)** |

While there is no model for the leaflets of the new valve, a temporary treatment is needed: hide `transcatheter_valve.leaflets` (opacity 0) or show only the frame.
When the model is ready, adjust the opacity in the fixtures.

## Animation and the contract

- `Scene.structures` has no transform, so the movement and expansion of the valve are expressed with animation clips baked into the GLB (`animation_clip`).
  The clip names follow the table above and are to be confirmed with the 3D owner.
- The new valve (`transcatheter_valve`) must be something the chatbot can point at with `focus` or `highlight`, so it is a **structure**, not an instrument.
  Delivery equipment changes position from step to step, so it is an **instrument**.

## Open questions

- Access route: how far to show it, for example through the femoral artery (the first version shows only the valve area)
- The source and license of the reference video, and the reference material to put in `sources`
