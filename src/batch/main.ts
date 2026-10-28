/** GTD Meridia batch export. Curated groups preserve 90 identities (011–100). */
import { strToU8, zip, type Zippable } from 'fflate';
import { encodeCharacter } from '../app/share';
import type { HumanParams } from '../core/params';
import { GTD_MERIDIA_BIBLE,GTD_CURATED_GROUPS,curatedGroup,type CuratedCharacter } from './gtd-curated90';
import type { BatchSettings } from './worker';
import './style.css';

type FileEvent = {
  type:'file';index:number;filename:string;seed:number;
  bytes:Uint8Array;triangles:number;height:number;params:object;profile:CuratedCharacter|null;
};
type StatusEvent = {type:'status';completed:number;total:number;stage:string};
type FinishedEvent = {type:'finished';completed:number;cancelled:boolean};
type ErrorEvent = {type:'error';message:string};
type WorkerEvent = FileEvent|StatusEvent|FinishedEvent|ErrorEvent;

const get=<T extends HTMLElement>(id:string):T=>{
  const element=document.getElementById(id);
  if(!element)throw new Error('Missing UI element: '+id);
  return element as T;
};
const mode=get<HTMLSelectElement>('mode');
const category=get<HTMLSelectElement>('category');
const categoryNote=get<HTMLElement>('category-note');
const count=get<HTMLInputElement>('count');
const seed=get<HTMLInputElement>('seed');
const detail=get<HTMLSelectElement>('detail');
const rig=get<HTMLSelectElement>('rig');
const generate=get<HTMLButtonElement>('generate');
const cancel=get<HTMLButtonElement>('cancel');
const next=get<HTMLButtonElement>('next');
const download=get<HTMLButtonElement>('download');
const downloadBible=get<HTMLButtonElement>('download-bible');
const status=get<HTMLElement>('status');
const progress=get<HTMLProgressElement>('progress');
const summary=get<HTMLElement>('summary');
const tbody=get<HTMLTableSectionElement>('rows');
const zipStatus=get<HTMLElement>('zip-status');
const checkboxes=['idle','walk','run'].map(id=>get<HTMLInputElement>('clip-'+id));
for(const group of GTD_CURATED_GROUPS){
  const option=document.createElement('option');
  option.value=String(group.index);
  option.textContent=String(group.index+1).padStart(2,'0')+' / '+group.name+' · NPC '+String(group.index*10+11).padStart(3,'0')+'–'+String(group.index*10+20).padStart(3,'0');
  category.append(option);
}
let worker:Worker|null=null;
let files:FileEvent[]=[];
let archive:Uint8Array|null=null;
let currentSettings:BatchSettings|null=null;
let running=false;
const mb=(n:number)=>(n/1048576).toFixed(2)+' MB';
function refreshMode():void {
  const curated=mode.value==='curated90';
  const idx=Number(category.value||0);
  category.disabled=!curated||running;
  count.disabled=curated||running;
  seed.disabled=curated||running;
  mode.disabled=running;
  next.disabled=!curated||running||idx>=GTD_CURATED_GROUPS.length-1;
  const group=GTD_CURATED_GROUPS[idx];
  categoryNote.textContent=curated
    ? 'Batch '+(idx+1)+'/9 · '+group.description+'. Ten distinct identities. Export each category ZIP before generating the next.'
    : 'Experimental random generation; separate from the canonical 90-character Meridia collection.';
}
function setBusy(busy:boolean):void {
  running=busy;generate.disabled=busy;cancel.disabled=!busy;
  [detail,rig,...checkboxes].forEach(el=>{el.disabled=busy});
  refreshMode();
}
function setStatus(message:string):void{status.textContent=message}
function appendRow(item:FileEvent):void{
  const row=document.createElement('tr');
  const fields=[
    item.profile?.id??'Random',item.profile?.label??'Randomized character',
    item.filename,String(item.seed),item.triangles.toLocaleString(),
    mb(item.bytes.byteLength),item.bytes.byteLength<1048576?'Within target':'Above 1 MB target',
  ];
  for(const value of fields){
    const td=document.createElement('td');td.textContent=value;row.append(td);
  }
  row.lastElementChild?.classList.add(item.bytes.byteLength<1048576?'good':'warn');
  const preview=document.createElement('td');
  const link=document.createElement('a');
  link.href=new URL(import.meta.env.BASE_URL+'app/#c='+encodeCharacter(item.params as HumanParams),location.origin).href;
  link.textContent='Preview ↗';link.target='_blank';link.rel='noopener';
  link.setAttribute('aria-label','Preview '+(item.profile?.label??item.filename)+' in Ara editor');
  preview.append(link);row.append(preview);
  tbody.append(row);
}
function updateSummary():void {
  const total=files.reduce((n,f)=>n+f.bytes.byteLength,0);
  const within=files.filter(f=>f.bytes.byteLength<1048576).length;
  summary.textContent=files.length+' characters · '+mb(total)+' total GLB · '+within+' under 1 MB';
}
function packageZip():void {
  if(!files.length){zipStatus.textContent='No characters exported.';return}
  zipStatus.textContent='Packaging ZIP in your browser…';
  const entries:Zippable={};
  const selected=currentSettings?.mode==='curated90'
    ? GTD_CURATED_GROUPS[currentSettings.categoryIndex]:null;
  const manifest={
    generator:'Ara 3D Gen — GTD Meridia 90 curated batch',
    schema:'gtd.meridia.npc-batch.v2',
    createdAt:new Date().toISOString(),
    settings:currentSettings,
    selectedCategory:selected,
    characters:files.map(f=>({
      id:f.profile?.id??null,label:f.profile?.label??null,category:f.profile?.category??null,
      filename:f.filename,seed:f.seed,heightMeters:f.height,
      triangles:f.triangles,glbBytes:f.bytes.byteLength,
      paramsFile:'specifications/'+f.filename.replace(/\.glb$/i,'.params.json'),
      profileFile:f.profile?'profiles/'+f.profile.id+'.json':null,
    })),
  };
  for(const f of files){
    entries['characters/'+f.filename]=[f.bytes,{level:0}];
    entries['specifications/'+f.filename.replace(/\.glb$/i,'.params.json')]=strToU8(JSON.stringify(f.params,null,2));
    if(f.profile)entries['profiles/'+f.profile.id+'.json']=strToU8(JSON.stringify(f.profile,null,2));
  }
  entries['manifest.json']=strToU8(JSON.stringify(manifest,null,2));
  if(currentSettings?.mode==='curated90')
    entries['creative-bible/GTD_Meridia_90_Character_Bible.json']=strToU8(JSON.stringify(GTD_MERIDIA_BIBLE,null,2));
  entries['README.txt']=strToU8(
    'G.T.D Meridia NPC Export — Contemporary South African City\n\n'+
    'characters/: animated GLB files (+Y up, +Z facing).\n'+
    'specifications/: reproducible Ara HumanParams for each model.\n'+
    'profiles/: intended character identity, wardrobe and district suitability.\n'+
    'creative-bible/: all 90 curated residents (curated batches only).\n'+
    'manifest.json: ID, source seed, GLB bytes and geometry metrics.\n\n'+
    'IMPORTANT: Narrative details (e.g. bags, glasses, rolled sleeves) may not be modeled by Ara.\n'+
    'These are unoptimized source GLBs. Inspect/optimize each model before GTD integration.\n'+
    'Target <1 MiB per optimized GLB; ZIP compression is not runtime optimization.\n'+
    'Do not rename IDs: 001–010 are the existing GTD characters; this collection is 011–100.\n'
  );
  zip(entries,{level:0},(error,bytes)=>{
    if(error){zipStatus.textContent='ZIP packaging failed: '+error.message;return}
    archive=bytes;download.disabled=false;
    zipStatus.textContent='ZIP ready · '+mb(bytes.byteLength);
    setStatus('Batch ready. Download its ZIP before generating the next group.');
  });
}
function finish(message:string):void {
  worker?.terminate();worker=null;setBusy(false);setStatus(message);packageZip();
}
function onMessage(event:MessageEvent<WorkerEvent>):void{
  const m=event.data;
  if(m.type==='status'){
    progress.max=m.total;progress.value=m.completed;
    setStatus(m.stage+' ('+m.completed+'/'+m.total+')');
  }else if(m.type==='file'){
    files.push(m);progress.value=files.length;appendRow(m);updateSummary();
  }else if(m.type==='finished'){
    finish(m.cancelled?'Stopped after '+m.completed+' characters.':'Generated '+m.completed+' characters.');
  }else if(m.type==='error'){
    finish('Generation failed: '+m.message+'. Partial results can still be downloaded.');
  }
}
function start():void {
  const curated=mode.value==='curated90';
  const idx=Number(category.value);
  const amount=curated?curatedGroup(idx).length:Number(count.value);
  const baseSeed=curated?42027:Number(seed.value);
  const clips=checkboxes.filter(c=>c.checked).map(c=>c.value);
  if(!Number.isSafeInteger(amount)||amount<1||amount>50||
     !Number.isSafeInteger(baseSeed)||baseSeed<0||baseSeed>999999999||
     !clips.length||(curated&&(!clips.includes('idle')||!clips.includes('walk')))){
    setStatus('Invalid settings. Curated characters require Idle and Walk; random batches allow 1–50.');
    return;
  }
  currentSettings={mode:curated?'curated90':'random',categoryIndex:idx,count:amount,baseSeed,
    detail:detail.value as BatchSettings['detail'],
    rig:rig.value as BatchSettings['rig'],clips};
  files=[];archive=null;tbody.replaceChildren();download.disabled=true;
  progress.max=amount;progress.value=0;zipStatus.textContent='No archive yet';
  updateSummary();setBusy(true);
  setStatus('Starting local character generation worker…');
  worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
  worker.onmessage=onMessage;
  worker.onerror=e=>finish('Generation worker error: '+(e.message||'unknown error'));
  worker.postMessage({type:'start',settings:currentSettings});
}
generate.addEventListener('click',start);
cancel.addEventListener('click',()=>{
  if(worker&&running){worker.postMessage({type:'cancel'});cancel.disabled=true;
    setStatus('Stopping after the current character…');}
});
download.addEventListener('click',()=>{
  if(!archive)return;
  const url=URL.createObjectURL(new Blob([archive as BlobPart],{type:'application/zip'}));
  const link=document.createElement('a');link.href=url;
  const idx=currentSettings?.categoryIndex??0;
  link.download=currentSettings?.mode==='curated90'
    ? 'GTD_Meridia_90_Group_'+String(idx+1).padStart(2,'0')+'_NPC_'+String(idx*10+11).padStart(3,'0')+'-'+String(idx*10+20).padStart(3,'0')+'.zip'
    : 'GTD_Random_NPC_'+(currentSettings?.baseSeed??0)+'_'+files.length+'.zip';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
});
downloadBible.addEventListener('click',()=>{
  const bytes=strToU8(JSON.stringify(GTD_MERIDIA_BIBLE,null,2));
  const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='GTD_Meridia_90_Character_Bible.json';
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
});
next.addEventListener('click',()=>{
  const idx=Number(category.value);
  if(idx<GTD_CURATED_GROUPS.length-1){category.value=String(idx+1);refreshMode();
    setStatus('Selected group '+(idx+2)+'/9. Download the previous ZIP before generating another batch.');}
});
mode.addEventListener('change',refreshMode);
category.addEventListener('change',refreshMode);
window.addEventListener('pagehide',()=>worker?.terminate());
refreshMode();updateSummary();
