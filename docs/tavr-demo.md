# TAVR Demo Plan (First Version)

The first topic of the patient-education demo is **TAVR (Transcatheter Aortic Valve Replacement)**.
We simplify the procedure of placing a new valve inside a narrowed aortic valve with a catheter into four scenes.
`packages/shared/fixtures/procedure.tavr.json` (slug: `tavr`) is the dummy data for this plan.
Everything is **educational dummy content** and is neither real patient data nor medical advice.

## Scenes (Steps)

| index | Title | What it shows | animation_clip |
|---|---|---|---|
| 0 | The narrowed original valve | The original valve narrowed by calcification | `native_valve_stenosis` (loop) |
| 1 | Delivering the new valve | The folded new valve carried to the valve position with a guidewire and a delivery catheter | `deliver_valve` |
| 2 | Expanding the new valve | The new valve opens and anchors in the annulus, and the original leaflets are pushed against the wall | `expand_valve` |
| 3 | Final position after the equipment is removed | The new valve and blood flow to the coronary arteries after the catheter is withdrawn | `valve_function` (loop) |

## 3D asset status

A `structure_id` must match a GLB mesh name one to one. The names below are the ones the fixtures assume, and **they must be matched with the real mesh names together with the 3D owner.**

| Subject | id | Status |
|---|---|---|
| Original aortic valve (three leaflets, calcification) | `aortic_valve`, `aortic_valve.leaflet_*`, `aortic_valve.calcification` | Candidate model found |
| Aorta, aortic root, annulus, left ventricle, coronary arteries | `aorta*`, `aortic_annulus`, `left_ventricle`, `*_coronary_artery` | To be confirmed |
| Delivery equipment | `guidewire`, `delivery_catheter` (instruments) | Candidate model found |
| Frame of the new valve | `transcatheter_valve.frame` | To be confirmed |
| **Leaflets of the new valve** | `transcatheter_valve.leaflets` | **No model yet (TODO)** |

While there is no model for the leaflets of the new valve, a temporary treatment is needed: hide `transcatheter_valve.leaflets` (opacity 0) or show only the frame.
When the model is ready, adjust the opacity in the fixtures.

## Animation and the contract

- `Scene.structures` has no transform, so the movement and expansion of the valve are expressed with animation clips baked into the GLB (`animation_clip`).
  The clip names follow the table above and are to be confirmed with the 3D owner.
- The new valve (`transcatheter_valve`) must be something the chatbot can point at with `focus` or `highlight`, so it is a **structure**, not an instrument.
  Delivery equipment changes position from step to step, so it is an **instrument**.

## Open questions

- Which kind of valve to show: balloon-expandable or self-expanding (the expansion scene and the instrument set differ)
- Access route: how far to show it, for example through the femoral artery (the first version shows only the valve area)
- The source and license of the reference video, and the reference material to put in `sources`
