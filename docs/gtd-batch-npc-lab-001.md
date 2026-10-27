# G.T.D NPC Batch Laboratory — Experiment 001

This feature is isolated in the \`interlinkglobal/3d-gen\` fork. It does not modify the G.T.D game.

## Browser workflow

1. Open \`/batch/\` on the deployed Ara fork.
2. Choose 1–50 characters, a base seed, geometry detail, skeleton and animation clips.
3. Click **Generate batch**. A dedicated Web Worker loads MakeHuman assets once, then builds and exports one character at a time.
4. Review individual GLB byte sizes and triangle counts. The 1 MB threshold is advisory.
5. Download the ZIP. It includes \`characters/*.glb\`, \`specifications/*.params.json\`, \`manifest.json\` and \`README.txt\`.
6. Validate appearance, animation integrity, mobile performance and compression **before** committing any GLB to G.T.D.

The batch uses deterministic seeds \`(baseSeed + index * 7919) % 1000000000\`, plus the upstream \`randomParams()\` function. Every character has its own morphology, clothes and appearance. The exported params file makes each character reproducible.

## Performance and storage

- The default is **10 characters, low geometry, game-lite skeleton, Idle/Walk/Run**.
- A single worker avoids running 50 simultaneous CPU-heavy builds.
- GLBs are stored in browser memory until the ZIP is prepared. For large batches or high detail, memory usage can become substantial; start with 10.
- Stop is cooperative: the current character may finish before cancellation is processed. A partial batch can still be downloaded.
- ZIP packaging runs asynchronously. GLB entries use ZIP level 0 because their embedded data may already be compressed.
- **ZIP size is not runtime GLB size.** Texture transcoding, mesh quantization, animation simplification and Babylon compatibility checks remain separate work.

## Hosting prerequisite

The upstream repository deliberately does **not** commit \`public/assets/\`. Its \`setup-assets\` script downloads the CC0 MakeHuman inputs (~420 MB) and builds web-ready packs (~85 MB).

This branch adds \`prebuild: npm run setup-assets -- --skip-mocap\`, ensuring Vercel generates those assets before \`vite build\`. The mocap rebuild download is omitted because baked clips are committed in \`src/core/anim/clips/mocap-data.ts\`.

If Vercel build time or download reliability becomes a bottleneck, move asset preparation into a separately cached CI artifact or dedicated static asset origin. Do not silently ship a UI that lacks \`assets/catalog.json\`, \`assets/base.pack\` or \`assets/targets.pack\`.

## Acceptance checklist

- \`/batch/\` loads and can fetch MakeHuman assets.
- Batch of 2 produces two nonidentical rigged GLBs with Idle, Walk and Run.
- ZIP opens and contains each GLB, its corresponding params JSON, and a manifest.
- Rerunning the same seed and settings reproduces the same character specifications.
- Stop returns a partial ZIP when at least one character has completed.
- The standard \`/app/\` editor continues to work.
- G.T.D main branch remains unchanged.

## License

Code is MIT; MakeHuman base assets are CC0. Motion capture is from CMU, usable in games but not for resale as standalone motion data. Retain upstream license notices.
