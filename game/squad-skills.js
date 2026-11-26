'use strict';

const ravenDuration=3, ravenWindup=.30, ravenFiringTime=ravenDuration-ravenWindup;
// The feet start to deploy as the pilot is still dropping into cover.
const bunkerPlantTime=.14, bunkerCrouchTime=.26;
const bunkerFrameEnds=[.180,.217,.255,.294,.332,.370,.412,.450,.492,.530,
  .572,.612,.651,.817,.867,.901,.930,1.070,1.210];
const bunkerBoardingAt=bunkerFrameEnds[12]+.0001; // fully assembled, leaves open
const bunkerSlamAt=bunkerFrameEnds[16];
const bunkerLampAt=bunkerFrameEnds[17];
const bunkerDeployTime=bunkerFrameEnds[18];
const squadSkillDefs = [
  {name:'벙커 전개', awakenedName:'미니건 메카', cooldown:15, recallCooldown:10, durability:160},
  {name:'쌍기관단총 난사', awakenedName:'삼중 난사', duration:ravenDuration, cooldown:10},
  {name:'관통 사격', awakenedName:'집중 레일건', duration:2.55, cooldown:11},
  {name:'박격포 포격', awakenedName:'다연장 공성포', duration:3.65, cooldown:13},
  {name:'코브라 공중지원',awakenedName:'A-10 공중지원',duration:7,cooldown:28}
];
const skillRoutes=['bulk','raven','lynx','rocket','cct'];
function trainedSkillForm(item,id,talents){
  if(!talents[skillRoutes[id]+'Skill'])return 0;
  return item?.rank==='S+' || (id===0 && talents.bulkCap)?2:1;
}
function skillForm(id,state=run){
  const weapon=state.squad[id]?.weapon;
  const trained=trainedSkillForm(weapon,id,state.talents);
  if(trained || !developerMode)return trained;
  return weapon?.rank==='S+'?2:1;
}
function skillCooldownDuration(seconds){return seconds*(1-run.talents.cooldownReduction)}
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

function bunkerPost(fort,dx,dy){
  const nav=routes[run.floor];
  for(const reach of [1,.75,.5,.25]){
    const x=fort.x+dx*reach,y=fort.y+dy*reach;
    if(nav.clear(fort.x,fort.y,x,y,4))return {x,y};
  }
  return {x:fort.x,y:fort.y};
}

function assignBunkerCover(fort){
  const crew=run.lineup.map(id=>run.squad[id]).filter(m=>m.id!==0 && m.hp>0);
  crew.sort((a,b)=>a.x-b.x || a.y-b.y);
  fort.seats={};fort.doorsteps={};fort.returnPosts={};fort.entered={};
  crew.forEach((m,i)=>{
    const side=i?1:-1;
    fort.seats[m.id]=bunkerPost(fort,side*18,-9);
    fort.doorsteps[m.id]=bunkerPost(fort,side*23,5);
    fort.returnPosts[m.id]={x:m.x,y:m.y};
    // Older checkpoints stored exterior cover positions, even with doors shut.
    if(fort.phase==='fire' || (fort.phase==='retract' && fort.foldTime>bunkerBoardingAt)){
      Object.assign(m,fort.seats[m.id]);
      fort.entered[m.id]=true;
    }
  });
  fort.radioCover=(run.radioTeam||[]).map(ally=>bunkerPost(fort,ally.side*35,-54));
}

function moveBunkerCrew(m,fort,nav,dt){
  const seat=fort.seats[m.id],door=fort.doorsteps[m.id];
  if(!seat)return;
  if(fort.phase==='retract'){
    if(fort.foldTime>bunkerBoardingAt)return;
    if(fort.entered[m.id] && dist(m,door)<2)fort.entered[m.id]=false;
    rushToCover(m,fort.entered[m.id]?door:fort.returnPosts[m.id],nav,dt);
    return;
  }
  if(dist(m,door)<2 || dist(m,seat)<2)fort.entered[m.id]=true;
  rushToCover(m,fort.entered[m.id]?seat:door,nav,dt);
}

function rushToCover(m,post,nav,dt){
  if(!post)return;
  m.speed=Math.min(280,90+dist(m,post)*8);
  nav.chase(m,post,dt);
}

const mechStats={hp:240,duration:8,cooldown:20,spinUp:.4,interval:.095};

function squadSkillLocked() {
  return deployedBunker() || run.activeSkill?.id===3;
}

function activateSquadSkill(testForm=0) {
  if (mode!=='play') return false;
  const member=run.squad[run.lead], id=member.id, def=squadSkillDefs[id];
  const preview=developerMode && (testForm===1 || testForm===2);
  const form=preview?testForm:skillForm(id);
  if (member.hp<=0 || member.deployed===false || !form) return false;
  if(preview){
    const current=run.activeSkill || (id===4 && run.cobra);
    if(current){
      if(!!current.awakened===(form===2))return false;
      if(run.activeSkill)cancelSquadSkill();
    }
  }
  if (id===0 && deployedBunker() && run.activeSkill.hp>0) {
    const fort=run.activeSkill;
    if(fort.phase==='retract')return false;
    fort.foldTime=fort.phase==='fire'?bunkerDeployTime:Math.min(fort.age,bunkerDeployTime);
    fort.phase='retract';
    member.skillReadyAt=run.t+skillCooldownDuration(def.recallCooldown);
    updateHud();
    return true;
  }
  if (run.activeSkill || (!preview && squadSkillCooldown(id)>0)) return false;
  if(id===4)return callCobra(member,form,preview);
  const firstBeat=[bunkerDeployTime,ravenWindup,.42,.82][id];
  const phase=['deploy','spin','charge','deploy'][id];
  const skill={id,awakened:form===2,phase,x:member.x,y:member.y,floor:run.floor,age:0,duration:def.duration,
    angle:run.heading,initialAngle:run.heading,beat:0,nextShot:firstBeat,lastFire:-Infinity};
  if(preview)skill.testSpecial=true;
  if(id===1)Object.assign(skill,{poseCel:60,angle:-1.05,initialAngle:-Math.PI/2,
    sprayTick:0,sprayDirections:[],burstDirections:[]});
  if(skill.awakened && id===2)skill.nextShot=1;
  if(skill.awakened && id===3)skill.nextShot=.60;
  if(id===0 && skill.awakened){
    skill.hp=skill.maxHp=Math.round(mechStats.hp*(run.talents.bulkCap?1.25:1));
    skill.duration=mechStats.duration;skill.nextShot=mechStats.spinUp;
  }else if (id===0) {
    initializeRadioTeam();
    skill.hp=skill.maxHp=def.durability;
    const age=run.t-(member.lastShot??-Infinity);
    skill.entryRecruitCel=(age<.20 || (member.moving && member.aimTarget?.hp>0))
      ?recruitAimCel(member):member.moving?recruitWalkCel(member):null;
    skill.plantFacing=member.flip||1;
    assignBunkerCover(skill);
  }
  if (id===3) skill.plantFacing=member.flip||1;
  run.activeSkill=skill;
  const cooldown=skillCooldownDuration(def.cooldown-(id===1 && run.talents.ravenCap?1:0));
  if(id===1 && skill.awakened){
    const pending=ravenPendingCharges();
    if(pending.length<3)pending.push((pending.at(-1)??run.t)+cooldown);
    member.burstRecharges=pending;
  }else if (id!==0) member.skillReadyAt=run.t+cooldown;
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
  if (skill.id===0 && (skill.phase!=='retract' || skill.hp<=0)) {
    const def=squadSkillDefs[0];
    member.skillReadyAt=run.t+skillCooldownDuration(skill.awakened?mechStats.cooldown:skill.hp>0?def.recallCooldown:def.cooldown);
  }
  member.cool=Math.max(.19,member.cool);
  member.shoot=0; member.burstIndex=0;
  if(deployedBunker(skill))for(const m of run.squad){
    if(m.id!==0 && m.deployed && m.hp>0)m.leavingCover=true;
  }
  run.activeSkill=null;
  updateHud();
}

function hitBunker(enemy,nav,damage,isContact){
  const fort=run.activeSkill;
  if(isContact && (enemy.nextBunkerHit||0)>run.t)return;
  if(isContact)enemy.nextBunkerHit=run.t+.8;
  fort.hp=Math.max(0,fort.hp-damage*(1-run.talents.reduction));
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
  const spinning=skill.id===1 && skill.phase==='spin';
  if(spinning){
    const reach=clearShotRange(member,heading,range);
    const inset=Math.min(19,reach),ux=Math.cos(heading),uy=Math.sin(heading);
    return {x:member.x+ux*inset,y:member.y-25+uy*inset,
      tx:member.x+ux*reach,ty:member.y-25+uy*reach,angle:heading,length:reach-inset,
      sourceX:member.x,sourceY:member.y,id:member.id,lead:true,hit:new Set(),age:0};
  }
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
  if(!bulk)shot.smokeSeed=Math.floor(Math.random()*65536);
  const speed=bulk?650:1080;
  const damage=Math.round((bulk && !skill.awakened?21:skill.phase==='spin'?4.5:9)*(1+member.weapon.power/100)*weaponRunMultiplier(member.id));
  Object.assign(shot,{speed,duration:shot.length/speed,damage,awakened:skill.awakened,
    remaining:1,skillRound:bulk?'bulk':'raven'});
  run.marks.push(shot);
  if(bulk)run.effects.push({skillFx:'bunkerFire',x:shot.x,y:shot.y,angle:shot.angle,
    id:member.id,hand,awakened:skill.awakened,lead:true,age:0,duration:.115});
  skillAudio.play(member.id,bulk?'cannon':hand?'smgB':'smgA',bulk?.42:.32);
  return shot;
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
  const siege=skill.awakened,angle=Math.atan2(target.y-member.y,target.x-member.x);
  member.flip=Math.cos(angle)<0?-1:1;
  member.lastShot=run.t;member.shoot=.27;member.aimAngle=skill.angle=angle;
  const barrel=skillShotSocket(member,skill,angle,salvoIndex);
  const travel=Math.hypot(target.x-member.x,target.y-member.y);
  const duration=siege?clamp(.18+travel/1100,.24,.65):clamp(.48+travel/1000,.32,.86);
  const power=(equipmentDamage(member.weapon,loadouts[3])+18)*weaponRunMultiplier(member.id);
  run.effects.push({skillFx:'shellArc',id:3,lead:true,large:true,awakened:siege,salvoIndex,angle,age:0,duration,
    x:barrel.x,y:barrel.y,tx:target.x,ty:target.y,damage:Math.round(power*(run.talents.rocketCap?1.25:1)),radius:siege?72:60});
  skillAudio.play(3,'thump',.54);
}

function detonateMortar(shell,state,floor) {
  shell.detonated=true;
  state.effects.push({skillFx:'blast',id:3,x:shell.tx,y:shell.ty,radius:shell.radius,large:shell.large,
    lead:true,awakened:shell.awakened,angle:shell.angle,age:0,duration:shell.large?1.02:.79});
  for (const enemy of state.enemies) {
    if (enemy.hp<=0) continue;
    const dx=enemy.x-shell.tx, dy=enemy.y-(shell.groundY??shell.ty);
    if (Math.hypot(dx,dy)>shell.radius || !routes[floor].clear(shell.tx,shell.groundY??shell.ty,enemy.x,enemy.y,0)) continue;
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

const ravenBodyTurns=2, ravenSectors=24;
// One turn in 48 firing beats, three shots per pose. Arms close across the
// chest and open again as the weight passes from one boot to the other.
const ravenTurnBeats=48;
const ravenShotCount=ravenBodyTurns*ravenTurnBeats;
const ravenPoseTime=3*ravenFiringTime/ravenShotCount;
// A short three-shot burst followed by a held silhouette before the next pivot.
function ravenShotAt(beat){
  return ravenWindup+(Math.floor(beat/3)+(beat%3)*.26)*ravenPoseTime;
}
const ravenChoreography=[
  [0,66],[3,48],[6,52],[9,64],[12,53],[15,65],[18,56],[21,68],
  [24,50],[27,58],[30,69],[33,67],[36,54],[39,70],[42,55],[45,71]
];
function ravenStepAtBeat(beat){
  return ravenChoreography.findIndex((_,i)=>beat<(ravenChoreography[i+1]?.[0]??ravenTurnBeats));
}
function updateRavenPose(skill,member){
  if(skill.age<ravenWindup){
    const time=skill.age*4/ravenWindup,frame=Math.min(3,Math.floor(time));
    skill.poseCel=60+frame;
    skill.poseFacing=1;skill.follow=Math.floor((time-frame)*4);
    skill.angle=[-1.05,-1.28,-.25,-.82][frame];
    return;
  }
  const turns=(skill.age-ravenWindup)*ravenBodyTurns/ravenFiringTime;
  const beat=(turns%1)*ravenTurnBeats;
  const index=ravenStepAtBeat(beat);
  const [start,cel]=ravenChoreography[index];
  const end=ravenChoreography[index+1]?.[0]??ravenTurnBeats;
  if(skill.poseCel!==cel){
    run.effects.push({skillFx:'spinEcho',id:1,x:member.x,y:member.y,angle:skill.angle,
      poseCel:skill.poseCel,poseFacing:skill.poseFacing,follow:skill.follow,age:0,duration:.11});
  }
  skill.poseCel=cel;skill.poseFacing=1;
  skill.follow=Math.min(3,Math.floor((beat-start)*4/(end-start)));
  skill.angle=Math.PI/2+turns*TAU;
}
const ravenFieldRadius=315;
const ravenSprayInterval=.0125;
// Draw one random heading from each clock sector before refilling the bag.
// Independent bags keep the decorative rounds and three-shot bursts unpaired.
function ravenRainHeading(bag,origin){
  if(!bag.length){
    for(let i=0;i<ravenSectors;i++)bag.push(i);
    for(let i=bag.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [bag[i],bag[j]]=[bag[j],bag[i]];
    }
  }
  return origin+(bag.pop()+Math.random()-.5)*TAU/ravenSectors;
}
function emitRavenRain(member,skill){
  const elapsed=skill.age-ravenWindup;
  if(elapsed<0 || reduceMotion.matches)return;
  // Skip expired tracers if a delayed frame covers a large part of the cast.
  skill.sprayTick=Math.max(skill.sprayTick,Math.floor((elapsed-.38)/ravenSprayInterval));
  while(skill.sprayTick*ravenSprayInterval<=elapsed && skill.sprayTick*ravenSprayInterval<ravenFiringTime){
    const tick=skill.sprayTick++;
    const heading=ravenRainHeading(skill.sprayDirections,skill.initialAngle);
    const ray=skillRay(member,skill,heading,null,ravenFieldRadius-Math.random()*62,tick%2);
    const speed=850+Math.random()*220, duration=ray.length/speed;
    const age=elapsed-tick*ravenSprayInterval;
    if(age>=duration)continue;
    run.marks.push({...ray,skillRound:'raven',secondary:true,tracerLength:58+Math.random()*34,
      groundSpark:tick%6===0,smokeSeed:Math.floor(Math.random()*65536),
      firstStep:age,remaining:1,speed,duration});
  }
}
function ravenHitChance(distance){
  if(distance<=105)return 1;
  if(distance<=155)return .9;
  if(distance<=210)return .8;
  if(distance<=265)return .7;
  return distance<=ravenFieldRadius?.6:0;
}
function hitRavenCircle(member,power,quadrant){
  let landed=false;
  for(const enemy of run.enemies){
    if(enemy.hp<=0)continue;
    const dx=enemy.x-member.x,dy=enemy.y-member.y;
    const angle=Math.atan2(dy,dx);
    const sector=Math.floor(((angle+TAU+Math.PI/2) % TAU)/(TAU/4));
    if(sector!==quadrant)continue;
    const chance=ravenHitChance(Math.hypot(dx,dy));
    if(!chance || !routes[run.floor].clear(member.x,member.y,enemy.x,enemy.y,0))continue;
    if(chance<1 && Math.random()>=chance)continue;
    damageEnemy(enemy,power,angle,run,member.id);
    enemy.ravenSlowUntil=run.t+.8;
    run.effects.push({skillFx:'ravenStrike',x:enemy.x,y:chestY(enemy),id:member.id,lead:true,
      angle,reach:Math.hypot(dx,dy),age:0,duration:.21});
    landed=true;
  }
  if(landed)gunAudio.play('hit');
}
function fireSkillBeat(member,skill) {
  const beat=skill.beat,hand=beat%2;
  skill.lastFire=skill.age;
  member.lastShot=run.t; member.shoot=.18;
  if (skill.id===0) {
    const heading=skill.awakened?run.heading:-Math.PI*.5+(beat%4)*Math.PI*.5;
    const candidates=combatTargets(member,285,false);
    const target=skill.awakened?candidates[0]?.enemy:candidates.find(({enemy})=>
      aimDistance(skillAim(member,enemy,heading),heading)<=Math.PI*.25)?.enemy;
    skill.angle=skillAim(member,target,heading);
    fireSkillBullet(member,skill,skill.angle,target,hand);
    skill.nextShot+=skill.awakened?mechStats.interval:.145;
  } else if (skill.id===1) {
    const heading=ravenRainHeading(skill.burstDirections,skill.initialAngle);
    member.shotColumn=hand?3:1;
    const main=fireSkillBullet(member,skill,heading,null,hand);
    const quadrant=[0,2,1,3][beat%4],pulse=Math.floor(beat/4)%3;
    const power=Math.floor(main.damage/3)+(pulse<main.damage%3?1:0);
    hitRavenCircle(member,power,quadrant);
    skill.nextShot=beat+1<ravenShotCount?ravenShotAt(beat+1):Infinity;
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
  if(deployedBunker(skill) && skill.phase==='retract'){
    skill.foldTime=Math.max(0,skill.foldTime-dt*1.25);
    if(skill.foldTime===0)cancelSquadSkill();
    return;
  }
  const previousAge=skill.age;
  skill.age+=dt;
  if(deployedBunker(skill) && skill.phase==='deploy' && skill.age>bunkerBoardingAt){
    if(!skill.seats)assignBunkerCover(skill);
    const boarding=run.squad.some(m=>m.hp>0 && skill.seats[m.id] &&
      (!skill.entered[m.id] || dist(m,skill.seats[m.id])>2));
    if(boarding)skill.age=bunkerBoardingAt;
    if(previousAge<bunkerSlamAt && skill.age>=bunkerSlamAt){
      skillAudio.play(0,'plant',.8);
      tone(106,.13,.085,'triangle',0,47);
    }
  }
  if (skill.id!==1 && skill.duration!==undefined && skill.age>=skill.duration) {cancelSquadSkill();return}
  if (!squadSkillLocked()) {skill.x=member.x; skill.y=member.y}
  switch (skill.id) {
    case 0:
      if(skill.phase==='deploy'){
        const ready=skill.awakened?mechStats.spinUp:bunkerDeployTime;
        skill.nextShot=Math.max(skill.nextShot,ready);
        if(skill.age>=ready)skill.phase='fire';
      }
      if (skill.phase!=='fire') return;
      break;
    case 1: updateRavenPose(skill,member);break;
    case 2: skill.phase=skill.age<(skill.awakened?1:.42)?'charge':'pierce'; break;
    case 3: skill.phase=skill.age<(skill.awakened?.60:.78)?'deploy':skill.age<(skill.awakened?2.45:3.20)?'barrage':'recover'; break;
  }
  while (skill.nextShot<=skill.age) fireSkillBeat(member,skill);
  if(skill.id===1 && skill.phase==='spin'){
    emitRavenRain(member,skill);
    skill.ribbonAngle=skill.initialAngle+clamp((skill.age-ravenWindup)/ravenFiringTime,0,1)*ravenBodyTurns*TAU;
    if(skill.age>=skill.duration)cancelSquadSkill();
  }
}
