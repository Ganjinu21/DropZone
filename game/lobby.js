'use strict';

const squadStorageKey=developerMode?'dropzone.dev.squad.v1':'dropzone.squad.v1';
const squadLimit=formationSlots.length;
let detailKey=null;
let savedSquad=[],draftSquad=[],pickerSquad=[],draftEquipment,editId=0,editSlot='weapon',menuReturnTarget;
function validSquad(ids) {
  return Array.isArray(ids) && ids.length===squadLimit && new Set(ids).size===squadLimit &&
    ids.every(id=>Number.isInteger(id) && id>=0 && id<names.length);
}
try {
  const ids=readLocal(squadStorageKey)??(developerMode?readLocal('dropzone.squad.v1'):null);
  if(validSquad(ids))savedSquad=ids;
} catch {}
function getSelectedSquad(){return validSquad(savedSquad)?savedSquad.slice():[0,1,2]}
function setLobbyReady(){
  $('start').textContent='플레이';$('start').disabled=false;$('select-team').disabled=false;$('shop').disabled=false;updateDiamondDisplay();
}
const prepRoles=roles;
const crewLabel=id=>id===4?'CCT-공중통제사':names[id]+' - '+roles[id];
function slotButton(slot){
  const item=gearByKey.get(draftEquipment[editId][slot]);
  return '<button type="button" class="gear-slot" data-slot="'+slot+'" aria-pressed="'+(slot===editSlot)+'" aria-label="'+equipmentSlots[slot]+', '+item.label+'"><img alt="" src="'+itemImage(item)+'"><em class="tier tier-'+item.rank+'">'+gradeLabel(item)+'</em></button>';
}
function paintInventory(){
  const rank=$('gear-rank').value, sort=$('gear-sort').value;
  const equippedItem=gearByKey.get(draftEquipment[editId][editSlot]);
  const selectedItem=gearByKey.get(detailKey);
  const list=equipmentCatalog.filter(i=>canEquip(editId,editSlot,i) && (!rank || rank===i.rank)).map(i=>{
    if(!canEnhance(i))return i;
    if(selectedItem?.artKey===i.key)return selectedItem;
    if(equippedItem.artKey===i.key)return equippedItem;
    for(let level=5;level>0;level--){
      const key=levelKey(i.key,level);
      if(owns(key))return gearByKey.get(key);
    }
    return i;
  });
  const stat=i=>i.weapon?equipmentDamage(i):i.power;
  list.sort((a,b)=>{
    if(sort==='name')return a.label.localeCompare(b.label,'ko');
    if(sort==='family')return Number(a.family==='pistol')-Number(b.family==='pistol') || a.tier-b.tier || a.power-b.power;
    return (sort==='rank'?b.tier-a.tier:stat(b)-stat(a)) || a.label.localeCompare(b.label,'ko');
  });
  $('locker-title').textContent=equipmentSlots[editSlot];
  $('locker-owner').textContent=editSlot==='weapon'?names[editId]+' 전용 · 공용 권총':editSlot==='shield'?'벌크 전용':'전 대원 공용';
  if(!list.some(i=>i.key===detailKey))detailKey=null;
  let previousFamily;
  $('gear-inventory').innerHTML=list.map(i=>{
    const owned=owns(i.key),equipped=draftEquipment[editId][editSlot]===i.key;
    const heading=sort==='family' && editSlot==='weapon' && i.family!==previousFamily
      ? '<span class="gear-group">'+itemFamilies[i.family]+'</span>':'';
    previousFamily=i.family;
    const status=equipped?'장착 중':owned?'보유':'미보유';
    return heading+'<button type="button" class="gear-tile" aria-label="'+i.label+', '+i.rank+'랭크, '+status+'" aria-pressed="'+(detailKey===i.key)+'" aria-controls="gear-detail" data-owned="'+owned+'" data-equipped="'+equipped+'" data-item="'+i.key+'"><img alt="" src="'+itemImage(i)+'"><em class="tier tier-'+i.rank+'">'+gradeLabel(i)+'</em></button>';
  }).join('') || '<p class="empty-inventory">해당 등급의 장비가 없습니다.</p>';
  paintGearDetail();
}
function paintPrep(){
  if(!draftSquad.includes(editId))editId=draftSquad[0];
  if(editSlot==='shield' && editId!==0)editSlot='weapon';
  const order=[editId,...draftSquad.filter(id=>id!==editId)];
  $('crew-figures').innerHTML=order.map((id,index)=>'<button type="button" class="figure figure-'+index+'" data-inspect="'+id+'" aria-pressed="'+(index===0)+'" aria-label="'+names[id]+' 장비 편집"><canvas aria-hidden="true" width="168" height="128"></canvas><small>'+(id===draftSquad[0]?'선두 · ':'')+names[id]+'</small></button>').join('');
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
  if(mode!=='home' || $('start').disabled)return;
  menuReturnTarget=document.activeElement===$('select-team')?$('select-team'):$('start');
  draftSquad=validSquad(savedSquad)?savedSquad.slice():[0,1,2];
  draftEquipment=normalizedEquipment(savedEquipment);detailKey=null;editId=draftSquad[0];editSlot='weapon';
  $('gear-rank').value='';$('main-menu').hidden=true;$('roster-screen').hidden=true;$('prep-screen').hidden=false;
  paintPrep();$('prep-back').focus({preventScroll:true});
}
function resetLobbyView(){
  $('prep-screen').hidden=true;$('roster-screen').hidden=true;$('main-menu').hidden=false;
}
function closeSquadSelection(){
  if($('crate-popup').open){$('crate-popup').close();return true}
  if(!$('roster-screen').hidden){
    $('roster-screen').hidden=true;$('prep-screen').hidden=false;paintPrep();$('change-crew').focus();return true;
  }
  if($('prep-screen').hidden)return false;
  if(detailKey){closeGearDetail();return true}
  resetLobbyView();menuReturnTarget?.focus({preventScroll:true});return true;
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
  for(const card of $('operator-grid').querySelectorAll('[data-pick]')){
    const id=Number(card.dataset.pick),slot=pickerSquad.indexOf(id);
    const role=slot<0?'대기':slot===0?'선두':(slot+1)+'번';
    card.setAttribute('aria-pressed',String(slot>=0));card.disabled=slot<0 && pickerSquad.length>=squadLimit;
    card.querySelector('.pick-mark').textContent=role;card.setAttribute('aria-label',names[id]+', '+prepRoles[id]+', '+role);
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
$('operator-grid').innerHTML=names.map((name,id)=>'<button type="button" class="pick-operator" data-pick="'+id+'" data-operator="'+id+'"><span class="pick-portrait"><img alt="" src="'+ART['face'+id]+'"><span class="pick-mark"></span></span><span class="pick-info"><small>'+prepRoles[id]+'</small><strong>'+name+'</strong><span>'+squadSkillDefs[id].name+'</span></span></button>').join('');
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
$('start').onclick=start;
$('select-team').onclick=openPreparation;$('change-crew').onclick=openSquadSelection;
$('roster-back').onclick=closeSquadSelection;
$('prep-back').onclick=()=>{detailKey=null;closeSquadSelection()};
$('save-team').onclick=applyPicker;
$('prep-save').onclick=savePreparation;

function updateDiamondDisplay(){
  for(const el of document.querySelectorAll('[data-balance]'))el.textContent=armory.diamonds;
  $('crate-open').textContent='다이아 '+boxPrice+'개로 개봉';
  $('crate-open').disabled=crateBusy || armory.diamonds<boxPrice;
  $('profile-mode').disabled=crateBusy;
  $('profile-mode').setAttribute('aria-pressed',String(developerMode));
  $('profile-mode').setAttribute('aria-label',developerMode?'일반 진행으로 전환':'개발자 모드로 전환');
  $('profile-mode').textContent=developerMode?'개발자 모드 · 전체 장비 해금':'일반 모드 · 개발자 모드로 전환';
  const n=armory.boxes;
  const milestone=n<firstBBox?'첫 B 보장까지 '+(firstBBox-n):n<firstABox?'첫 A 보장까지 '+(firstABox-n):'다음 A 보장까지 '+(repeatABoxes-armory.sinceA);
  $('crate-progress').textContent='누적 '+n+'상자 · '+milestone+'상자';
}
let crateBusy=false,fusionBusy=false;
function paintGearDetail(){
  const item=gearByKey.get(detailKey);
  $('gear-detail').hidden=!item;
  if(!item)return;
  const current=gearByKey.get(draftEquipment[editId][editSlot]),owned=owns(item.key),same=item===current;
  $('item-context').textContent=itemFamilies[item.family]+' · '+itemOwner(item);
  $('item-tier').className='tier tier-'+item.rank;$('item-tier').textContent=gradeLabel(item);
  $('item-icon').src=itemImage(item);$('item-title').textContent=item.label;
  $('item-detail').textContent=item.family==='pistol'
    ? '1발 피해  '+equipmentDamage(item)+' (선두) · '+equipmentDamage(item,sidearm)+' (후열)'
    : item.weapon?'1발 피해  '+equipmentDamage(item):gearEffect(editSlot,item);
  const perHand=item.family==='smg';
  const reload=gearStats(editId,draftEquipment).reload;
  $('item-magazine').textContent=item.weapon?'탄창 '+(perHand?(item.capacity/2)+'발 × 2':item.capacity+'발')+' · 재장전 '+Number((item.reload*reload).toFixed(2))+'초':'';
  $('item-compare').textContent=same?'현재 장착 중':'장착 중인 '+gradeLabel(current)+' '+current.label+' · '+gearEffect(editSlot,current);
  const recipe=fusionRecipe(item);
  $('enhancement').hidden=!recipe;
  if(recipe){
    const variants=Array.from({length:6},(_,n)=>gearByKey.get(levelKey(item.artKey,n)));
    $('item-level').innerHTML=variants.map(v=>'<option value="'+v.key+'">'+gradeLabel(v)+' · '+(armory.counts[v.key]||0)+'개</option>').join('');
    $('item-level').value=item.key;
    const next=gearByKey.get(recipe.output),material=gearByKey.get(recipe.material);
    $('fusion-preview').textContent=gradeLabel(item)+' + '+gradeLabel(material)+' → '+gradeLabel(next)+' '+next.label+' · 피해 '+equipmentDamage(item)+' → '+equipmentDamage(next);
    const ready=readyToFuse(armory,item,recipe);
    $('item-fuse').textContent=!ready?'재료 부족':item.level===5?'등급 승급':'합성 강화';
    $('item-fuse').disabled=fusionBusy || !ready;
  }
  const source=!item.weapon && item.rank==='S+'?(item.family==='shield'?'유료 전용 · 미보유':'개발자 모드에서 사용 가능'):(item.level || (item.weapon && item.tier>=3))?'합성으로 획득':'특수 무기 소환에서 획득';
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
    const result=await fuseWeapon(input);
    if(!result)return;
    // If the last equipped copy was used up, follow it to the crafted weapon.
    const follow=rows=>rows.map(row=>row && result.consumed.includes(row.weapon)?{...row,weapon:result.item.key}:row);
    const stored=readLocal(equipmentKey);
    savedEquipment=normalizedEquipment(follow(Array.isArray(stored)?stored:savedEquipment));
    if(!stored || JSON.stringify(stored)!==JSON.stringify(savedEquipment)){
      try{localStorage.setItem(equipmentKey,JSON.stringify(savedEquipment))}catch{}
    }
    draftEquipment=normalizedEquipment(follow(draftEquipment));
    if(detailKey===input){
      detailKey=result.item.key;
      if($('gear-rank').value && $('gear-rank').value!==result.item.rank)$('gear-rank').value=result.item.rank;
    }
  }finally{
    fusionBusy=false;if(!$('prep-screen').hidden)paintPrep();
  }
};
$('crate-family').innerHTML=['pistol',...weaponFamilies].map(f=>'<option value="'+f+'">'+itemFamilies[f]+'</option>').join('');
$('profile-mode').onclick=()=>{
  if(crateBusy)return;
  try{localStorage.setItem(developerPreference,JSON.stringify(!developerMode));location.reload()}
  catch{$('crate-result').textContent='프로필을 저장할 수 없습니다.'}
};
for(const dialog of document.querySelectorAll('.armory-popup')){
  dialog.addEventListener('click',e=>{if(e.target.closest('[data-dismiss]')||e.target===dialog && (e.offsetX<0||e.offsetY<0||e.offsetX>dialog.clientWidth||e.offsetY>dialog.clientHeight))dialog.close()});
}
$('shop').onclick=()=>{
  $('crate-family').value=weaponFamilies[getSelectedSquad()[0]];
  $('crate-result').textContent=armory.diamonds<boxPrice?'필요한 다이아 '+(boxPrice-armory.diamonds)+'개':'';
  updateDiamondDisplay();$('crate-popup').showModal();
};
$('crate-open').onclick=async()=>{
  if(crateBusy)return;
  crateBusy=true;updateDiamondDisplay();
  try {
    const result=await openWeaponCrate($('crate-family').value);
    if(result.drops)$('crate-result').innerHTML=result.drops.map(i=>'<div><img alt="" src="'+itemImage(i)+'"><span><b>'+i.rank+' · '+i.label+'</b><small>'+itemOwner(i)+'</small></span></div>').join('');
    else $('crate-result').textContent=result.message;
  }finally{crateBusy=false;updateDiamondDisplay()}
};
