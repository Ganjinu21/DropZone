'use strict';

// Every source cel already includes both hands and both weapons. The optional
// finish layers contain only the painted metal at the same frame coordinates.
const ravenArtDir='art/armory/raven-cels/';
const ravenAtlasRows=Math.ceil((28+ravenBarrels.length)/8);
const ravenCelArt={ravenEcho:ravenArtDir+'echo.png',ravenFollowEcho:ravenArtDir+'spin-follow-echo.webp'};
for(const {rank} of rankedTiers){
  if(rank==='C')continue;
  const name=rank.replace('+','-plus');
  ravenCelArt['raven-finish'+rank]=ravenArtDir+'finish-'+name+'.webp';
}

function ravenBodyCel(m,age,skill){
  if(skill?.phase==='spin'){
    if(skill.poseCel!=null)return {index:skill.poseCel,facing:skill.poseFacing??1};
    const turns=((skill.angle??Math.PI/2)-Math.PI/2)/TAU;
    const beat=(turns-Math.floor(turns))*ravenTurnBeats;
    return {index:ravenChoreography[ravenStepAtBeat(beat)][1],facing:1};
  }
  const t=skill?.age??0;
  const frame=t<.09?0:t<.18?1:2+((skill?.beat||1)-1)%3*2+(age>=.037?1:0);
  return {index:40+frame,facing:Math.cos(skill?.angle??0)<0?-1:1};
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
  drawRavenBody(g,m,cel,skill);
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
  const follow=skill?.phase==='spin' && skill.follow<3 && !reduceMotion.matches;
  const index=follow?32+skill.follow*24+cel.index-48:cel.index-40;
  const set=frameSet(m),size=224;
  g.save();g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.scale(cel.facing,1);
  g.drawImage(set.special,index%8*size,Math.floor(index/8)*size,size,size,-36,-67,72,72);
  if(m.weapon.tier>0 && m.weapon.tier!==set.tier){
    const [x,y]=ravenFinishOrigins[cel.index],im=art['raven-finish'+m.weapon.rank];
    const w=im.width/8,h=im.height/ravenAtlasRows;
    g.drawImage(im,cel.index%8*w,Math.floor(cel.index/8)*h,w,h,(x-144)/4,(y-268)/4,w/4,h/4);
  }
  g.restore();
}
