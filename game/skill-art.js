'use strict';

const skillArt = Object.fromEntries(Object.entries({
  bunker: 'bunker', mechFold: 'bulk-fold', squadBoard: 'squad-board', bulkRounds: 'bulk-ballistics',
  ravenAim: 'raven-aim', ravenEcho: 'raven-echo', ravenRounds: 'raven-ballistics',
  lynxAim: 'lynx-aim', lynxPierce: 'lynx-pierce', lynxBeam: 'lynx-beam',
  hammerFx: 'hammer-fx', hammerBlast: 'hammer-blast'
}).map(([id, name]) => [id, 'art/skills/' + name + '.png']));

const bunkerWidth = 112;
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

function skillAimPose(m, s) {
  const since = s.age - s.lastFire;
  if (m.id === 1) {
    const fired = m.shotColumn === 3 ? 3 : 1;
    return {sheet:art.ravenAim, w:112, h:72, fx:54, fy:65, px:53, py:36,
      col:since < .042 ? fired : since < .096 ? fired+1 : 0};
  }
  return {sheet:art.lynxAim, w:96, h:64, fx:32, fy:60, px:30, py:33,
    col:s.phase === 'charge' ? (s.age < .18 ? 0 : 1)
      : since < .064 ? 3 : since < .136 ? 4 : since < .27 ? 5 : since < .422 ? 6 : 2};
}

function hammerFlip(m) { return m.flip < 0 ? -1 : 1; }

function rifleSkillItem(m){
  const family=m.id===1?'smg':'sniper';
  return m.weapon.family===family?m.weapon:gearByKey.get(family+'-0');
}

// Each position comes from the corresponding frame's gun tip. Combat calls this
// before it spawns the round; camera movement never changes an in-flight origin.
function skillShotSocket(m, s, angle, hand = 0) {
  if (m.id === 0) {
    const west = Math.cos(angle) < 0, front = Math.sin(angle) >= 0;
    const u = front ? (west ? .145 : .86) : (west ? .10 : .90);
    const v = front ? .735 : .12;
    return {x:s.x + (u-.5)*bunkerWidth, y:s.y + (v-.92)*bunkerWidth*art.bunker.height/art.bunker.width};
  }
  if (m.id === 3) {
    if(!s)return combatMuzzle(m,1,true);
    const pose=hammerMortarPose(m,s);
    return {x:s.x+pose.facing*(pose.x+pose.reach*Math.cos(pose.pitch)),
      y:s.y+pose.y+pose.reach*Math.sin(pose.pitch)};
  }
  const item=rifleSkillItem(m), fit=weaponSockets[item.family][item.tier];
  if (s.phase === 'spin') {
    const tip = fit.turn[spinStep(s.angle)][hand];
    return {x:m.x+tip[0]-54, y:m.y+crewTorsoY(m)+tip[1]-65};
  }
  const pose = skillAimPose(m, s), flip = Math.cos(angle) < 0 ? -1 : 1;
  const tip = m.id===1?fit.forward[hand]:fit.firingTip;
  const pitch = Math.atan2(Math.sin(angle), Math.abs(Math.cos(angle)));
  const u = tip[0]-pose.px, v = tip[1]-pose.py;
  return {
    x:m.x + flip*(pose.px-pose.fx + u*Math.cos(pitch)-v*Math.sin(pitch)),
    y:m.y + crewTorsoY(m) + pose.py-pose.fy + u*Math.sin(pitch)+v*Math.cos(pitch)
  };
}

function drawRifleSkill(m, s) {
  const p = skillAimPose(m, s);
  const flip = Math.cos(s.angle) < 0 ? -1 : 1;
  const pitch = Math.atan2(Math.sin(s.angle), Math.abs(Math.cos(s.angle)));
  ctx.save();
  ctx.translate(Math.round(m.x), Math.round(m.y));
  ctx.scale(flip, 1);
  if(m.moving || crewOutfitSheet(m))drawCrewBody(ctx,m,m.moving);
  else skillCell(p.sheet,p.col,0,p.w,p.h,0,0,p.fx,p.fy);
  ctx.translate(p.px-p.fx, p.py-p.fy+crewTorsoY(m));
  ctx.rotate(pitch);
  const item=rifleSkillItem(m);
  skillCell(art[item.artKey+'-skill'],p.col,0,p.w,p.h,0,0,p.px,p.py);
  const glove=fieldGear(m.loadout,'gloves');
  if(glove)for(const [x,y] of skillGrips[item.family][p.col]){
    ctx.drawImage(glove,x-p.px-4,y-p.py-2,8,5);
  }
  ctx.restore();
}

function drawSpinner(m, s) {
  const i = spinStep(s.angle);
  if (!reduceMotion.matches) {
    ctx.save();
    for (let back = 3; back >= 1; back--) {
      const old = (i - back * 2 + 16) % 16, a = old * TAU / 16;
      ctx.globalAlpha = (4-back)*.18;
      skillCell(art.ravenEcho,old%8,(3-back)*2+Math.floor(old/8),112,72,
        m.x-Math.cos(a)*back*4,m.y+Math.sin(a)*back*1.6,54,65);
    }
    for (let hand=0;hand<2;hand++) {
      const tip=s.angle+hand*Math.PI;
      for (let j=0;j<5;j++) {
        const a=tip-1.7+j*.34, b=a+.32;
        ctx.globalAlpha=(j+1)*.14;
        line(m.x+Math.cos(a)*41,m.y-25+Math.sin(a)*14,
          m.x+Math.cos(b)*41,m.y-25+Math.sin(b)*14,j>2?'#ffc37b':'#c46650',1+j*.5);
      }
    }
    ctx.restore();
  }
  const spin=art[rifleSkillItem(m).artKey+'-skill'];
  const glove=fieldGear(m.loadout,'gloves');
  if(!m.moving && !crewOutfitSheet(m) && !glove){
    skillCell(spin,i%8,1+Math.floor(i/8),112,72,m.x,m.y,54,65);
    return;
  }
  const row=Math.floor(i/8);
  const y=m.y+crewTorsoY(m), facing=Math.cos(s.angle)<0?-1:1;
  const hands=(near)=>{
    skillCell(spin,i%8,(near?5:3)+row,112,72,m.x,y,54,65);
    if(!glove)return;
    for(const direction of [i*TAU/16+.32,i*TAU/16+Math.PI-.32]){
      if((Math.sin(direction)>=-.10)!==near)continue;
      ctx.save();ctx.translate(Math.round(m.x+Math.cos(direction)*17),Math.round(y-27+Math.sin(direction)*11));
      ctx.scale(Math.cos(direction)<0?-1:1,1);ctx.drawImage(glove,-3,-2,6,5);ctx.restore();
    }
  };
  hands(false);
  ctx.save();ctx.translate(Math.round(m.x),Math.round(m.y));ctx.scale(facing,1);
  drawCrewBody(ctx,m,m.moving);ctx.restore();
  hands(true);
}

function hammerMortarPose(m,s){
  const plant=clamp(Math.min(s.age/.64,(s.duration-s.age)/.40),0,1);
  const facing=s.plantFacing||hammerFlip(m);
  const weapon=m.weapon.family==='rocket'?m.weapon:gearByKey.get('rocket-0');
  const {image,w,h,bore}=weaponMount({weapon},1);
  const elapsed=s.age-s.lastFire;
  const recoil=elapsed>=0&&elapsed<.12?Math.sin(elapsed/.12*Math.PI)*2:0;
  return {plant,facing,image,w,h,bore,x:Math.round(1+13*plant),y:-32+15*plant,
    pitch:-plant*1.16,reach:w-13-recoil,recoil};
}

function drawHammerSkill(m,s){
  const pose=hammerMortarPose(m,s);
  const {plant,facing,image,w,h,bore,x,y,pitch,reach}=pose;
  ctx.save();ctx.translate(Math.round(s.x),Math.round(s.y));ctx.scale(facing,1);
  const sink=Math.round(8*plant);
  // Keep the face and torso intact while the legs bend into the planted stance.
  const outfit=crewOutfitSheet(m),body=outfit||art.crewBodies,cell=outfit?0:3*192;
  ctx.drawImage(body,cell,82,192,46,-32,-19+sink,96,23-sink);
  ctx.drawImage(body,cell,0,192,82,-32,-60+sink,96,41);
  if(plant>.12){
    const open=12*plant;
    line(x,y+1,x-open,y+19*plant,'#263032',3);
    line(x,y+1,x+open,y+19*plant,'#263032',3);
    line(x,y+1,x+open,y+19*plant,'#858474',1);
  }
  ctx.translate(x,y);ctx.rotate(pitch);
  ctx.drawImage(image,reach-w,-Math.round(h*bore),w,h);
  ctx.fillStyle='#825136';ctx.fillRect(0,3,7,3);
  ctx.fillStyle='#d69a67';ctx.fillRect(1,2,5,3);
  ctx.restore();
  const contact=(s.age-.60)/.24;
  if(contact>=0 && contact<1)skillFlash(art.hammerFx,1,Math.floor(contact*8),64,64,32,32,s.x+facing*17,s.y,0,.8);
}

function boardBunker(s, p) {
  for (const m of run.squad) {
    if (m.hp <= 0 || m.deployed === false) continue;
    const from = s.boardFrom?.[m.id] || m;
    const x = from.x+(s.x-from.x)*p, y = from.y+(s.y-from.y)*p;
    ctx.save();
    ctx.globalAlpha *= Math.min(1,(1-p)*3);
    if (m.id < 3 && !crewOutfitSheet(m) && !fieldGear(m.loadout,'gloves')) skillCell(art.squadBoard,Math.min(3,Math.floor(p*4)),m.id,96,64,x,y,32,60);
    else drawEquippedMember({...m,x,y,moving:p<1,gait:m.gait+p*Math.hypot(s.x-from.x,s.y-from.y)});
    ctx.restore();
  }
  for(const [i,ally] of (run.radioTeam||[]).entries()){
    const from=s.radioFrom?.[i];
    if(ally.hp<=0 || !from)continue;
    ctx.save();ctx.globalAlpha*=Math.min(1,(1-p)*3);
    cctRadioSprite({...ally,x:from.x+(s.x-from.x)*p,y:from.y+(s.y-from.y)*p,moving:p<1,gait:ally.gait+p*Math.hypot(s.x-from.x,s.y-from.y)/summonScale});
    ctx.restore();
  }
}

function foldEase(value) {
  const u = clamp(value,0,1);
  return u*u*(3-2*u);
}

function foldingMech(s, baseline, armorEdge) {
  const x = Math.round(s.x-56), y = Math.round(baseline);
  const bend = foldEase((s.age-.10)/.23);
  const crouched = foldEase((s.age-.22)/.10);
  const reveal = foldEase(s.age/.065);
  // Feet are registered to row 140 in both cells. Take the weight on the
  // shins and upper legs first, leaving the head, cockpit and soles rigid.
  const leg = Math.round(59*(1-.90*bend)), waist = Math.round(25*(1-.55*bend));
  ctx.save();
  ctx.beginPath();ctx.rect(x,armorEdge,112,Math.max(0,y-armorEdge+1));ctx.clip();
  if (crouched < 1) {
    ctx.save();
    const jointEdge=y-Math.round(crouched*100);
    ctx.beginPath();ctx.rect(x,y-145,112,145+jointEdge-y);ctx.clip();
    ctx.globalAlpha *= reveal;
    ctx.drawImage(art.mechFold,0,126,112,14,x,y-14,112,14);
    ctx.drawImage(art.mechFold,0,67,112,59,x,y-14-leg,112,leg);
    ctx.drawImage(art.mechFold,0,42,112,25,x,y-14-leg-waist,112,waist);
    ctx.drawImage(art.mechFold,0,0,112,42,x,y-14-leg-waist-42,112,42);
    ctx.restore();
  }
  if (crouched > 0) {
    ctx.save();
    const reach=Math.ceil(crouched*100);
    ctx.beginPath();ctx.rect(x,y-reach,112,reach+1);ctx.clip();
    skillCell(art.mechFold,1,0,112,144,s.x,y,56,140);
    ctx.restore();
  }
  ctx.restore();
  return 132-65*bend;
}

function drawBunker(s) {
  const h = bunkerWidth*art.bunker.height/art.bunker.width;
  const baseline = s.y+h*.08;
  const deploy = s.phase==='deploy';
  footShadow(s.x,s.y-1,43*(deploy ? clamp(s.age/.12,0,1) : 1));
  let top = s.y-h*.92, sealEdge = baseline;
  if (deploy) {
    const seal = foldEase((s.age-.41)/.15);
    // The new hull closes from the hatch to the planted feet. Two complementary
    // masks keep the crew compartment solid throughout the transition.
    sealEdge = seal>0 ? Math.ceil(baseline-h+(h+1)*seal) : baseline-144;
    const mechHeight = foldingMech(s,baseline,sealEdge);
    top = Math.min(baseline-mechHeight,seal>0 ? baseline-h : baseline);
    if (s.age < .36) boardBunker(s,clamp(s.age/.36,0,1));
  }
  ctx.save();
  if (deploy) {
    ctx.beginPath();ctx.rect(s.x-bunkerWidth/2-1,baseline-145,bunkerWidth+2,145+sealEdge-baseline);ctx.clip();
  }
  ctx.drawImage(art.bunker,Math.round(s.x-bunkerWidth/2),Math.round(s.y-h*.92),bunkerWidth,h);
  ctx.restore();
  ctx.fillStyle='#172220';ctx.fillRect(s.x-23,top-8,46,6);
  ctx.fillStyle=s.hp>s.maxHp*.3?'#b2c294':'#e49460';ctx.fillRect(s.x-22,top-7,Math.ceil(44*s.hp/s.maxHp),4);
  leaderChevron(s.x,top-14);
}

function drawSkillRound(shot,x,y,angle) {
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
  } else if (e.skillFx === 'spinEcho' && !reduceMotion.matches) {
    const step=spinStep(e.angle);
    ctx.save();ctx.globalAlpha *= .28*(1-e.age/e.duration);
    skillCell(art.ravenEcho,step%8,4+Math.floor(step/8),112,72,e.x,e.y,54,65);
    ctx.restore();
  }
}

function drawSkillFX(e) {
  const t = clamp(e.age/e.duration,0,1);
  switch (e.skillFx) {
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
    case 'shellArc': drawShellFlight(e); break;
    case 'smgFire': {
      const col = frameAt(e.age,[.012,.033,.052,.067,.079,.09]);
      if (col>=0) skillFlash(art.ravenRounds,1,col,72,56,7,28,e.x,e.y,e.angle,.92);
      break;
    }
    case 'smgTrail': {
      const tail=Math.min(78,Math.hypot(e.tx-e.x,e.ty-e.y))*(1-t);
      ctx.save();ctx.translate(e.tx,e.ty);ctx.rotate(e.angle);ctx.globalAlpha*=.7*(1-t);
      ctx.fillStyle='#d57151';ctx.fillRect(-tail,-1,tail,2);
      ctx.fillStyle='#ffce86';ctx.fillRect(-tail*.45,0,tail*.45,1);ctx.restore();
      break;
    }
    case 'bunkerFire':
      drawTagEffect('bulk_muzzle',e.age,e.x,e.y,e.angle);
      break;
  }
}
