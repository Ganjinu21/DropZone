'use strict';

const squadSkillDefs = [
  {name:'벙커 전개', awakenedName:'미니건 메카', cooldown:15, recallCooldown:10, durability:160},
  {name:'쌍기관단총 난사', awakenedName:'삼중 난사', duration:3, cooldown:10},
  {name:'관통 사격', awakenedName:'집중 레일건', duration:2.55, cooldown:11},
  {name:'박격포 포격', awakenedName:'다연장 공성포', duration:3.65, cooldown:13},
  {name:'코브라 공중지원',awakenedName:'A-10 공중지원',duration:7,cooldown:28}
];
function weaponSkillForm(item){
  if(item?.rank==='S+')return 2;
  return item?.rank==='A' || item?.rank==='S'?1:0;
}
function skillForm(id){return weaponSkillForm(run.squad[id].weapon)}
function skillDisplayName(id,form){return form===2?squadSkillDefs[id].awakenedName:squadSkillDefs[id].name}

// Packaged as data so local desktop previews and the offline Android WebView
// can decode the same sound bank without fetching file:// URLs.
const skillAudio = {
  buffers:new Map(), loading:null,
  load(context) {
    if (this.loading) return;
    this.loading=Promise.all(Object.entries(SQUAD_SKILL_SOUNDS).map(async ([name,wav])=>{
      const bytes=Uint8Array.from(atob(wav),ch=>ch.charCodeAt(0));
      this.buffers.set(name,await context.decodeAudioData(bytes.buffer));
    })).catch(error=>console.warn('Could not decode skill audio',error));
  },
  play(id,name,volume=.45) {
    if (run.lead!==id || !sound || sound.state!=='running' || !this.buffers.has(name)) return;
    const source=sound.createBufferSource(), gain=sound.createGain();
    source.buffer=this.buffers.get(name);
    gain.gain.value=volume;
    source.connect(gain); gain.connect(sound.destination); source.start();
    source.onended=()=>{source.disconnect(); gain.disconnect()};
  }
};

function squadSkillCooldown(id) {
  if(id===1 && skillForm(id)===2){
    const pending=ravenPendingCharges();
    return pending.length<3?0:pending[0]-run.t;
  }
  return Math.max(0,(run.squad[id].skillReadyAt ?? 0)-run.t);
}

// Deadlines advance in combat time and survive pausing, tagging out and saving.
function ravenPendingCharges(){
  return (run.squad[1].burstRecharges??[]).filter(readyAt=>readyAt>run.t);
}

function deployedBunker(skill=run.activeSkill){
  return skill?.id===0 && !skill.awakened;
}

const mechStats={hp:240,duration:8,cooldown:20,spinUp:.4,interval:.095};

function squadSkillLocked() {
  return deployedBunker() || run.activeSkill?.id===3;
}

function activateSquadSkill() {
  if (mode!=='play') return false;
  const member=run.squad[run.lead], id=member.id, def=squadSkillDefs[id];
  const form=skillForm(id);
  if (member.hp<=0 || member.deployed===false || !form) return false;
  if (id===0 && deployedBunker() && run.activeSkill.hp>0) {
    cancelSquadSkill();
    return true;
  }
  if (run.activeSkill || squadSkillCooldown(id)>0) return false;
  if(id===4)return callCobra(member);
  const firstBeat=[.58,.18,.42,.82][id];
  const phase=['deploy','forward','charge','deploy'][id];
  const skill={id,awakened:form===2,phase,x:member.x,y:member.y,floor:run.floor,age:0,duration:def.duration,
    angle:run.heading,initialAngle:run.heading,beat:0,nextShot:firstBeat,lastFire:-Infinity};
  if(skill.awakened && id===2)skill.nextShot=1;
  if(skill.awakened && id===3)skill.nextShot=.60;
  if(id===0 && skill.awakened){
    skill.hp=skill.maxHp=mechStats.hp;
    skill.duration=mechStats.duration;skill.nextShot=mechStats.spinUp;
  }else if (id===0) {
    initializeRadioTeam();
    skill.hp=skill.maxHp=def.durability;
    skill.boardFrom=run.squad.map(m=>({x:m.x,y:m.y}));
    skill.radioFrom=run.radioTeam?.map(m=>({x:m.x,y:m.y}));
    for(const occupant of [...run.squad.filter(m=>m.deployed),...(run.radioTeam||[])]){
      if(occupant.hp>0){occupant.x=skill.x;occupant.y=skill.y}
    }
  }
  if (id===3) skill.plantFacing=member.flip||1;
  run.activeSkill=skill;
  if(id===1 && skill.awakened){
    const pending=ravenPendingCharges();
    pending.push((pending.at(-1)??run.t)+def.cooldown);
    member.burstRecharges=pending;
  }else if (id!==0) member.skillReadyAt=run.t+def.cooldown;
  member.burstIndex=0;
  if (squadSkillLocked()) run.squad.forEach(m=>{m.moving=false; m.moveSpeed=0});
  if (id===0 || id===2) skillAudio.play(id,'lock');
  if (id===3) skillAudio.play(id,'plant');
  updateHud();
  return true;
}

function cancelSquadSkill() {
  const skill=run.activeSkill;
  if (!skill) return;
  const member=run.squad[skill.id];
  if (skill.id===0) {
    const def=squadSkillDefs[0];
    member.skillReadyAt=run.t+(skill.awakened?mechStats.cooldown:skill.hp>0?def.recallCooldown:def.cooldown);
  }
  member.cool=Math.max(.19,member.cool);
  member.shoot=0; member.burstIndex=0;
  run.activeSkill=null;
  updateHud();
}

function hitBunker(enemy,nav,damage,isContact){
  const fort=run.activeSkill;
  if(isContact && (enemy.nextBunkerHit||0)>run.t)return;
  if(isContact)enemy.nextBunkerHit=run.t+.8;
  fort.hp=Math.max(0,fort.hp-damage);
  if(fort.hp>0)return;
  cancelSquadSkill();
  const protectedCrew=fort.awakened?[run.squad[0]]:run.squad;
  for(const m of protectedCrew)if(m.deployed && m.hp>0)m.hurt=.85;
  if(!fort.awakened)for(const m of run.radioTeam||[])if(m.hp>0)m.grace=.85;
  run.effects.push({skillFx:'blast',id:0,x:fort.x,y:fort.y,radius:98,large:true,age:0,duration:1,angle:0});
  combatCue('guard',fort.x,fort.y,.4,0,0,98);
  tone(115,.27,.08,'sawtooth',0,32);
  for(const foe of run.enemies){
    const d=dist(fort,foe);
    if(foe.hp<=0 || d>98 || !nav.clear(fort.x,fort.y,foe.x,foe.y,0))continue;
    const angle=d>.01?Math.atan2(foe.y-fort.y,foe.x-fort.x):foe.phase||0;
    const step=foe.boss?2:6;
    for(let n=0;n<9;n++){
      const dx=Math.cos(angle)*step,dy=Math.sin(angle)*step;
      if(!nav.clear(foe.x,foe.y,foe.x+dx,foe.y+dy,4))break;
      nav.slide(foe,dx,dy,4);
    }
  }
}

function skillAim(member,target,fallback) {
  return target ? Math.atan2(chestY(target)-(member.y-25),target.x-member.x) : fallback;
}

function aimDistance(a,b) {
  return Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
}

// Keep free aim and the quoted gameplay ranges in the same traversable space
// as ordinary rounds, also when the spin aims through a wall or outside a map.
function clearShotRange(member,angle,range) {
  const dx=Math.cos(angle), dy=Math.sin(angle), nav=routes[run.floor];
  const clear=step=>nav.clear(member.x,member.y,member.x+dx*step,member.y+dy*step,0);
  if (clear(range)) return range;
  let low=0,high=range;
  while (high-low>1) {
    const mid=(low+high)/2;
    if (clear(mid)) low=mid; else high=mid;
  }
  return low;
}

function skillRay(member,skill,heading,target,range,hand) {
  const barrel=skillShotSocket(member,skill,heading,hand);
  let angle=heading, contact=null;
  if (target) {
    const dx=target.x-barrel.x,dy=chestY(target)-barrel.y;
    if (dx*Math.cos(heading)+dy*Math.sin(heading)>0) angle=Math.atan2(dy,dx);
    else contact=target;
  }
  const ux=Math.cos(angle),uy=Math.sin(angle);
  const barrelReach=Math.max(0,(barrel.x-member.x)*ux+(barrel.y-(member.y-25))*uy);
  const length=Math.max(1,clearShotRange(member,angle,range)-barrelReach);
  return {x:barrel.x,y:barrel.y,tx:barrel.x+ux*length,ty:barrel.y+uy*length,angle,length,
    sourceX:member.x,sourceY:member.y,id:member.id,lead:true,contact,hit:new Set(),age:0};
}

function fireSkillBullet(member,skill,heading,target,hand) {
  const bulk=skill.id===0;
  const shot=skillRay(member,skill,heading,target,bulk?285:315,hand);
  const speed=bulk?650:860;
  const damage=Math.round((bulk && !skill.awakened?21:9)*(1+member.weapon.power/100)*weaponRunMultiplier(member.id));
  Object.assign(shot,{speed,duration:shot.length/speed,damage,awakened:skill.awakened,
    remaining:1,skillRound:bulk?'bulk':'raven'});
  run.marks.push(shot);
  run.effects.push({skillFx:bulk?'bunkerFire':'smgFire',x:shot.x,y:shot.y,angle:shot.angle,
    id:member.id,hand,awakened:skill.awakened,lead:true,age:0,duration:bulk?.115:.075});
  skillAudio.play(member.id,bulk?'cannon':hand?'smgB':'smgA',bulk?.42:.32);
}

function fireRailBeam(member,skill) {
  const range=skill.awakened?630:520;
  const target=combatTargets(member,range,true)[0]?.enemy;
  const angle=skillAim(member,target,skill.angle);
  // Aim and socket for the long rifle must agree before the instantaneous hit.
  member.flip=Math.cos(angle)<0?-1:1;
  skill.angle=angle;
  const beam=skillRay(member,skill,angle,target,range,0);
  const power=(skill.awakened?210:58)*(1+member.weapon.power/100)*weaponRunMultiplier(member.id);
  function impact(enemy,x,y){
    beam.damage=Math.round(power*(skill.awakened && enemy.boss?2:1));
    roundImpact(beam,enemy,x,y,run);
  }
  beam.remaining=Infinity;
  if (beam.contact) impact(beam.contact,beam.x,beam.y);
  for (const {enemy,enter} of rayCollisions(beam,run,run.floor,0,beam.length)) {
    impact(enemy,beam.x+Math.cos(beam.angle)*enter,beam.y+Math.sin(beam.angle)*enter);
  }
  run.mark=target ?? null;
  run.effects.push({skillFx:'railBeam',id:2,x:beam.x,y:beam.y,tx:beam.tx,ty:beam.ty,
    angle:beam.angle,awakened:skill.awakened,age:0,duration:skill.awakened?.56:.37,lead:true});
  skillAudio.play(2,'pierce',.57);
}

function fireMortar(member,target,skill,salvoIndex=0) {
  const large=!!skill;
  const siege=!!skill?.awakened;
  const angle=Math.atan2(target.y-member.y,target.x-member.x);
  member.flip=Math.cos(angle)<0?-1:1;
  member.lastShot=run.t; member.shoot=.27; member.aimAngle=angle;
  if (skill) skill.angle=angle;
  if(!large)combatAim(member,target.x,chestY(target),1);
  const barrel=large?skillShotSocket(member,skill,angle,salvoIndex):combatMuzzle(member,1,member.id===run.lead);
  const travel=Math.hypot(target.x-member.x,target.y-member.y);
  const duration=siege?clamp(.18+travel/1100,.24,.65):clamp((large?.48:.30)+travel/1000,.32,.86);
  run.effects.push({skillFx:'shellArc',id:3,lead:true,large,awakened:siege,salvoIndex,angle,age:0,duration,
    x:barrel.x,y:barrel.y,tx:target.x,ty:target.y,
    damage:Math.round((equipmentDamage(member.weapon,loadouts[3])+(large?18:0))*weaponRunMultiplier(member.id)),radius:siege?72:large?60:37});
  skillAudio.play(3,large?'thump':'lob',large?.54:.45);
}

function detonateMortar(shell,state,floor) {
  shell.detonated=true;
  state.effects.push({skillFx:'blast',id:3,x:shell.tx,y:shell.ty,radius:shell.radius,large:shell.large,
    lead:true,awakened:shell.awakened,angle:shell.angle,age:0,duration:shell.large?1.02:.79});
  for (const enemy of state.enemies) {
    if (enemy.hp<=0) continue;
    const dx=enemy.x-shell.tx, dy=enemy.y-shell.ty;
    if (Math.hypot(dx,dy)>shell.radius || !routes[floor].clear(shell.tx,shell.ty,enemy.x,enemy.y,0)) continue;
    damageEnemy(enemy,shell.damage,Math.atan2(dy,dx),state,shell.id);
  }
  if (state===run) skillAudio.play(3,shell.large?'burst':'grenade',shell.large?.49:.42);
}

const barrageTimes=[.82,1.10,1.27,1.43,1.91,2.10,2.43,2.63];

function fireSiegeRocket(member,skill){
  const slot=skill.beat%4,volley=Math.floor(skill.beat/4);
  // Hold the aim point for each four-rocket salvo so dodging enemies can leave its footprint.
  if(slot===0){
    const targets=combatTargets(member,425,false);
    if(targets.length){
      const anchor=targets[volley%targets.length].enemy;
      skill.salvoCenter={x:anchor.x,y:anchor.y};
    }else{
      const reach=clearShotRange(member,skill.initialAngle,180);
      skill.salvoCenter={x:member.x+Math.cos(skill.initialAngle)*reach,y:member.y+Math.sin(skill.initialAngle)*reach};
    }
  }
  const center=skill.salvoCenter,angle=Math.atan2(center.y-member.y,center.x-member.x);
  const side=(slot-1.5)*31,depth=(volley-1)*12;
  const x=center.x-Math.sin(angle)*side+Math.cos(angle)*depth;
  const y=center.y+Math.cos(angle)*side+Math.sin(angle)*depth;
  const aim=routes[run.floor].clear(member.x,member.y,x,y,0)?{x,y}:center;
  fireMortar(member,aim,skill,slot);
  skill.nextShot=skill.beat===11?Infinity:slot===3?.60+(volley+1)*.70:skill.nextShot+.09;
}

function fireBarrageShell(member,skill) {
  const targets=combatTargets(member,365,false);
  if (targets.length) {
    // Spread the salvo amongst nearby threats even if the nearest survives.
    const target=targets[skill.beat%Math.min(4,targets.length)].enemy;
    fireMortar(member,target,skill);
    return;
  }
  const angle=skill.initialAngle+skill.beat*Math.PI*.75;
  const reach=clearShotRange(member,angle,92+(skill.beat%3)*35);
  fireMortar(member,{x:member.x+Math.cos(angle)*reach,y:member.y+Math.sin(angle)*reach},skill);
}

function fireSkillBeat(member,skill) {
  const beat=skill.beat,hand=beat%2;
  skill.lastFire=skill.age;
  member.lastShot=run.t; member.shoot=.18;
  if (skill.id===0) {
    const heading=skill.awakened?run.heading:-Math.PI*.75+(beat%4)*Math.PI*.5;
    const candidates=combatTargets(member,285,false);
    const target=skill.awakened?candidates[0]?.enemy:candidates.find(({enemy})=>
      aimDistance(skillAim(member,enemy,heading),heading)<=Math.PI*.25)?.enemy;
    skill.angle=skillAim(member,target,heading);
    fireSkillBullet(member,skill,skill.angle,target,hand);
    skill.nextShot+=skill.awakened?mechStats.interval:.145;
  } else if (skill.id===1) {
    let heading=skill.angle;
    if (skill.phase==='spin') heading+=hand*Math.PI;
    const candidates=combatTargets(member,315,false);
    const target=candidates.find(({enemy})=>skill.phase!=='spin' ||
      aimDistance(skillAim(member,enemy,heading),heading)<.22)?.enemy;
    heading=skillAim(member,target,heading);
    if (skill.phase==='forward') skill.angle=heading;
    member.flip=Math.cos(skill.angle)<0?-1:1;
    member.shotColumn=hand?3:1;
    if (skill.phase==='spin' && hand===0) run.effects.push({skillFx:'spinEcho',id:1,lead:true,awakened:skill.awakened,
      x:member.x,y:member.y,gait:member.gait,moving:member.moving,angle:skill.angle,age:0,duration:.22});
    fireSkillBullet(member,skill,heading,target,hand);
    skill.nextShot+=skill.phase==='spin'?.07:.077;
  } else if (skill.id===2) {
    fireRailBeam(member,skill);
    skill.nextShot=skill.awakened || beat===3?Infinity:skill.nextShot+.52;
  } else if(skill.awakened){
    fireSiegeRocket(member,skill);
  } else {
    fireBarrageShell(member,skill);
    skill.nextShot=barrageTimes[beat+1]??Infinity;
  }
  skill.beat++;
}

function tickSquadSkills(dt) {
  const skill=run.activeSkill;
  if (!skill) return;
  const member=run.squad[skill.id];
  if (skill.id!==run.lead || member.hp<=0 || skill.floor!==run.floor) {cancelSquadSkill();return}
  skill.age+=dt;
  if (skill.duration!==undefined && skill.age>=skill.duration) {cancelSquadSkill();return}
  if (!squadSkillLocked()) {skill.x=member.x; skill.y=member.y}
  switch (skill.id) {
    case 0:
      skill.phase=skill.age<(skill.awakened?mechStats.spinUp:.58)?'deploy':'fire';
      if (skill.phase!=='fire') return;
      break;
    case 1:
      if (skill.age>=1.32) {
        if (skill.phase==='forward') skill.initialAngle=skill.angle;
        skill.phase='spin';
        skill.angle=skill.initialAngle+(skill.age-1.32)*TAU/0.78;
      }
      break;
    case 2: skill.phase=skill.age<(skill.awakened?1:.42)?'charge':'pierce'; break;
    case 3: skill.phase=skill.age<(skill.awakened?.60:.78)?'deploy':skill.age<(skill.awakened?2.45:3.20)?'barrage':'recover'; break;
  }
  while (skill.nextShot<=skill.age) fireSkillBeat(member,skill);
}
