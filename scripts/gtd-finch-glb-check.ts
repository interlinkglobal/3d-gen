/** Verify the actual Finch GLB pipeline, including procedural round_glasses. */
import { nodeLibrary } from './node-assets';
import { DEFAULT_PARAMS, PRESETS } from '../src/core/params';
import { buildHuman } from '../src/core/human';
import { DEFAULT_EXPORT, planExport, runExport } from '../src/export';
import { garmentById } from '../src/core/garments';

function requireTrue(ok: unknown, msg: string): asserts ok {
  if (!ok) throw new Error('Finch GLB check failed: ' + msg);
}

const preset = PRESETS.Finch;
requireTrue(!!preset, 'Finch preset missing');
requireTrue(garmentById.has('round_glasses'), 'round_glasses missing from accessory inventory');
requireTrue(preset.accessories?.includes('round_glasses'), 'Finch does not wear round_glasses');

const lib = await nodeLibrary();
const p = { ...DEFAULT_PARAMS, ...preset, name: 'Finch', detail: 'medium' as const };
const finch = await buildHuman(lib, p);
const materials = finch.mesh.materials.map((m) => m.name);
requireTrue(materials.includes('Round glasses frame'), 'round metal frames not generated');
requireTrue(materials.includes('Round glasses clear lenses'), 'clear lenses not generated');
requireTrue(!!finch.rig && finch.rig.bones.length > 20, 'animated game rig missing');

const settings = { ...DEFAULT_EXPORT, mode: 'animated' as const, format: 'glb' as const, clips: ['idle', 'talk', 'sit_idle'] };
const plan = planExport(finch, settings);
requireTrue(plan.download === 'Finch.glb', 'incorrect browser export filename');
const file = await runExport(lib, finch, plan);
requireTrue(file.name === 'Finch.glb', 'unexpected GLB output');
const dv = new DataView(file.data.buffer, file.data.byteOffset, file.data.byteLength);
requireTrue(dv.getUint32(0, true) === 0x46546c67, 'invalid GLB magic');
requireTrue(dv.getUint32(8, true) === file.data.byteLength, 'GLB length mismatch');
const jsonLength = dv.getUint32(12, true);
const gltf = JSON.parse(new TextDecoder().decode(file.data.subarray(20, 20 + jsonLength)));
requireTrue(gltf.skins?.length > 0, 'GLB lost its rig');
requireTrue(gltf.animations?.length === 3, 'GLB did not embed three selected animations');
requireTrue(gltf.materials?.some((m: { name: string }) => m.name === 'Round glasses frame'), 'frame absent from GLB');
requireTrue(gltf.materials?.some((m: { name: string }) => m.name === 'Round glasses clear lenses'), 'lenses absent from GLB');
console.log(`Finch GLB PASS: ${(file.data.byteLength / 1048576).toFixed(2)} MB, rigged, 3 animations, round glasses frame + lenses`);
