# Eye anatomy prototype

A small second walkthrough so the walkthroughs list is not all "Coming Soon". It is a prototype: it shows the main parts of the eye with placeholder text, in the same page layout as the TAVR walkthrough (3D view, step slider, side panel and chat). It has no procedure and no backend.

Route: `/walkthrough/eye` (behind the same sign-in as `/walkthrough`). The card is in the walkthroughs list.

## What it contains

- **Parts (8):** cornea, iris, lens, suspensory ligaments, sclera, choroid, retina, optic nerve. Each is its own model file, `apps/frontend/public/models/eye/eye_<id>.glb`, and its `structure_id` is the part name. The files are bound to the structure ids in `scene_bindings.ts`, so pointing at a part names it, clicking pins it, and the step scenes and the chat can highlight it like the heart parts.
- **Content (dummy):** `packages/shared/fixtures/structures.eye.json` and `procedure.eye.json` (5 steps, slug `eye_anatomy`, no condition). They follow the same schemas as the TAVR fixtures and are checked by `packages/shared/test/fixtures.test.ts`. The descriptions are short placeholders, not reviewed medical text.
- **Chat:** the built-in demo client (`DemoChatClient`) with eye content from `apps/frontend/src/eye/eye_content.ts`: a question that names a part gets that part's description and the camera moves to it; "zoom in", "rotate left", "go to step 3" and "reset the view" work. The on-device privacy guard wraps it like the TAVR chat. There is no Convex or model call, so Slow / Fast does not apply.
- **Not included:** the Convex seed does not know about the eye content, and progress is not saved.

## Where the model comes from

"Cross Section of Eye - Anatomy" by Erik Ao, <https://sketchfab.com/3d-models/cross-section-of-eye-anatomy-4bf3236c8fe2407ea3f494a93b8f5aa2>, licensed **CC BY 4.0**. The license requires credit, so the page shows a credit line; keep it when you change the page.

The original file is 118 MB (about 2.9 million triangles with 4K-class textures), too large for the web. Each part was cut out of it, its transforms were baked in, the mesh was simplified, and textures and materials were removed (the page colors each part itself). The eight files add up to about 3.5 MB.

Two parts of the original were left out because their meaning is not clear enough to label: a set of rods behind the eye, and a thin shell between the sclera and choroid that the file calls "Muscle". The central retinal artery and vein were left out too, because they are hidden inside the optic nerve.

## Rebuilding the model files

The script used (Node, `@gltf-transform` and `meshoptimizer`) is not in the repository. In short: for every part, take the nodes with the matching name, apply their world matrices to the vertices, rotate the eye so the cut face points toward the camera and the cornea toward the right, move the center of the eye to the origin, drop the normals, weld with a tolerance of `0.00001`, simplify (ratio 0.05 for the three big shells, about 0.1 to 0.5 for the front parts), recompute normals, and write one file per part.

`ModelObject` scales every file to a unit cube and centers it, so `eye_walkthrough.tsx` gives each part its own `position` (the middle of the part) and `scale` (its longest side) to put it back where it belongs. If you replace a file, recompute those two values.
