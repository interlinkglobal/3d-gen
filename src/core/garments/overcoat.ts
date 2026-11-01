/**
 * Reese-style tailored overcoat. The inner shirt, coat shell, lapels and long
 * split hem share the existing procedural clothing/rigging pipeline.
 * Units are MakeHuman decimetres; skinning is assigned in human.ts.
 */
import type { Vec3 } from '../math';
import { cm, REGION } from './body';
import { cloth, isTrunk, mat, shellPart, skirt, torsoY, type GCtx, type GPart, type GarmentStyle } from './kit';
import { card, ellipsoid, frameOf, merge, v3 } from './ring';

export function buildTailoredOvercoat(g: GCtx, st: GarmentStyle): GPart[] {
  const b = g.body;
  const shirt = cloth(g, 'Dress shirt', { pattern: 'solid', color: st.color2, color2: '#d5d9dc' }, { roughness: 0.91 });
  const wool = cloth(g, 'Tailored overcoat', st, { roughness: 0.96 });
  const result: GPart[] = [];

  // Separate white underlayer remains visible in the front V opening.
  result.push(...shellPart(g, {
    covers: (v) => (isTrunk(v) && v.t > 0.06) ||
      (v.region === REGION.neck && v.t < 1.04) ||
      v.region === REGION.upperarm ||
      (v.region === REGION.lowerarm && v.t < 0.95),
    offset: cm(0.65), tile: 0.24, relax: 4,
  }, shirt));

  // Close-fitted wool shell: long sleeves, structured shoulders and an open
  // lapel V above the button line. The white shirt is not hidden by the coat.
  result.push(...shellPart(g, {
    covers: (v) => (isTrunk(v) && v.t > 0.10 &&
      (v.t < 0.55 || Math.abs(v.tth) > 0.20 + 0.45 * Math.max(0, v.t - 0.55))) ||
      v.region === REGION.upperarm ||
      (v.region === REGION.lowerarm && v.t < 0.95),
    offset: (v) => cm(v.region === REGION.upperarm ? 2.25 : 2.05),
    tile: 0.30, relax: 4,
  }, wool));

  // One continuous back-and-side panel, open down the centre front. Bias the
  // skinning lookup to the pelvis so the coat does not stick to either knee.
  const knee = b.joint('lowerleg01.L____head')[1];
  const topY = torsoY(b, 0.27);
  const hem = skirt(b, topY, knee + cm(5), cm(2.1), 0.045,
    [0.17, Math.PI * 2 - 0.17], 48, { tileV: 0.28 });
  if (hem) {
    const skinAt = new Float32Array(hem.positions);
    for (let i = 1; i < skinAt.length; i += 3) skinAt[i] = topY;
    result.push({
      mesh: hem,
      material: { ...wool, name: 'Overcoat long split hem', doubleSided: true },
      skinAt,
    });
  }

  // Front-of-chest reference follows the morphed body instead of assuming a
  // fixed chest depth; two separate lapels expose the shirt and collar.
  const frontZ = (t: number): number => {
    let z = b.L.torsoZ + cm(8);
    for (let i = 0; i < b.info.length; i++) {
      const v = b.info[i];
      if (isTrunk(v) && Math.abs(v.tt - t) < 0.12 && Math.abs(v.tth) < 0.95)
        z = Math.max(z, b.p(i)[2]);
    }
    return z + cm(2.5);
  };
  const lapels = [];
  for (const side of [-1, 1]) {
    const a: Vec3 = [side * b.L.shoulderX * 0.55, torsoY(b, 0.91), frontZ(0.91)];
    const end: Vec3 = [side * b.L.shoulderX * 0.18, torsoY(b, 0.55), frontZ(0.55)];
    const direction = v3.sub(end, a);
    lapels.push(card(a, v3.norm(direction), [side, 0, 0],
      v3.len(direction), cm(5.3), 0.70, 4));
  }
  const lapelMesh = merge(lapels);
  if (lapelMesh) result.push({
    mesh: lapelMesh,
    material: { ...wool, name: 'Overcoat notch lapels', doubleSided: true },
  });

  const buttons = [];
  for (const t of [0.46, 0.34, 0.23]) {
    const at: Vec3 = [b.L.shoulderX * 0.12, torsoY(b, t), frontZ(t) + cm(0.45)];
    buttons.push(ellipsoid(frameOf(at, [0, 0, 1], [0, 1, 0]),
      [cm(0.62), cm(0.62), cm(0.22)], [0.5, 0.5], 8, 4));
  }
  const buttonMesh = merge(buttons);
  if (buttonMesh) result.push({
    mesh: buttonMesh,
    material: mat('Overcoat buttons', null, { color: '#1a1a1d', roughness: 0.48, metalness: 0.12 }),
  });
  return result;
}
