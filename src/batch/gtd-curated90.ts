/** GTD Meridia curated 90: human-readable identities mapped to the real Ara generator.
 * The creative bible remains canonical; unavailable props are NOT fabricated.
 * 9 deterministic batches of 10, IDs 011–100. Existing 001–010 are untouched.
 */
import bibleJson from '../../data/gtd-meridia-character-bible-90.json';
import type { Catalog } from '../core/assets';
import { randomParams, yearsToAge, type Detail, type HumanParams } from '../core/params';
import type { RigType } from '../core/rig/skeletons';

export interface CuratedCharacter {
  id: string;
  category: string;
  categoryIndex: number;
  label: string;
  age: number;
  presentation: string;
  build: string;
  hair: string;
  wardrobe: string;
  primary: string;
  secondary: string;
  signature: string;
  activity: string;
  districtFit: string[];
}
interface CharacterBible {
  schema: string;
  city: string;
  creativeDirection: string;
  characters: CuratedCharacter[];
  categories: {index:number;name:string;description:string;districtFit:string[];count:number}[];
}
export const GTD_MERIDIA_BIBLE = bibleJson as CharacterBible;
export const GTD_CURATED_GROUPS = GTD_MERIDIA_BIBLE.categories;
export const GTD_CURATED_CHARACTERS = GTD_MERIDIA_BIBLE.characters;
export const GTD_CURATED_TOTAL = GTD_CURATED_CHARACTERS.length;

export function curatedGroup(index: number): CuratedCharacter[] {
  if (!Number.isInteger(index) || index < 0 || index >= GTD_CURATED_GROUPS.length)
    throw new Error('Unknown Meridia category batch: ' + index);
  return GTD_CURATED_CHARACTERS.filter((p) => p.categoryIndex === index);
}
export function curatedSeed(profile: CuratedCharacter): number {
  const numericId = Number(profile.id.replace(/^GTD_NPC_/, ''));
  return (42027 + (numericId - 1) * 7919) % 1000000000;
}

const shapes: Record<string,[number,number,number]> = {
  slender:[.48,.34,.40], sturdy:[.52,.68,.60], curvy:[.47,.67,.47],
  stocky:[.42,.75,.57], athletic:[.57,.47,.76], tall:[.77,.46,.54],
  petite:[.30,.38,.43], broad:[.63,.69,.75], average:[.50,.50,.52],
  compact:[.37,.54,.53], lean:[.58,.36,.59],
};
const styleFor = (primary:string,secondary:string,pattern='solid') => ({pattern,color:primary,color2:secondary});
const wardrobeOptions: Record<string,string[]> = {
  casual:['casualsuit','casual'],smart:['casualsuit','elegantsuit'],
  formal:['elegantsuit','casualsuit'],sport:['sportsuit','casualsuit'],
  street:['casualsuit','sportsuit'],creative:['casualsuit','elegantsuit'],
};
function matchingOutfit(cat:Catalog, female:boolean, kind:string, fallback:string):string {
  const allowed = cat.outfits.filter(o => {
    const tags = o.tags.map(t=>t.toLowerCase());
    if (female && tags.includes('male') && !tags.includes('female')) return false;
    if (!female && tags.includes('female') && !tags.includes('male')) return false;
    const id=o.id.toLowerCase();
    if (female && id.startsWith('male_')) return false;
    if (!female && id.startsWith('female_')) return false;
    return true;
  });
  for (const fragment of wardrobeOptions[kind]??['casualsuit']) {
    const found=allowed.find(o=>o.id.toLowerCase().includes(fragment));
    if(found)return found.id;
  }
  return allowed.find(o=>o.id===fallback)?.id ?? allowed[0]?.id ?? 'none';
}

/** Converts one curated biography into reproducible, supported Ara HumanParams.
 * Real GLB variation is enforced by morphology, hair, wardrobe and palette;
 * signatures such as props/bags are creative direction only until supported. */
export function makeCuratedParams(
  profile:CuratedCharacter, cat:Catalog, detail:Detail='low',
  rig:Extract<RigType,'game'|'game_lite'>='game_lite',
):HumanParams {
  const seed=curatedSeed(profile);
  const base=randomParams(seed,cat);
  const female=profile.presentation==='F';
  const [height,weight,muscle]=shapes[profile.build]??shapes.average;
  const idNumber=Number(profile.id.slice(-3));
  const variance=(((idNumber*37)%17)-8)/500;
  // Vary background independently of occupation; South Africa is diverse.
  const ancestry:[[number,number,number],[number,number,number],[number,number,number],[number,number,number],[number,number,number]]=[
    [.93,.03,.04],[.82,.07,.11],[.13,.76,.11],[.10,.05,.85],[.56,.16,.28],
  ];
  const [african,asian,caucasian]=ancestry[(idNumber*7)%ancestry.length];
  const hair=cat.hair.some(h=>h.id===profile.hair)?profile.hair:base.hair;
  const outfit=matchingOutfit(cat,female,profile.wardrobe,base.outfit);
  const p:HumanParams={
    ...base,seed,name:profile.id+'_S'+seed,gender:female?.02:.98,
    age:yearsToAge(profile.age),height:Math.min(.95,Math.max(.15,height+variance)),
    weight:Math.min(.95,Math.max(.15,weight-variance)),
    muscle:Math.min(.95,Math.max(.15,muscle+variance)),
    african,asian,caucasian,
    hair,hairColor:profile.age>=66?'#8b8277':base.hairColor,
    facialHair:female?'none':base.facialHair,
    outfit,outfitTint:profile.primary,top:'none',bottom:'none',
    accessories:[],garmentStyles:{},detail,rig,animations:true,
    faceBones:false,faceShapes:false,speechShapes:false,
    weapon:'none',vehicle:'none',
  };
  const top=(id:string,bottom:string,pattern='solid')=>{
    p.outfit='none';p.top=id;p.bottom=bottom;
    p.garmentStyles[id]=styleFor(profile.primary,profile.secondary,pattern);
    p.garmentStyles[bottom]=styleFor(profile.secondary,profile.primary,pattern);
  };
  switch(profile.wardrobe){
    case 'work':top('uniform_shirt','uniform_trousers');p.accessories=['belt'];break;
    case 'trades':top('fatigue_shirt','fatigue_pants');p.accessories=['belt'];break;
    case 'safety':top('uniform_shirt','uniform_trousers');p.accessories=['reflective_vest','belt'];break;
    case 'uniform':top('uniform_shirt_long','uniform_trousers');p.accessories=['belt'];break;
    case 'traditional':top('long_tunic','trousers','ankara');p.accessories=['bead_necklace'];break;
    case 'outdoors':top('tank_top','cargo_shorts');p.accessories=['belt'];break;
    case 'creative':
      if(idNumber%2===0)top('techwear_jacket','techwear_pants');
      break;
    case 'street':
      if(idNumber%3===0)top('techwear_jacket','techwear_pants');
      break;
    case 'sport':
      if(p.outfit==='none')top('tank_top','cargo_shorts');
      break;
  }
  if(p.outfit!=='none' && idNumber%3===0)p.accessories=['watch'];
  // Do not imply all narrative signatures (bags, scarves, glasses) are modeled.
  return p;
}
