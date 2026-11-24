'use strict';

const equipmentKey='dropzone.equipment.v2';
const armoryKey='dropzone.armory.v1';
const boxPrice=10;
const equipmentSlots={weapon:'무기',gloves:'장갑',boots:'신발',helmet:'헬멧',top:'상의',pants:'하의',shield:'전술방패'};
const weaponFamilies=['carbine','smg','sniper','rocket','ar'];
const itemFamilies={pistol:'권총',carbine:'실드 카빈',smg:'듀얼 SMG',sniper:'저격소총',rocket:'전술 로켓포',ar:'돌격소총',
  shield:'전술방패',gloves:'전술 장갑',boots:'전투화',helmet:'전투모',top:'전술 조끼',pants:'전투 바지'};
const patterns=[['보급','C',0],['기동','B',5],['개량','B',7],['경량','A',9],['강화','A',11],['정예','S',14]];
const rankedNames={
  pistol:['시작 권총','기동 권총','전술 권총','정예 권총','펄스 권총'],
  carbine:['초병','순찰대','문지기','성문','해태'],
  smg:['더블 탭','스위치','래피드','크로스파이어','쌍도깨비'],
  sniper:['척후','망루','긴그림자','월식','백호'],
  rocket:['화통','철퇴','해머헤드','공성추','이무기'],
  ar:['콜사인','릴레이','비콘','나이트링크','흑매'],
  shield:['초병 방패','순찰대 방패','문지기 방패','성문 방패','해태 방패']
};
// Keep the original C, B, A and S save IDs. S+ has its own ID and drop policy.
const rankedTiers=[
  {rank:'C',variant:0,bonus:0}, {rank:'B',variant:1,bonus:20},
  {rank:'A',variant:3,bonus:45}, {rank:'S',variant:5,bonus:75},
  {rank:'S+',variant:6,bonus:100}
];
const shieldGuard=[0,5,9,14,18];
const equipmentCatalog=Object.entries(itemFamilies).flatMap(([family,label])=>{
  if(rankedNames[family])return rankedTiers.map(({rank,variant,bonus},tier)=>({
    key:family+'-'+variant,family,label:rankedNames[family][tier],rank,tier,
    power:family==='shield'?shieldGuard[tier]:bonus,weapon:family!=='shield',
    asset:'art/armory/catalog/'+family+'/'+(rank==='S+'?'S-plus':rank)
  }));
  return patterns.map(([prefix,rank,power],variant)=>({
    key:family+'-'+variant,family,label:prefix+' '+label,rank,tier:'CBAS'.indexOf(rank),power,weapon:false
  }));
});
const gearByKey=new Map(equipmentCatalog.map(i=>[i.key,i]));
function canonicalGearKey(key){
  if(gearByKey.has(key) || typeof key!=='string')return key;
  const family=key.split('-')[0];
  if(!Object.hasOwn(rankedNames,family))return key;
  if(key===family+'-2')return family+'-1';
  if(key===family+'-4')return family+'-3';
  return key;
}
const starterKeys=['pistol-0',...Object.keys(equipmentSlots).filter(k=>k!=='weapon').map(k=>k+'-0')];
const gearImage=family=>'art/prep/'+family+'.png';
const itemImage=i=>i.asset?i.asset+'.png':gearImage(i.family);
const crateEligible=i=>i.rank!=='S+';
const defaultItem=slot=>slot==='weapon'?'pistol-0':slot+'-0';
function gearSlots(id){return Object.keys(equipmentSlots).filter(slot=>slot!=='shield'||id===0)}
function canEquip(id,slot,item){
  if(!item || !Number.isInteger(id) || id<0 || id>=weaponFamilies.length || !gearSlots(id).includes(slot))return false;
  return slot==='weapon' ? item.family==='pistol'||item.family===weaponFamilies[id] : item.family===slot;
}
function readLocal(key){try{return JSON.parse(localStorage.getItem(key))}catch{return null}}
const legacyGear=readLocal('dropzone.equipment.v1');
function restoredArmory(raw){
  const owned=new Set(starterKeys);
  if(raw && Array.isArray(raw.owned)){
    for(const saved of raw.owned){const key=canonicalGearKey(saved);if(gearByKey.has(key))owned.add(key)}
  }else if(Array.isArray(legacyGear)){
    for(const [id,row] of legacyGear.entries()){
      for(const [slot,saved] of Object.entries(row||{})){
        const key=canonicalGearKey(saved);
        if(canEquip(id,slot,gearByKey.get(key)) && !key.endsWith('-0'))owned.add(key);
      }
    }
  }
  return {diamonds:Number.isSafeInteger(raw?.diamonds)?Math.max(0,raw.diamonds):0,owned:[...owned]};
}
let armory=restoredArmory(readLocal(armoryKey)), sessionStorageOnly=false;
const owns=key=>armory.owned.includes(key);
function normalizedEquipment(data){
  return weaponFamilies.map((_,id)=>Object.fromEntries(gearSlots(id).map(slot=>{
    const key=canonicalGearKey(data?.[id]?.[slot]);
    return [slot,canEquip(id,slot,gearByKey.get(key))&&owns(key)?key:defaultItem(slot)];
  })));
}
let savedEquipment=normalizedEquipment(readLocal(equipmentKey)??legacyGear);
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
function openWeaponCrate(){
  return changeArmory(state=>{
    if(state.diamonds<boxPrice)return {message:'다이아가 부족합니다. 적을 처치해 모으세요.'};
    const fresh=equipmentCatalog.filter(i=>crateEligible(i) && !state.owned.includes(i.key));
    const weapons=fresh.filter(i=>i.weapon),armor=fresh.filter(i=>!i.weapon);
    if(!weapons.length)return {message:'소환 가능한 무기를 모두 수집했습니다.'};
    const choose=list=>list[Math.floor(Math.random()*list.length)];
    const drops=[choose(weapons)];if(armor.length)drops.push(choose(armor));
    state.diamonds-=boxPrice;state.owned.push(...drops.map(i=>i.key));return {drops};
  });
}
function gearStats(id){
  const row=savedEquipment[id], power=slot=>gearByKey.get(row[slot])?.power||0;
  return {interval:1/(1+power('gloves')/100),movement:1+power('boots')/100,
    health:power('helmet')+power('pants'),protection:power('top')/100,guard:power('shield')/100};
}
function gearEffect(slot,item){
  if(item.weapon)return '기본 피해 '+equipmentDamage(item);
  const effects={gloves:'공격 속도',boots:'이동 속도',helmet:'체력',top:'피해 감소',pants:'체력',shield:'전방 방어'};
  return effects[slot]+' +'+item.power+(['helmet','pants'].includes(slot)?'':'%');
}
function itemOwner(item){
  if(item.family==='shield')return '벌크 전용';
  const id=weaponFamilies.indexOf(item.family);
  return id<0?'모든 대원 공용':names[id]+' 전용';
}
addEventListener('storage',event=>{
  if(event.key===armoryKey){armory=restoredArmory(readLocal(armoryKey));updateDiamondDisplay();if(!$('prep-screen').hidden)paintInventory()}
  if(event.key===equipmentKey)savedEquipment=normalizedEquipment(readLocal(equipmentKey));
});
