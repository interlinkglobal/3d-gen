/** Reese export acceptance: procedural overcoat, humanoid rig and every supported clip. */
import { nodeLibrary } from './node-assets';
import { DEFAULT_PARAMS, PRESETS } from '../src/core/params';
import { CLIPS } from '../src/core/anim/clips';
import { buildHuman } from '../src/core/human';
import { DEFAULT_EXPORT, planExport, runExport } from '../src/export';
import { garmentById } from '../src/core/garments';

function requireTrue(ok: unknown, msg: string): asserts ok {
  if (!ok) throw new Error('Reese GLB check failed: ' + msg);
}
const preset = PRESETS.Reese;
requireTrue(!!preset, 'Reese preset missing');
requireTrue(preset.top === 'tailored_overcoat', 'canonical overcoat not selected');
requireTrue(garmentById.has('tailored_overcoat'), 'overcoat generator not registered');
requireTrue(CLIPS.length >= 70, 'animation catalog unexpectedly reduced');
const lib = await nodeLibrary();
const p = { ...DEFAULT_PARAMS, ...preset, name: 'Reese', detail: 'medium' as const };
const reese = await buildHuman(lib, p);
const materials = reese.mesh.materials.map((m) => m.name);
for (const material of ['Dress shirt', 'Tailored overcoat', 'Overcoat long split hem', 'Overcoat notch lapels'])
  requireTrue(materials.includes(material), 'missing clothing material: ' + material);
requireTrue(!!reese.rig && reese.rig.bones.length >= 60, 'full game rig missing');
for (const x of reese.mesh.positions) requireTrue(Number.isFinite(x), 'nonfinite mesh coordinate');
const settings = {
  ...DEFAULT_EXPORT, mode: 'animated' as const, format: 'glb' as const,
  packaging: 'embedded' as const, clips: CLIPS.map((c) => c.id),
};
const plan = planExport(reese, settings);
requireTrue(plan.download === 'Reese.glb', 'incorrect export filename');
const file = await runExport(lib, reese, plan);
requireTrue(file.name === 'Reese.glb', 'unexpected GLB name');
const dv = new DataView(file.data.buffer, file.data.byteOffset, file.data.byteLength);
requireTrue(dv.getUint32(0, true) === 0x46546c67, 'invalid GLB header');
requireTrue(dv.getUint32(8, true) === file.data.byteLength, 'GLB byte length mismatch');
const jsonLength = dv.getUint32(12, true);
const gltf = JSON.parse(new TextDecoder().decode(file.data.subarray(20, 20 + jsonLength)));
requireTrue(gltf.skins?.length > 0, 'GLB missing skin');
requireTrue(gltf.animations?.length === CLIPS.length, 'GLB did not embed all available clips');
requireTrue(gltf.animations.every((a: { channels: unknown[] }) => a.channels?.length > 0), 'empty animation');
for (const material of ['Dress shirt', 'Tailored overcoat', 'Overcoat long split hem'])
  requireTrue(gltf.materials?.some((m: { name: string }) => m.name === material), 'GLB lost material ' + material);
console.log(`Reese GLB PASS: ${(file.data.byteLength / 1048576).toFixed(2)} MB, ${reese.rig!.bones.length} bones, ${CLIPS.length} embedded animations, tailored coat`);
