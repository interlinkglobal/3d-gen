/** Fast validation of the 90-character Meridia bible and parameter mapping. */
import { GTD_MERIDIA_BIBLE,GTD_CURATED_CHARACTERS,GTD_CURATED_GROUPS,curatedGroup,curatedSeed,makeCuratedParams } from '../src/batch/gtd-curated90';
import type {Catalog} from '../src/core/assets';
import {ageToYears} from '../src/core/params';
const assert=(ok:unknown,message:string)=>{if(!ok)throw new Error(message)};
const people=GTD_CURATED_CHARACTERS;
assert(GTD_MERIDIA_BIBLE.schema==='gtd.meridia.character-bible.v1','schema');
assert(people.length===90,'expected exactly 90 people');
assert(GTD_CURATED_GROUPS.length===9,'expected nine categories');
assert(new Set(people.map(p=>p.id)).size===90,'duplicate NPC id');
assert(new Set(people.map(p=>p.label)).size===90,'duplicate character label');
assert(new Set(people.map(p=>p.signature)).size===90,'duplicate signature');
assert(new Set(people.map(p=>p.activity)).size===90,'duplicate activity');
assert(new Set(people.map(p=>p.primary+'/'+p.secondary)).size>75,'too few distinct palettes');
assert(new Set(people.map(curatedSeed)).size===90,'duplicate seeds');
for(let i=0;i<90;i++){
  const p=people[i];
  assert(p.id==='GTD_NPC_'+String(i+11).padStart(3,'0'),'missing sequential ID '+i);
  assert(p.categoryIndex===Math.floor(i/10),'category order '+p.id);
  assert(p.age>=18&&p.age<=90,'invalid adult age '+p.id);
  assert(p.signature.length>=8&&p.activity.length>10,'incomplete creative identity '+p.id);
  assert(p.districtFit.length>0,'missing district reuse '+p.id);
}
for(let i=0;i<9;i++)assert(curatedGroup(i).length===10,'category '+i+' not ten');
const ids=(names:string[])=>names.map(id=>({id,name:id,tags:[]}));
const catalog={
  sliders:[],outfits:ids(['male_casualsuit01','female_casualsuit02','male_elegantsuit01','female_elegantsuit01','female_sportsuit01']),
  eyes:ids(['brown','darkbrown','blackbrown']),eyebrows:ids(['eyebrow001']),
  eyelashes:ids(['eyelashes01']),hair:ids(['short02','short04','afro01','bob02','braid01','ponytail01','cornrows','box_braids','buzz','short01','short03','long01','bob01']),
  shoes:ids(['shoes01']),hats:[],
} as unknown as Catalog;
for(const person of people){
  const params=makeCuratedParams(person,catalog);
  assert(params.name===person.id+'_S'+curatedSeed(person),'wrong export name '+person.id);
  assert(params.rig==='game_lite'&&params.detail==='low'&&params.animations,'wrong export defaults');
  assert(Math.abs(ageToYears(params.age)-person.age)<.01,'wrong age '+person.id);
  assert(params.outfit==='none'||catalog.outfits.some(o=>o.id===params.outfit),'unknown outfit '+person.id);
  assert(params.hair==='none'||catalog.hair.some(h=>h.id===params.hair),'unknown hair '+person.id);
  assert(params.gender===(person.presentation==='F'?.02:.98),'wrong presentation '+person.id);
}
console.log('GTD curated 90 PASS: 9 categories × 10, 90 unique IDs/seeds/identities and valid generated parameters');
