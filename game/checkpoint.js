'use strict';

const checkpointKey=developerMode?'dropzone.dev.run.v1':'dropzone.run.v1';
const activeCheckpointKey=checkpointKey+'.active';
const checkpointSlot=id=>checkpointKey+'.save.'+id;
let savedBattle=null,lastCheckpointTime=-Infinity,lastCheckpointKills=-1;
let observedOwner=null,writer=null,writingRun=null,retiredRun=null,memoryCheckpoint=false;

// The same enemy can be a boss, an aim target and a previously hit projectile
// target. Keep shared references and Sets intact when crossing JSON storage.
function encodeBattle(){
  const references=new Map(),nodes=[];
  function encode(value){
    if(typeof value==='number' && !Number.isFinite(value))return {infinity:Math.sign(value)};
    if(value===null || typeof value!=='object')return value;
    if(!references.has(value)){
      const index=nodes.length;
      references.set(value,index);nodes.push(null);
      if(value instanceof Set)nodes[index]={set:Array.from(value,encode)};
      else if(Array.isArray(value))nodes[index]=value.map(encode);
      else nodes[index]=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]));
    }
    return {ref:references.get(value)};
  }
  const root=encode(run);
  return JSON.stringify({version:2,root,nodes,phase:mode==='upgrade'?'upgrade':'play',
    choices:mode==='upgrade'?offers:[],choice:mode==='upgrade'?selected:0});
}

function decodeBattle(text){
  const data=JSON.parse(text);
  if(![1,2].includes(data.version) || !Array.isArray(data.nodes) || !['play','upgrade'].includes(data.phase))throw Error('작전 형식');
  const objects=data.nodes.map(n=>Array.isArray(n)?[]:Array.isArray(n.set)?new Set():{});
  function decode(value){
    if(value===null || typeof value!=='object')return value;
    if(value.infinity===1 || value.infinity===-1)return value.infinity*Infinity;
    if(!Number.isInteger(value.ref) || !objects[value.ref])throw Error('작전 참조');
    return objects[value.ref];
  }
  data.nodes.forEach((node,i)=>{
    const obj=objects[i];
    if(obj instanceof Set){for(const item of node.set)obj.add(decode(item))}
    else if(Array.isArray(obj)){for(const item of node)obj.push(decode(item))}
    else for(const [k,v] of Object.entries(node)){
      if(k==='__proto__')throw Error('작전 속성');
      obj[k]=decode(v);
    }
  });
  const state=decode(data.root);
  if(!validSquad(state.lineup) || !state.lineup.includes(state.lead) || state.squad.length!==names.length ||
     !state.squad.every((m,id)=>m.id===id && Number.isFinite(m.hp) && m.max>0 && m.gear &&
       canEquip(id,'weapon',gearByKey.get(m.loadout.weapon))) || state.squad[state.lead].hp<=0 ||
     !Number.isFinite(state.t) || !Array.isArray(state.up) || state.up.length!==magnet+1 ||
     !['surface','metro'].includes(state.floor) || !stages[state.stage-1]?.waves[state.wave-1] ||
     ![state,state.floors.surface,state.floors.metro].every(f=>floorLists.every(key=>Array.isArray(f[key]))))throw Error('작전 상태');
  for(const m of state.squad)m.weapon=gearByKey.get(m.loadout.weapon);
  const skill=state.activeSkill,craft=state.cobra;
  if(skill){
    const member=state.squad[skill.id],form=weaponSkillForm(member?.weapon);
    if(!member?.deployed || member.hp<=0 || member.id!==state.lead || !form || skill.awakened && form!==2){
      state.activeSkill=null;
      if(member){member.shoot=0;member.burstIndex=0}
    }else if(data.version===1)skill.awakened=false;
  }
  if(craft){
    const chief=state.squad[4],form=weaponSkillForm(chief.weapon);
    if(!chief.deployed || !form || craft.awakened && form!==2)state.cobra=null;
    else if(data.version===1)craft.awakened=false;
  }
  if(data.phase==='upgrade'){
    if(!Array.isArray(data.choices) || data.choices.length!==3 ||
       !data.choices.every(k=>Number.isInteger(k) && k>=0 && k<=magnet) ||
       !Number.isInteger(data.choice) || data.choice<0 || data.choice>=3)throw Error('증강 상태');
    const legal=state.lineup.filter(id=>state.up[id*2]<weaponRankCap).map(id=>id*2);
    legal.push(fieldKit,vitality,magnet);
    if(state.up[firepower]<3)legal.push(firepower);
    // Keep every still-valid slot (including the selected index). Fill only
    // unavailable or repeated cards, without granting another level or reward.
    const held=new Set();
    const cards=data.choices.map(k=>{
      if(!legal.includes(k) || held.has(k))return null;
      held.add(k);return k;
    });
    const remaining=legal.filter(k=>!held.has(k));
    data.choices=cards.map(k=>k??remaining.shift());
  }
  return {state,phase:data.phase,choices:data.choices,choice:data.choice};
}

function refreshContinueMenu(){
  $('continue-run').hidden=!savedBattle;
  $('start').textContent=savedBattle?'새 작전':'플레이';
}
function persistentBattle(owner=localStorage.getItem(activeCheckpointKey)){
  // Before writer slots were introduced the root key held the entire v1 graph.
  return localStorage.getItem(owner?checkpointSlot(owner):checkpointKey);
}
function readBattleCheckpoint(){
  let owner,text;
  try{
    owner=localStorage.getItem(activeCheckpointKey);
    if(memoryCheckpoint && owner===observedOwner)return;
    text=persistentBattle(owner);
  }catch{return}
  if(writer && writer!==owner){
    retiredRun=writingRun;writingRun=null;
    try{localStorage.removeItem(checkpointSlot(writer))}catch{}
    writer=null;
  }
  observedOwner=owner;memoryCheckpoint=false;
  try{
    if(text)decodeBattle(text);
    savedBattle=text;
  }catch{savedBattle=null}
}
function retireStaleBattle(){
  retiredRun=run;
  if(writer){
    try{localStorage.removeItem(checkpointSlot(writer))}catch{}
  }
  writer=null;writingRun=null;memoryCheckpoint=false;
  readBattleCheckpoint();
  // A pause or end transition may be in progress. Let it finish before
  // returning home so its remaining UI work cannot reopen the stale battle.
  const stale=run;
  queueMicrotask(()=>{
    if(run!==stale)return;
    mode='home';show('home');
  });
  return false;
}
function saveBattleCheckpoint(){
  if(!run || !['play','pause','upgrade'].includes(mode))return;
  if(retiredRun===run)return false;
  const text=encodeBattle();
  const claim=writingRun!==run || !writer;
  const previous=observedOwner;
  savedBattle=text;lastCheckpointTime=run.t;lastCheckpointKills=run.kills;
  try{
    if(localStorage.getItem(activeCheckpointKey)!==previous)return retireStaleBattle();
    if(claim){
      // Only an explicit start/continue creates a new writer. Its data is
      // complete before the pointer is published. Old tabs only own old slots.
      const id=crypto.randomUUID?.()??[Date.now(),Math.random()].join('-');
      localStorage.setItem(checkpointSlot(id),text);
      if(localStorage.getItem(activeCheckpointKey)!==previous){
        localStorage.removeItem(checkpointSlot(id));
        return retireStaleBattle();
      }
      try{localStorage.setItem(activeCheckpointKey,id)}
      catch(error){localStorage.removeItem(checkpointSlot(id));throw error}
      writer=observedOwner=id;writingRun=run;
      if(previous)localStorage.removeItem(checkpointSlot(previous));
      // A small root marker supports menu/save-presence checks. The active
      // pointer remains authoritative if a stale end races its removal.
      localStorage.setItem(checkpointKey,id);
    }else localStorage.setItem(checkpointSlot(writer),text);
    memoryCheckpoint=false;
  }catch{
    // Unavailable browser storage or a full quota still permits local continue.
    memoryCheckpoint=true;
  }
}
function autosaveBattle(){
  if(mode==='play' && (run.t-lastCheckpointTime>=2 || run.kills!==lastCheckpointKills))saveBattleCheckpoint();
}
function clearBattleCheckpoint(){
  if(run===retiredRun)return false;
  try{
    if(localStorage.getItem(activeCheckpointKey)!==observedOwner)return retireStaleBattle();
    if(writer||observedOwner)localStorage.removeItem(checkpointSlot(writer||observedOwner));
    if(localStorage.getItem(activeCheckpointKey)===observedOwner)localStorage.removeItem(checkpointKey);
  }catch{}
  savedBattle=null;retiredRun=run;writingRun=null;writer=null;memoryCheckpoint=true;
  lastCheckpointTime=-Infinity;lastCheckpointKills=-1;
}
function resumeBattle(){
  if(mode!=='home')return;
  readBattleCheckpoint();
  if(!savedBattle){refreshContinueMenu();return}
  let saved;
  try{saved=decodeBattle(savedBattle)}catch{savedBattle=null;refreshContinueMenu();return}
  run=saved.state;
  routes[run.floor].aimAt(run.x,run.y);
  $('party').replaceChildren();last=0;startBattleAudio();
  if(saved.phase==='upgrade')openUpgrade(saved.choices,saved.choice);
  else show('play');
  updateHud();
}
$('continue-run').onclick=resumeBattle;
$('replace-confirm').onclick=()=>{$('replace-run').close();start()};
$('replace-cancel').onclick=()=>$('replace-run').close();
$('upgrade-home').onclick=()=>show('home');
addEventListener('pagehide',saveBattleCheckpoint);
addEventListener('storage',event=>{
  if(event.key!==null && event.key!==checkpointKey && event.key!==activeCheckpointKey &&
     event.key!==checkpointSlot(observedOwner))return;
  if(mode==='home'){
    readBattleCheckpoint();
    if(!$('start').disabled)refreshContinueMenu();
  }else if(['play','pause','upgrade'].includes(mode)){
    try{
      if(localStorage.getItem(activeCheckpointKey)!==observedOwner)retireStaleBattle();
    }catch{}
  }
});
