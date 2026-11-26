'use strict';

const awakenedArt={mech:'art/skills/field-mech.png',minigun:'art/skills/field-minigun.png',
  rocketBank:'art/skills/field-rocket-bank.png',a10:'art/skills/field-a10.png'};

function mechGunPose(s,angle){
  const flip=Math.cos(angle)<0?-1:1;
  const moving=run.squad[0].moving && !reduceMotion.matches;
  const step=moving?Math.sin((run.squad[0].gait||0)*Math.PI*2/crewStrideLength):0;
  const bob=Math.round(Math.abs(step)*2)+(s.age<.4?Math.round((.4-s.age)*12):0);
  const kick=s.age-s.lastFire<.06?1:0;
  return {flip,step,bob,x:Math.round(s.x)+flip*17,y:Math.round(s.y)-49+bob,reach:36-kick};
}
function mechShotSocket(s,angle){
  const gun=mechGunPose(s,angle);
  return {x:gun.x+gun.reach*Math.cos(angle),y:gun.y+gun.reach*Math.sin(angle)};
}
function drawMech(s){
  const gun=mechGunPose(s,s.angle);
  const feet=Math.round(s.y),center=Math.round(s.x);
  footShadow(center,feet-1,27);
  ctx.save();ctx.translate(center,feet);ctx.scale(gun.flip,1);
  const stride=Math.round(gun.step*4);
  ctx.drawImage(art.mech,0,54,74,46,-37-stride,-46+Math.max(0,stride),74,46-Math.max(0,stride));
  ctx.drawImage(art.mech,74,54,74,46,-37+stride,-46+Math.max(0,-stride),74,46-Math.max(0,-stride));
  ctx.drawImage(art.mech,148,0,74,55,-37,-100+gun.bob,74,55);
  ctx.restore();
  ctx.save();ctx.translate(gun.x,gun.y);ctx.rotate(s.angle);
  if(gun.flip<0)ctx.scale(1,-1);
  ctx.drawImage(art.minigun,gun.reach-43,-8);
  if(s.age-s.lastFire<.08){
    const front=gun.reach;
    skillPixelLine(front+1,0,front+9,0,'#f5bb74',3);
    skillPixelLine(front+2,-1,front+6,-2,'#ffecc0');
    skillPixelLine(front+2,2,front+6,3,'#c9804a');
  }
  ctx.restore();
  ctx.fillStyle='#252a29';ctx.fillRect(center-20,feet-105+gun.bob,40,4);
  ctx.fillStyle='#9dc7aa';ctx.fillRect(center-19,feet-104+gun.bob,Math.round(38*clamp(s.hp/s.maxHp,0,1)),2);
  leaderChevron(center,feet-109+gun.bob);
}

function a10Pose(craft){
  return {flip:craft.flip||1,bank:reduceMotion.matches?0:Math.sin(craft.age*2.2)*.065};
}
function a10Muzzle(craft){
  const {flip,bank}=a10Pose(craft),u=82,v=24;
  return {x:craft.x+flip*(u*Math.cos(bank)-v*Math.sin(bank)),y:craft.y+u*Math.sin(bank)+v*Math.cos(bank)};
}
function drawA10Support(craft){
  const {flip,bank}=a10Pose(craft);
  ctx.save();ctx.translate(Math.round(craft.x),Math.round(craft.y));ctx.scale(flip,1);ctx.rotate(bank);
  ctx.drawImage(art.a10,-86,-48,172,97);
  ctx.restore();
}
function drawStrafeTrace(e){
  const progress=reduceMotion.matches?.85:clamp(e.age/e.duration,0,1);
  const head=.22+.78*progress,tail=Math.max(0,head-.29);
  const dx=e.tx-e.x,dy=e.ty-e.y;
  skillPixelLine(e.x+dx*tail,e.y+dy*tail,e.x+dx*head,e.y+dy*head,'#bd7952',2);
  skillPixelLine(e.x+dx*(head-.055),e.y+dy*(head-.055),e.x+dx*head,e.y+dy*head,'#ffdf8b',2);
}

const bankApertures=[[41,4],[44,9],[41,14],[44,19]];
function siegeRackPose(m,s){
  const facing=s.plantFacing||hammerFlip(m);
  const plant=clamp(Math.min(s.age/.53,(s.duration-s.age)/.4),0,1);
  const kick=s.age-s.lastFire<.06?2:0;
  return {facing,plant,x:s.x+facing*(8+Math.round(9*plant)),y:s.y-20+Math.round(6*plant),
    pitch:-.13-plant*.97,left:-7-kick,top:-13};
}
function siegeShotSocket(m,s,port=0){
  const p=siegeRackPose(m,s),[front,row]=bankApertures[port%4];
  const u=p.left+front,v=p.top+row;
  return {x:p.x+p.facing*(u*Math.cos(p.pitch)-v*Math.sin(p.pitch)),y:p.y+u*Math.sin(p.pitch)+v*Math.cos(p.pitch)};
}
function drawSiegeLauncher(m,s){
  const p=siegeRackPose(m,s),f=p.facing;
  drawRecruit(ctx,{...m,x:s.x,y:s.y,flip:f},Infinity,false,recruitSkillCel(m,s));
  ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));ctx.scale(f,1);
  for(const end of [-15,15]){
    skillPixelLine(0,-1,end,p.plant*13,'#252b2e',4);
    skillPixelLine(0,-2,end,p.plant*13-1,'#9b9d8b');
    ctx.fillStyle='#393c40';ctx.fillRect(end-3,Math.round(p.plant*13),9,3);
  }
  ctx.rotate(p.pitch);ctx.drawImage(art.rocketBank,p.left,p.top);ctx.restore();
}
function drawPulseArms(m,s){
  const since=s.age-s.lastFire;
  if(m.id===1){
    for(let hand=0;hand<2;hand++){
      const socket=skillShotSocket(m,s,s.angle,hand),c=Math.cos(socket.angle),v=Math.sin(socket.angle);
      const width=since<.09?10:4;
      skillPixelLine(socket.x-c*width,socket.y-v*width,socket.x,socket.y,'#f04b67',2);
      skillPixelLine(socket.x-c*3,socket.y-v*3,socket.x,socket.y,'#ffc6cc');
    }
  }else if(m.id===2 && s.phase==='charge'){
    const socket=skillShotSocket(m,s,s.angle);
    const power=clamp(s.age,0,1),r=3+Math.round(power*5);
    ctx.save();ctx.translate(Math.round(socket.x),Math.round(socket.y));ctx.rotate(s.angle);
    skillPixelLine(-r-3,-r,-2,-2,'#58aeaf');skillPixelLine(-r-3,r,-2,2,'#58aeaf');
    skillPixelLine(-2,0,r+1,0,'#e9fff0',2);
    if(power>.48){ctx.fillStyle='#a8d6cb';ctx.fillRect(-1,-3,2,7)}
    ctx.restore();
  }
}
function drawAwakenedEffect(e){
  const t=clamp(e.age/e.duration,0,1);
  if(e.skillFx==='railBeam'){
    const dx=e.tx-e.x,dy=e.ty-e.y,length=Math.hypot(dx,dy);
    ctx.save();ctx.translate(e.x,e.y);ctx.rotate(Math.atan2(dy,dx));
    ctx.globalAlpha*=Math.min(1,(1-t)*2);
    const spread=3+Math.round((1-t)*2);
    ctx.fillStyle='#375963';ctx.fillRect(0,-spread-1,length,spread*2+2);
    ctx.fillStyle='#548f94';ctx.fillRect(0,-spread+1,length,spread*2-1);
    ctx.fillStyle='#a6e5d7';ctx.fillRect(0,-2,length,4);
    ctx.fillStyle='#f5ffdf';ctx.fillRect(0,0,length,1);
    for(let x=11;x<length-8;x+=21){
      const dy=(Math.floor(x/21)%2?1:-1)*spread;
      skillPixelLine(x,-dy,x+6,dy,'#78cbd3');skillPixelLine(x+6,dy,x+12,-dy,'#91c4b3');
    }
    if(t<.54){
      skillPixelLine(-5,-3,6,-8,'#69b0b3',2);skillPixelLine(-3,3,8,7,'#86b9b4',2);
      skillPixelLine(-2,-6,2,5,'#bce6d4',3);skillPixelLine(0,0,13,0,'#fff4c5',3);
    }
    ctx.restore();return true;
  }
  if(e.skillFx==='smgFire'||e.skillFx==='smgTrail'){
    const trail=e.skillFx==='smgTrail',cap=trail?Math.min(52,Math.hypot(e.tx-e.x,e.ty-e.y)):11;
    ctx.save();ctx.translate(trail?e.tx:e.x,trail?e.ty:e.y);ctx.rotate(e.angle);
    ctx.globalAlpha*=1-t;const start=trail?-cap:0;
    ctx.fillStyle='#399fa6';ctx.fillRect(start,-2,cap,4);
    ctx.fillStyle='#c8f2cf';ctx.fillRect(start,-1,cap*.8,2);
    if(!trail){skillPixelLine(1,0,8,-4,'#65c7be');skillPixelLine(2,1,7,3,'#8dd7b9')}
    ctx.restore();return true;
  }
  if(e.skillFx==='shellArc'){
    const h=100+(e.salvoIndex||0)*8,dx=e.tx-e.x,dy=e.ty-e.y;
    const at=u=>[e.x+dx*u,e.y+dy*u-4*h*u*(1-u)];
    const [x,y]=at(t),[tx,ty]=at(Math.max(0,t-.075));
    skillPixelLine(tx,ty,x,y,'#788481',3);
    skillPixelLine((tx+x)/2,(ty+y)/2,x,y,'#b4d8bb',2);
    const angle=Math.atan2(dy-4*h*(1-2*t),dx);
    ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(angle);
    ctx.fillStyle='#2a3239';ctx.fillRect(-5,-2,9,5);
    ctx.fillStyle='#859ba2';ctx.fillRect(-4,-1,7,2);
    ctx.fillStyle='#e3d4ac';ctx.fillRect(3,-1,2,2);
    ctx.fillStyle='#b18765';ctx.fillRect(-5,-3,2,2);ctx.fillRect(-5,2,2,2);
    ctx.fillStyle='#7ed9ce';ctx.fillRect(-9,-1,5,2);ctx.restore();return true;
  }
  return false;
}

function drawSiegeShock(e){
  if(!e.awakened || e.skillFx!=='blast' || e.age>=.25)return;
  const t=e.age/.25,r=8+t*(e.radius||52)*.64;
  ctx.save();ctx.globalAlpha*=1-t;
  for(let i=0;i<12;i++){
    const a=i*TAU/12,b=a+.24;
    skillPixelLine(e.x+Math.cos(a)*r,e.y+Math.sin(a)*r*.38,
      e.x+Math.cos(b)*r,e.y+Math.sin(b)*r*.38,i%3?'#b18662':'#9cd1bf',2);
  }
  ctx.restore();
}
