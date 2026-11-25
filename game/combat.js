'use strict';

const loadouts = [
  {name: 'bulk', range: 204, speed: 580, delay: .76, damage: 16},
  {name: 'raven', range: 252, speed: 735, delay: .49, damage: 11},
  {name: 'lynx', range: 385, speed: 1090, delay: 1.16, damage: 38, armoredMultiplier: 1.45},
  {name: 'hammer', range: 300, speed: 490, delay: 1.27, damage: 22},
  {name:'support',range:275,speed:790,delay:.36,damage:14}
];
const sidearm = {name: 'support', range: 193, speed: 650, delay: 1.18, damage: 7};
const enemyChest = [18, 17, 25];
const enemyWidth = [10, 8, 15];
const bossSpriteScale = 1.5;
function chestY(enemy) {
  return enemy.y - enemyChest[enemy.type] * (enemy.boss ? bossSpriteScale : 1);
}
const gunAudio = {
  buffers: new Map(), loading: null, lastImpact: -1,
  load(context) {
    skillAudio.load(context);
    if (this.loading) return;
    // Short ignition crack, pitched motor and a filtered exhaust tail.
    const rate=context.sampleRate, launch=context.createBuffer(1,Math.ceil(rate*.48),rate);
    const samples=launch.getChannelData(0);
    let seed=71, low=0, mid=0, phase=0;
    for(let i=0;i<samples.length;i++){
      const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const white=seed/2147483648-1;
      low+=(white-low)*(1-Math.exp(-4200/rate));
      mid+=(white-mid)*(1-Math.exp(-(18000*Math.exp(-6*t)+1800)/rate));
      phase+=2*Math.PI*(55+135*Math.exp(-22*t))/rate;
      const attack=Math.min(1,t/.003),tail=Math.min(1,(.48-t)/.035);
      samples[i]=Math.tanh(attack*tail*(white*.70*Math.exp(-95*t)+Math.sin(phase)*.75*Math.exp(-17*t)+
        (mid-low)*3.9*(1-Math.exp(-45*t))*Math.exp(-8*t)));
    }
    this.buffers.set('rocket-launch',launch);
    this.loading = Promise.all(Object.entries(COMBAT_SOUNDS).map(async ([name, wav]) => {
      const bytes = Uint8Array.from(atob(wav), ch => ch.charCodeAt(0));
      this.buffers.set(name, await context.decodeAudioData(bytes.buffer));
    })).catch(error => console.warn('Could not decode combat audio', error));
  },
  play(name,volume) {
    if (!sound || sound.state !== 'running' || !this.buffers.has(name)) return;
    if (name === 'hit') {
      if (sound.currentTime - this.lastImpact < .045) return;
      this.lastImpact = sound.currentTime;
    }
    const src = sound.createBufferSource(), gain = sound.createGain();
    src.buffer = this.buffers.get(name);
    gain.gain.value = volume ?? (name === 'hit' ? .50 : .68);
    src.connect(gain); gain.connect(sound.destination); src.start();
    src.onended = () => {src.disconnect(); gain.disconnect()};
  }
};

function targetInSight(member,enemy,range,distanceSquared){
  return enemy.hp>0 && distanceSquared<=range*range &&
    routes[run.floor].clear(member.x,member.y,enemy.x,enemy.y,0);
}
function combatTargets(member, range, sniper) {
  const inRange = [];
  for (const enemy of run.enemies) {
    const dx = enemy.x - member.x, dy = enemy.y - member.y;
    const distance = dx * dx + dy * dy;
    if (targetInSight(member,enemy,range,distance)) {
      inRange.push({enemy, distance});
    }
  }
  inRange.sort((a,b) => {
    if (sniper) {
      if (!!a.enemy.boss !== !!b.enemy.boss) return a.enemy.boss ? -1 : 1;
      const rank = Number(b.enemy.type === 2) - Number(a.enemy.type === 2);
      if (rank) return rank;
      if (a.enemy.hp !== b.enemy.hp) return b.enemy.hp - a.enemy.hp;
    }
    return a.distance - b.distance;
  });
  return inRange;
}

// Stop the ray at the first footprint past the aimed target. Muzzle pixels are
// above ground, so route checks use the feet and shot drawing uses the chest.
function shotLength(member, target, extra, distance) {
  const nav = routes[run.floor], dx = target.x-member.x, dy = target.y-member.y;
  const groundDistance = Math.hypot(dx,dy) || 1;
  const clear = step => nav.clear(target.x,target.y,target.x+dx*step/groundDistance,target.y+dy*step/groundDistance,0);
  if (clear(extra)) return distance+extra;
  let low=0, high=extra;
  while (high-low>1) {
    const mid=(low+high)/2;
    if (clear(mid)) low=mid; else high=mid;
  }
  return distance+low;
}

function launchRound(member, barrel, target, weapon, lead, damage) {
  const tx = target.x, ty = chestY(target);
  let dx=tx-barrel.x, dy=ty-barrel.y;
  const distance=Math.hypot(dx,dy);
  const ux=member.flip*Math.cos(member.aimPitch), uy=Math.sin(member.aimPitch);
  // If an enemy is already inside the barrel's reach, contact is immediate.
  const contact=dx*ux+dy*uy <= 0 || distance < 1;
  if (contact) {dx=ux; dy=uy}
  const angle=Math.atan2(dy,dx);
  const pierce=member.weapon.family==='sniper';
  const length=shotLength(member,target,pierce?166:18,contact?1:distance);
  run.marks.push({
    x:barrel.x, y:barrel.y, tx:barrel.x+Math.cos(angle)*length,
    ty:barrel.y+Math.sin(angle)*length, angle, id:member.id, lead,
    age:0, duration:length/weapon.speed, length, speed:weapon.speed,
    sourceX:member.x, sourceY:member.y, family:member.weapon.family, tier:memberTier(member), flightHeight:target.y-ty, damage, remaining:pierce?2:1,
    hit:new Set(), contact:contact?target:null
  });
}

function equippedProfile(item,lead=true){
  if(item.family==='pistol' && !lead)return sidearm;
  return loadouts[weaponFamilies.indexOf(item.family)];
}
function equipmentDamage(item,profile=equippedProfile(item)){
  return Math.round(profile.damage*(100+item.power)/100);
}
function basicWeaponProfile(member,lead){
  return equippedProfile(member.weapon,lead);
}
function basicHitDamage(member,weapon){
  return Math.round(equipmentDamage(member.weapon,weapon)*weaponRunMultiplier(member.id));
}

function criticalDamage(power,operatorId,enemy,state){
  const gear=run.squad[operatorId]?.gear;
  const chance=gear?(gear.critChance??0)+run.talents.critBonus:0;
  if(chance<=0 || Math.random()>=chance)return power;
  state.cues.push({kind:'critical',x:enemy.x,y:chestY(enemy),age:0,duration:.4});
  return power*1.5;
}

function evadeHit(member){
  const chance=member.gear?.evadeChance??0;
  if(chance<=0 || Math.random()>=chance)return false;
  combatCue('evade',member.x,member.y-28,.45);
  return true;
}

// Reload deadlines follow simulated combat time, including time spent as a supporting member.
function magazineReady(member,item){
  if(member.ammoKey!==item.key || (member.reloadAt>0 && run.t>=member.reloadAt)){
    member.ammoKey=item.key;member.ammo=item.capacity;member.reloadAt=0;
    member.nextShotColumn=1;
  }
  return member.ammo>0;
}
function spendRound(member,item){
  if(member.deployed && run.talents.ammoSaveChance && Math.random()<run.talents.ammoSaveChance)return;
  member.ammo--;
  if(member.ammo===0)member.reloadAt=run.t+item.reload*(member.gear?.reload??1)/(1+run.talents.reloadBonus);
}

function shoot(member) {
  if (member.hp<=0 || member.deployed===false) return;
  const skill=run.activeSkill;
  if (skill && (deployedBunker(skill) || skill.id===member.id)) return;
  const lead=member.id===run.lead,family=member.weapon.family;
  if(!magazineReady(member,member.weapon))return;
  const weapon=basicWeaponProfile(member,lead);
  const sniper=family==='sniper',dual=family==='smg';
  const targets=combatTargets(member,weapon.range,sniper);
  member.aimTarget=targets[0]?.enemy??null;
  if (!member.aimTarget) {
    member.cool=.075; member.burstIndex=0;
    if (sniper) run.mark=null;
    return;
  }
  const target=targets[0].enemy, beat=member.burstIndex || 0;
  const col=dual?(member.nextShotColumn??((member.weapon.capacity-member.ammo)%2?3:1)):1;
  if(dual)member.nextShotColumn=col===1?3:1;
  spendRound(member,member.weapon);
  const twinPower=run.talents.twinPower;
  const nextTarget=targets[1]?.enemy??target;
  if (sniper) run.mark=target;
  member.lastShot=run.t;
  combatAim(member,target.x,chestY(target),col,lead);
  const barrel=combatMuzzle(member,col,lead);
  member.aimAngle=Math.atan2(Math.sin(member.aimPitch),member.flip*Math.cos(member.aimPitch));
  member.lastShot=run.t; member.shotColumn=col; member.shoot=.22;
  const damage=basicHitDamage(member,weapon);
  launchRound(member,barrel,target,weapon,lead,damage);
  if(twinPower){
    const echo={x:barrel.x-4*Math.sin(member.aimAngle),y:barrel.y+4*Math.cos(member.aimAngle)};
    launchRound(member,echo,nextTarget,weapon,lead,damage*twinPower);
  }

  if(family==='rocket'){
    run.effects.push({id:member.id,tier:memberTier(member),lead,shotTime:run.t,col,clip:'hammer_muzzle',age:0,duration:.13,x:barrel.x,y:barrel.y});
    gunAudio.play('rocket-launch',lead? .64:.34);
    member.cool=weapon.delay/(1+run.talents.fireRateBonus);
    return;
  }
  const state={id:member.id, tier:memberTier(member), lead, flip:member.flip, col, shotTime:run.t, angle:member.aimAngle, age:0};
  run.effects.push({...state,clip:weapon.name+'_muzzle',x:barrel.x,y:barrel.y,duration:[.144,.096,.180,.089,.10][lead?member.id:3]});
  const back=sniper?21:6;
  run.effects.push({...state,clip:'brass',x:barrel.x-back*Math.cos(state.angle),y:barrel.y-back*Math.sin(state.angle),duration:.23});
  if (lead) gunAudio.play(dual?(col===1?'raven-a':'raven-b'):weapon.name);
  member.burstIndex=dual && member.ammo>0?(beat+1)%3:0;
  member.cool=(dual && member.burstIndex!==0 ? .068 : weapon.delay)/(1+run.talents.fireRateBonus);
}

function roundImpact(shot, enemy, x, y, state) {
  if(shot.family==='rocket'){
    explodeRocket(shot,shot.contact?enemy.x:x,shot.contact?chestY(enemy):y,enemy.y,state);
    return;
  }
  const pierce=shot.family==='sniper' || (shot.lead && shot.id===2 && !shot.family);
  const heavyBonus=pierce && (enemy.boss || enemy.type===2)?loadouts[2].armoredMultiplier:1;
  damageEnemy(enemy,Math.round(shot.damage*heavyBonus),shot.angle,state,shot.id);
  state.effects.push({tier:shot.tier,clip:Number.isInteger(shot.tier)?'rank-impact':pierce?'pierce_exit':'hit_spark',x,y,id:shot.id,
    lead:shot.lead,angle:shot.angle,age:0,duration:pierce?.148:.132});
  if (state===run && shot.lead && shot.id===run.lead) gunAudio.play('hit');
  shot.hit.add(enemy);
  shot.remaining--;
}

function explodeRocket(shot,x,y,groundY,state){
  shot.remaining=0;
  if(Number.isInteger(shot.tier))state.effects.push({clip:'rank-impact',tier:shot.tier,id:3,x,y,angle:shot.angle,age:0,duration:.30});
  detonateMortar({id:shot.id,tx:x,ty:y,groundY,angle:shot.angle,damage:shot.damage,radius:37,large:false},
    state,state===run?run.floor:otherFloor());
}

function rocketExhaust(shot,state,from,to){
  const ux=Math.cos(shot.angle),uy=Math.sin(shot.angle);
  const step=reduceMotion.matches?20:10;
  for(let d=(Math.floor(from/step)+1)*step;d<=to;d+=step){
    const wobble=Math.sin(d*.43+shot.x)*2;
    state.effects.push({skillFx:'exhaust',x:shot.x+ux*(d-7)-uy*wobble,y:shot.y+uy*(d-7)+ux*wobble,
      age:0,duration:reduceMotion.matches?.18:.34,seed:d,angle:shot.angle});
  }
}

function rayCollisions(shot, state, floor, from, to) {
  const collisions=[], ux=Math.cos(shot.angle), uy=Math.sin(shot.angle);
  for (const enemy of state.enemies) {
    if (enemy.hp<=0 || shot.hit.has(enemy)) continue;
    const dx=enemy.x-shot.x, dy=chestY(enemy)-shot.y;
    const radius=enemyWidth[enemy.type]*(enemy.boss?bossSpriteScale:1);
    const center=dx*ux+dy*uy, side=Math.abs(dx*uy-dy*ux);
    if (center+radius<from || center-radius>to || side>=radius) continue;
    const halfChord=Math.sqrt(radius*radius-side*side);
    const enter=Math.max(from,center-halfChord);
    if (enter>to || center+halfChord<from) continue;
    if (routes[floor].clear(shot.sourceX,shot.sourceY,enemy.x,enemy.y,0)) collisions.push({enemy,enter});
  }
  return collisions.sort((a,b)=>a.enter-b.enter);
}

function advanceRounds(dt, state=run, floor=run.floor) {
  for (const effect of state.effects) {
    if (effect.skillFx==='shellArc' && !effect.detonated && effect.age+dt>=effect.duration) {
      detonateMortar(effect,state,floor);
    }
  }
  let kept=0;
  for (const shot of state.marks) {
    const from=shot.age*shot.speed;
    shot.age=Math.min(shot.duration,shot.age+(shot.firstStep??dt));
    if(shot.firstStep!=null)delete shot.firstStep;
    const to=shot.age*shot.speed, ux=Math.cos(shot.angle), uy=Math.sin(shot.angle);
    if (shot.contact) {
      if (shot.contact.hp>0 && state.enemies.includes(shot.contact)) {
        roundImpact(shot,shot.contact,shot.x,shot.y,state);
      }
      shot.contact=null;
    }
    const collisions=shot.skillRound!=='raven' && shot.remaining>0 ? rayCollisions(shot,state,floor,from,to) : [];
    if(shot.family==='rocket' && shot.remaining){
      rocketExhaust(shot,state,from,collisions[0]?.enter??to);
      if(!collisions.length && shot.age>=shot.duration)explodeRocket(shot,shot.tx,shot.ty,shot.ty+shot.flightHeight,state);
    }
    for (const {enemy,enter} of collisions) {
      roundImpact(shot,enemy,shot.x+ux*enter,shot.y+uy*enter,state);
      if (shot.remaining===0) break;
    }
    if (shot.remaining<=0) continue;
    if (shot.age<shot.duration) state.marks[kept++]=shot;
    else if (shot.skillRound==='raven') {
      state.effects.push({skillFx:'ravenGroundHit',id:1,x:shot.tx,y:shot.ty,
        flight:shot,angle:shot.angle,age:0,duration:(shot.secondary && !shot.groundSpark) ? .48 : .68});
    }
  }
  state.marks.length=kept;
}

function absorbContact(enemy, member, nav, damageOverride) {
  member.hurt=.7;
  if(evadeHit(member))return;
  const bulk=run.squad[0];
  const angle=bulk.lastShot!=null && bulk.shoot>0 ? bulk.aimAngle : run.heading;
  const guard=run.lead===0 && (enemy.x-member.x)*Math.cos(angle)+(enemy.y-member.y)*Math.sin(angle)>0;
  const contactDamage=damageOverride ?? enemy.contactDamage ?? [8,6,15][enemy.type];
  member.hp-=contactDamage*(1-run.talents.reduction)*(guard?1-Math.min(.95,.55+bulk.gear.guard):1);
  combatCue('hurt',member.x,member.y,.28,member.id,Math.atan2(member.y-enemy.y,member.x-enemy.x));
  if (!guard) return;
  run.effects.push({clip:'shield_block',x:bulk.x+Math.cos(angle)*15,y:bulk.y-26+Math.sin(angle)*8,id:0,lead:true,angle,age:0,duration:.168});
  gunAudio.play('block');
  if (run.shield>0) return;
  run.shield=2.5;
  const radius=32;
  combatCue('guard',bulk.x,bulk.y,.37,0,angle,radius);
  for (const foe of run.enemies) {
    const dx=foe.x-bulk.x, dy=foe.y-bulk.y, d=Math.hypot(dx,dy);
    if (foe.hp<=0 || d>radius || !nav.clear(bulk.x,bulk.y,foe.x,foe.y,0)) continue;
    const impulseAngle=d>.01?Math.atan2(dy,dx):angle;
    const push=foe.boss?5:20;
    nav.slide(foe,Math.cos(impulseAngle)*push,Math.sin(impulseAngle)*push,4);
    damageEnemy(foe,5,impulseAngle,run,0);
  }
}
