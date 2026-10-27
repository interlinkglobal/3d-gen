/** Batch NPC UI. Exports are generated in a worker and zipped in the browser. */
import { strToU8, zip, type Zippable } from 'fflate';
import type { BatchSettings } from './worker';
import './style.css';

type FileEvent = {
  type: 'file'; index: number; filename: string; seed: number;
  bytes: Uint8Array; triangles: number; height: number; params: object;
};
type StatusEvent = { type: 'status'; completed: number; total: number; stage: string };
type FinishedEvent = { type: 'finished'; completed: number; cancelled: boolean };
type ErrorEvent = { type: 'error'; message: string };
type WorkerEvent = FileEvent | StatusEvent | FinishedEvent | ErrorEvent;
type RecordEntry = FileEvent;

const get = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error('Missing UI element: ' + id);
  return element as T;
};
const count = get<HTMLInputElement>('count');
const seed = get<HTMLInputElement>('seed');
const detail = get<HTMLSelectElement>('detail');
const rig = get<HTMLSelectElement>('rig');
const generate = get<HTMLButtonElement>('generate');
const cancel = get<HTMLButtonElement>('cancel');
const download = get<HTMLButtonElement>('download');
const status = get<HTMLElement>('status');
const progress = get<HTMLProgressElement>('progress');
const summary = get<HTMLElement>('summary');
const tbody = get<HTMLTableSectionElement>('rows');
const zipStatus = get<HTMLElement>('zip-status');
const checkboxes = ['idle', 'walk', 'run'].map((id) => get<HTMLInputElement>('clip-' + id));

let worker: Worker | null = null;
let files: RecordEntry[] = [];
let archive: Uint8Array | null = null;
let currentSettings: BatchSettings | null = null;
let running = false;

const mb = (n: number) => (n / 1048576).toFixed(2) + ' MB';
function setBusy(busy: boolean): void {
  running = busy;
  generate.disabled = busy;
  cancel.disabled = !busy;
  [count, seed, detail, rig, ...checkboxes].forEach((el) => { el.disabled = busy; });
}
function setStatus(message: string): void { status.textContent = message; }
function appendRow(item: FileEvent): void {
  const row = document.createElement('tr');
  const fields = [
    String(item.index + 1).padStart(3, '0'), item.filename,
    String(item.seed), item.triangles.toLocaleString(), mb(item.bytes.byteLength),
    item.bytes.byteLength < 1048576 ? 'Within target' : 'Above 1 MB target',
  ];
  for (const value of fields) {
    const td = document.createElement('td');
    td.textContent = value;
    row.append(td);
  }
  row.lastElementChild?.classList.add(item.bytes.byteLength < 1048576 ? 'good' : 'warn');
  tbody.append(row);
}
function updateSummary(): void {
  const total = files.reduce((n, f) => n + f.bytes.byteLength, 0);
  const within = files.filter((f) => f.bytes.byteLength < 1048576).length;
  summary.textContent = files.length + ' characters · ' + mb(total) + ' total GLB · ' +
    within + ' under 1 MB';
}
function packageZip(): void {
  if (!files.length) {
    zipStatus.textContent = 'No characters were exported.';
    return;
  }
  zipStatus.textContent = 'Packaging ZIP in your browser…';
  const entries: Zippable = {};
  const manifest = {
    generator: 'Ara 3D Gen — GTD Batch NPC Lab 001',
    createdAt: new Date().toISOString(),
    settings: currentSettings,
    characters: files.map((f) => ({
      name: f.filename, seed: f.seed, heightMeters: f.height,
      triangles: f.triangles, glbBytes: f.bytes.byteLength,
      paramsFile: 'specifications/' + f.filename.replace(/\.glb$/i, '.params.json'),
    })),
  };
  for (const f of files) {
    entries['characters/' + f.filename] = [f.bytes, { level: 0 }];
    entries['specifications/' + f.filename.replace(/\.glb$/i, '.params.json')] =
      strToU8(JSON.stringify(f.params, null, 2));
  }
  entries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  entries['README.txt'] = strToU8(
    'G.T.D NPC Batch Export\n\n' +
    'characters/: animated GLB files, +Y up, facing +Z.\n' +
    'specifications/: reproducible character parameters.\n' +
    'manifest.json: seeds, triangle counts and byte sizes.\n\n' +
    'GLBs are unoptimized source exports. Inspect and optimize before committing to G.T.D.\n' +
    'ZIP compression is not equivalent to GLB runtime optimization.\n'
  );
  zip(entries, { level: 0 }, (error, bytes) => {
    if (error) {
      zipStatus.textContent = 'ZIP packaging failed: ' + error.message;
      return;
    }
    archive = bytes;
    download.disabled = false;
    zipStatus.textContent = 'ZIP ready · ' + mb(bytes.byteLength);
    setStatus('Batch ready. Download the ZIP to review your NPCs.');
  });
}
function finish(message: string): void {
  worker?.terminate();
  worker = null;
  setBusy(false);
  setStatus(message);
  packageZip();
}
function onMessage(event: MessageEvent<WorkerEvent>): void {
  const m = event.data;
  if (m.type === 'status') {
    progress.max = m.total;
    progress.value = m.completed;
    setStatus(m.stage + ' (' + m.completed + '/' + m.total + ')');
  } else if (m.type === 'file') {
    files.push(m);
    progress.value = files.length;
    appendRow(m);
    updateSummary();
  } else if (m.type === 'finished') {
    finish(m.cancelled ? 'Stopped after ' + m.completed + ' characters.' : 'Generated ' + m.completed + ' characters.');
  } else if (m.type === 'error') {
    finish('Generation failed: ' + m.message + '. Partial results can still be downloaded.');
  }
}
generate.addEventListener('click', () => {
  const amount = Number(count.value);
  const baseSeed = Number(seed.value);
  const clips = checkboxes.filter((c) => c.checked).map((c) => c.value);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 50 ||
      !Number.isSafeInteger(baseSeed) || baseSeed < 0 || baseSeed > 999999999 ||
      !clips.length) {
    setStatus('Enter 1–50 characters, a seed between 0 and 999999999, and at least one animation.');
    return;
  }
  currentSettings = {
    count: amount, baseSeed,
    detail: detail.value as BatchSettings['detail'],
    rig: rig.value as BatchSettings['rig'],
    clips,
  };
  files = [];
  archive = null;
  tbody.replaceChildren();
  download.disabled = true;
  progress.max = amount;
  progress.value = 0;
  zipStatus.textContent = 'No archive yet';
  updateSummary();
  setBusy(true);
  setStatus('Starting browser generation worker…');
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = onMessage;
  worker.onerror = (event) => {
    finish('Generation worker error: ' + (event.message || 'unknown error'));
  };
  worker.postMessage({ type: 'start', settings: currentSettings });
});
cancel.addEventListener('click', () => {
  if (worker && running) {
    worker.postMessage({ type: 'cancel' });
    cancel.disabled = true;
    setStatus('Stopping after the current character…');
  }
});
download.addEventListener('click', () => {
  if (!archive) return;
  const url = URL.createObjectURL(new Blob([archive as BlobPart], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'GTD_NPC_batch_' + (currentSettings?.baseSeed ?? 0) + '_' + files.length + '.zip';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});
window.addEventListener('pagehide', () => worker?.terminate());
updateSummary();
