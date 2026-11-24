'use strict';

const summonScale=.8;
const summonDamageRatio=.8;

function cctRadioSprite(member){
  ctx.save();ctx.translate(Math.round(member.x),Math.round(member.y));ctx.scale(summonScale,summonScale);
  drawMemberGear(ctx,{...member,id:4,x:0,y:0,weapon:run.squad[4].weapon},member.shoot>0?0:Infinity,member.moving);
  ctx.restore();
}
function callCobra(member){
  run.cobra={age:0,duration:7,shot:.5,x:member.x,y:member.y-76};
  member.skillReadyAt=run.t+squadSkillDefs[4].cooldown;
  updateHud();return true;
}
function fireSupport(source,enemy,damage){
  const angle=Math.atan2(chestY(enemy)-source.y,enemy.x-source.x);
  run.effects.push({clip:'support_tracer',x:source.x,y:source.y,tx:enemy.x,ty:chestY(enemy),age:0,duration:.095});
  damageEnemy(enemy,damage,angle);
}
function initializeRadioTeam(){
  const chief=run.squad[4];
  if(chief?.deployed && !run.radioTeam)run.radioTeam=[-1,1].map(side=>({
    side,x:chief.x,y:chief.y,hp:30,max:30,gait:0,flip:1,shoot:0,cool:1,
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
  const travel=Math.hypot(ally.x-x,ally.y-y);
  ally.moving=travel>dt*5;ally.gait+=travel;
  if(ally.moving && Math.abs(ally.x-x)>dt*4)ally.flip=Math.sign(ally.x-x);
}
function updateRadioSupport(dt){
  const chief=run.squad[4];
  if(!chief?.deployed)return;
  initializeRadioTeam();
  const nav=routes[run.floor],fort=run.activeSkill?.id===0?run.activeSkill:null;
  for(const ally of run.radioTeam){
    if(ally.hp<=0){
      ally.respawn-=dt;
      if(ally.respawn<=0 && chief.hp>0)Object.assign(ally,{hp:ally.max,x:chief.x,y:chief.y,grace:1,cool:.5,
        downFloor:null,reviveTime:0,floor:run.floor,post:null,patrolTime:0});
      continue;
    }
    if(ally.floor!==run.floor){ally.x=run.x;ally.y=run.y;ally.floor=run.floor;ally.post=null}
    if(fort){ally.x=fort.x;ally.y=fort.y;ally.moving=false;ally.post=null;continue}
    const enemy=combatTargets(ally,188,false)[0]?.enemy;
    moveRadioAlly(ally,enemy,nav,dt);
    ally.shoot-=dt;ally.cool-=dt;ally.grace-=dt;
    if(!enemy)continue;
    if(ally.grace<=0 && dist(enemy,ally)<18){
      ally.hp-=enemy.contactDamage||8;ally.grace=.75;
      if(ally.hp<=0){ally.hp=0;ally.downFloor=run.floor;ally.reviveTime=0;ally.respawn=6;continue}
    }
    if(ally.cool<=0){
      const pose={...ally,id:4,weapon:chief.weapon};
      // Aim in the summon's unscaled coordinate space before mapping its muzzle to the floor.
      combatAim(pose,ally.x+(enemy.x-ally.x)/summonScale,ally.y+(chestY(enemy)-ally.y)/summonScale,1);
      ally.flip=pose.flip;ally.aimPitch=pose.aimPitch;
      const barrel=combatMuzzle(pose,1,false);
      const source={x:ally.x+(barrel.x-ally.x)*summonScale,y:ally.y+(barrel.y-ally.y)*summonScale};
      const damage=basicHitDamage(chief,basicWeaponProfile(chief,chief.id===run.lead));
      fireSupport(source,enemy,damage*summonDamageRatio);
      ally.shoot=.16;ally.cool=1.25;
    }
  }
  const craft=run.cobra;
  if(!craft)return;
  craft.age+=dt;craft.shot-=dt;
  if(craft.age>=craft.duration){run.cobra=null;return}
  craft.x=run.x+Math.cos(craft.age*1.5)*125;craft.y=run.y-86+Math.sin(craft.age*1.5)*36;
  if(craft.shot<=0){
    const enemy=combatTargets(run,340,false)[0]?.enemy;
    if(enemy)fireSupport(craft,enemy,19+3*(run.up[9]||0));
    craft.shot=.52;
  }
}
function drawCobraSupport(){
  const craft=run.cobra;if(!craft)return;
  ctx.save();ctx.translate(Math.round(craft.x),Math.round(craft.y));ctx.scale(Math.sin(craft.age*1.5)>0?-1:1,1);
  ctx.drawImage(art.cobra,-74,-50,148,78);ctx.restore();
}
