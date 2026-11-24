'use strict';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let screenShade;
let shadeAspect = 0;

function ellipse(x, y, rx, ry, color, width = 0, start = 0, end = TAU) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, start, end);
  if (width) {
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function line(x1, y1, x2, y2, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function footShadow(x, y, size) {
  ellipse(x + 1, y, size + 2, size * .34, '#121c263a');
  ellipse(x, y, size * .80, size * .19, '#1d242a77');
}

function drawUnit(frame, row, x, y, flip, width = 64, height = 64) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(flip, 1);
  ctx.drawImage(art.combatUnits, frame * 64, row * 64, 64, 64,
    -Math.round(width / 2), -Math.round(height * 60 / 64), width, height);
  ctx.restore();
}

const tagRoles = ['bulk', 'raven', 'lynx'];
const shoulder = { x: 32, y: 32 };
const tagArt = {
  ...Object.fromEntries(equipmentCatalog.filter(i=>i.weapon || i.family==='shield').flatMap(i=>{
    if(i.family==='shield')return [[i.key,i.asset+'-field.png']];
    if(i.family==='smg')return [[i.key,i.asset+'-near.png'],[i.key+'-far',i.asset+'-far.png'],[i.key+'-pair',itemImage(i)],[i.key+'-skill',i.asset+'-skill.png']];
    if(i.family==='sniper')return [[i.key,itemImage(i)],[i.key+'-skill',i.asset+'-skill.png']];
    return [[i.key,itemImage(i)]];
  })),
  ...Object.fromEntries(equipmentCatalog.filter(i=>armorStats[i.family] && i.tier>0).map(i=>{
    const fitted=i.family==='pants'||i.family==='boots';
    return [i.key,fitted?'art/armory/worn/'+i.family+'-'+(i.rank==='S+'?'S-plus':i.rank)+'.png':itemImage(i)];
  })),
  crewStride:'art/armory/crew-stride.png',
  crewBodies:'art/armory/bodies.png',specialistHands:'art/armory/specialist-hands.png',
  combatUnits: 'combat-units.png',
  cobra:'art/prep/cobra.png',
  infectedBosses: 'art/bosses/infected.png',
  tagRig: 'art/tag-combat/units-rig.png',
  tagEquip: 'art/tag-combat/units-equip.png',
  tagGear: 'art/tag-combat/units-gear.png',
  tagFX: 'art/tag-combat/fx.png'
};

function tagCell(atlas, col, row, x, y) {
  ctx.drawImage(atlas, col * 96, row * 64, 96, 64, x, y, 96, 64);
}

// Contact, compression, passing foot and lift repeat on the other side.
const crewStepY=[0,1,0,-1,0,1,0,-1];
function crewStrideFrame(m){
  const step=Math.floor((m.gait||0)*8/crewStrideLength);
  return (step%8+8)%8;
}
function crewTorsoY(m){
  return m.moving && !reduceMotion.matches?crewStepY[crewStrideFrame(m)]:0;
}
function shoulderAt(m) {
  return {x:Math.round(m.x),y:Math.round(m.y)+shoulder.y-60+crewTorsoY(m)};
}

// Widths are in game pixels. The same native art stays sharp in the larger locker preview.
const fieldWidths={pistol:[18,19,20,21,22],carbine:[29,30,32,34,36],smg:[23,24,25,26,28],
  sniper:[49,52,54,57,60],rocket:[46,47,49,51,53],ar:[34,35,37,39,41]};
// Rear and forward palm centers on the CCT rig, in field pixels from the shoulder.
const rifleHands=[[0,-1],[11,0]];
const fieldHands={
  pistol:[[0,-1],[3,0]], carbine:rifleHands, smg:[[0,-1],[11,-4]],
  sniper:[[0,2],[11,3]], rocket:[[0,-3],[8,-4]], ar:rifleHands
};
function weaponMount(m,col,recoil=0){
  const {family,tier,artKey:key}=m.weapon,far=family==='smg' && col===3;
  const image=art[far?key+'-far':key];
  const w=fieldWidths[family][tier],h=Math.round(w*image.height/image.width);
  const fit=weaponSockets[far?'smgFar':family][tier];
  const [x,y]=fieldHands[family][far || family==='rocket'?1:0];
  return {image,w,h,x:x-recoil-Math.round(w*fit.grip[0]),y:y-Math.round(h*fit.grip[1]),
    gripX:x-recoil,gripY:y,bore:fit.bore};
}
function combatAim(m,tx,ty,col){
  const pivot=shoulderAt(m),dx=tx-pivot.x,dy=ty-pivot.y;
  m.flip=dx<0?-1:dx>0?1:m.flip;
  const mount=weaponMount(m,col),offset=mount.y+mount.h*mount.bore;
  m.aimPitch=Math.atan2(dy,Math.abs(dx))-Math.asin(clamp(offset/Math.max(1,Math.hypot(dx,dy)),-1,1));
  m.aimAngle=Math.atan2(Math.sin(m.aimPitch),m.flip*Math.cos(m.aimPitch));
}
function combatMuzzle(m,col,lead,pitch=m.aimPitch??0){
  const pivot=shoulderAt(m),part=weaponMount(m,col,2);
  const u=part.x+part.w,v=part.y+part.h*part.bore;
  return {x:pivot.x+m.flip*(u*Math.cos(pitch)-v*Math.sin(pitch)),y:pivot.y+u*Math.sin(pitch)+v*Math.cos(pitch)};
}
function drawCrewBody(g,m,moving){
  const sheet=crewOutfitSheet(m),frame=crewStrideFrame(m);
  const sprite=sheet || (moving?art.crewStride:art.crewBodies);
  const x=sheet?(moving?frame+1:0)*192:(moving?frame:m.id)*192;
  const y=!sheet && moving?m.id*128:0;
  if(moving && reduceMotion.matches && crewStepY[frame]){
    // Pin the torso while retaining the authored ground-contact position.
    const hip=80, shift=crewStepY[frame]*2, split=hip+shift;
    g.drawImage(sprite,x,y,192,split,-32,-60-shift/2,96,split/2);
    g.drawImage(sprite,x,y+split,192,128-split,-32,-60+hip/2,96,(128-hip)/2);
  }else g.drawImage(sprite,x,y,192,128,-32,-60,96,64);
}
// Hand positions are relative to the same shoulder pivot used for shot origins.
// The forearm and forward palm are separate so the two SMGs can recoil independently.
function drawCrewHand(g,id,forward,x,y,glove){
  const sx=forward?76:0,width=forward?116:76;
  const offsetX=x-(forward?11:0),offsetY=y-(forward?0:-1);
  g.drawImage(art.specialistHands,id*192+sx,0,width,128,sx/2-32+offsetX,-32+offsetY,width/2,64);
  if(glove)g.drawImage(glove,x-4,y-3,8,6);
}
function drawMemberGear(g,m,age,moving=false){
  const id=m.id,dy=moving?crewTorsoY(m):0,glove=fieldGear(m.loadout,'gloves');
  const family=m.weapon.family;
  g.save();g.translate(Math.round(m.x),Math.round(m.y));g.scale(m.flip||1,1);
  drawCrewBody(g,m,moving);
  if(id===0)g.drawImage(art[m.shieldItem||'shield-0'],-19,-39+dy,25,37);
  g.save();g.translate(0,-28+dy);
  g.rotate((m.aimPitch||0)*clamp((.34-age)/.12,0,1));
  for(const col of (family==='smg'?[3,1]:[1])){
    const kick=age<.055 && (m.shotColumn||1)===col?2:0;
    const mount=weaponMount(m,col,kick);
    g.drawImage(mount.image,mount.x,mount.y,mount.w,mount.h);
    if(family==='ar'){
      const end=mount.x+mount.w,beamY=Math.round(mount.y+mount.h*mount.bore);
      g.fillStyle='#94322e';g.fillRect(end+1,beamY,2,1);g.fillRect(end+5,beamY,1,1);
      g.fillStyle='#ff5147';g.fillRect(end+8,beamY-1,2,2);
    }
    if(family==='smg'){
      drawCrewHand(g,id,col===3,mount.gripX,mount.gripY,glove);
    }else{
      const [rear,forward]=fieldHands[family];
      if(id!==0)drawCrewHand(g,id,true,forward[0]-kick,forward[1],glove);
      drawCrewHand(g,id,false,rear[0]-kick,rear[1],glove);
    }
  }
  g.restore();
  g.restore();
}
function drawCrewPreview(canvas,id,row){
  const g=canvas.getContext('2d');g.imageSmoothingEnabled=false;
  const weapon=gearByKey.get(row.weapon);
  g.save();g.scale(canvas.width/84,canvas.height/64);
  drawMemberGear(g,{id,weapon,loadout:row,shieldItem:row.shield,flip:1,x:weapon.family==='sniper'?29:38,y:60},Infinity);
  g.restore();
}
function drawEquippedMember(m){
  const age=run.t-(m.lastShot??-Infinity);
  ctx.save();if(m.hurt>.55)ctx.globalAlpha*=.72;
  drawMemberGear(ctx,m,age,m.moving);ctx.restore();
}

function drawCrystal(g) {
  const rare = g.val > 1;
  const phase = run.t * 3.3 + (g.seed ?? (Math.floor(g.x / 20) + Math.floor(g.y / 20))) * 1.93;
  const x = Math.round(g.x), base = Math.round(g.y);
  const y = base - 4 - Math.round(reduceMotion.matches ? 0 : Math.sin(phase) * 1.6);
  const r = rare ? 6 : 4;
  ellipse(x, base + 1, r + 1, 2, '#15272969');
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -r - 1); ctx.lineTo(r, -2); ctx.lineTo(r, 1);
  ctx.lineTo(0, r + 2); ctx.lineTo(-r, 1); ctx.lineTo(-r, -2); ctx.closePath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rare ? '#583e28' : '#1a4549';
  ctx.stroke();
  ctx.fillStyle = rare ? '#f2bc64' : '#6cd2c3';
  ctx.fill();
  ctx.fillStyle = rare ? '#9b633d' : '#328c88';
  ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, -1); ctx.lineTo(0, r + 1); ctx.fill();
  ctx.fillStyle = rare ? '#fff3c1' : '#d7fff0';
  ctx.fillRect(-2, -r + 1, 2, 2);
  if (rare && Math.sin(phase) > .48) {
    ctx.fillRect(r - 2, -r - 4, 1, 5);
    ctx.fillRect(r - 4, -r - 2, 5, 1);
  }
  ctx.restore();
}

function leaderChevron(x, y) {
  x = Math.round(x); y = Math.round(y);
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(-5, -4); ctx.lineTo(0, -2); ctx.lineTo(5, -4);
  ctx.lineTo(5, 0); ctx.lineTo(0, 3); ctx.lineTo(-5, 0); ctx.closePath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#3b3128'; ctx.stroke();
  ctx.fillStyle = '#ffce75'; ctx.fill();
  ctx.fillStyle = '#fff3c6'; ctx.fillRect(-4, -3, 2, 1); ctx.fillRect(2, -3, 2, 1);
  ctx.restore();
}

function drawDowned(m) {
  footShadow(m.x,m.y,14);
  ctx.save();ctx.translate(Math.round(m.x),Math.round(m.y));
  ctx.save();const scale=.72*(m.side?summonScale:1);ctx.scale(scale,scale);ctx.rotate(-Math.PI*.45);
  drawMemberGear(ctx,{...m,id:m.id??4,loadout:m.loadout||run.squad[4].loadout,weapon:m.weapon||run.squad[4].weapon,x:5,y:13,flip:1},Infinity);
  ctx.restore();
  const progress=(m.reviveTime||0)/3;
  ctx.fillStyle='#152322';ctx.fillRect(-24,-32,48,15);
  ctx.textAlign='center';ctx.font='10px Arcade, sans-serif';ctx.fillStyle='#ffe3ae';
  ctx.fillText(progress?'구조 '+Math.min(99,Math.floor(progress*100))+'%':'구조 3초',0,-21);
  ctx.fillStyle='#354d48';ctx.fillRect(-23,-18,46,3);
  ctx.fillStyle='#a6ddae';ctx.fillRect(-23,-18,Math.round(46*progress),3);
  ctx.restore();
}

function drawHero(m) {
  const lead = m.id === run.lead;
  footShadow(m.x, m.y, 12);
  if (lead) {
    ellipse(m.x, m.y, 17, 5, '#342d25aa', 3, .04, 3.10);
    ellipse(m.x, m.y, 17, 5, '#edbf68', 1.5, .07, 3.07);
  }
  const skill = run.activeSkill?.id === m.id ? run.activeSkill : null;
  if(skill?.id===3)drawHammerSkill(m,skill);
  else if(skill?.phase==='spin')drawSpinner(m,skill);
  else if(skill)drawRifleSkill(m,skill);
  else drawEquippedMember(m);
  if (lead) leaderChevron(m.x, m.y - [57,55,55,51,55][m.id]);
}

function drawBossSprite(stage, frame, x, y, flip, hit, height = 88) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(flip, 1);
  ctx.drawImage(hit ? art.infectedBossHit : art.infectedBosses,
    frame * 96, (stage - 1) * 88, 96, 88, -48, -Math.round(83 * height / 88), 96, height);
  ctx.restore();
}

function drawInfectedBoss(e) {
  const stage = e.stage || e.pattern?.stage || run.stage;
  const marks = e.pattern?.marks || [];
  const cfg = bossPatterns[stage - 1];
  const active = marks.find(mark => !mark.done);
  let frame = 0, flip = e.flip, height = 88;
  if (active || marks.length) {
    if (stage === 3) {
      // Each spore marks a fresh target before its impact. The launcher's
      // recoil follows that individual shot, even as older marks expire.
      const latest = marks[marks.length - 1];
      frame = latest.age >= .23 && latest.age < .45 ? 3 : 2;
    } else {
      frame = !active || active.age >= cfg.windup ? 3 : 2;
      if (stage === 1 && Math.abs(marks[0].dx) > .1) flip = Math.sign(marks[0].dx);
    }
  } else if (!reduceMotion.matches) {
    const inContact = run.squad.some(m => m.deployed && m.hp > 0 && Math.hypot(e.x-m.x,e.y-m.y) <= 11);
    const phase = run.t * (stage === 2 ? 3.6 : 4.5) + e.phase;
    frame = inContact ? 0 : Math.floor(phase) % 2;
    height += Math.sin(phase * Math.PI) > .5 ? 1 : 0;
  }
  footShadow(e.x, e.y, stage === 2 ? 23 : 19);
  drawBossSprite(stage, frame, e.x, e.y, flip, e.hit > .052, height);
}

function drawEnemy(e) {
  const heavy = e.type === 2;
  if (e.boss) drawInfectedBoss(e);
  else {
    const phase = run.t * [5.4, 8.5, 3.9][e.type] + e.phase;
    const lift = reduceMotion.matches ? 0 : Math.abs(Math.sin(phase * Math.PI / 2)) * (heavy ? .65 : 1.1);
    footShadow(e.x, e.y, heavy ? 12 : 7.5);
    drawUnit(Math.floor(phase) % 4, 3 + e.type + (e.hit > .052 ? 6 : 0), e.x, e.y - lift, e.flip);
  }
  if (run.mark === e && run.lead === 2) {
    const y = chestY(e);
    const spread = 9 + Math.round(Math.sin(run.t * 5));
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
      const x0 = Math.round(e.x) + dx * spread, y0 = Math.round(y) + dy * spread;
      line(x0, y0, x0 - dx * 4, y0, '#fcce7c', 2);
      line(x0, y0, x0, y0 - dy * 4, '#fcce7c', 2);
    }
  }
  if (heavy && !e.boss && e.hp < e.max) {
    const x = Math.round(e.x) - 10, y = Math.round(e.y) - 51;
    ctx.fillStyle = '#302b2c'; ctx.fillRect(x, y, 20, 4);
    ctx.fillStyle = '#da926a'; ctx.fillRect(x + 1, y + 1, Math.ceil(18 * Math.max(0, e.hp) / e.max), 2);
  }
}

function drawTagEffect(name, age, x, y, angle = 0) {
  const clip = tagAtlas.fx[name];
  let ms = Math.max(0, age * 1000);
  if (clip.loop) ms %= clip.durationMs.reduce((a, b) => a + b, 0);
  let col = 0;
  while (col < clip.durationMs.length && ms >= clip.durationMs[col]) ms -= clip.durationMs[col++];
  if (col === clip.durationMs.length) return;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(angle);
  ctx.drawImage(art.tagFX, col * 48, clip.row * 48, 48, 48, -clip.pivot[0], -clip.pivot[1], 48, 48);
  ctx.restore();
}

function drawTracer(mark) {
  const t = clamp(mark.age / mark.duration, 0, 1);
  const dx = mark.tx - mark.x, dy = mark.ty - mark.y;
  const x = mark.x + dx * t, y = mark.y + dy * t;
  const angle = mark.angle ?? Math.atan2(dy, dx);
  if (drawSkillRound(mark,x,y,angle)) return;
  if (mark.lead && mark.id<3 && mark.family!=='pistol') {
    drawTagEffect(tagRoles[mark.id] + '_bullet', mark.age, x, y, angle);
  } else {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    ctx.fillStyle = '#b28d59'; ctx.fillRect(-5, -1, 5, 2);
    ctx.fillStyle = '#ffedb5'; ctx.fillRect(-2, -1, 2, 1);
    ctx.restore();
  }
}

function drawEffect(e) {
  if(e.clip==='support_tracer'){line(e.x,e.y,e.tx,e.ty,'#ffe1a7',1.6);return}
  if (e.skillFx) { drawSkillFX(e); return; }
  if (e.clip === 'brass') {
    if (reduceMotion.matches) return;
    const t = e.age / e.duration;
    if (e.id === 0 && e.lead) {
      skillFlash(art.bulkRounds,1,Math.min(4,Math.floor(t*5)),40,32,20,16,
        e.x + e.flip*t*3,e.y+23*t-13*Math.sin(Math.PI*t),0,.65);
    } else drawTagEffect('brass', e.age, e.x - e.flip * t * 16, e.y - Math.sin(t * Math.PI) * 12 + 22 * t * t);
  } else if (e.clip && e.clip.endsWith('_muzzle')) {
    const m = run.squad[e.id];
    if (!m || m.deployed === false || m.hp <= 0 || m.lastShot !== e.shotTime ||
      (m.id === run.lead) !== e.lead || run.activeSkill?.id === 0) return;
    const tip=combatMuzzle(m,e.col,e.lead,m.aimPitch);
    drawTagEffect(e.clip, e.age, tip.x, tip.y, e.angle);
  } else if (e.clip === 'pierce_exit' || (e.clip === 'hit_spark' && e.lead)) {
    const col = Math.min(4,Math.floor(e.age/e.duration*5));
    if (e.id === 0) skillFlash(art.bulkRounds,2,col,40,32,16,16,e.x,e.y,e.angle);
    else if (e.id === 1) skillFlash(art.ravenRounds,2,col,72,56,34,28,e.x,e.y,e.angle);
    else if (e.id === 2) skillFlash(art.lynxPierce,2,col,56,48,17,24,e.x,e.y,e.angle);
    else drawTagEffect(e.clip,e.age,e.x,e.y,e.angle);
  } else if (e.clip) {
    drawTagEffect(e.clip, e.age, e.x, e.y, e.angle);
  } else if (e.row === 3) {
    const frame = Math.min(5, Math.floor(e.age / e.duration * 6));
    ctx.drawImage(art.fx, frame * 128, 3 * 72, 128, 72, e.x - e.w * .36, e.y - e.w * .43, e.w, e.w * .56);
  }
}

function drawDown(cue, t) {
  const id = cue.id, size = id === 2 ? 1.4 : 1;
  const dx = Math.cos(cue.angle || 0);
  const opacity = ctx.globalAlpha;
  if (t < .70) {
    const p = t / .70;
    ctx.globalAlpha = opacity * (1 - p) * .83;
    const flip = cue.flip || (dx > 0 ? -1 : 1);
    if (cue.bossStage) drawBossSprite(cue.bossStage, 3, cue.x + dx*p*6, cue.y, flip, false, 88-p*47);
    else drawUnit(2, 3 + id, cue.x + dx * p * 6, cue.y, flip, 64 + p * 4, 64 - p * 35);
  }
  ctx.globalAlpha = opacity * (1 - t) * .65;
  const frame = Math.min(5, Math.floor(t * 6));
  const w = (18 + t * 12) * size;
  ctx.drawImage(art.fx, frame * 128, 2 * 72, 128, 72, cue.x - w * .36, cue.y - w * .42, w, w * .56);
  ctx.globalAlpha = opacity;
}

function drawGroundCue(cue) {
  const t = clamp(cue.age / cue.duration, 0, 1);
  if (cue.kind === 'down') { drawDown(cue, t); return; }
  if (cue.kind !== 'guard' && cue.kind !== 'swap') return;
  const guard = cue.kind === 'guard';
  const member = run.squad[cue.id];
  const x = guard ? cue.x : member.x, y = guard ? cue.y : member.y;
  const r = guard ? 7 + (cue.size - 7) * (1 - (1 - t) ** 2) : 12 + 20 * t;
  const flatten = guard ? .63 : .39;
  const ink = guard ? '#8ac8ff' : '#ffd184';
  const opacity = ctx.globalAlpha;
  ctx.globalAlpha = opacity * (1 - t) * .15;
  ellipse(x, y, r, r * flatten, ink);
  ctx.globalAlpha = opacity * (1 - t) * .90;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + .12 + (guard ? 0 : t * .4);
    ellipse(x, y, r, r * flatten, ink, 2 - t, a, a + 1.22);
  }
  ctx.globalAlpha = opacity;
}

function drawAirCue(cue) {
  const t = clamp(cue.age / cue.duration, 0, 1);
  const opacity = ctx.globalAlpha;
  if (cue.kind === 'swap') {
    const m = run.squad[cue.id];
    drawTagEffect('tag_pulse', cue.age, m.x, m.y - 57);
  } else if (cue.kind === 'guard') {
    const angle = cue.angle || 0;
    ctx.globalAlpha = opacity * (1 - t) * .83;
    for (let i = 0; i < 4; i++) {
      const a = angle + (i - 1.5) * .33, r = 15 + t * 10;
      const x = cue.x + Math.cos(a) * r, y = cue.y - 10 + Math.sin(a) * r * .56;
      line(x, y, x, y - 5 - 7 * Math.sin((i + 1) * Math.PI / 5), '#a2cefc', 2);
    }
  } else if (cue.kind === 'hurt') {
    const m = run.squad[cue.id];
    ctx.globalAlpha = opacity * (1 - t) * .85;
    const r = 12 + t * 10;
    ellipse(m.x, m.y - 17, r, r, '#fc9578', 2, 3.4, 4.42);
    ellipse(m.x, m.y - 17, r, r, '#fc9578', 2, .25, 1.15);
  } else if (cue.kind === 'pickup' || cue.kind === 'equip') {
    const equip = cue.kind === 'equip';
    const x = equip ? run.squad[cue.id].x : cue.x;
    const y = (equip ? run.squad[cue.id].y : cue.y) - 5;
    const count = equip ? 7 : 3;
    ctx.globalAlpha = opacity * (1 - t) * .83;
    ctx.fillStyle = equip ? '#ffda8d' : '#a9eddc';
    for (let i = 0; i < count; i++) {
      const a = TAU * i / count + .4, r = (equip ? 12 : 6) * (1 + t * .65);
      ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * .5 - 13 * t), 2, 2 + 2 * (1 - t));
    }
  }
  ctx.globalAlpha = opacity;
}

function drawFloorCues(state, opacity, visible, draw) {
  for (const cue of state.cues) {
    const attached = cue.kind === 'swap' || cue.kind === 'hurt' || cue.kind === 'equip';
    const anchor = attached ? run.squad[cue.id] : cue;
    if (attached && (anchor.deployed === false || run.activeSkill?.id === 0)) continue;
    if ((!attached && !opacity) || !visible(anchor.x, anchor.y)) continue;
    ctx.globalAlpha = attached ? 1 : opacity;
    draw(cue);
  }
}

function drawScreenShade() {
  if (shadeAspect !== viewW || !screenShade) {
    shadeAspect = viewW;
    screenShade = document.createElement('canvas');
    screenShade.width = 192; screenShade.height = Math.max(1, Math.round(192 * viewH / viewW));
    const brush = screenShade.getContext('2d'), w = screenShade.width, h = screenShade.height;
    brush.scale(w, h);
    const shade = brush.createRadialGradient(.5, .51, .16, .5, .51, .73);
    shade.addColorStop(0, 'rgba(12,21,26,0)'); shade.addColorStop(.68, 'rgba(12,21,26,.05)');
    shade.addColorStop(1, 'rgba(12,21,26,.21)'); brush.fillStyle = shade; brush.fillRect(0, 0, 1, 1);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(screenShade, 0, 0, viewW, viewH);
  ctx.imageSmoothingEnabled = false;
}

function drawStick() {
  if (!stick || mode !== 'play') return;
  const x = stick.x * viewW / innerWidth, y = stick.y * viewH / innerHeight;
  const l = Math.max(1, Math.hypot(stick.dx, stick.dy)), r = 34;
  ellipse(x, y, r, r, '#121e2699');
  for (let i = 0; i < 4; i++) ellipse(x, y, r, r, '#d5dfd7a0', 2, i * Math.PI / 2 + .12, (i + 1) * Math.PI / 2 - .12);
  const tx = x + stick.dx / l * 25, ty = y + stick.dy / l * 25;
  ellipse(tx, ty, 11, 11, '#f2e0aaac');
  ellipse(tx, ty, 11, 11, '#f9ebc580', 1);
}

function render() {
  if (!run || mode === 'home') return;
  const map=cityMaps[run.floor];
  const cx = Math.round(clamp(run.camera.x - viewW / 2, 0, Math.max(0, map.bounds.w - viewW)));
  const cy = Math.round(clamp(run.camera.y - viewH / 2, 0, Math.max(0, map.bounds.h - viewH)));
  const visible = (x, y, padding = 80) => x >= cx - padding && x <= cx + viewW + padding &&
    y >= cy - padding && y <= cy + viewH + padding;
  ctx.setTransform(1, 0, 0, 1, -cx, -cy);
  ctx.fillStyle='#172027';
  ctx.fillRect(cx,cy,viewW,viewH);
  ctx.save();
  const view={x:cx,y:cy,w:viewW,h:viewH};
  const depth=run.depth??0, undergroundAlpha=depth*depth*(3-2*depth);
  if(depth<1){
    SURFACE.draw(ctx,view);
    drawMapAmbience(ctx,'surface',view,run.t,reduceMotion.matches);
  }
  if(depth>0){
    ctx.globalAlpha=undergroundAlpha;
    underground.draw(ctx,view);
    const origin=underground.offset;
    ctx.translate(origin.x,origin.y);
    drawMapAmbience(ctx,'metro',{...view,x:view.x-origin.x,y:view.y-origin.y},run.t,reduceMotion.matches);
  }
  ctx.restore();
  // Keep surface-before-metro ordering on both sides of the logical midpoint.
  const layers = [
    {state: run.floor === 'surface' ? run : run.floors.surface, opacity: 1 - undergroundAlpha},
    {state: run.floor === 'metro' ? run : run.floors.metro, opacity: undergroundAlpha}
  ];
  const actors = [];
  for (const {state, opacity} of layers) {
    if (opacity > 0) {
      ctx.globalAlpha = opacity;
      for (const g of state.crystals) if (visible(g.x, g.y, 12)) drawCrystal(g);
      for (const e of state.effects) if (e.skillFx) drawSkillGround(e);
      for (const o of state.enemies) if (visible(o.x, o.y)) actors.push({o, draw:drawEnemy, opacity});
    }
    drawFloorCues(state, opacity, visible, drawGroundCue);
  }
  ctx.save();
  ctx.globalAlpha = 1;
  drawBossWarnings(ctx);
  ctx.restore();
  if (run.activeSkill?.id === 0) actors.push({o:run.activeSkill,draw:drawBunker});
  else for (const o of run.squad) if (o.hp > 0 && o.deployed !== false) actors.push({o,draw:drawHero});
  for(const m of [...run.squad,...(run.radioTeam||[])])if(m.hp<=0 && m.downFloor===run.floor)actors.push({o:m,draw:drawDowned});
  if(run.activeSkill?.id!==0)for(const ally of run.radioTeam||[])if(ally.hp>0)actors.push({o:ally,draw:cctRadioSprite});
  actors.sort((a, b) => a.o.y - b.o.y);
  for(const {o,draw,opacity} of actors){ctx.globalAlpha=opacity??1;draw(o)}
  ctx.globalAlpha=1;
  for (const {state, opacity} of layers) {
    ctx.globalAlpha = opacity;
    if (opacity > 0) for (const mark of state.marks) drawTracer(mark);
    for (const e of state.effects) {
      const attached = e.clip?.endsWith('_muzzle');
      const anchor = attached ? run.squad[e.id] : e;
      const longEffect = e.skillFx === 'railBeam' || e.skillFx === 'shellArc';
      if ((!attached && !opacity) || (!longEffect && !visible(anchor.x, anchor.y))) continue;
      ctx.globalAlpha = attached ? 1 : opacity;
      drawEffect(e);
    }
    drawFloorCues(state, opacity, visible, drawAirCue);
  }
  ctx.globalAlpha = 1;
  drawCobraSupport();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawScreenShade();
  drawStick();
}

function tick(now) {
  const dt = last ? Math.min(.04, (now - last) / 1000) : 0;
  last = now;
  if (mode === 'play') update(dt);
  if (mode !== 'home') render();
  requestAnimationFrame(tick);
}

function flashTint(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const g = canvas.getContext('2d');
  g.drawImage(image, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(255,240,211,.72)';
  g.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

Promise.all(Object.entries({ ...ART, ...tagArt, ...skillArt }).map(([id, url]) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { art[id] = img; resolve(); };
    img.onerror = () => reject(new Error('이미지 ' + id + (url.startsWith('data:') ? '' : ' (' + url + ')')));
    img.src = url;
  }))).then(() => {
    art.tagRigHit = flashTint(art.tagRig);
    art.infectedBossHit = flashTint(art.infectedBosses);
    art.tagEquipHit = flashTint(art.tagEquip);
    makeMap();
    $('home').style.backgroundImage = 'linear-gradient(90deg,rgba(9,19,26,.86),rgba(12,21,27,.42) 45%,transparent 70%),url(' + ART.lobby + ')';
    setLobbyReady();
    requestAnimationFrame(tick);
  }).catch(error => {
    console.error('DropZone startup', error.stack || error.message);
    $('start').textContent = '시작 실패 · ' + error.message;
  });
