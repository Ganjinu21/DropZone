'use strict';

const squadStorageKey=developerMode?'dropzone.dev.squad.v1':'dropzone.squad.v1';
const squadLimit=formationSlots.length;
let detailKey=null;
let savedSquad=[],draftSquad=[],pickerSquad=[],draftEquipment,editId=0,editSlot='weapon';
function validSquad(ids) {
  return Array.isArray(ids) && ids.length===squadLimit && new Set(ids).size===squadLimit &&
    ids.every(id=>Number.isInteger(id) && id>=0 && id<names.length);
}
try {
  const ids=readLocal(squadStorageKey)??(developerMode?readLocal('dropzone.squad.v1'):null);
  if(validSquad(ids))savedSquad=ids;
} catch {}
function getSelectedSquad(){return validSquad(savedSquad)?savedSquad.slice():[0,1,2]}
let lobbyReady=false;
function chooseStartStage(number) {
  if (!Number.isInteger(number) || number < 1 || number > stages.length) return;
  selectedStartStage = number;
  Battlefield.prepare(number);
  $('mission-location').textContent=stages[number-1].name;
  const rules = stages[number - 1];
  $('stage-preview-art').src = 'art/stages/stage-' + number + '.webp';
  $('stage-preview-name').textContent = rules.name;
  $('stage-brief').textContent = (seoulLayouts[number-1].axis?'특별 작전 · ':'')+'약 6분 · 웨이브 ' + rules.waves.length + ' · 보스 ' + rules.bossName;
  $('stage-label').textContent = '스테이지 ' + number;
  $('stage-label').setAttribute('aria-label', '스테이지 ' + number + ', ' + rules.name);
  $('stage-prev').disabled = number === 1;
  $('stage-next').disabled = number === stages.length;
  if(lobbyReady)refreshContinueMenu();
}

$('stage-prev').onclick = () => chooseStartStage(selectedStartStage - 1);
$('stage-next').onclick = () => chooseStartStage(selectedStartStage + 1);
document.querySelector('.stage-switch').addEventListener('keydown', event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  chooseStartStage(selectedStartStage + (event.key === 'ArrowLeft' ? -1 : 1));
  $('stage-label').focus({preventScroll: true});
});

function setLobbyReady(){
  lobbyReady=true;chooseStartStage(developerMode?1:highestPlayableStage());
  readBattleCheckpoint();refreshContinueMenu();$('select-team').disabled=false;$('shop').disabled=false;updateDiamondDisplay();
}
const prepRoles=roles;
const crewLabel=id=>id===4?'CCT-공중통제사':names[id]+' - '+roles[id];
function slotButton(slot){
  const item=gearByKey.get(draftEquipment[editId][slot]);
  return '<button type="button" class="gear-slot" data-slot="'+slot+'" aria-pressed="'+(slot===editSlot)+'" aria-label="'+equipmentSlots[slot]+', '+item.label+', 아이템 레벨 '+item.itemLevel+'"><img alt="" src="'+inventoryImage(item)+'"><em class="tier tier-'+item.rank+'">'+gradeLabel(item)+'</em></button>';
}
function paintInventory(){
  const rank=$('gear-rank').value, sort=$('gear-sort').value;
  const equippedItem=gearByKey.get(draftEquipment[editId][editSlot]);
  const selectedItem=gearByKey.get(detailKey);
  const list=equipmentCatalog.filter(i=>canEquip(editId,editSlot,i) && (!rank || rank===i.rank)).map(i=>{
    if(!canEnhance(i))return i;
    if(selectedItem?.artKey===i.key)return selectedItem;
    if(equippedItem.artKey===i.key)return equippedItem;
    for(let level=i.weapon && i.rank==='S'?5:enhancementLimit(i);level>0;level--){
      const key=levelKey(i.key,level);
      if(owns(key))return gearByKey.get(key);
    }
    return i;
  });
  const stat=i=>i.weapon?equipmentDamage(i):i.power;
  list.sort((a,b)=>{
    if(sort==='name')return a.label.localeCompare(b.label,'ko');
    if(sort==='ascending')return a.tier-b.tier || a.power-b.power;
    return (sort==='rank'?b.tier-a.tier:stat(b)-stat(a)) || a.label.localeCompare(b.label,'ko');
  });
  $('locker-title').textContent=equipmentSlots[editSlot];
  $('locker-owner').textContent=editSlot==='weapon'?names[editId]+' 전용 · '+itemFamilies[weaponFamilies[editId]]:editSlot==='shield'?'벌크 전용':'전 대원 공용';
  if(!list.some(i=>i.key===detailKey))detailKey=null;
  $('gear-inventory').innerHTML=list.map(i=>{
    const owned=owns(i.key),equipped=draftEquipment[editId][editSlot]===i.key;
    const status=equipped?'장착 중':owned?'보유':'미보유';
    return '<button type="button" class="gear-tile" aria-label="'+i.label+', '+i.rank+'랭크, 아이템 레벨 '+i.itemLevel+', '+status+'" aria-pressed="'+(detailKey===i.key)+'" aria-controls="gear-detail" data-owned="'+owned+'" data-equipped="'+equipped+'" data-item="'+i.key+'"><img alt="" src="'+inventoryImage(i)+'"><em class="tier tier-'+i.rank+'">'+gradeLabel(i)+'</em></button>';
  }).join('') || '<p class="empty-inventory">해당 등급의 장비가 없습니다.</p>';
  paintGearDetail();
}
let promotingCrew=false;
let promotionNoticeTimer;
function paintPromotion(panel,id){
  const tier=armory.crewTiers[id],p=crewProgress(id,draftEquipment[id],tier);
  const count=Math.min(3,p.qualified), rank=p.current.rank;
  const requirement=p.next?p.next.rank+' 이상 '+count+'/3':'최고 등급';
  const average=Number(p.average.toFixed(1));
  panel.innerHTML='<div class="promotion-line"><strong class="tier tier-'+rank+'">'+rank+' 등급</strong>'+
    '<span>평균 Lv.'+average+'</span></div><progress max="1" value="'+p.fill+'" aria-label="'+names[id]+
    ' 종합 아이템 레벨, '+requirement+'"></progress><small>'+requirement+'</small>'+
    (p.ready?'<button type="button" data-field-control="primary" data-promote="'+id+'" data-from="'+tier+
      '" aria-label="'+names[id]+' '+p.next.rank+' 등급 영구 돌파"'+(promotingCrew?' disabled':'')+'>'+p.next.rank+' 영구 돌파 ↑</button>':'');
}
function promotionNotice(message){
  clearTimeout(promotionNoticeTimer);
  $('promotion-notice').textContent=message;
  promotionNoticeTimer=setTimeout(()=>{$('promotion-notice').textContent=''},3500);
}
$('barracks-page').addEventListener('click',async event=>{
  const button=event.target.closest('[data-promote]');
  if(!button || promotingCrew)return;
  const id=Number(button.dataset.promote),tier=Number(button.dataset.from);
  const row={...draftEquipment[id]};
  promotingCrew=true;button.disabled=true;
  try{
    const promoted=await promoteCrew(id,tier,row);
    promotionNotice(promoted?names[id]+' · '+rankedTiers[tier+1].rank+' 등급 돌파 완료':'장착 장비와 현재 등급을 확인해 주세요.');
  }catch{
    promotionNotice('돌파를 저장하지 못했습니다. 다시 시도해 주세요.');
  }finally{
    promotingCrew=false;
    if(!$('prep-screen').hidden)paintPrep();
    if(!$('roster-screen').hidden)updateSquadSelection();
    syncRankTest();
  }
});
function paintPrep(){
  if(!draftSquad.includes(editId))editId=draftSquad[0];
  if(editSlot==='shield' && editId!==0)editSlot='weapon';
  const order=[editId,...draftSquad.filter(id=>id!==editId)];
  paintPromotion($('prep-promotion'),editId);
  $('crew-figures').innerHTML=order.map((id,index)=>'<button type="button" class="figure figure-'+index+'" data-inspect="'+id+'" aria-pressed="'+(index===0)+'" aria-label="'+names[id]+' 장비 편집"><canvas aria-hidden="true" width="336" height="256"></canvas><small>'+(id===draftSquad[0]?'선두 · ':'')+names[id]+'</small></button>').join('');
  $('crew-name').textContent=crewLabel(editId);
  $('make-leader').disabled=editId===draftSquad[0];$('make-leader').textContent=editId===draftSquad[0]?'출발 선두':'선두 지정';
  $('slots-left').innerHTML=(editId===0?['weapon','shield','gloves','boots']:['weapon','gloves','boots']).map(slotButton).join('');
  $('slots-right').innerHTML=['helmet','top','pants'].map(slotButton).join('');
  for(const canvas of $('crew-figures').querySelectorAll('canvas')){
    const id=Number(canvas.closest('button').dataset.inspect);
    drawCrewPreview(canvas,id,draftEquipment[id]);
  }
  paintInventory();
}
function openPreparation(){
  if(mode!=='home' || !lobbyReady)return;
  showLobbyPage(lobbyPages.indexOf($('barracks-page')), {focus:true});
}
function renderBarracksPage(){
  if(!draftEquipment){
    draftSquad=getSelectedSquad();draftEquipment=normalizedEquipment(savedEquipment);
    detailKey=null;editId=draftSquad[0];editSlot='weapon';
    $('gear-rank').value='';$('roster-screen').hidden=true;$('prep-screen').hidden=false;
  }
  if($('roster-screen').hidden)paintPrep();
  else updateSquadSelection();
}
function resetLobbyView(){
  draftEquipment=null;detailKey=null;
  $('prep-screen').hidden=true;$('roster-screen').hidden=true;
  showLobbyPage(homePageIndex, {immediate:true});
}
function closeSquadSelection(){
  for(const dialog of [$('supply-rates-dialog'),$('diamond-confirm')]){
    if(dialog.open){dialog.close();return true}
  }
  if($('replace-run').open){$('replace-run').close();return true}
  if(lobbyPageIndex>homePageIndex){showLobbyPage(lobbyPageIndex-1,{focus:true});return true}
  if(lobbyPages[lobbyPageIndex]!==$('barracks-page'))return false;
  if(!$('roster-screen').hidden){
    $('roster-screen').hidden=true;$('prep-screen').hidden=false;paintPrep();$('change-crew').focus();return true;
  }
  if($('prep-screen').hidden)return false;
  if(detailKey){closeGearDetail();return true}
  resetLobbyView();$('select-team').focus({preventScroll:true});return true;
}
function savePreparation(){
  if(mode!=='home' || !validSquad(draftSquad))return;
  savedSquad=draftSquad.slice();savedEquipment=normalizedEquipment(draftEquipment);
  try{
    localStorage.setItem(equipmentKey,JSON.stringify(savedEquipment));
    localStorage.setItem(squadStorageKey,JSON.stringify(savedSquad));
  }catch{}
  resetLobbyView();$('start').focus({preventScroll:true});
}
function updateSquadSelection(){
  const talents=TalentTree.effects(armory.talentRanks);
  for(const card of $('operator-grid').querySelectorAll('[data-pick]')){
    const id=Number(card.dataset.pick),slot=pickerSquad.indexOf(id);
    const portrait=card.querySelector('.pick-portrait img');
    const equipped=wornPortrait(id);
    paintPromotion(card.parentElement.querySelector('.promotion-panel'),id);
    if(portrait.getAttribute('src')!==equipped)portrait.src=equipped;
    const form=trainedSkillForm(gearByKey.get(draftEquipment[id].weapon),id,talents);
    const skill=form?skillDisplayName(id,form):'특수 스킬 잠금';
    card.querySelector('.pick-info > span').textContent=skill;
    const role=slot<0?'대기':slot===0?'선두':(slot+1)+'번';
    card.setAttribute('aria-pressed',String(slot>=0));card.disabled=slot<0 && pickerSquad.length>=squadLimit;
    card.querySelector('.pick-mark').textContent=role;card.setAttribute('aria-label',[names[id],prepRoles[id],role,skill].join(', '));
  }
  $('roster-count').textContent=pickerSquad.length+' / '+squadLimit;
  $('roster-help').textContent=pickerSquad.length===3?'교체할 대원을 누른 뒤 새 대원을 선택하세요.':'세 명을 선택하세요. 첫 번째 대원이 선두입니다.';
  $('squad-line').textContent=pickerSquad.map(crewLabel).join('  /  ');
  $('save-team').disabled=!validSquad(pickerSquad);
}
function openSquadSelection(){
  if($('prep-screen').hidden){openPreparation();return}
  detailKey=null;pickerSquad=draftSquad.slice();$('prep-screen').hidden=true;$('roster-screen').hidden=false;
  updateSquadSelection();$('roster-back').focus();
}
function applyPicker(){
  if(!validSquad(pickerSquad))return;
  draftSquad=pickerSquad.slice();closeSquadSelection();
}
$('operator-grid').innerHTML=names.map((name,id)=>'<div class="roster-entry"><div class="promotion-panel"></div><button type="button" class="pick-operator" data-pick="'+id+'" data-operator="'+id+'"><span class="pick-portrait"><img alt="" src="'+ART['face'+id]+'"><span class="pick-mark"></span></span><span class="pick-info"><small>'+prepRoles[id]+'</small><strong>'+name+'</strong><span></span></span></button></div>').join('');
$('operator-grid').onclick=e=>{
  const btn=e.target.closest('[data-pick]');if(!btn||btn.disabled)return;
  const id=+btn.dataset.pick, index=pickerSquad.indexOf(id);
  if(index>=0)pickerSquad.splice(index,1);else if(pickerSquad.length<squadLimit)pickerSquad.push(id);
  updateSquadSelection();
};
$('prep-screen').onclick=e=>{
  const btn=e.target.closest('button');if(!btn || btn.disabled)return;
  if(btn.dataset.inspect!==undefined){editId=+btn.dataset.inspect;detailKey=null;paintPrep()}
  if(btn.dataset.slot){
    editSlot=btn.dataset.slot;detailKey=draftEquipment[editId][editSlot];
    $('gear-rank').value='';paintPrep();revealGearDetail();
  }
  if(btn.dataset.item){
    const item=gearByKey.get(btn.dataset.item);
    if(canEquip(editId,editSlot,item)){
      detailKey=item.key;paintInventory();
      $('gear-inventory').querySelector('[data-item="'+item.key+'"]').focus({preventScroll:true});
      revealGearDetail();
    }
  }
};
$('gear-rank').onchange=$('gear-sort').onchange=paintInventory;
$('make-leader').onclick=()=>{draftSquad=[editId,...draftSquad.filter(id=>id!==editId)];paintPrep()};
$('start').onclick=()=>{if(savedBattle)$('replace-run').showModal();else start()};
$('change-crew').onclick=openSquadSelection;
$('roster-back').onclick=closeSquadSelection;
$('prep-back').onclick=()=>{detailKey=null;closeSquadSelection()};
$('save-team').onclick=applyPicker;
$('prep-save').onclick=savePreparation;

let fusionBusy=false;
function paintGearDetail(){
  const item=gearByKey.get(detailKey);
  $('gear-detail').hidden=!item;
  if(!item)return;
  const current=gearByKey.get(draftEquipment[editId][editSlot]),owned=owns(item.key),same=item===current;
  const talents=TalentTree.effects(armory.talentRanks);
  const form=item.weapon?trainedSkillForm(item,editId,talents):0;
  const ability=item.weapon?(form?' · '+(form===2?'각성 스킬 ':'특수 스킬 ')+skillDisplayName(editId,form):' · 스킬트리에서 해금'):'';
  $('item-context').textContent=itemFamilies[item.family]+' · 아이템 Lv.'+item.itemLevel+' · '+itemOwner(item)+ability;
  $('item-tier').className='tier tier-'+item.rank;$('item-tier').textContent=gradeLabel(item);
  $('item-icon').src=inventoryImage(item);$('item-title').textContent=item.label;
  $('item-detail').textContent=item.weapon?'1발 피해 '+equipmentDamage(item):gearEffect(editSlot,item)+' · 전투에는 능력치만 적용';
  const perHand=item.family==='smg';
  const reload=gearStats(editId,draftEquipment).reload/(1+talents.reloadBonus);
  $('item-magazine').textContent=item.weapon?'탄창 '+(perHand?(item.capacity/2)+'발 × 2':item.capacity+'발')+' · 재장전 '+Number((item.reload*reload).toFixed(2))+'초':'';
  $('item-compare').textContent=same?'현재 장착 중':'장착 중인 '+gradeLabel(current)+' '+current.label+' · '+gearEffect(editSlot,current);
  const recipe=fusionRecipe(item);
  $('enhancement').hidden=!recipe;
  if(recipe){
    const last=item.weapon && item.rank==='S'?5:enhancementLimit(item);
    const variants=Array.from({length:last+1},(_,n)=>gearByKey.get(levelKey(item.artKey,n)))
      .filter(v=>v.level<=enhancementLimit(item) || owns(v.key));
    $('item-level').innerHTML=variants.map(v=>'<option value="'+v.key+'">'+gradeLabel(v)+' · '+(armory.counts[v.key]||0)+'개</option>').join('');
    $('item-level').value=item.key;
    const next=gearByKey.get(recipe.output);
    $('fusion-preview').textContent=gradeLabel(item)+' '+item.label+' 2개 → '+gradeLabel(next)+' '+next.label+' · '+gearEffect(editSlot,next);
    const ready=readyToFuse(armory,item,recipe);
    $('item-fuse').textContent=!ready?'재료 부족':item.level>=enhancementLimit(item)?'등급 승급':'합성 강화';
    $('item-fuse').disabled=fusionBusy || !ready;
  }
  let source = item.weapon ? '무기 보급상자에서 획득' : '장비 보급상자에서 획득';
  if (item.rank === 'S+') {
    source = '동일한 S +3 장비 2개 합성';
  } else if (item.level) {
    source = '같은 강화 단계 2개 합성';
  } else if (item.rank === 'S') {
    source = item.weapon ? '무기 보급상자 Lv.15부터 · 합성 가능' : '장비 보급상자 Lv.15부터';
  }
  $('item-action').textContent=same?'장착 중':owned?'교체하기':source;
  $('item-action').disabled=!owned || same || fusionBusy;
}
function revealGearDetail(){
  $('gear-detail').scrollIntoView({block:'nearest'});
}
function closeGearDetail(){
  const previous=detailKey;detailKey=null;paintInventory();
  $('gear-inventory').querySelector('[data-item="'+previous+'"]')?.focus({preventScroll:true});
}
$('item-close').onclick=closeGearDetail;
$('item-action').onclick=()=>{
  const item=gearByKey.get(detailKey);
  if(!item || !owns(item.key) || !canEquip(editId,editSlot,item))return;
  draftEquipment[editId][editSlot]=item.key;paintPrep();
  $('gear-inventory').querySelector('[data-item="'+item.key+'"]')?.focus({preventScroll:true});
};
$('item-level').onchange=()=>{detailKey=$('item-level').value;paintInventory();revealGearDetail()};
$('item-fuse').onclick=async()=>{
  if(fusionBusy)return;
  const input=detailKey;
  fusionBusy=true;paintGearDetail();
  try{
    const result=await fuseGear(input);
    if(!result)return;
    // Follow the last consumed copy in every saved or open loadout using that slot.
    const slot=result.item.weapon?'weapon':result.item.family;
    const follow=rows=>rows.map(row=>row && result.consumed.includes(row[slot])?{...row,[slot]:result.item.key}:row);
    const stored=readLocal(equipmentKey);
    savedEquipment=normalizedEquipment(follow(Array.isArray(stored)?stored:savedEquipment));
    if(!stored || JSON.stringify(stored)!==JSON.stringify(savedEquipment)){
      try{localStorage.setItem(equipmentKey,JSON.stringify(savedEquipment))}catch{}
    }
    if(draftEquipment)draftEquipment=normalizedEquipment(follow(draftEquipment));
    if(detailKey===input){
      detailKey=result.item.key;
      if($('gear-rank').value && $('gear-rank').value!==result.item.rank)$('gear-rank').value=result.item.rank;
    }
  }finally{
    fusionBusy=false;if(!$('prep-screen').hidden)paintPrep();
  }
};
for(const dialog of document.querySelectorAll('.armory-popup')){
  dialog.addEventListener('click',e=>{if(e.target.closest('[data-dismiss]')||e.target===dialog && (e.offsetX<0||e.offsetY<0||e.offsetX>dialog.clientWidth||e.offsetY>dialog.clientHeight))dialog.close()});
}
