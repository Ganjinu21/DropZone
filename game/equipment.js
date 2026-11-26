'use strict';

// This portrait development branch starts in the test profile. Normal progress keeps its original save keys.
const developerPreference='dropzone.developer-mode';
const developerMode=readLocal(developerPreference)!==false;
const equipmentKey=developerMode?'dropzone.dev.equipment.v2':'dropzone.equipment.v2';
const armoryKey=developerMode?'dropzone.dev.armory.v1':'dropzone.armory.v1';
const boxPrice=SupplyRules.price;
const equipmentSlots={weapon:'무기',gloves:'장갑',boots:'신발',helmet:'헬멧',top:'상의',pants:'하의',shield:'전술방패'};
const weaponFamilies=['pistol','smg','sniper','rocket','ar'];
const itemFamilies={pistol:'권총',smg:'듀얼 SMG',sniper:'저격소총',rocket:'전술 로켓포',ar:'돌격소총',
  shield:'전술방패',gloves:'전술 장갑',boots:'전투화',helmet:'전투모',top:'전술 조끼',pants:'전투 바지'};
const armorStats={
  helmet:{effect:'치명타 확률',values:[3,6,10,15,22],unit:'%',sign:'+'},
  gloves:{effect:'재장전 속도',values:[5,10,16,24,35],unit:'%',sign:'+'},
  top:{effect:'최대 체력',values:[8,16,28,45,65],unit:'',sign:'+'},
  pants:{effect:'회피 확률',values:[2,4,7,10,15],unit:'%',sign:'+'},
  boots:{effect:'이동 속도',values:[3,6,10,15,22],unit:'%',sign:'+'}
};
const rankedNames={
  pistol:['시작 권총','기동 권총','전술 권총','정예 권총','펄스 권총'],
  smg:['더블 탭','스위치','래피드','크로스파이어','쌍도깨비'],
  sniper:['척후','망루','긴그림자','월식','백호'],
  rocket:['화통','철퇴','해머헤드','공성추','이무기'],
  ar:['콜사인','릴레이','비콘','나이트링크','흑매'],
  shield:['초병 방패','순찰대 방패','문지기 방패','성문 방패','해태 방패'],
  helmet:['캔버스 캡','야전 강철모','돌입 방탄 헬멧','중장 방탄 헬멧','펄스 4구 야투경'],
  gloves:['반장갑','야전 가죽 장갑','돌입 너클 장갑','야간 강습 장갑','코어 건틀릿'],
  top:['민간 누빔 조끼','야전 탄입 조끼','돌입 플레이트 캐리어','야간 강습 흉갑','리액터 흉갑'],
  pants:['작업 바지','야전 카고 바지','돌입 전술 바지','야간 강습 바지','서보 전투 바지'],
  boots:['캔버스 운동화','야전 부츠','돌입 전투화','야간 강습 전투화','자력 기동화']
};
// Keep the original C, B, A and S save IDs. S+ has its own ID and drop policy.
const rankedTiers=[
  {rank:'C',variant:0,bonus:0,itemLevel:10}, {rank:'B',variant:1,bonus:60,itemLevel:20},
  {rank:'A',variant:3,bonus:150,itemLevel:30}, {rank:'S',variant:5,bonus:450,itemLevel:40},
  {rank:'S+',variant:6,bonus:1100,itemLevel:50}
];
const shieldGuard=[0,5,9,14,18];
const equipmentCatalog=Object.keys(itemFamilies).flatMap(family=>
  rankedTiers.map(({rank,variant,bonus,itemLevel},tier)=>{
    const weapon=weaponFamilies.includes(family);
    const power=weapon?bonus:family==='shield'?shieldGuard[tier]:armorStats[family].values[tier];
    return {key:family+'-'+variant,family,label:rankedNames[family][tier],rank,tier,power,weapon,itemLevel,
      asset:'art/armory/catalog/'+family+'/'+(rank==='S+'?'S-plus':rank)};
  })
);
const gearByKey=new Map(equipmentCatalog.map(i=>[i.key,i]));
const weaponMagazines={
  pistol:  {rounds:[10,12,14,16,18],seconds:[1.35,1.30,1.25,1.20,1.10]},
  smg:     {rounds:[24,28,32,40,48],seconds:[2.10,2.00,1.85,1.70,1.55]},
  sniper:  {rounds:[4,5,5,6,7],seconds:[2.60,2.50,2.35,2.20,2.00]},
  rocket:  {rounds:[1,1,2,2,3],seconds:[3.00,2.80,2.70,2.50,2.30]},
  ar:      {rounds:[20,24,28,30,36],seconds:[1.85,1.75,1.65,1.55,1.45]}
};
function enhancementLimit(item){
  if(item?.rank==='S')return 3;
  return item?.weapon && ['B','A'].includes(item.rank)?5:0;
}
const canEnhance=item=>enhancementLimit(item)>0;
const levelKey=(base,level)=>level?base+'@'+level:base;
const gradeLabel=i=>i.level?i.rank+'+'+i.level:i.rank;
for(const item of equipmentCatalog){
  item.artKey=item.key;
  item.level=0;
  if(item.weapon){
    const magazine=weaponMagazines[item.family];
    item.capacity=magazine.rounds[item.tier];
    item.reload=magazine.seconds[item.tier];
  }
  const limit=enhancementLimit(item);
  // Previously saved S +4 and +5 weapons remain usable at their original power.
  const lastLevel=item.weapon && item.rank==='S'?5:limit;
  for(let level=1;level<=lastLevel;level++){
    const key=levelKey(item.key,level);
    const bonus=item.weapon?level*({B:15,A:35,S:80}[item.rank]):
      Math.round(level*((item.family==='shield'?shieldGuard:armorStats[item.family].values)[item.tier+1]-item.power)/(limit+1));
    gearByKey.set(key,{...item,key,level,itemLevel:item.itemLevel+level,power:item.power+bonus});
  }
}
function fusionRecipe(item){
  const limit=enhancementLimit(item);
  if(!limit)return null;
  const promote=item.level>=limit;
  const material=item.key;
  const output=promote?item.family+'-'+rankedTiers[item.tier+1].variant:levelKey(item.artKey,item.level+1);
  return {material,output};
}
function canonicalGearKey(key){
  if(typeof key!=='string' || gearByKey.has(key))return key;
  // Carbines used Bulk's weapon slot in earlier saves. Preserve rank, fusion level and copies.
  return key.replace(/^carbine-/,'pistol-').replace(/-2(?=@|$)/,'-1').replace(/-4(?=@|$)/,'-3');
}
const starterKeys=equipmentCatalog.filter(item=>item.tier===0).map(item=>item.key);
const itemImage=i=>i.asset+'.png';
function inventoryImage(item){
  return item.asset+'.webp';
}
const defaultItem=(id,slot)=>(slot==='weapon'?weaponFamilies[id]:slot)+'-0';
function gearSlots(id){return Object.keys(equipmentSlots).filter(slot=>slot!=='shield'||id===0)}
function canEquip(id,slot,item){
  if(!item || !Number.isInteger(id) || id<0 || id>=weaponFamilies.length || !gearSlots(id).includes(slot))return false;
  return slot==='weapon' ? item.family===weaponFamilies[id] : item.family===slot;
}
function readLocal(key){try{return JSON.parse(localStorage.getItem(key))}catch{return null}}
const legacyGear=developerMode?null:readLocal('dropzone.equipment.v1');
const safeCount=n=>Number.isSafeInteger(n)&&n>0?n:0;
function restoredSupply(raw){
  const oldCount=safeCount(raw?.boxes);
  const oldRemaining=Math.max(1,SupplyRules.interval-safeCount(raw?.sinceA));
  const supplyCounts={},legacyGuaranteedAt={};
  for(const kind of ['weapon','gear']){
    const migrated=Object.hasOwn(raw?.supplyCounts??{},kind);
    const count=migrated?safeCount(raw.supplyCounts[kind]):oldCount;
    supplyCounts[kind]=count;
    // A combined box used to award both items. Honor an earlier pending pity once per pool.
    const due=migrated?safeCount(raw.legacyGuaranteedAt?.[kind]):oldCount+oldRemaining;
    if(Number.isSafeInteger(due) && due>count && due-count<SupplyRules.progress(count).remainingToA){
      legacyGuaranteedAt[kind]=due;
    }
  }
  return {supplyCounts,legacyGuaranteedAt};
}
function restoredBossClaims(raw){
  const claims={};
  // One bit per stage. Receipts survive checkpoint retries and concurrent launches.
  if(raw && typeof raw==='object'){
    for(const [key,mask] of Object.entries(raw)){
      if(key.startsWith('run:') && key.length>4 && key.length<=164 && Number.isInteger(mask) && mask>0 && mask<2**stages.length)claims[key]=mask;
    }
  }
  return claims;
}
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
  // Earlier developer saves treated the whole catalog as owned. Honor equipped S+ pieces.
  if(developerMode && !raw?.crewTiers){
    const rows=readLocal(equipmentKey)??readLocal('dropzone.equipment.v2');
    if(Array.isArray(rows))for(const row of rows)for(const key of Object.values(row||{})){
      if(gearByKey.get(key)?.rank==='S+')counts[key]=Math.max(1,counts[key]||0);
    }
  }
  for(const key of starterKeys)counts[key]=Math.max(1,counts[key]||0);
  const bossTokens=developerMode && !Object.hasOwn(raw??{},'bossTokens')?8:safeCount(raw?.bossTokens);
  const crewTiers=weaponFamilies.map((_,id)=>{
    const tier=raw?.crewTiers?.[id];
    return Number.isInteger(tier) && rankedTiers[tier]?tier:0;
  });
  return {crewTiers,diamonds:!raw && developerMode?3000:safeCount(raw?.diamonds),counts,...restoredSupply(raw),
    bossTokens,talentRanks:TalentTree.restoreRanks(raw?.talentRanks),bossClaims:restoredBossClaims(raw?.bossClaims)};
}
let armory=restoredArmory(readLocal(armoryKey)),sessionStorageOnly=false;
function owns(key){
  const item=gearByKey.get(key);
  return !!armory.counts[key] || !!(developerMode && item?.asset && item.rank!=='S+' && !item.level);
}
function normalizedEquipment(data){
  return weaponFamilies.map((_,id)=>Object.fromEntries(gearSlots(id).map(slot=>{
    let key=canonicalGearKey(data?.[id]?.[slot]);
    const old=gearByKey.get(key);
    if(slot==='weapon' && id!==0 && old?.family==='pistol'){
      // Former shared sidearms stay in Bulk's inventory. Use the same class-weapon rank if owned.
      const dedicated=weaponFamilies[id]+key.slice('pistol'.length);
      key=owns(dedicated)?dedicated:dedicated.split('@')[0];
    }
    const item=gearByKey.get(key);
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
    return [slot,defaultItem(id,slot)];
  })));
}
let savedEquipment=normalizedEquipment(readLocal(equipmentKey)??(developerMode?readLocal('dropzone.equipment.v2'):legacyGear));
function changeArmory(edit,{requireSave=false}={}){
  const update=()=>{
    if(!sessionStorageOnly)armory=restoredArmory(readLocal(armoryKey)??armory);
    const state=requireSave?restoredArmory(armory):armory;
    const result=edit(state);
    try{
      localStorage.setItem(armoryKey,JSON.stringify(state));
      if(requireSave)sessionStorageOnly=false;
    }catch(error){
      if(requireSave)throw error;
      sessionStorageOnly=true;
    }
    armory=state;
    updateDiamondDisplay();return result;
  };
  if(!navigator.locks)return Promise.resolve(update());
  let entered=false;
  return navigator.locks.request(armoryKey,()=>{entered=true;return update()}).catch(error=>{
    if(!entered && (error.name==='SecurityError'||error.name==='NotAllowedError'))return update();
    throw error;
  });
}
// Each of the three strongest slots can contribute at most one full step.
function crewProgress(id,row,tier=armory.crewTiers[id]){
  const equipped=gearSlots(id).map(slot=>gearByKey.get(row[slot]));
  const average=equipped.reduce((sum,item)=>sum+item.itemLevel,0)/equipped.length;
  const current=rankedTiers[tier],next=rankedTiers[tier+1];
  if(!next)return {current,next,average,fill:1,qualified:3,ready:false};
  const qualified=equipped.filter(item=>item.tier>tier).length;
  const levels=equipped.map(item=>item.itemLevel).sort((a,b)=>b-a).slice(0,3);
  const span=next.itemLevel-current.itemLevel;
  const fill=levels.reduce((sum,level)=>sum+Math.max(0,Math.min(1,(level-current.itemLevel)/span)),0)/3;
  return {current,next,average,qualified,fill,ready:qualified>=3};
}
function promoteCrew(id,expectedTier,row){
  return changeArmory(state=>{
    if(!Number.isInteger(id)||!Object.hasOwn(state.crewTiers,id)||state.crewTiers[id]!==expectedTier)return false;
    for(const slot of gearSlots(id)){
      const item=gearByKey.get(row[slot]);
      if(!item || !canEquip(id,slot,item) || !owns(item.key))return false;
    }
    if(!crewProgress(id,row,expectedTier).ready)return false;
    state.crewTiers[id]=expectedTier+1;
    return true;
  },{requireSave:true});
}
function awardDiamonds(value){
  return changeArmory(state=>{state.diamonds=Math.min(Number.MAX_SAFE_INTEGER,state.diamonds+safeCount(value))});
}
async function purchaseTalent(id,expectedRank){
  const result=await changeArmory(state=>{
    const status=TalentTree.status(id,state);
    if(!status.canBuy)return {ok:false,message:status.reason};
    if(status.rank!==expectedRank)return {ok:false,message:'연구 단계가 변경되었습니다.'};
    state[status.currency]-=status.cost;
    state.talentRanks[id]=status.rank+1;
    return {ok:true,message:TalentTree.byId.get(id).name+' '+(status.rank+1)+'단계 연구 완료'};
  });
  dispatchEvent(new Event('talents-changed'));
  return result;
}
async function claimBossToken(runId,stage){
  if(typeof runId!=='string' || !runId.length || runId.length>160 ||
     !Number.isInteger(stage) || stage<1 || stage>stages.length)return {awarded:false};
  const result=await changeArmory(state=>{
    const key='run:'+runId,bit=1<<(stage-1),previous=state.bossClaims[key]||0;
    if(previous&bit)return {awarded:false};
    state.bossClaims[key]=previous|bit;
    state.bossTokens=Math.min(Number.MAX_SAFE_INTEGER,state.bossTokens+1);
    state.diamonds=Math.min(Number.MAX_SAFE_INTEGER,state.diamonds+5);
    return {awarded:true};
  });
  if(result.awarded)dispatchEvent(new Event('talents-changed'));
  return result;
}
function crateProgress(kind,state=armory){
  const info=SupplyRules.progress(state.supplyCounts[kind]);
  const early=state.legacyGuaranteedAt?.[kind];
  if(early>info.count)info.remainingToA=Math.min(info.remainingToA,early-info.count);
  return info;
}
function openSupplyCrate(kind){
  return changeArmory(state=>{
    if(kind!=='weapon' && kind!=='gear')return {message:'보급상자 종류를 확인해 주세요.'};
    if(state.diamonds<boxPrice)return {message:'다이아가 부족합니다. 적을 처치해 모으세요.'};
    const {count,level,remainingToA}=crateProgress(kind,state);
    if(count===Number.MAX_SAFE_INTEGER)return {message:'보급상자 개봉 횟수가 한도에 도달했습니다.'};
    const guaranteed=remainingToA===1;
    const rank=guaranteed?'A':SupplyRules.rankForRoll(level,Math.random());
    const pool=equipmentCatalog.filter(item=>item.weapon===(kind==='weapon') && item.rank===rank);
    const item=pool[Math.floor(Math.random()*pool.length)];
    const owned=state.counts[item.key]||0;
    if(owned===Number.MAX_SAFE_INTEGER)return {message:'해당 아이템의 보유 수량이 한도에 도달했습니다.'};
    state.diamonds-=boxPrice;
    state.supplyCounts[kind]=count+1;
    state.counts[item.key]=owned+1;
    if(guaranteed)delete state.legacyGuaranteedAt[kind];
    return {drops:[item],guaranteed,level};
  });
}
function readyToFuse(state,item,recipe){
  if(!recipe)return false;
  return (state.counts[item.key]||0)>=2;
}
function fuseGear(key){
  return changeArmory(state=>{
    const item=gearByKey.get(key),recipe=fusionRecipe(item);
    if(!readyToFuse(state,item,recipe))return null;
    state.counts[key]-=2;
    state.counts[recipe.output]=(state.counts[recipe.output]||0)+1;
    return {item:gearByKey.get(recipe.output),consumed:state.counts[key]?[]:[key]};
  });
}
function gearStats(id,loadout=savedEquipment){
  const row=loadout[id], power=slot=>gearByKey.get(row[slot])?.power||0;
  return {movement:1+power('boots')/100,reload:1/(1+power('gloves')/100),health:power('top'),
    evadeChance:power('pants')/100,critChance:power('helmet')/100,guard:power('shield')/100};
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
    dispatchEvent(new Event('talents-changed'));
    if(mode==='home' && lobbyReady)refreshContinueMenu();
    if(draftEquipment){
      draftEquipment=normalizedEquipment(draftEquipment);
      if(!$('prep-screen').hidden)paintPrep();
      if(!$('roster-screen').hidden)updateSquadSelection();
    }
  }
  if(event.key===equipmentKey)savedEquipment=normalizedEquipment(readLocal(equipmentKey));
});
