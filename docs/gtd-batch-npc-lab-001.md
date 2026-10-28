# G.T.D Meridia 90 — Curated NPC Generation Preparation (2026-10-28)

## Purpose
Prepare 90 **different** contemporary South African urban residents in the `interlinkglobal/3d-gen` fork for the owner to export, optimize and commit into the G.T.D game later. This task does **not** change the game or its currently accepted 100-agent/10-appearance simulation.

## Creative source of truth
`data/gtd-meridia-character-bible-90.json` defines 90 stable identities `GTD_NPC_011`–`GTD_NPC_100` across nine groups of ten: everyday residents; office professionals; students and young adults; trades and essential workers; affluent residents; street personalities; older residents; fitness and sports enthusiasts; public-service and community workers.

Each entry has a creative label, age, presentation, body-build direction, hair direction, wardrobe family, two-color palette, individual signature, activity and suggested district reuse. It is a **creative reference** as well as a batch-generation input. IDs 001–010 remain reserved for the ten existing optimized NPCs.

## How to generate
1. Visit the deployed fork's `/batch/` page.
2. Select **Meridia — 90 curated residents** (default) and category 01. The category dropdown shows the exact NPC ID range.
3. Leave default **Low** detail, **Game lite** rig and **Idle/Walk/Run** clips. Idle and Walk are mandatory for curated pedestrian compatibility.
4. Click **Generate selected 10**. One Web Worker builds one character at a time, loading shared MakeHuman assets only once per group.
5. Inspect each generated character with **Preview ↗** (opens the Ara single-character editor with the exact reproducible parameters). Check appearance, face, clothes and animation.
6. Download that group's ZIP **before** generating the next group. Then choose **Next group** and repeat through group 09.
7. The nine ZIPs contain 90 source GLBs plus per-character parameter files, individual creative profiles, a manifest and the entire reusable 90-character bible.
8. Optimize, verify GLB runtime compatibility and commit assets to GTD **separately**. This fork intentionally does not upload assets to the game.

## Reproducibility
For NPC numeric ID `N`, seed `(42027+(N-1)*7919)%1000000000`. Unlike the original random-batch experiment, each creative profile is mapped to reproducible MakeHuman parameters, including age, build, hair, color palette and clothing family. Selected outfits are validated against the live asset catalog; supported procedural garments are used for uniform, trades, safety, traditional, outdoor and some creative/street styles.

**Honest representation:** Not every narrative detail is a supported Ara 3D object. A character's shopping bag, rolled sleeve, instrument, glasses or hairstyle nuance may appear in the creative profile without being physically present on the GLB. The preview is the owner's visual acceptance gate; refine or reject any approximation before exporting to the game.

## Resource policy
- Export nine groups of ten rather than 90 models in a single browser memory allocation.
- Default skeleton `game_lite`, geometry `low`, embedded `Idle`, `Walk`, `Run`.
- Source GLBs are **not guaranteed below 1 MiB**; the UI reports size but does not claim compression.
- Target **under 1 MiB per optimized GLB**, as with the accepted ten NPCs. Do not rely on ZIP compression as a substitute for GLB optimization.
- Reuse the creative bible in future districts, keeping stable IDs and identity even if the NPC's location or schedule changes.
- Do not merge this work into the G.T.D game before the owner has exported, optimized, committed and accepted the assets.

## Validation
`npm run test:curated` checks all 90 IDs, nine groups, unique names/seeds/signatures, ages, district metadata and supported parameter generation. `npm run build` runs TypeScript validation and the curated test before building the browser lab.

## License
Ara code is MIT; MakeHuman source assets are CC0. Keep upstream motion-capture license notices with any redistributed files.
