'use strict';

const operatorRoles=['bulk','raven','lynx','hammer','cct'];
const recruitParts=['stand','frames'];
const recruitArt={};
function recruitImagePath(role,part,tier=0){
  const rank=rankedTiers[tier].rank.replace('+','-plus');
  if(part==='frames' || part==='special')return 'art/armory/crew-frames/'+role+'/'+rank+(part==='special'?'-special':'')+'.webp';
  if(tier)return 'art/armory/crew-frames/'+role+'/'+rank+'-'+part+'.webp';
  if(role==='raven')return 'art/armory/raven-cels/'+(part==='face'?'portrait-C.png':'barracks-0.webp');
  return 'art/armory/recruits/'+role+'-'+part+'.webp';
}
const uniformParts=role=>role==='raven'?[...recruitParts,'special']:recruitParts;
for(const role of operatorRoles){
  for(const part of uniformParts(role))recruitArt[role+'Recruit'+part]=recruitImagePath(role,part);
}

// Keep one promoted uniform per operator in memory on mobile. A replaced load
// may finish out of order, so only the current entry can refresh the barracks.
const recruitUniforms=new Map();
function requestRecruitUniform(id,tier){
  const role=operatorRoles[id];
  if(!role || !tier)return null;
  const current=recruitUniforms.get(role);
  if(current?.tier===tier && (!current.retryAfter || current.retryAfter>Date.now()))return current;
  const entry={tier};
  recruitUniforms.set(role,entry);
  entry.ready=Promise.all(uniformParts(role).map(async part=>{
    const image=new Image();
    image.src=recruitImagePath(role,part,tier);
    await image.decode();
    return [part,image];
  })).then(pairs=>{
    entry.images=Object.fromEntries(pairs);
    if(recruitUniforms.get(role)===entry)redrawBarracksUniform(id,tier);
    return true;
  }).catch(error=>{
    entry.retryAfter=Date.now()+5000;
    console.error('대원 제복을 불러오지 못했습니다.',role,tier,error);
    return false;
  });
  return entry;
}

const finishColors=[null,'#7496a9','#efb847','#cf494a','#80e3ed'];
const gearDecals=new Map();
function weaponSurface(tip,length,radius){
  const [x,y,angle]=tip,a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return [x+s*radius,y-c*radius,x-s*radius,y+c*radius,
    x-length*c-s*radius,y-length*s+c*radius,x-length*c+s*radius,y-length*s-c*radius];
}
// Tint only the registered bit of painted equipment, including any transparent edge pixels.
// Caches are small cutouts, never full copies of a field atlas or a high-resolution standing figure.
function drawRecruitFinish(g,image,source,box,points,tier,key){
  if(!tier)return;
  key+=':'+tier;
  let cached=gearDecals.get(key);
  if(!cached){
    const xs=[points[0],points[2],points[4],points[6]],ys=[points[1],points[3],points[5],points[7]];
    const x=Math.floor(Math.min(...xs)),y=Math.floor(Math.min(...ys));
    const w=Math.ceil(Math.max(...xs))-x+1,h=Math.ceil(Math.max(...ys))-y+1;
    const d=Math.min(4,source[2]/box[0]),canvas=document.createElement('canvas');
    canvas.width=Math.ceil(w*d);canvas.height=Math.ceil(h*d);
    const c=canvas.getContext('2d');c.scale(d,d);c.translate(-x,-y);
    c.beginPath();c.moveTo(points[0],points[1]);
    for(let i=2;i<8;i+=2)c.lineTo(points[i],points[i+1]);
    c.closePath();c.clip();c.drawImage(image,...source,0,0,...box);
    c.globalCompositeOperation='source-atop';c.globalAlpha=.5;c.fillStyle=finishColors[tier];c.fillRect(x,y,w,h);
    cached={canvas,x,y,w:canvas.width/d,h:canvas.height/d};gearDecals.set(key,cached);
  }
  g.drawImage(cached.canvas,cached.x,cached.y,cached.w,cached.h);
}

// Six complete illustrations per action. The player's traveled distance selects
// the next footfall, even when the shooting timer resets between those footfalls.
const crewFrameSize=256,crewFrameHeight=164,crewFrameFoot=[109,243];
const crewMotion={guard:0,travel:1,toward:2,away:3,up:4,level:5,down:6,skill:7};
// The supplied sheets have four side strides and grounded up/level/down key poses.
const fieldKeys={walk:48,up:52,level:53,down:54};
function hasFieldKeys(m){return m.id!==3 && outfitTier(m)>=2}
function crewFootfall(m){
  const beat=Math.floor((m.gait||0)*6/crewStrideLength);
  return (beat%6+6)%6;
}
function recruitAimCel(m,moving=m.moving,angle){
  angle??=m.aimSector!=null?m.aimSector*Math.PI/4:m.operatorAngle??m.aimAngle??0;
  const pitch=Math.atan2(Math.sin(angle),Math.abs(Math.cos(angle)));
  // The simulation tracks all eight bearings. Even a target directly above
  // or below the squad uses a three-quarter illustration and its muzzle.
  const action=crewMotion.level+clamp(Math.round(pitch/(Math.PI/4)),-1,1);
  if(!moving && hasFieldKeys(m))
    return fieldKeys.level+action-crewMotion.level;
  const phase=moving?crewFootfall(m):0;
  return action*6+phase;
}
function recruitWalkCel(m){
  const action=m.walkRow===6?crewMotion.toward:m.walkRow===7?crewMotion.away:crewMotion.travel;
  if(action===crewMotion.travel && hasFieldKeys(m)){
    const step=Math.floor((m.gait||0)*4/crewStrideLength);
    return fieldKeys.walk+(step%4+4)%4;
  }
  return action*6+crewFootfall(m);
}
function recruitPose(m,age,moving){
  const now=run?.t??0;
  if(m.id!==1 && m.boarding!=null)return crewMotion.skill*6+Math.min(5,Math.floor(clamp(m.boarding,0,1)*6));
  const radioAge=now-(m.signalAt??-Infinity);
  if(m.id===4 && radioAge>=0 && radioAge<.83)return crewMotion.skill*6+Math.min(5,Math.floor(radioAge*6/.83));
  if((age>=0 && age<.20) || m.aimTarget?.hp>0 || now<(m.aimHeldUntil??-Infinity))return recruitAimCel(m,moving);
  if(moving)return recruitWalkCel(m);
  if(hasFieldKeys(m))return fieldKeys.level;
  return reduceMotion.matches?0:Math.floor(now*3)%6;
}
function frameSet(m){
  const role=operatorRoles[m.id],tier=outfitTier(m);
  const uniform=requestRecruitUniform(m.id,tier)?.images;
  return {role,tier:uniform?tier:0,frames:uniform?.frames??art[role+'Recruitframes'],stand:uniform?.stand??art[role+'Recruitstand'],special:uniform?.special??art.ravenRecruitspecial};
}
function recruitSocket(m,cel=recruitAimCel(m),f=m.flip||1,footX=m.x,footY=m.y,far=false){
  const set=frameSet(m),mark=crewFrameAnchors[set.role][set.tier][cel];
  const unit=crewHeight[m.id]/crewFrameHeight,rad=mark[2]*Math.PI/180;
  const hand=far && m.id===1?3:0;
  return {x:footX+f*(mark[hand]-crewFrameFoot[0])*unit,
    y:footY+(mark[hand+1]-crewFrameFoot[1])*unit,angle:Math.atan2(Math.sin(rad),f*Math.cos(rad))};
}
function paintCrewEquipment(g,m,image,src,box,mark,key,standing=false){
  g.drawImage(image,...src,0,0,...box);
  const bodyTier=standing?-1:outfitTier(m);
  if(!m.weapon?.tier || m.weapon.tier===bodyTier)return;
  const length=(standing?[15,16,39,34,24]:[11,17,33,25,19])[m.id];
  const radius=m.id===3?3.5:1.8;
  const barrel=weaponSurface(mark,length,radius);
  drawRecruitFinish(g,image,src,box,barrel,m.weapon.tier,key);
  if(m.id===1)drawRecruitFinish(g,image,src,box,weaponSurface([mark[3],mark[4],mark[2]],length,radius),m.weapon.tier,key+'-far');
}
function drawRecruit(g,m,age,moving,pose=null){
  const set=frameSet(m),cel=pose??recruitPose(m,age,moving);
  const size=crewFrameSize,unit=crewHeight[m.id]/crewFrameHeight;
  g.save();g.translate(m.x,m.y);g.scale((m.flip||1)*unit,unit);
  g.translate(-crewFrameFoot[0],-crewFrameFoot[1]);
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  const src=[cel%6*size,Math.floor(cel/6)*size,size,size];
  paintCrewEquipment(g,m,set.frames,src,[size,size],crewFrameAnchors[set.role][set.tier][cel],
    set.role+'-'+set.tier+'-'+cel+'-gun');
  g.restore();
}
function drawRecruitStanding(g,m){
  const set=frameSet(m),image=set.stand,mark=crewStandAnchors[set.role][set.tier];
  const unit=crewHeight[m.id]/275,w=275*image.width/image.height;
  g.save();g.translate(m.x,m.y);g.scale(unit,unit);g.translate(-w*mark[0],-275);
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  paintCrewEquipment(g,m,image,[0,0,image.width,image.height],[w,275],mark.slice(1),
    set.role+'-'+set.tier+'-stand-gun',true);
  g.restore();
}
