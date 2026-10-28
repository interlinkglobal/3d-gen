/** Isolated browser worker for reproducible NPC batch generation. No server-side execution. */
import { AssetLibrary, fetchSource } from '../core/assets';
import { buildHuman } from '../core/human';
import { triangleCount } from '../core/mesh';
import { randomParams, type Detail } from '../core/params';
import { curatedGroup,makeCuratedParams,type CuratedCharacter } from './gtd-curated90';
import type { RigType } from '../core/rig/skeletons';
import { planExport, runExport, type ExportSettings } from '../export';

export interface BatchSettings {
  mode: 'random' | 'curated90';
  categoryIndex: number;
  count: number;
  baseSeed: number;
  detail: Detail;
  rig: Extract<RigType, 'game' | 'game_lite'>;
  clips: string[];
}
type Request = { type: 'start'; settings: BatchSettings } | { type: 'cancel' };
type Event =
  | { type: 'status'; completed: number; total: number; stage: string }
  | { type: 'file'; index: number; filename: string; seed: number; bytes: Uint8Array; triangles: number; height: number; params: object; profile: CuratedCharacter | null }
  | { type: 'finished'; completed: number; cancelled: boolean }
  | { type: 'error'; message: string };

const emit = (message: Event, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(message, transfer);
let running = false;
let cancelled = false;

async function run(s: BatchSettings): Promise<void> {
  running = true;
  cancelled = false;
  let completed = 0;
  try {
    if (!['random','curated90'].includes(s.mode) ||
        !Number.isSafeInteger(s.categoryIndex) || s.categoryIndex < 0 || s.categoryIndex > 8 ||
        !Number.isSafeInteger(s.count) || s.count < 1 || s.count > 50 ||
        !Number.isSafeInteger(s.baseSeed) || s.baseSeed < 0 || s.baseSeed > 999999999 ||
        !['low', 'medium', 'high'].includes(s.detail) ||
        !['game', 'game_lite'].includes(s.rig) ||
        !Array.isArray(s.clips) || !s.clips.length ||
        s.clips.some((c) => !['idle', 'walk', 'run'].includes(c)))
      throw new Error('Invalid batch settings');
    if(s.mode==='curated90' && (!s.clips.includes('idle') || !s.clips.includes('walk')))
      throw new Error('Curated NPCs require Idle and Walk animations');
    const profiles=s.mode==='curated90'?curatedGroup(s.categoryIndex):[];
    const amount=s.mode==='curated90'?profiles.length:s.count;
    const assets = new URL(import.meta.env.BASE_URL + 'assets/', self.location.origin).href;
    emit({ type: 'status', completed, total: amount, stage: 'Loading MakeHuman assets' });
    const lib = await new AssetLibrary(fetchSource(assets)).init();
    const exportSettings: ExportSettings = {
      mode: 'animated', format: 'glb', clips: s.clips,
      packaging: 'embedded', clipMesh: false, rootMotion: false,
      loopSuffix: false, weaponFile: 'held',
    };
    for (let i = 0; i < amount; i++) {
      // Yield to let the browser deliver cancellation between characters.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (cancelled) break;
      const profile=profiles[i]??null;
      const seed=profile?((42027+(Number(profile.id.slice(-3))-1)*7919)%1000000000):(s.baseSeed+i*7919)%1000000000;
      const params=profile?makeCuratedParams(profile,lib.catalog,s.detail,s.rig):randomParams(seed,lib.catalog);
      if(!profile)params.name='GTD_RANDOM_'+String(i+1).padStart(3,'0')+'_S'+seed;
      params.detail = s.detail;
      params.rig = s.rig;
      params.faceBones = false;
      params.faceShapes = false;
      params.speechShapes = false;
      params.animations = true;
      params.weapon = 'none';
      params.vehicle = 'none';
      emit({ type: 'status', completed, total: amount, stage: 'Building ' + params.name });
      const ch = await buildHuman(lib, params, {
        onStage: (label) => emit({ type: 'status', completed, total: amount, stage: params.name + ': ' + label }),
      });
      if (cancelled) break;
      emit({ type: 'status', completed, total: amount, stage: 'Exporting ' + params.name });
      const file = await runExport(lib, ch, planExport(ch, exportSettings));
      const bytes = file.data;
      emit({
        type: 'file', index: i, filename: file.name, seed,
        bytes, triangles: triangleCount(ch.mesh), height: ch.height, params, profile,
      }, [bytes.buffer]);
      completed++;
    }
    emit({ type: 'finished', completed, cancelled });
  } catch (e) {
    emit({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  } finally {
    running = false;
  }
}

self.onmessage = (e: MessageEvent<Request>) => {
  if (e.data.type === 'cancel') {
    cancelled = true;
  } else if (!running) {
    void run(e.data.settings);
  }
};
