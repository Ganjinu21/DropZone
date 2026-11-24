'use strict';

// This portrait development branch starts in the test profile. Normal progress keeps its original save keys.
const developerPreference='dropzone.developer-mode';
const developerMode=readLocal(developerPreference)!==false;
const equipmentKey=developerMode?'dropzone.dev.equipment.v2':'dropzone.equipment.v2';
const armoryKey=developerMode?'dropzone.dev.armory.v1':'dropzone.armory.v1';
const boxPrice=100,firstBBox=3,firstABox=21,repeatABoxes=12;
const equipmentSlots={weapon:'무기',gloves:'장갑',boots:'신발',helmet:'헬멧',top:'상의',pants:'하의',shield:'전술방패'};
const weaponFamilies=['carbine','smg','sniper','rocket','ar'];
const itemFamilies={pistol:'권총',carbine:'실드 카빈',smg:'듀얼 SMG',sniper:'저격소총',rocket:'전술 로켓포',ar:'돌격소총',
  shield:'전술방패',gloves:'전술 장갑',boots:'전투화',helmet:'전투모',top:'전술 조끼',pants:'전투 바지'};
const armorStats={
  helmet:{effect:'최대 체력',values:[8,16,28,45,65],unit:'',sign:'+'},
  gloves:{effect:'기본 공격 속도',values:[3,6,10,16,24],unit:'%',sign:'+'},
  top:{effect:'받는 피해',values:[3,7,12,18,26],unit:'%',sign:'−'},
  pants:{effect:'재장전 시간',values:[4,8,14,22,32],unit:'%',sign:'−'},
  boots:{effect:'이동 속도',values:[3,6,10,15,22],unit:'%',sign:'+'}
};
const rankedNames={
  pistol:['시작 권총','기동 권총','전술 권총','정예 권총','펄스 권총'],
  carbine:['초병','순찰대','문지기','성문','해태'],
  smg:['더블 탭','스위치','래피드','크로스파이어','쌍도깨비'],
  sniper:['척후','망루','긴그림자','월식','백호'],
  rocket:['화통','철퇴','해머헤드','공성추','이무기'],
  ar:['콜사인','릴레이','비콘','나이트링크','흑매'],
  shield:['초병 방패','순찰대 방패','문지기 방패','성문 방패','해태 방패'],
  helmet:['관제 헬멧','수색 관제모','돌입 헬멧','야간 강습 헬멧','펄스 바이저'],
  gloves:['정찰 사격 장갑','수색 장갑','돌입 너클 장갑','야간 강습 장갑','코어 건틀릿'],
  top:['보급 견갑 조끼','수색 흉갑 조끼','돌입 플레이트 캐리어','야간 강습 흉갑','리액터 흉갑'],
  pants:['보급 전투 바지','수색 카고 바지','돌입 전술 바지','야간 강습 바지','서보 전투 바지'],
  boots:['보급 전투화','수색 기동화','돌입 전투화','야간 강습 전투화','자력 기동화']
};
// Keep the original C, B, A and S save IDs. S+ has its own ID and drop policy.
const rankedTiers=[
  {rank:'C',variant:0,bonus:0}, {rank:'B',variant:1,bonus:60},
  {rank:'A',variant:3,bonus:150}, {rank:'S',variant:5,bonus:450},
  {rank:'S+',variant:6,bonus:1100}
];
const shieldGuard=[0,5,9,14,18];
const equipmentCatalog=Object.keys(itemFamilies).flatMap(family=>
  rankedTiers.map(({rank,variant,bonus},tier)=>{
    const weapon=family==='pistol'||weaponFamilies.includes(family);
    const power=weapon?bonus:family==='shield'?shieldGuard[tier]:armorStats[family].values[tier];
    return {key:family+'-'+variant,family,label:rankedNames[family][tier],rank,tier,power,weapon,
      asset:'art/armory/catalog/'+family+'/'+(rank==='S+'?'S-plus':rank)};
  })
);
const gearByKey=new Map(equipmentCatalog.map(i=>[i.key,i]));
const weaponMagazines={
  pistol:  {rounds:[10,12,14,16,18],seconds:[1.35,1.30,1.25,1.20,1.10]},
  carbine: {rounds:[18,20,24,28,30],seconds:[1.90,1.80,1.70,1.60,1.50]},
  smg:     {rounds:[24,28,32,40,48],seconds:[2.10,2.00,1.85,1.70,1.55]},
  sniper:  {rounds:[4,5,5,6,7],seconds:[2.60,2.50,2.35,2.20,2.00]},
  rocket:  {rounds:[1,1,2,2,3],seconds:[3.00,2.80,2.70,2.50,2.30]},
  ar:      {rounds:[20,24,28,30,36],seconds:[1.85,1.75,1.65,1.55,1.45]}
};
const canEnhance=i=>i?.weapon && (i.rank==='A'||i.rank==='S');
const levelKey=(base,level)=>level?base+'@'+level:base;
const gradeLabel=i=>i.level?i.rank+'+'+i.level:i.rank;
for(const item of equipmentCatalog.filter(i=>i.weapon)){
  const magazine=weaponMagazines[item.family];
  Object.assign(item,{artKey:item.key,level:0,capacity:magazine.rounds[item.tier],reload:magazine.seconds[item.tier]});
  if(!canEnhance(item))continue;
  for(let level=1;level<=5;level++){
    const key=levelKey(item.key,level);
    gearByKey.set(key,{...item,key,level,power:item.power+level*(item.rank==='A'?35:80)});
  }
}
function fusionRecipe(item){
  if(!canEnhance(item))return null;
  const base=item.artKey;
  const material=item.level===5?item.key:base;
  const output=item.level===5?item.family+'-'+rankedTiers[item.tier+1].variant:levelKey(base,item.level+1);
  return {material,output};
}
function canonicalGearKey(key){
  if(gearByKey.has(key) || typeof key!=='string')return key;
  const family=key.split('-')[0];
  if(!Object.hasOwn(rankedNames,family))return key;
  if(key===family+'-2')return family+'-1';
  if(key===family+'-4')return family+'-3';
  return key;
}
const starterKeys=['pistol-0',...Object.keys(equipmentSlots).filter(k=>k!=='weapon').map(k=>k+'-0')];
const itemImage=i=>i.asset+'.png';
const defaultItem=slot=>slot==='weapon'?'pistol-0':slot+'-0';
function gearSlots(id){return Object.keys(equipmentSlots).filter(slot=>slot!=='shield'||id===0)}
function canEquip(id,slot,item){
  if(!item || !Number.isInteger(id) || id<0 || id>=weaponFamilies.length || !gearSlots(id).includes(slot))return false;
  return slot==='weapon' ? item.family==='pistol'||item.family===weaponFamilies[id] : item.family===slot;
}
function readLocal(key){try{return JSON.parse(localStorage.getItem(key))}catch{return null}}
const legacyGear=developerMode?null:readLocal('dropzone.equipment.v1');
const safeCount=n=>Number.isSafeInteger(n)&&n>0?n:0;
function restoredArmory(raw){
  const counts={};
  if(raw?.counts && typeof raw.counts==='object'){
    for(const [old,n] of Object.entries(raw.counts)){
      const key=canonicalGearKey(old);
      if(gearByKey.has(key) && safeCount(n))counts[key]=Math.min(Number.MAX_SAFE_INTEGER,(counts[key]||0)+n);
    }
  }else if(Array.isArray(raw?.owned)){
    for(const old of new Set(raw.owned)){
      const key=canonicalGearKey(old);
      if(gearByKey.has(key))counts[key]=(counts[key]||0)+1;
    }
  }else if(developerMode){
    for(const i of equipmentCatalog.filter(canEnhance))counts[i.key]=12;
  }else if(Array.isArray(legacyGear)){
    for(const [id,row] of legacyGear.entries())for(const [slot,old] of Object.entries(row||{})){
      const key=canonicalGearKey(old);
      if(canEquip(id,slot,gearByKey.get(key)) && !key.endsWith('-0'))counts[key]=1;
    }
  }
  for(const key of starterKeys)counts[key]=Math.max(1,counts[key]||0);
  return {diamonds:!raw && developerMode?3000:safeCount(raw?.diamonds),counts,
    boxes:safeCount(raw?.boxes),sinceA:safeCount(raw?.sinceA)};
}
let armory=restoredArmory(readLocal(armoryKey)),sessionStorageOnly=false;
function owns(key){
  const item=gearByKey.get(key);
  return !!armory.counts[key] || !!(developerMode && item?.asset && !item.level);
}
function normalizedEquipment(data){
  return weaponFamilies.map((_,id)=>Object.fromEntries(gearSlots(id).map(slot=>{
    const key=canonicalGearKey(data?.[id]?.[slot]),item=gearByKey.get(key);
    if(canEquip(id,slot,item)){
      if(owns(key))return [slot,key];
      // Recover references to a consumed copy even if the app closed between the inventory and loadout saves.
      if(canEnhance(item)){
        let next=item;
        while(canEnhance(next)){
          next=gearByKey.get(fusionRecipe(next).output);
          if(owns(next.key))return [slot,next.key];
        }
      }
    }
    return [slot,defaultItem(slot)];
  })));
}
let savedEquipment=normalizedEquipment(readLocal(equipmentKey)??(developerMode?readLocal('dropzone.equipment.v2'):legacyGear));
function changeArmory(edit){
  const update=()=>{
    if(!sessionStorageOnly)armory=restoredArmory(readLocal(armoryKey)??armory);
    const result=edit(armory);
    try{localStorage.setItem(armoryKey,JSON.stringify(armory))}catch{sessionStorageOnly=true}
    updateDiamondDisplay();return result;
  };
  if(!navigator.locks)return Promise.resolve(update());
  let entered=false;
  return navigator.locks.request(armoryKey,()=>{entered=true;return update()}).catch(error=>{
    if(!entered && (error.name==='SecurityError'||error.name==='NotAllowedError'))return update();
    throw error;
  });
}
function awardDiamonds(value){return changeArmory(state=>{state.diamonds+=value})}
function crateRank(state){
  const draw=state.boxes+1;
  if(draw<firstBBox)return 'C';
  if(draw===firstBBox)return 'B';
  if(draw<firstABox)return Math.random()<.30?'B':'C';
  if(draw===firstABox || state.sinceA+1>=repeatABoxes)return 'A';
  const roll=Math.random();
  if(roll<.08)return 'A';
  return roll<.38?'B':'C';
}
function openWeaponCrate(family){
  return changeArmory(state=>{
    if(!Object.hasOwn(weaponMagazines,family))return {message:'보급할 무기 종류를 선택하세요.'};
    if(state.diamonds<boxPrice)return {message:'다이아가 부족합니다. 적을 처치해 모으세요.'};
    const rank=crateRank(state);
    const weapon=equipmentCatalog.find(i=>i.family===family && i.rank===rank);
    const armor=equipmentCatalog.filter(i=>!i.weapon && i.rank!=='S+' && !state.counts[i.key]);
    const drops=[weapon];
    if(armor.length)drops.push(armor[Math.floor(Math.random()*armor.length)]);
    state.diamonds-=boxPrice;state.boxes++;state.sinceA=rank==='A'?0:state.sinceA+1;
    for(const i of drops)state.counts[i.key]=(state.counts[i.key]||0)+1;
    return {drops};
  });
}
function readyToFuse(state,item,recipe){
  if(!recipe)return false;
  const input=state.counts[item.key]||0,material=state.counts[recipe.material]||0;
  return item.key===recipe.material?input>=2:input>=1 && material>=1;
}
function fuseWeapon(key){
  return changeArmory(state=>{
    const item=gearByKey.get(key),recipe=fusionRecipe(item);
    if(!readyToFuse(state,item,recipe))return null;
    state.counts[key]--;state.counts[recipe.material]--;
    state.counts[recipe.output]=(state.counts[recipe.output]||0)+1;
    return {item:gearByKey.get(recipe.output),consumed:[key,recipe.material].filter(k=>!state.counts[k])};
  });
}
function gearStats(id,loadout=savedEquipment){
  const row=loadout[id], power=slot=>gearByKey.get(row[slot])?.power||0;
  return {interval:1/(1+power('gloves')/100),movement:1+power('boots')/100,
    health:power('helmet'),reload:1-power('pants')/100,protection:power('top')/100,guard:power('shield')/100};
}
function gearEffect(slot,item){
  if(item.weapon)return '기본 피해 '+equipmentDamage(item);
  if(slot==='shield')return '전방 방어 +'+item.power+'%';
  const stat=armorStats[item.family];
  return stat.effect+' '+stat.sign+item.power+stat.unit;
}
function itemOwner(item){
  if(item.family==='shield')return '벌크 전용';
  const id=weaponFamilies.indexOf(item.family);
  return id<0?'모든 대원 공용':names[id]+' 전용';
}
addEventListener('storage',event=>{
  if(event.key===armoryKey){
    armory=restoredArmory(readLocal(armoryKey));savedEquipment=normalizedEquipment(readLocal(equipmentKey)??savedEquipment);
    updateDiamondDisplay();
    if(!$('prep-screen').hidden){draftEquipment=normalizedEquipment(draftEquipment);paintPrep()}
  }
  if(event.key===equipmentKey)savedEquipment=normalizedEquipment(readLocal(equipmentKey));
});
