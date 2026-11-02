/**
 * Reese's structured, knee-length single-breasted wool overcoat.
 *
 * Coordinates are MakeHuman decimetres. The torso and sleeves follow the
 * morphable body; the extended split hem uses pelvis-biased weights so it
 * cannot accidentally inherit one leg's animation. The separate raised
 * collar, notched lapels and overlapping button facing are deliberately
 * modelled geometry, not a white/black texture illusion.
 */
import type { PolyMesh } from '../geometry';
import type { Vec3 } from '../math';
import { cm, REGION } from './body';
import { cloth, isTrunk, mat, shellPart, skirt, torsoY, type GCtx, type GPart, type GarmentStyle } from './kit';
import { cord, ellipsoid, frameOf, merge } from './ring';

/** A small solid cloth panel with front/back faces and a sewn perimeter. */
function clothPanel(outline: Vec3[], thickness = cm(0.28)): PolyMesh {
  const n = outline.length;
  const positions: number[] = [];
  for (const p of outline) positions.push(...p);
  for (const p of outline) positions.push(p[0], p[1], p[2] - thickness);
  const uvs: number[] = [];
  const xs = outline.map((p) => p[0]), ys = outline.map((p) => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const dx = Math.max(cm(0.1), Math.max(...xs) - minX);
  const dy = Math.max(cm(0.1), Math.max(...ys) - minY);
  for (let layer = 0; layer < 2; layer++)
    for (const p of outline) uvs.push((p[0] - minX) / dx, (p[1] - minY) / dy);
  const faceSizes: number[] = [], faceVerts: number[] = [], faceUVs: number[] = [];
  const tri = (a: number, b: number, c: number) => {
    faceSizes.push(3);
    faceVerts.push(a, b, c);
    faceUVs.push(a, b, c);
  };
  for (let j = 1; j < n - 1; j++) {
    tri(0, j, j + 1);
    tri(n, n + j + 1, n + j);
  }
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n;
    tri(j, k, n + k);
    tri(j, n + k, n + j);
  }
  return {
    positions: Float32Array.from(positions),
    faceSizes: Uint8Array.from(faceSizes),
    faceVerts: Uint32Array.from(faceVerts),
    faceUVs: Uint32Array.from(faceUVs),
    uvs: Float32Array.from(uvs),
  };
}

export function buildTailoredOvercoat(g: GCtx, st: GarmentStyle): GPart[] {
  const b = g.body;
  const result: GPart[] = [];
  const shoulder = b.L.shoulderX;
  // Flat near-black wool: no shiny/striped fabric or zipper-like strip.
  const wool = mat('Tailored overcoat', null, { color: st.color, roughness: 0.98, metalness: 0, doubleSided: true });
  const facing = { ...wool, name: 'Overcoat front facing' };
  const shirt = cloth(g, 'Dress shirt', { pattern: 'solid', color: st.color2, color2: '#dfe1e2' }, { roughness: 0.94 });

  // The shirt is an under-layer, not a white strip painted onto the coat.
  result.push(...shellPart(g, {
    covers: (v) => (isTrunk(v) && v.t > 0.06) ||
      (v.region === REGION.neck && v.t < 1.04) ||
      v.region === REGION.upperarm ||
      (v.region === REGION.lowerarm && v.t < 0.98),
    offset: cm(0.7), tile: 0.34, relax: 4,
  }, shirt));

  // Structured shoulders and fuller sleeves. A widened shirt opening grows
  // towards the neck; below the breastbone the coat is single-breasted and
  // closed. No long exposed white strip down the stomach.
  result.push(...shellPart(g, {
    covers: (v) => (isTrunk(v) && v.t > 0.08 &&
      (v.t < 0.55 || Math.abs(v.tth) > 0.19 + 0.66 * (v.t - 0.55))) ||
      v.region === REGION.upperarm ||
      (v.region === REGION.lowerarm && v.t < 1.02),
    offset: (v) => cm(v.region === REGION.upperarm ? 3.5 :
      v.region === REGION.lowerarm ? 2.9 :
      v.t > 0.79 ? 3.7 : 3.0),
    tile: 0.38, relax: 4,
  }, wool));

  // Full-length side/back skirt, instead of a fitted knee-hugging tube.
  // Positive angles run around the back from the front-left edge to
  // the front-right edge, leaving two separate front edges.
  const kneeY = b.joint('lowerleg01.L____head')[1];
  const waistY = torsoY(b, 0.30);
  const hem = skirt(b, waistY, kneeY + cm(1.5), cm(4.0), 0.055,
    [0.33, Math.PI * 2 - 0.33], 56, { tileV: 0.42 });
  if (hem) {
    const skinAt = new Float32Array(hem.positions);
    for (let i = 1; i < skinAt.length; i += 3) skinAt[i] = waistY;
    result.push({
      mesh: hem,
      material: { ...wool, name: 'Overcoat long split hem' },
      skinAt,
    });
  }

  // Sample the actual morphed chest so the front pieces don't disappear
  // inside unusually thin/strong body types.
  const frontZ = (t: number): number => {
    let z = b.L.torsoZ + cm(7);
    for (let i = 0; i < b.info.length; i++) {
      const v = b.info[i];
      if (isTrunk(v) && Math.abs(v.tt - t) < 0.13 && Math.abs(v.tth) < 0.88)
        z = Math.max(z, b.p(i)[2]);
    }
    return z + cm(4.0);
  };
  const front = (side: number, x: number, t: number, extra = 0): Vec3 =>
    [side * shoulder * x, torsoY(b, t), frontZ(t) + cm(extra - 0.7 * x)];

  // Each lapel is a REAL broad folded piece. The outer notch is made by
  // terminating the collar separately from the tapered lower lapel.
  // A raised collar surrounds the neck and a clearly visible shirt V.
  const lapelMeshes: PolyMesh[] = [];
  for (const side of [-1, 1]) {
    lapelMeshes.push(clothPanel([
      front(side, 0.14, 0.98, 1.0),
      front(side, 0.43, 0.99, 1.2),
      front(side, 0.72, 0.90, 0.7),
      front(side, 0.54, 0.82, 1.7),
      front(side, 0.32, 0.88, 2.2),
    ]));
    lapelMeshes.push(clothPanel([
      front(side, 0.32, 0.86, 2.1),
      front(side, 0.56, 0.80, 1.9),
      front(side, 0.68, 0.77, 1.5),
      front(side, 0.39, 0.63, 1.5),
      front(side, 0.15, 0.53, 0.85),
      front(side, 0.24, 0.70, 1.8),
    ]));
  }
  const lapels = merge(lapelMeshes);
  if (lapels) result.push({ mesh: lapels, material: { ...wool, name: 'Overcoat notch lapels' } });

  // A white, folded dress-shirt collar inside the V, not a clerical bib/tie.
  const whiteCollars: PolyMesh[] = [];
  for (const side of [-1, 1]) {
    whiteCollars.push(clothPanel([
      front(side, 0.07, 0.99, -1.35),
      front(side, 0.20, 0.98, -1.15),
      front(side, 0.28, 0.85, -1.05),
      front(side, 0.08, 0.91, -1.0),
    ], cm(0.12)));
  }
  const shirtCollar = merge(whiteCollars);
  if (shirtCollar) result.push({
    mesh: shirtCollar,
    material: mat('Dress shirt collar', null, { color: st.color2, roughness: 0.9, doubleSided: true }),
  });

  // Single-breasted overlap and button line create the tailoring read.
  // Both are above the front shell instead of being hidden inside the torso.
  const overlap: PolyMesh[] = [];
  const seam: Vec3[] = [];
  for (const t of [0.54, 0.46, 0.37, 0.27, 0.17]) {
    seam.push(front(1, 0.10, t, 0.20));
  }
  overlap.push(clothPanel([
    front(1, 0.07, 0.54, 0.04),
    front(1, 0.20, 0.51, 0.05),
    front(1, 0.22, 0.17, 0.08),
    front(1, 0.08, 0.17, 0.08),
  ], cm(0.12)));
  const overlapMesh = merge(overlap);
  if (overlapMesh) result.push({ mesh: overlapMesh, material: facing });

  const seams = cord(seam, cm(0.10), false, 4);
  result.push({
    mesh: seams,
    material: mat('Overcoat centre seam', null, { color: '#101114', roughness: 0.98 }),
  });
  const buttons: PolyMesh[] = [];
  for (const t of [0.47, 0.35, 0.23]) {
    const p = front(1, 0.16, t, 0.55);
    buttons.push(ellipsoid(frameOf(p, [0, 0, 1], [0, 1, 0]),
      [cm(0.78), cm(0.78), cm(0.22)], [0.5, 0.5], 10, 5));
  }
  const buttonMesh = merge(buttons);
  if (buttonMesh) result.push({
    mesh: buttonMesh,
    material: mat('Overcoat buttons', null, { color: '#111216', roughness: 0.52, metalness: 0.08 }),
  });
  return result;
}
