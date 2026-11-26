'use strict';

// Every source cel already includes both hands and both weapons. The optional
// finish layers contain only the painted metal at the same frame coordinates.
const ravenArtDir='art/armory/raven-cels/';
const ravenAtlasRows=Math.ceil((28+ravenBarrels.length)/8);
const ravenCelArt={ravenEcho:ravenArtDir+'echo.png',ravenCels:ravenArtDir+'base.png',
  ravenFollow:ravenArtDir+'spin-follow.webp',ravenFollowEcho:ravenArtDir+'spin-follow-echo.webp',
  ravenFieldCels:ravenArtDir+'field.png',ravenField2x:ravenArtDir+'field-2x.webp'};
for(const {rank} of rankedTiers){
  if(rank==='C')continue;
  const name=rank.replace('+','-plus');
  ravenCelArt['raven-finish'+rank]=ravenArtDir+'finish-'+name+'.webp';
  ravenCelArt['raven-uniform'+rank]=ravenArtDir+'uniform-'+name+'.webp';
}

function ravenShotCel(m,age){
  const sector=m.ravenSector??((m.flip||1)<0?4:0);
  if(sector===0 || sector===4){
    const index=m.moving?28:age<.032?29:age<.078?30:age<.14?31:28;
    return {index,facing:sector===4?-1:1};
  }
  return {index:[32,35,36,37,38,39,34,33][sector],facing:1};
}
function ravenBodyCel(m,age,skill){
  if(skill?.phase==='spin'){
    if(skill.poseCel!=null)return {index:skill.poseCel,facing:skill.poseFacing??1};
    const turns=((skill.angle??Math.PI/2)-Math.PI/2)/TAU;
    const beat=(turns-Math.floor(turns))*ravenTurnBeats;
    return {index:ravenChoreography[ravenStepAtBeat(beat)][1],facing:1};
  }
  if(skill?.phase==='forward'){
    const t=skill.age??0;
    const frame=t<.09?0:t<.18?1:2+((skill.beat||1)-1)%3*2+(age>=.037?1:0);
    return {index:40+frame,facing:Math.cos(skill.angle)<0?-1:1};
  }
  if(age<.15 || (m.moving && m.aimTarget?.hp>0))return ravenShotCel(m,age);
  const facing=m.flip||1;
  if(m.moving){
    const first=m.walkRow===7?12:m.walkRow===6?20:4;
    return {index:first+crewStrideFrame(m),facing};
  }
  const t=typeof run==='object' && run?run.t:0;
  return {index:reduceMotion.matches?0:[0,1,2,3,2,1][Math.floor(t*3)%6],facing};
}
function ravenBarrel(m,cel,hand){
  const pair=ravenBarrels[cel.index-28],j=hand?3:0;
  const a=pair[j+2]*Math.PI/180;
  return {x:Math.round(m.x)+cel.facing*(pair[j]-72)/2,y:Math.round(m.y)+(pair[j+1]-134)/2,
    angle:Math.atan2(Math.sin(a),cel.facing*Math.cos(a))};
}

function drawRavenFollow(g,im,cel,stage,size){
  const row=stage*(ravenAtlasRows-6)+Math.floor((cel.index-48)/8);
  g.drawImage(im,(cel.index%8)*size,row*size,size,size,-36,-67,72,72);
}

function drawRavenCels(g,m,age,skill){
  const cel=ravenBodyCel(m,age,skill);
  g.save();g.translate(Math.round(m.x),Math.round(m.y));
  if(!skill && m.moving && cel.index>=28 && cel.index<40){
    const first=m.walkRow===7?12:m.walkRow===6?20:4;
    const walk={index:first+crewStrideFrame(m),facing:m.flip||1};
    drawWalkingShot(g,()=>drawRavenBody(g,m,walk),()=>drawRavenBody(g,m,cel));
  }else drawRavenBody(g,m,cel,skill);
  g.restore();
  if(skill?.phase!=='spin')return;
  for(let hand=0;hand<2;hand++){
    if(!(skill.beat>hand))continue;
    const latest=skill.beat-1,beat=latest-(latest-hand)%2;
    const elapsed=skill.age-ravenShotAt(beat);
    const frame=frameAt(elapsed,[.009,.024,.037,.046]);
    if(elapsed<0 || frame<0)continue;
    const tip=ravenBarrel(m,cel,hand);
    g.save();g.translate(tip.x,tip.y);g.rotate(tip.angle);
    const size=reduceMotion.matches?.30:.48;
    g.scale(size*[.64,1,.80,.40][frame],size);
    g.globalAlpha*=[.85,1,.78,.4][frame];
    g.drawImage(art.ravenMuzzle,0,((Math.floor(beat/2)+hand)%2)*48,144,48,-1,-24,144,48);
    g.restore();
  }
}

function drawRavenBody(g,m,cel,skill){
  const draw=(im,x,y,width,height)=>{
    const w=im.width/8,h=im.height/ravenAtlasRows;
    g.drawImage(im,(cel.index%8)*w,Math.floor(cel.index/8)*h,w,h,x,y,width??w/2,height??h/2);
  };
  g.save();
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  g.scale(cel.facing,1);
  const transform=g.getTransform(),scale=Math.hypot(transform.a,transform.b);
  if(skill?.phase==='spin' && skill.follow<3 && !reduceMotion.matches)
    drawRavenFollow(g,art.ravenFollow,cel,skill.follow,288);
  else draw(scale<=1?art.ravenFieldCels:scale<=2?art.ravenField2x:art.ravenCels,-36,-67,72,72);
  // Every grade uses the same face, cel, scale and foot registration.
  const tier=outfitTier(m);
  if(tier>0)draw(art['raven-uniform'+rankedTiers[tier].rank],-36,-67,72,72);
  if(m.weapon.tier>0){
    const [x,y]=ravenFinishOrigins[cel.index],im=art['raven-finish'+m.weapon.rank];
    draw(im,(x-144)/4,(y-268)/4,im.width/32,im.height/(4*ravenAtlasRows));
  }
  g.restore();
}
