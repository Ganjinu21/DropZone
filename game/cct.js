'use strict';

const summonScale=.8;
const summonDamageRatio=.8;

function cctRadioSprite(member){
  ctx.save();ctx.translate(Math.round(member.x),Math.round(member.y));ctx.scale(summonScale,summonScale);
  drawMemberGear(ctx,{...member,id:4,x:0,y:0,loadout:run.squad[4].loadout,weapon:run.squad[4].weapon},run.t-(member.lastShot??-Infinity),member.moving);
  ctx.restore();
}
function callCobra(member){
  const awakened=skillForm(4)===2;
  run.cobra={awakened,age:0,duration:awakened?11:squadSkillDefs[4].duration,shot:.5,flip:1,x:member.x,y:member.y-76};
  member.skillReadyAt=run.t+squadSkillDefs[4].cooldown;
  updateHud();return true;
}
function fireSupport(source,enemy,damage,awakened=false){
  const angle=Math.atan2(chestY(enemy)-source.y,enemy.x-source.x);
  run.effects.push({clip:'support_tracer',awakened,x:source.x,y:source.y,tx:enemy.x,ty:chestY(enemy),age:0,duration:.095});
  damageEnemy(enemy,damage,angle,run,4);
}
function initializeRadioTeam(){
  const chief=run.squad[4];
  if(!chief?.deployed || run.radioTeam)return;
  const max=Math.round(30*(1+.3*run.up[vitality]));
  run.radioTeam=[-1,1].map(side=>({
    side,x:chief.x,y:chief.y,hp:max,max,baseMax:30,gear:chief.gear,gait:0,flip:1,shoot:0,cool:1,
    grace:1,floor:run.floor,patrolTime:0,moving:false
  }));
}

function choosePatrolPoint(ally,enemy,nav){
  // Pick a reachable post around the squad, favouring opposite flanks under fire.
  const facing=enemy?Math.atan2(enemy.y-run.y,enemy.x-run.x):run.heading;
  const preferred=facing+ally.side*(enemy?1.4:2.1);
  for(let i=0;i<8;i++){
    const angle=preferred+(Math.random()-.5)*2.3;
    const reach=(29+Math.random()*38)*stairFormationScale(run);
    const x=run.x+Math.cos(angle)*reach,y=run.y+Math.sin(angle)*reach;
    if(nav.clear(run.x,run.y,x,y,4) && nav.clear(ally.x,ally.y,x,y,4))return {x,y};
  }
  return {x:run.x,y:run.y};
}

function moveRadioAlly(ally,enemy,nav,dt){
  const beyondLeash=dist(ally,run)>80;
  ally.patrolTime-=dt;
  if(!ally.post || ally.patrolTime<=0 || dist(ally.post,run)>70 || beyondLeash){
    ally.post=beyondLeash?{x:run.x,y:run.y}:choosePatrolPoint(ally,enemy,nav);
    ally.patrolTime=1.2+Math.random()*1.8;
  }
  const dx=ally.post.x-ally.x,dy=ally.post.y-ally.y,d=Math.hypot(dx,dy);
  const x=ally.x,y=ally.y;
  if(d>2){
    ally.speed=beyondLeash?175:run.moving?128:55;
    const fraction=Math.min(1,dt*ally.speed/d);
    if(nav.clear(x,y,ally.post.x,ally.post.y,4))nav.slide(ally,dx*fraction,dy*fraction,4);
    else nav.chase(ally,run,dt);
  }
  updateCrewStride(ally,ally.x-x,ally.y-y,dt,summonScale);
}
function updateRadioSupport(dt){
  const chief=run.squad[4];
  if(!chief?.deployed)return;
  initializeRadioTeam();
  const nav=routes[run.floor],fort=deployedBunker()?run.activeSkill:null;
  for(const ally of run.radioTeam){
    if(ally.hp<=0){
      ally.respawn-=dt;
      if(ally.respawn<=0 && chief.hp>0)Object.assign(ally,{hp:ally.max,x:chief.x,y:chief.y,grace:1,cool:.5,
        ammoKey:null,gait:0,moving:false,shoot:0,aimTarget:null,lastShot:null,downFloor:null,reviveTime:0,floor:run.floor,post:null,patrolTime:0});
      continue;
    }
    if(ally.floor!==run.floor){ally.x=run.x;ally.y=run.y;ally.floor=run.floor;ally.post=null}
    if(fort){ally.x=fort.x;ally.y=fort.y;ally.moving=false;ally.post=null;ally.aimTarget=null;continue}
    const enemy=combatTargets(ally,188,false)[0]?.enemy;
    ally.aimTarget=enemy??null;
    if(enemy && enemy.x!==ally.x)ally.flip=Math.sign(enemy.x-ally.x);
    moveRadioAlly(ally,enemy,nav,dt);
    ally.shoot-=dt;ally.cool-=dt;ally.grace-=dt;
    if(!enemy)continue;
    if(ally.grace<=0 && dist(enemy,ally)<18){
      if(!evadeHit(ally))ally.hp-=enemy.contactDamage||8;
      ally.grace=.75;
      if(ally.hp<=0){ally.hp=0;ally.downFloor=run.floor;ally.reviveTime=0;ally.respawn=6;continue}
    }
    // The small CCT replica tracks the opponent from its scaled shoulder.
    const pose={...ally,id:4,x:0,y:0,weapon:chief.weapon};
    const x=Math.round(ally.x),y=Math.round(ally.y);
    combatAim(pose,(enemy.x-x)/summonScale,(chestY(enemy)-y)/summonScale,1);
    ally.flip=pose.flip;ally.aimPitch=pose.aimPitch;
    if(ally.cool<=0 && magazineReady(ally,chief.weapon)){
      spendRound(ally,chief.weapon);
      const barrel=combatMuzzle(pose,1,false);
      const source={x:x+barrel.x*summonScale,y:y+barrel.y*summonScale};
      const damage=basicHitDamage(chief,basicWeaponProfile(chief,chief.id===run.lead));
      fireSupport(source,enemy,damage*summonDamageRatio);
      ally.shoot=.16;ally.lastShot=run.t;ally.cool=1.25;
    }
  }
  const craft=run.cobra;
  if(!craft)return;
  craft.age+=dt;craft.shot-=dt;
  if(craft.age>=craft.duration){run.cobra=null;return}
  const orbit=craft.age*(craft.awakened?1.85:1.5);
  craft.x=run.x+Math.cos(orbit)*(craft.awakened?160:125);
  craft.y=run.y-(craft.awakened?104:86)+Math.sin(orbit)*(craft.awakened?54:36);
  craft.flip=Math.sin(orbit)>0?-1:1;
  if(craft.shot<=0){
    const enemy=combatTargets(run,craft.awakened?400:340,false)[0]?.enemy;
    if(enemy){
      const damage=equipmentDamage(chief.weapon,{damage:craft.awakened?6:19})*weaponRunMultiplier(4);
      fireSupport(craft.awakened?a10Muzzle(craft):craft,enemy,Math.round(damage),craft.awakened);
    }
    craft.shot=craft.awakened?.15:.52;
  }
}
function drawCobraSupport(){
  const craft=run.cobra;if(!craft)return;
  if(craft.awakened){drawA10Support(craft);return}
  ctx.save();ctx.translate(Math.round(craft.x),Math.round(craft.y));ctx.scale(Math.sin(craft.age*1.5)>0?-1:1,1);
  ctx.drawImage(art.cobra,-74,-50,148,78);ctx.restore();
}
