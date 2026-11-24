'use strict';

const squadStorageKey='dropzone.squad.v1';
const squadLimit=formationSlots.length;
let savedSquad=[],draftSquad=[],pickerSquad=[],draftEquipment,editId=0,editSlot='weapon',menuReturnTarget;
function validSquad(ids) {
  return Array.isArray(ids) && ids.length===squadLimit && new Set(ids).size===squadLimit &&
    ids.every(id=>Number.isInteger(id) && id>=0 && id<names.length);
}
try {
  const ids=JSON.parse(localStorage.getItem(squadStorageKey));
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
  return '<button type="button" class="gear-slot" data-slot="'+slot+'" aria-pressed="'+(slot===editSlot)+'" aria-label="'+equipmentSlots[slot]+', '+item.label+'"><img alt="" src="'+itemImage(item)+'"><em class="tier tier-'+item.rank+'">'+item.rank+'</em></button>';
}
function paintInventory(){
  const rank=$('gear-rank').value, sort=$('gear-sort').value;
  const list=equipmentCatalog.filter(i=>owns(i.key) && canEquip(editId,editSlot,i) && (!rank || rank===i.rank));
  list.sort((a,b)=>{
    if(sort==='name')return a.label.localeCompare(b.label,'ko');
    return (sort==='rank'?b.tier-a.tier:b.power-a.power) || a.label.localeCompare(b.label,'ko');
  });
  $('locker-title').textContent=equipmentSlots[editSlot];
  $('locker-owner').textContent=editSlot==='weapon'?'공용 권총 · 직업 전용':editSlot==='shield'?'벌크 전용':'전 대원 공용';
  $('gear-inventory').innerHTML=list.map(i=>{
    const on=draftEquipment[editId][editSlot]===i.key;
    return '<button type="button" class="gear-tile" aria-label="'+i.label+', '+i.rank+'랭크" aria-pressed="'+on+'" data-item="'+i.key+'"><img alt="" src="'+itemImage(i)+'"><em class="tier tier-'+i.rank+'">'+i.rank+'</em></button>';
  }).join('') || '<p class="empty-inventory">이 랭크의 보유 장비가 없습니다.</p>';
}
function paintPrep(){
  if(!draftSquad.includes(editId))editId=draftSquad[0];
  if(editSlot==='shield' && editId!==0)editSlot='weapon';
  const order=[editId,...draftSquad.filter(id=>id!==editId)];
  $('crew-figures').innerHTML=order.map((id,index)=>'<button type="button" class="figure figure-'+index+'" data-inspect="'+id+'" aria-pressed="'+(index===0)+'" aria-label="'+names[id]+' 장비 편집"><canvas aria-hidden="true" width="84" height="64"></canvas><small>'+(id===draftSquad[0]?'선두 · ':'')+names[id]+'</small></button>').join('');
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
  draftEquipment=normalizedEquipment(savedEquipment);editId=draftSquad[0];editSlot='weapon';
  $('gear-rank').value='';$('main-menu').hidden=true;$('roster-screen').hidden=true;$('prep-screen').hidden=false;
  paintPrep();$('prep-back').focus({preventScroll:true});
}
function resetLobbyView(){
  $('prep-screen').hidden=true;$('roster-screen').hidden=true;$('main-menu').hidden=false;
}
function closeSquadSelection(){
  for(const id of ['gear-popup','crate-popup'])if($(id).open){$(id).close();return true}
  if(!$('roster-screen').hidden){
    $('roster-screen').hidden=true;$('prep-screen').hidden=false;paintPrep();$('change-crew').focus();return true;
  }
  if($('prep-screen').hidden)return false;
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
  pickerSquad=draftSquad.slice();$('prep-screen').hidden=true;$('roster-screen').hidden=false;
  updateSquadSelection();$('roster-back').focus();
}
function applyPicker(){
  if(!validSquad(pickerSquad))return;
  draftSquad=pickerSquad.slice();closeSquadSelection();
}
$('operator-grid').innerHTML=names.map((name,id)=>'<button type="button" class="pick-operator" data-pick="'+id+'" data-operator="'+id+'"><span class="pick-portrait"><img alt="" src="'+(id===3?'art/skills/hammer-roster.webp':ART['face'+id])+'"><span class="pick-mark"></span></span><span class="pick-info"><small>'+prepRoles[id]+'</small><strong>'+name+'</strong><span>'+squadSkillDefs[id].name+'</span></span></button>').join('');
$('operator-grid').onclick=e=>{
  const btn=e.target.closest('[data-pick]');if(!btn||btn.disabled)return;
  const id=+btn.dataset.pick, index=pickerSquad.indexOf(id);
  if(index>=0)pickerSquad.splice(index,1);else if(pickerSquad.length<squadLimit)pickerSquad.push(id);
  updateSquadSelection();
};
$('prep-screen').onclick=e=>{
  const btn=e.target.closest('button');if(!btn || btn.disabled)return;
  if(btn.dataset.inspect!==undefined){editId=+btn.dataset.inspect;paintPrep()}
  if(btn.dataset.slot){
    editSlot=btn.dataset.slot;paintPrep();
    showGearPopup(gearByKey.get(draftEquipment[editId][editSlot]),true);
  }
  if(btn.dataset.item){
    const item=gearByKey.get(btn.dataset.item);
    if(owns(item.key) && canEquip(editId,editSlot,item))showGearPopup(item,false);
  }
};
$('gear-rank').onchange=$('gear-sort').onchange=paintInventory;
$('make-leader').onclick=()=>{draftSquad=[editId,...draftSquad.filter(id=>id!==editId)];paintPrep()};
$('start').onclick=start;
$('select-team').onclick=openPreparation;$('change-crew').onclick=openSquadSelection;
$('roster-back').onclick=$('prep-back').onclick=closeSquadSelection;
$('save-team').onclick=applyPicker;
$('prep-save').onclick=savePreparation;

function updateDiamondDisplay(){
  for(const el of document.querySelectorAll('[data-balance]'))el.textContent=armory.diamonds;
  $('crate-open').disabled=crateBusy||armory.diamonds<boxPrice||equipmentCatalog.every(i=>!i.weapon||owns(i.key));
}
let crateBusy=false;
let popupKey=null,inspectEquipped=false;
function showGearPopup(item,equipped){
  popupKey=item.key;inspectEquipped=equipped;
  const current=gearByKey.get(draftEquipment[editId][editSlot]);
  $('item-context').textContent=equipmentSlots[editSlot]+'  /  '+item.rank+' 랭크';
  $('item-icon').src=itemImage(item);$('item-title').textContent=item.label;
  $('item-detail').textContent=itemOwner(item)+' · '+gearEffect(editSlot,item);
  const same=current.key===item.key;
  $('item-compare').textContent=same?'현재 장착 중':'현재 '+current.label+' · '+gearEffect(editSlot,current);
  $('item-action').textContent=equipped?'교체할 장비 보기':same?'장착 중':'이 장비로 교체';
  $('item-action').disabled=!equipped && same;
  $('gear-popup').showModal();
}
$('item-action').onclick=()=>{
  const item=gearByKey.get(popupKey);
  if(!inspectEquipped && owns(popupKey) && canEquip(editId,editSlot,item))draftEquipment[editId][editSlot]=popupKey;
  $('gear-popup').close();
  if(inspectEquipped)$('gear-rank').value='';
  paintPrep();$('gear-inventory').querySelector('button')?.focus({preventScroll:true});
};
for(const dialog of document.querySelectorAll('.armory-popup')){
  dialog.addEventListener('click',e=>{if(e.target.closest('[data-dismiss]')||e.target===dialog && (e.offsetX<0||e.offsetY<0||e.offsetX>dialog.clientWidth||e.offsetY>dialog.clientHeight))dialog.close()});
}
$('shop').onclick=()=>{
  $('crate-result').textContent=armory.diamonds<boxPrice?'소환에 필요한 다이아 '+(boxPrice-armory.diamonds)+'개':'';
  updateDiamondDisplay();$('crate-popup').showModal();
};
$('crate-open').onclick=async()=>{
  if(crateBusy)return;
  crateBusy=true;updateDiamondDisplay();
  try {
    const result=await openWeaponCrate();
    if(result.drops)$('crate-result').innerHTML=result.drops.map(i=>'<div><img alt="" src="'+itemImage(i)+'"><span><b>'+i.rank+' · '+i.label+'</b><small>'+itemOwner(i)+'</small></span></div>').join('');
    else $('crate-result').textContent=result.message;
  }finally{crateBusy=false;updateDiamondDisplay()}
};
