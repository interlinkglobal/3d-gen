# G.T.D — Reese character preset (2026-11-02)

## Goal and reference
John Reese from *Person of Interest*: tall, lean athletic build; angular face, deep-set eyes, short dark swept-back hair; serious neutral expression. The canonical outfit follows the owner's second photograph: matte charcoal-black knee-length overcoat, white dress shirt, dark tailored trousers and black shoes. The small forehead injury in the first photograph is not permanent.

## Implementation
The **Reese** preset uses the standard MakeHuman morph system and the new `tailored_overcoat` procedural top. This top generates a white inner shirt, wool coat shell with full sleeves, separate notch lapels, button details, and a long front-split hem. The hem uses pelvis-biased skinning to avoid sticking to either leg. It uses the normal mesh, UV, texture, material and humanoid-rig export pipeline.

Open **/app/#preset=Reese&export** to load the preset with **GLB / rigged + animations / one file** and every animation currently in the `CLIPS` catalog selected. The exported file is `Reese.glb`. A dedicated build-time test verifies clothing, rig, GLB structure and the full animation catalog.

## Known limitations and acceptance boundary
- This is a reference-derived procedural likeness, **not** a photo scan or guaranteed facial identity match.
- Existing short hair is a close approximation; individual silver temple strands are not generated.
- Black gloves and the alternative blue-grey shirt are not modeled as separate variants.
- Long coat panels are pelvis-skinned, not cloth-simulated; inspect extreme crouch, jump, vehicle and combat poses for hem/leg clipping. Do not claim perfect cloth collision without visual verification.
- No character has been committed to the GTD repository. The owner should inspect, adjust, export and optimize the model from the deployed 3D Gen editor before GTD integration.
