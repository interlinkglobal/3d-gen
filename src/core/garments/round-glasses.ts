/**
 * Reusable round spectacles for Ara characters, including G.T.D's Finch.
 * Built from the morphed head each time, in MakeHuman decimetres.
 * The lightweight cords follow the head rig and export with the character GLB.
 */
import type { PolyMesh } from '../geometry';
import type { Vec3 } from '../math';
import { cm, REGION } from './body';
import type { GarmentStyle, GCtx, GPart } from './kit';
import { mat, points } from './kit';
import { cord, merge, v3 } from './ring';

/** Clear, almost invisible lens discs: retain readable eyes in browser gameplay. */
function lensDisc(center: Vec3, r: number, segments = 32): PolyMesh {
  const positions: number[] = [...center];
  const uvs: number[] = [0.5, 0.5];
  const faceVerts: number[] = [], faceUVs: number[] = [];
  const faceSizes: number[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle), y = Math.sin(angle);
    positions.push(center[0] + r * x, center[1] + r * y, center[2]);
    uvs.push((x + 1) / 2, (y + 1) / 2);
  }
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    faceSizes.push(3);
    faceVerts.push(0, i + 1, next + 1);
    faceUVs.push(0, i + 1, next + 1);
  }
  return {
    positions: Float32Array.from(positions),
    uvs: Float32Array.from(uvs),
    faceSizes: Uint8Array.from(faceSizes),
    faceVerts: Uint32Array.from(faceVerts),
    faceUVs: Uint32Array.from(faceUVs),
  };
}

/** Frames and lenses aligned to the morphed face; no fixed-size head assumption. */
export function roundGlasses(g: GCtx, style: GarmentStyle): GPart[] {
  const b = g.body;
  const head = points(b, (v) => v.region === REGION.head);
  const headH = b.L.crownY - b.L.chinY;
  if (head.length < 20 || !Number.isFinite(headH) || headH <= 0) return [];

  // Estimate the eyeline and head breadth from the actual current head mesh.
  const eyeY = b.L.chinY + 0.54 * headH;
  const band = head.filter((p) => Math.abs(p[1] - eyeY) < cm(2.5));
  if (band.length < 10) return [];
  const halfWidth = Math.max(...band.map((p) => Math.abs(p[0])));
  const radius = Math.max(cm(1.7), Math.min(cm(2.55), halfWidth * 0.345));
  const eyeX = Math.max(radius + cm(0.38), halfWidth * 0.44);

  const rims: PolyMesh[] = [], arms: PolyMesh[] = [], lenses: PolyMesh[] = [];
  const frontZ: Record<number, number> = {};
  for (const side of [-1, 1] as const) {
    const local = head.filter((p) =>
      side * p[0] > eyeX * 0.55 &&
      Math.abs(p[0] - side * eyeX) < radius &&
      Math.abs(p[1] - eyeY) < radius + cm(0.3));
    // Keep lenses ahead of eyebrow and cheek surfaces; never fit to the nose tip.
    const z = (local.length ? Math.max(...local.map((p) => p[2])) :
      Math.max(...band.map((p) => p[2]))) + cm(0.65);
    frontZ[side] = z;

    const rim: Vec3[] = Array.from({ length: 40 }, (_, i) => {
      const a = (i / 40) * 2 * Math.PI;
      const dx = Math.cos(a), dy = Math.sin(a);
      return [side * eyeX + radius * dx, eyeY + radius * dy, z - cm(0.25) * dx * dx];
    });
    rims.push(cord(rim, cm(0.13), true, 6));
    lenses.push(lensDisc([side * eyeX, eyeY, z - cm(0.04)], radius * 0.94));

    // Slender, hinged temples extend over the side of the head toward the ears.
    const outerX = side * (eyeX + radius);
    arms.push(cord([
      [outerX - side * cm(0.12), eyeY + cm(0.12), z - cm(0.25)],
      [side * (halfWidth + cm(0.32)), eyeY + cm(0.08), z - cm(1.10)],
      [side * (halfWidth + cm(0.20)), eyeY - cm(0.15), b.L.headZ - cm(0.85)],
    ], cm(0.11), false, 6));
  }

  // Curved nose bridge joins the innermost portions of the two rings.
  const leftInner = -eyeX + radius, rightInner = eyeX - radius;
  const bridge = cord([
    [leftInner, eyeY + cm(0.10), frontZ[-1] - cm(0.23)],
    [0, eyeY + cm(0.48), Math.max(frontZ[-1], frontZ[1]) + cm(0.05)],
    [rightInner, eyeY + cm(0.10), frontZ[1] - cm(0.23)],
  ], cm(0.115), false, 6);

  // Use a shared forehead skin location so all parts follow the skull,
  // not individually weighted jaw or eye bones during speech animation.
  const forehead = head
    .filter((p) => p[1] > eyeY + radius * 0.8 && Math.abs(p[0]) < eyeX * 0.35)
    .sort((a, c) => c[2] - a[2])[0] ?? [0, eyeY + radius, b.L.headZ];
  const bound = (mesh: PolyMesh) => {
    const skinAt = new Float32Array(mesh.positions.length);
    for (let i = 0; i < skinAt.length; i += 3) {
      skinAt[i] = forehead[0];
      skinAt[i + 1] = forehead[1];
      skinAt[i + 2] = forehead[2];
    }
    return { mesh, skinAt };
  };

  const metal = merge([...rims, bridge, ...arms]);
  const glass = merge(lenses);
  return [
    ...(metal ? [{ ...bound(metal), material: mat('Round glasses frame', null, {
      color: style.color, metalness: 0.65, roughness: 0.26,
    }) }] : []),
    ...(glass ? [{ ...bound(glass), material: mat('Round glasses clear lenses', null, {
      color: '#e5edf5', roughness: 0.07, metalness: 0, alpha: 'blend',
      opacity: 0.12, doubleSided: true,
    }) }] : []),
  ];
}
