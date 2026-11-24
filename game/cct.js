'use strict';

function cctRadioSprite(member, size=64) {
  const frame=member.shoot>0 ? 4 : member.moving ? Math.floor(member.gait/8)%4 : 0;
  ctx.save();ctx.translate(Math.round(member.x),Math.round(member.y));ctx.scale(member.flip||1,1);
  ctx.drawImage(art.cctPoses,frame*64,0,64,64,-size/2,-size*60/64,size,size);ctx.restore();
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
function updateRadioSupport(dt){
  const chief=run.squad[4];
  if(!chief?.deployed)return;
  const nav=routes[run.floor];
  if(!run.radioTeam)run.radioTeam=[-1,1].map(side=>({side,x:chief.x,y:chief.y,hp:30,gait:0,flip:1,shoot:0,cool:1,grace:1,floor:run.floor}));
  for(const ally of run.radioTeam){
    if(ally.hp<=0){
      ally.respawn-=dt;
      if(ally.respawn<=0 && chief.hp>0)Object.assign(ally,{hp:30,x:chief.x,y:chief.y,grace:1,cool:.5});
      continue;
    }
    if(ally.floor!==run.floor){ally.x=run.x;ally.y=run.y;ally.floor=run.floor}
    let tx=run.x-36,ty=run.y+ally.side*38;
    if(nav.blocked(tx,ty,4)){tx=run.x;ty=run.y}
    const dx=tx-ally.x,dy=ty-ally.y,d=Math.hypot(dx,dy);
    ally.moving=d>12;
    if(ally.moving){
      const step=Math.min(d,145*dt),x=ally.x,y=ally.y;
      if(nav.clear(x,y,tx,ty,4))nav.slide(ally,dx/d*step,dy/d*step,4);
      else {ally.speed=145;nav.chase(ally,run,dt)}
      ally.gait+=Math.hypot(ally.x-x,ally.y-y);if(Math.abs(dx)>3)ally.flip=Math.sign(dx);
    }
    ally.shoot-=dt;ally.cool-=dt;ally.grace-=dt;
    const enemy=combatTargets(ally,188,false)[0]?.enemy;
    if(!enemy)continue;
    if(ally.grace<=0 && dist(enemy,ally)<18){ally.hp-=enemy.contactDamage||8;ally.grace=.75;if(ally.hp<=0){ally.respawn=6;continue}}
    if(ally.cool<=0){ally.flip=enemy.x<ally.x?-1:1;fireSupport({x:ally.x+ally.flip*14,y:ally.y-23},enemy,5);ally.shoot=.16;ally.cool=1.25}
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
