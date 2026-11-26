'use strict';

const skillArt = Object.fromEntries(Object.entries({
  bulkRounds: 'bulk-ballistics',
  ravenMuzzle:'raven-muzzle', ravenRounds: 'raven-ballistics', ravenFlight:'raven-flight', ravenContact:'raven-contact',
  ravenDrift:'raven-drift',
  lynxPierce: 'lynx-pierce', lynxBeam: 'lynx-beam',
  hammerFx: 'hammer-fx', hammerBlast: 'hammer-blast'
}).map(([id, name]) => [id, 'art/skills/' + name + '.png']));

skillArt.bunkerDeploy='art/skills/bulk-shield-deploy.webp';
// World-space offsets from the planted shield to each port in the locked cel.
const bunkerPorts=[[35,-33],[0,-6],[-35,-33],[0,-63]];
const bunkerShellScale=1.48;
const laserEnds = [.032,.072,.120,.178,.238,.313,.410];
const blastEnds = [.036,.080,.137,.201,.275,.358,.444,.538,.641,.749,.865,.997];
const frameAt = (age, ends) => ends.findIndex(end => age < end);
const spinStep = angle => (Math.round(angle * 16 / TAU) % 16 + 16) % 16;

function skillCell(sheet, col, row, w, h, x, y, pivotX, pivotY) {
  ctx.drawImage(sheet, col * w, row * h, w, h, Math.round(x - pivotX), Math.round(y - pivotY), w, h);
}

function skillFlash(sheet, row, col, w, h, px, py, x, y, angle = 0, scale = 1) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  skillCell(sheet, col, row, w, h, 0, 0, px, py);
  ctx.restore();
}

// The short spin streaks, sight glint, and mortar legs share the hard edges
// and metal highlights of the equipment sprites, including on a diagonal.
function skillPixelLine(x1,y1,x2,y2,color,thickness=1){
  const dx=x2-x1,dy=y2-y1,steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))));
  ctx.fillStyle=color;
  for(let i=0;i<=steps;i++){
    ctx.fillRect(Math.round(x1+dx*i/steps),Math.round(y1+dy*i/steps),thickness,thickness);
  }
}

function hammerFlip(m) { return m.flip < 0 ? -1 : 1; }

function rifleSkillFacing(m,angle){
  const horizontal=Math.cos(angle);
  return Math.abs(horizontal)<Math.sin(Math.PI/8)?(m.flip||1):Math.sign(horizontal);
}

function recruitSkillCel(m,s,angle=s.angle){
  const skill=crewMotion.skill*6;
  if(m.id===2){
    const aim=recruitAimCel(m,false,angle);
    if(Math.floor(aim/6)!==crewMotion.level)return aim;
    const step=s.phase==='charge'?Math.min(4,Math.floor(s.age/.09)):s.age-s.lastFire<.13?5:4;
    return skill+step;
  }
  const plant=clamp(Math.min(s.age/.64,(s.duration-s.age)/.40),0,1);
  return skill+Math.min(5,Math.floor(plant*6));
}

// Each position comes from the corresponding frame's gun tip. Combat calls this
// before it spawns the round; camera movement never changes an in-flight origin.
function skillShotSocket(m, s, angle, hand = 0) {
  if(m.id===1){
    const cel=ravenBodyCel(m,s.age-s.lastFire,s);
    return ravenBarrel(m,cel,hand);
  }
  if(s?.awakened && m.id===0)return mechShotSocket(s,angle);
  if(s?.awakened && m.id===3)return siegeShotSocket(m,s,hand);
  if (m.id === 0) {
    const [dx,dy]=bunkerPorts[(Math.round(angle/(Math.PI/2))+4)%4];
    return {x:s.x+dx*bunkerShellScale,y:s.y+dy*bunkerShellScale};
  }
  if (m.id === 3) {
    if(!s)return combatMuzzle(m,1,true);
    return recruitSocket(m,recruitSkillCel(m,s),s.plantFacing||hammerFlip(m),s.x,s.y);
  }
  return recruitSocket(m,recruitSkillCel(m,s,angle),rifleSkillFacing(m,angle));
}

function drawRifleSkill(m,s){
  if(m.id===1){drawRavenCels(ctx,m,s.age-s.lastFire,s);return}
  const facing=rifleSkillFacing(m,s.angle);
  const index=recruitSkillCel(m,s);
  drawRecruit(ctx,{...m,flip:facing},Infinity,false,index);
  if(s.phase==='charge'){
    const tip=recruitSocket(m,index,facing);
    ctx.save();ctx.translate(tip.x,tip.y);ctx.rotate(tip.angle);
    ctx.fillStyle='#73b8c0';ctx.fillRect(-3,-1,5,2);
    if(s.age>.22){ctx.fillStyle='#e4ffdc';ctx.fillRect(-1,-2,2,3)}
    ctx.restore();
  }
}

// World-space ground layer: the outer rim shares its radius with the damage check.
function drawRavenField(m,s){
  const fade=clamp(Math.min(s.age/.12,(s.duration-s.age)/.22),0,1);
  ctx.save();ctx.globalAlpha*=fade;
  ctx.beginPath();ctx.arc(m.x,m.y,ravenFieldRadius,0,TAU);
  ctx.lineWidth=1.5;ctx.strokeStyle='rgba(220,98,106,.75)';ctx.stroke();
  ctx.restore();
}

function drawSpinner(m, s) {
  const orbit=s.ribbonAngle??s.initialAngle;
  const sweep=Math.min(3.4,Math.max(0,orbit-s.initialAngle));
  const rimRadius=48;
  function ribbon(front){
    ctx.save();ctx.translate(m.x,m.y-24);
    for(let hand=0;hand<2;hand++){
      const tip=orbit+hand*Math.PI;
      for(let i=0;i<32;i++){
        const u=i/32,v=(i+1)/32,a=tip-sweep*(1-u),b=tip-sweep*(1-v);
        if((Math.sin((a+b)/2)>0)!==front)continue;
        const radius=rimRadius-8+8*u;
        ctx.globalAlpha=(reduceMotion.matches?.24:.8)*v;
        ctx.strokeStyle='#e42345';ctx.lineWidth=1+5*v;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(radius*Math.cos(a),radius*.57*Math.sin(a));
        ctx.lineTo((40+8*v)*Math.cos(b),(40+8*v)*.57*Math.sin(b));ctx.stroke();
        if(i>16){
          ctx.strokeStyle='#ffa2a9';ctx.lineWidth=1;
          ctx.beginPath();ctx.moveTo((radius+2)*Math.cos(a),(radius+2)*.57*Math.sin(a));
          ctx.lineTo((42+8*v)*Math.cos(b),(42+8*v)*.57*Math.sin(b));ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
  ribbon(false);
  drawRavenCels(ctx,m,s.age-s.lastFire,s);
  ribbon(true);
}

function drawRavenSkillPose(m,angle,spin,since){
  drawRavenCels(ctx,m,since,{angle,phase:spin?'spin':'forward'});
}
function drawSpinPose(m, angle) {
  drawRavenSkillPose(m,angle,true,0);
}

function drawHammerSkill(m,s){
  if(s.awakened){drawSiegeLauncher(m,s);return}
  const facing=s.plantFacing||hammerFlip(m);
  drawRecruit(ctx,{...m,x:s.x,y:s.y,flip:facing},Infinity,false,recruitSkillCel(m,s));
  const contact=(s.age-.60)/.24;
  if(contact>=0 && contact<1)skillFlash(art.hammerFx,1,Math.floor(contact*8),64,64,32,32,s.x+facing*17,s.y,0,.8);
}

function drawBunkerPilot(s,t){
  const member={...run.squad[0],x:0,y:0,flip:1};
  const phase=clamp(t/bunkerCrouchTime,0,1);
  const cel=phase<.1?(s.entryRecruitCel??0):crewMotion.skill*6+Math.min(5,Math.floor(phase*6));
  drawRecruit(ctx,member,Infinity,false,cel);
}

function drawBunker(s) {
  const t=s.phase==='retract'?s.foldTime:s.phase==='deploy'?s.age:bunkerDeployTime;
  const next=frameAt(t,bunkerFrameEnds);
  const frame=t<bunkerPlantTime?-1:next<0?bunkerFrameEnds.length-1:next;
  const top=s.y-73*bunkerShellScale;
  const planted=clamp((t-bunkerPlantTime)/.15,0,1);
  ctx.save();ctx.globalAlpha*=1-planted;
  footShadow(s.x,s.y-1,14);
  ctx.restore();
  ctx.save();ctx.globalAlpha*=planted;
  footShadow(s.x,s.y-1,35*bunkerShellScale);
  ctx.restore();
  const sheet=art.bunkerDeploy,cell=sheet.width/6;
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const facing=s.plantFacing||1;
  const impact=t-bunkerSlamAt;
  const kick=s.phase==='deploy' && !reduceMotion.matches && impact>=0 && impact<.095
    ?1.9*Math.cos(impact*81)*(1-impact/.095)**2:0;
  const shell=i=>{
    ctx.save();ctx.translate(Math.round(s.x),Math.round(s.y)+kick);ctx.scale(facing,1);
    ctx.drawImage(sheet,(i%6)*cell,Math.floor(i/6)*cell,cell,cell,
      -64*bunkerShellScale,-112*bunkerShellScale,128*bunkerShellScale,128*bunkerShellScale);
    ctx.restore();
  };
  if(frame>=1 && frame<=16)shell(18+frame);
  if(frame<17){
    for(const m of run.squad)if(s.entered?.[m.id] && m.hp>0 && m.deployed)drawHero(m);
    ctx.save();ctx.translate(Math.round(s.x),Math.round(s.y));ctx.scale(facing,1);
    drawBunkerPilot(s,t);
    ctx.restore();
  }
  if(frame>=0)shell(frame);
  if(frame===18 && t<bunkerDeployTime){
    const ignition=clamp((t-bunkerLampAt)/.045,0,1);
    const glow=ignition*clamp((bunkerDeployTime-t)/.095,0,1);
    ctx.save();
    ctx.translate(Math.round(s.x),Math.round(s.y));
    ctx.scale(facing*bunkerShellScale*.4,bunkerShellScale*.4);
    // The closed cels differ only around this recessed amber indicator.
    ctx.globalAlpha*=1-ignition;
    ctx.drawImage(sheet,5*cell+150,2*cell+184,20,48,-10,-96,20,48);
    ctx.restore();
    ctx.save();ctx.translate(s.x,s.y-28.8*bunkerShellScale);
    ctx.scale(bunkerShellScale*.57,bunkerShellScale);
    ctx.globalAlpha*=s.phase==='deploy'?glow:0;
    const spill=ctx.createRadialGradient(0,0,0,0,0,12);
    spill.addColorStop(0,'rgba(255,247,196,.92)');
    spill.addColorStop(.25,'rgba(255,186,68,.56)');
    spill.addColorStop(1,'rgba(255,132,36,0)');
    ctx.fillStyle=spill;ctx.fillRect(-12,-12,24,24);ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle='#172220';ctx.fillRect(s.x-23,top-8,46,6);
  ctx.fillStyle=s.hp>s.maxHp*.3?'#b2c294':'#e49460';ctx.fillRect(s.x-22,top-7,Math.ceil(44*s.hp/s.maxHp),4);
  leaderChevron(s.x,top-14);
}

function ravenFlightDistance(shot,time){
  const t=clamp(time/shot.duration,0,1);
  return shot.length*t*(.55+.45*t);
}

// Local +X is the incoming round's heading. Sample the same seed throughout
// a plume's life so its outline, handedness and travel stay coherent.
function drawRavenSmoke(seed,t,size,opacity){
  if(t<=0 || t>=1)return;
  const family=seed%3;
  const speed=.44+((seed>>2)&15)*.028;
  const bend=(((seed>>6)&15)-7.5)*.019;
  const width=size*(.56+((seed>>10)&7)*.04+t*.57);
  const height=width*(.43+((seed>>13)&3)*.06);
  const travel=size*speed*t*(1.75-.75*t);
  const phase=Math.min(3,t*(3.5+((seed>>9)&3)*.12));
  const frame=Math.floor(phase), blend=clamp((phase-frame-.64)/.36,0,1);
  ctx.save();
  ctx.translate(travel,travel*bend*t);
  ctx.rotate(bend*(.25+.75*t));
  if(seed&32768)ctx.scale(1,-1);
  const alpha=ctx.globalAlpha*opacity*Math.min(1,t/.075)*Math.min(1,(1-t)/.32);
  ctx.globalAlpha=alpha*(1-blend);
  ctx.drawImage(art.ravenDrift,frame*112,family*48,112,48,-width*.09,-height*.5,width,height);
  if(blend>0){
    ctx.globalAlpha=alpha*blend;
    ctx.drawImage(art.ravenDrift,(frame+1)*112,family*48,112,48,-width*.09,-height*.5,width,height);
  }
  ctx.restore();
}

// The head and the tail sample different times on the same world-space path.
// After contact the head is pinned while the last section of the wake catches up.
function drawRavenFlight(shot,time){
  if(!shot.duration || reduceMotion.matches)return;
  const accent=!shot.secondary || shot.groundSpark;
  const head=ravenFlightDistance(shot,time);
  const lag=(shot.tracerLength??102)/shot.speed;
  const tail=ravenFlightDistance(shot,time-lag);
  const span=head-tail, after=Math.max(0,time-shot.duration);
  ctx.save();ctx.translate(shot.x,shot.y);ctx.rotate(shot.angle);
  if(accent){
    for(let i=1;i<=2;i++){
      const seed=(shot.smokeSeed+i*23209)&65535;
      const shed=shot.duration*(i*.28+(seed&7)*.008);
      const p=(time-shed)/.19;
      if(p<=0 || p>=1)continue;
      ctx.save();ctx.translate(ravenFlightDistance(shot,shed),0);
      drawRavenSmoke(seed,p,15+i*3,.68);
      ctx.restore();
    }
  }
  if(span>.05){
    const heat=clamp(1-after/lag,0,1);
    const phase=clamp(time/shot.duration,0,1);
    const swell=Math.sin(phase*Math.PI)**2;
    const width=(accent?1.9:1.2)*(1+2.6*swell)*heat;
    ctx.globalAlpha=(accent?.86:.50)*heat;
    ctx.fillStyle=accent?'#ff1649':'#e52350';
    ctx.beginPath();ctx.moveTo(tail,0);ctx.quadraticCurveTo(tail+span*.70,-width*.22,head,-width*.55);
    ctx.lineTo(head,width*.43);ctx.quadraticCurveTo(tail+span*.62,width*.48,tail,0);ctx.fill();
    ctx.fillStyle='#fcaecf';
    ctx.beginPath();ctx.moveTo(head-span*.56,0);ctx.lineTo(head,-width*.20);
    ctx.lineTo(head,width*.16);ctx.fill();
    if(time<shot.duration){
      // Compact at release, stretch through mid-flight, compress just before contact.
      const nose=Math.min(head+2,(accent?22:16)+(accent?37:24)*swell);
      const thick=(accent?12:9)+(accent?20:11)*swell;
      const cel=phase<.52?2*phase/.52:2+(phase-.52)/.48;
      const frame=Math.min(2,Math.floor(cel)), mix=cel-frame;
      const alpha=accent?.98:.78;
      ctx.globalAlpha=alpha*(1-mix);
      ctx.drawImage(art.ravenFlight,96,frame*56,128,56,head-nose,-thick/2,nose,thick);
      ctx.globalAlpha=alpha*mix;
      ctx.drawImage(art.ravenFlight,96,(frame+1)*56,128,56,head-nose,-thick/2,nose,thick);
    }
  }
  ctx.restore();
}

function drawSkillRound(shot,x,y,angle) {
  if(shot.skillRound==='raven'){
    drawRavenFlight(shot,shot.age);
    return true;
  }
  if (!shot.lead || shot.family==='pistol') return false;
  if (shot.id === 0) {
    skillFlash(art.bulkRounds,0,0,40,32,33,16,x,y,angle,shot.skillRound ? .82 : 1);
  } else if (shot.id === 1) {
    if (shot.skillRound) {
      const tail = Math.min(58,Math.hypot(x-shot.x,y-shot.y));
      ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
      ctx.fillStyle='#ad5048';ctx.fillRect(-tail,-1,tail,3);
      ctx.fillStyle='#f8ab67';ctx.fillRect(-tail*.55,0,tail*.55,1);ctx.restore();
    }
    skillFlash(art.ravenRounds,0,Math.floor(shot.age/.03)%6,72,56,40,28,x,y,angle,.91);
  } else if (shot.id === 2) {
    skillFlash(art.lynxPierce,1,Math.floor(shot.age/.036)%5,56,48,32,24,x,y,angle,1.2);
  } else return false;
  return true;
}

function drawShellFlight(e) {
  const t = clamp(e.age/e.duration,0,1), height = e.large ? 115 : 45;
  const dx = e.tx-e.x, dy = e.ty-e.y;
  if (e.age < .115) {
    const launchAngle = Math.atan2(dy-height*4,dx);
    skillFlash(art.ravenRounds,1,Math.min(5,Math.floor(e.age/.019)),72,56,7,28,
      e.x,e.y,launchAngle,e.large ? .88 : .66);
  }
  for (let i=4;i>=0;i--) {
    const u = t-i*.026;
    if (u < 0) continue;
    const x = e.x+dx*u, y = e.y+dy*u-height*4*u*(1-u);
    if (i === 0) {
      const pitch = Math.atan2(dy-height*4*(1-2*u), dx);
      skillFlash(art.hammerFx,3,Math.floor(e.age/.046)%8,64,64,32,32,x,y,pitch,e.large ? 1 : .8);
    } else if (!reduceMotion.matches) {
      ctx.fillStyle = ['','#edb16b','#c59c72','#a79276','#887e6f'][i];
      ctx.fillRect(Math.round(x),Math.round(y),i>2 ? 2 : 3,2);
    }
  }
}

function drawSkillGround(e) {
  if(e.awakened && e.id===3)drawSiegeShock(e);
  if (e.skillFx === 'shellArc') {
    const t = 1-(e.duration-e.age)/(e.large ? .40 : .23);
    if (t>0) skillFlash(art.hammerFx,0,Math.min(7,Math.floor(t*8)),64,64,32,32,
      e.tx,e.ty,0,e.large ? 1 : .62);
  } else if (e.skillFx === 'blast') {
    let col = frameAt(e.age,blastEnds);
    if (col < 0) col=11;
    ctx.save();ctx.globalAlpha *= clamp((e.duration-e.age)/.32,0,1);
    skillCell(art.hammerBlast,col,e.large ? 3 : 0,124,108,e.x,e.y,62,84);
    ctx.restore();
  } else if (e.skillFx === 'ravenGroundHit') {
    const t=e.age/e.duration;
    const shot=e.flight, accent=!shot?.secondary || shot.groundSpark;
    if(shot && e.age<.20)drawRavenFlight(shot,shot.duration+e.age);
    ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle);
    if(reduceMotion.matches){
      ctx.globalAlpha*=.42*(1-t);ctx.fillStyle='#b88b99';ctx.fillRect(-2,0,4,1);
    }else{
      if(e.age<.055){
        const size=accent?44:25;
        ctx.save();ctx.globalAlpha*=1-e.age/.055;
        ctx.drawImage(art.ravenContact,0,0,96,72,-size*30/96,-size*58/96,size,size*.75);
        ctx.restore();
      }
      drawRavenSmoke(shot?.smokeSeed??0,t,accent?63:34,accent?1:.78);
    }
    ctx.restore();
  } else if (e.skillFx === 'spinEcho' && !reduceMotion.matches) {
    const cel=ravenBodyCel(run.squad[1],0,{phase:'spin',angle:e.angle,poseCel:e.poseCel,poseFacing:e.poseFacing});
    const t=e.age/e.duration, shift=7+8*t;
    ctx.save();ctx.globalAlpha*=.62*(1-t);
    ctx.imageSmoothingEnabled=true;
    ctx.translate(e.x+Math.sin(e.angle)*shift,e.y-Math.cos(e.angle)*shift*.6);ctx.scale(cel.facing,1);
    if(e.follow<3)drawRavenFollow(ctx,art.ravenFollowEcho,cel,e.follow,72);
    else ctx.drawImage(art.ravenEcho,cel.index%8*144,Math.floor(cel.index/8)*144,144,144,-36,-67,72,72);
    ctx.restore();
  }
}

function drawSkillFX(e) {
  if(e.awakened && e.skillFx!=='smgFire' && e.skillFx!=='smgTrail' && drawAwakenedEffect(e))return;
  const t = clamp(e.age/e.duration,0,1);
  switch (e.skillFx) {
    case 'ravenStrike': {
      ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle);
      const reach=Math.min(125,e.reach*.8);
      ctx.globalAlpha*=1-t;
      ctx.fillStyle='#ef594b';ctx.beginPath();ctx.moveTo(-reach*(1-t),0);
      ctx.lineTo(-5,-2.5);ctx.lineTo(3,0);ctx.lineTo(-5,2.5);ctx.fill();
      const burst=reduceMotion.matches?6:5+11*Math.sin(t*Math.PI);
      for(let i=0;i<4;i++){
        ctx.rotate(Math.PI*.5);
        ctx.beginPath();ctx.moveTo(-2,0);ctx.lineTo(0,-2);
        ctx.lineTo(burst*(i%2?.6:1),0);ctx.lineTo(0,2);ctx.fillStyle='#ffe5ac';ctx.fill();
      }
      ctx.restore();break;
    }
    case 'railBeam': {
      const row = frameAt(t*.410,laserEnds);
      if (row < 0) return;
      const angle = Math.atan2(e.ty-e.y,e.tx-e.x), length = Math.hypot(e.tx-e.x,e.ty-e.y);
      ctx.save();ctx.translate(e.x,e.y);ctx.rotate(angle);
      ctx.drawImage(art.lynxBeam,0,row*26,160,26,0,-13,length,26);
      ctx.restore();
      const flash = frameAt(e.age,[.024,.056,.096,.144,.192]);
      if (flash>=0) skillFlash(art.lynxPierce,0,flash,56,48,7,24,e.x,e.y,angle,1.25);
      break;
    }
    case 'blast': {
      const col = frameAt(e.age,blastEnds);
      if (col >= 0) {
        const row = e.large ? 4 : 1;
        skillCell(art.hammerBlast,col,row,124,108,e.x,e.y,62,84);
        skillCell(art.hammerBlast,col,row+1,124,108,e.x,e.y,62,84);
      }
      break;
    }
    case 'exhaust': {
      const size=Math.round(3+6*t),x=Math.round(e.x-size/2),y=Math.round(e.y-size/2-4*t);
      ctx.save();ctx.globalAlpha*=.78*(1-t);
      ctx.fillStyle='#242629';ctx.fillRect(x+1,y,size-1,size);ctx.fillRect(x,y+1,size+2,size-2);
      ctx.fillStyle='#424244';ctx.fillRect(x+1,y,Math.max(2,size-3),2);ctx.restore();break;
    }
    case 'shellArc': drawShellFlight(e); break;
    case 'smgFire': {
      ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle);
      ctx.scale(1-t*.7,1-t*.65);ctx.fillStyle='#f2234b';
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(7,-5);ctx.lineTo(6,-2);
      ctx.lineTo(22,0);ctx.lineTo(7,2);ctx.lineTo(9,5);ctx.closePath();ctx.fill();
      ctx.fillStyle='#ffe3d9';ctx.fillRect(0,-1,12,2);ctx.restore();
      break;
    }
    case 'smgTrail': {
      const tail=Math.min(78,Math.hypot(e.tx-e.x,e.ty-e.y))*(1-t);
      ctx.save();ctx.translate(e.tx,e.ty);ctx.rotate(e.angle);ctx.globalAlpha*=.7*(1-t);
      ctx.fillStyle='#d12348';ctx.fillRect(-tail,-1,tail,2);
      ctx.fillStyle='#ffc3c6';ctx.fillRect(-tail*.45,0,tail*.45,1);ctx.restore();
      break;
    }
    case 'bunkerFire':
      drawTagEffect('bulk_muzzle',e.age,e.x,e.y,e.angle);
      break;
  }
}
