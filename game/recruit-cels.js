'use strict';

const recruitArt={};
for(const role of operatorRoles.filter(Boolean)){
  for(const part of ['stand','field','stride'])
    recruitArt[role+'Recruit'+part]='art/armory/recruits/'+role+'-'+part+'.webp';
}

// Muzzles on the 160-unit field proofs, in walking, sight elevation and skill order.
// The third coordinate is the illustrated barrel angle in screen space.
const recruitTips={
  bulk:[[94,78,0],[96,78,0],[96,79,0],[98,80,0],[87,75,0],[84,75,0],[101,82,18],[106,84,18],
    [88,37,-78],[102,46,-34],[112,58,0],[111,85,34],[80,105,87],[113,59,0],[92,91,0],[91,98,0]],
  lynx:[[121,95,40],[117,94,38],[120,96,39],[121,99,43],[117,97,43],[116,96,42],[99,101,49],[107,100,48],
    [92,32,-89],[122,38,-41],[137,69,0],[122,102,43],[95,125,88],[137,62,0],[143,75,0],[147,91,0]],
  hammer:[[116,69,-18],[111,69,-19],[108,70,-17],[115,69,-17],[105,69,-13],[107,69,-13],[106,69,-17],[100,70,-12],
    [83,34,-90],[104,37,-46],[115,59,-3],[110,87,31],[100,101,76],[117,60,0],[121,71,0],[129,83,0]],
  cct:[[115,98,40],[106,98,40],[109,100,41],[107,100,41],[103,97,40],[102,99,40],[103,90,41],[107,91,41],
    [93,46,-70],[117,58,-29],[125,75,-4],[119,96,32],[94,120,69],[120,71,-3],[116,105,32],[103,116,49]]
};
// Hero art is measured at 275 units tall. Align the hips rather than the end of the weapon.
const recruitStand={
  bulk:{hip:.47,tip:[79,80,2],shield:[107,94,134,89,134,205,102,207]},
  lynx:{hip:.43,tip:[196,126,29]},hammer:{hip:.46,tip:[122,62,-20]},cct:{hip:.48,tip:[129,115,27]}
};
const finishColors=[null,'#7496a9','#efb847','#cf494a','#80e3ed'];
const gearDecals=new Map();
function usesRecruitArt(m){return m.id!==1 && outfitTier(m)===0}
function recruitUnit(m){return crewHeight[m.id]/(204/1.8)}
function recruitAimCel(m,age,moving){
  const angle=m.operatorAngle??m.aimAngle??0;
  const elevation=Math.round(Math.atan2(Math.sin(angle),Math.abs(Math.cos(angle)))/(Math.PI/4));
  return elevation===0 && !moving && age>=.038 && age<.135?13:10+elevation;
}
function recruitSocket(m){
  const cel=recruitAimCel(m,(run?.t??0)-(m.lastShot??-Infinity),m.moving);
  const [x,y,a]=recruitTips[operatorRoles[m.id]][cel],unit=recruitUnit(m),f=m.flip||1,rad=a*Math.PI/180;
  return {x:Math.round(m.x)+f*(x-80)*unit,y:Math.round(m.y)+(y-272/1.8)*unit,
    angle:Math.atan2(Math.sin(rad),f*Math.cos(rad))};
}
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
function drawRecruit(g,m,age,moving){
  const role=operatorRoles[m.id],standing=recruitStand[role],now=run?.t??0;
  const signal=m.id===4 && now-(m.signalAt??-Infinity)<.83;
  const working=signal || m.boarding!=null;
  const aim=!working && ((age>=0 && age<.20) || (moving && m.aimTarget?.hp>0));
  const stride=crewStrideFrame(m),weaponTier=m.weapon?.tier,shieldTier=m.id===0?gearByKey.get(m.shieldItem)?.tier:0;
  g.save();g.translate(Math.round(m.x),Math.round(m.y));g.scale(m.flip||1,1);
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  if(!moving && !aim && !working){
    const image=art[role+'Recruitstand'],w=275*image.width/image.height;
    const unit=crewHeight[m.id]/275;
    const breath=run && !reduceMotion.matches?1+.0025*Math.sin(now*3+m.id):1;
    g.scale(unit,unit*breath);g.translate(-w*standing.hip,-275);
    const source=[0,0,image.width,image.height],box=[w,275];
    g.drawImage(image,0,0,...box);
    if(weaponTier)drawRecruitFinish(g,image,source,box,weaponSurface(standing.tip,[15,0,39,34,24][m.id],m.id===3?5:2.2),weaponTier,role+'-stand-gun');
    if(shieldTier)drawRecruitFinish(g,image,source,box,standing.shield,shieldTier,role+'-stand-shield');
  }else{
    let cel;
    if(working)cel=m.boarding!=null?(m.boarding>.45?15:14):(now-m.signalAt<.55?14:15);
    else if(aim)cel=recruitAimCel(m,age,moving);
    else cel=m.walkRow===6?4+(stride>>2):m.walkRow===7?6+(stride>>2):stride>>1;
    const unit=recruitUnit(m),image=art[role+'Recruitfield'];
    const source=[cel%4*288,(cel>>2)*288,288,288];
    g.scale(unit,unit);g.translate(-80,-272/1.8);
    if(moving && !working){
      const knee=204,strip=288-knee;
      g.drawImage(image,source[0],source[1],288,knee,0,0,160,knee/1.8);
      const row=aim?cel-8:m.walkRow===6?6:m.walkRow===7?7:5;
      const step=!aim && row>=6?stride-stride%2:stride;
      g.drawImage(art[role+'Recruitstride'],step*288,row*strip,288,strip,0,knee/1.8,160,strip/1.8);
    }else g.drawImage(image,...source,0,0,160,160);
    if(weaponTier){
      const tip=recruitTips[role][cel],length=[6,0,18,14,12][m.id];
      drawRecruitFinish(g,image,source,[160,160],weaponSurface(tip,length,m.id===3?2.1:1.15),weaponTier,role+cel+'-gun');
    }
    // The shield recognition stripe sits below the viewport on front-facing poses.
    if(shieldTier && (cel<6 || cel>=8)){
      const center=[96,97,97,97,98,98,0,0,94,92,91,90,92,91,96,96][cel],h=cel>=14?110:92;
      drawRecruitFinish(g,image,source,[160,160],[center-4,h+2,center+3,h-1,center+3,h+2,center-4,h+5],shieldTier,'bulk'+cel+'-shield');
    }
  }
  g.restore();
}
