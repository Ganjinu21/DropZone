'use strict';

// The test panel borrows gear for this sortie. The armory inventory and
// saved squad preset continue to be owned by the barracks.
const rankTestPanel=$('rank-test');
const testGrades=Array(5).fill(null);
let testLead=null;
function testRow(id,original){
  const tier=developerMode?testGrades[id]:null;
  if(tier==null)return original;
  const suffix='-'+rankedTiers[tier].variant;
  const row={...original,weapon:weaponFamilies[id]+suffix};
  if(id===0)row.shield='shield'+suffix;
  return row;
}
function testLineup(base){
  if(!developerMode || testLead==null)return base;
  return [testLead,...base.filter(i=>i!==testLead)].slice(0,formationSlots.length);
}
function syncRankTest(){
  rankTestPanel.hidden=!developerMode || !lobbyReady || !['home','play','pause'].includes(mode);
  if(rankTestPanel.hidden)return;
  const dock=mode==='home'?$('hub-nav'):document.body;
  if(rankTestPanel.parentElement!==dock)dock.append(rankTestPanel);
  const battle=mode!=='home',id=battle?run.lead:testLead??getSelectedSquad()[0];
  $('test-crew').value=id;
  $('test-rank').value=(battle?run.squad[id].testTier:testGrades[id])??'';
  const tier=battle?outfitTier(run.squad[id]):testGrades[id]??armory.crewTiers[id];
  $('test-current').textContent=names[id]+' · '+rankedTiers[tier].rank;
}
function applyTestLoadout(m){
  m.testOriginal??={...m.loadout};
  const row=testRow(m.id,m.testOriginal);
  m.testTier=testGrades[m.id];m.loadout=row;m.weapon=gearByKey.get(row.weapon);m.shieldItem=row.shield;
  m.gear={...m.gear,guard:(gearByKey.get(row.shield)?.power??0)/100};
  magazineReady(m,m.weapon);
}
function chooseTestLeader(id){
  testLead=id;
  if(mode==='home'){syncRankTest();return}
  const old=run.squad[run.lead],incoming=run.squad[id];
  if(old.id===id)return;
  if(run.activeSkill)cancelSquadSkill();
  if(!incoming.deployed){
    run.lineup[run.lineup.indexOf(old.id)]=id;
    old.deployed=false;old.hp=0;delete old.downFloor;
    if(old.id===4){run.radioTeam=null;run.cobra=null}
    incoming.deployed=true;
    $('party').replaceChildren();
  }
  if(incoming.hp<=0){
    Object.assign(incoming,{hp:incoming.max,x:old.x,y:old.y,hurt:0,moving:false,reviveTime:0});
    delete incoming.downFloor;
  }
  if(testGrades[id]!=null)applyTestLoadout(incoming);
  setLeader(id);syncRankTest();
  if(mode==='pause')showLoadout();
  saveBattleCheckpoint();
}
if(developerMode){
  for(const [id,name] of names.entries())$('test-crew').add(new Option(name,id));
  for(const [i,{rank}] of rankedTiers.entries())$('test-rank').add(new Option(rank,i));
  $('test-crew').onchange=e=>chooseTestLeader(Number(e.target.value));
  $('test-rank').onchange=e=>{
    const id=Number($('test-crew').value);
    testGrades[id]=e.target.value===''?null:Number(e.target.value);
    requestRecruitUniform(id,testGrades[id]??armory.crewTiers[id]);
    if(mode!=='home'){
      applyTestLoadout(run.squad[id]);$('party').replaceChildren();updateHud();
      if(mode==='pause')showLoadout();saveBattleCheckpoint();
    }
    syncRankTest();
  };
  for(const event of ['keydown','keyup'])rankTestPanel.addEventListener(event,e=>e.stopPropagation());
}
