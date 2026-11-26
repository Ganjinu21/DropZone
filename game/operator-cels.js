'use strict';

const operatorRoles=['bulk',null,'lynx','hammer','cct'];
const operatorSlots=['weapon','shield','helmet','top','pants','boots','gloves'];
const operatorBreathBeats=[0,1,2,3,2,1];
const operatorCelArt={};
for(const role of operatorRoles.filter(Boolean)){
  const dir='art/armory/painted-squad/'+role;
  operatorCelArt[role+'Base']=dir+'.webp';
  for(const size of [72,144])operatorCelArt[role+'Field'+size]=dir+'-'+size+'.webp';
  for(const {rank} of rankedTiers.slice(1)){
    operatorCelArt[role+'Finish'+rank]=dir+'-'+rank.replace('+','-plus')+'.webp';
  }
}

// Five gun elevations plus horizontal reflection cover eight screen directions.
function operatorAimCel(angle,recoil){
  const step=Math.round(Math.atan2(Math.sin(angle),Math.abs(Math.cos(angle)))/(Math.PI/4));
  return step===0?(recoil?3:2):[4,5,2,6,7][step+2]+(recoil?8:0);
}
function operatorWalkCel(m){
  const stride=crewStrideFrame(m);
  if(m.walkRow===6 || m.walkRow===7)return (m.walkRow===6?24:28)+(stride>>1);
  return 16+stride;
}
function operatorCel(m,age,moving=m.moving){
  if(m.boarding!=null)return 8+Math.min(3,Math.floor(m.boarding*4));
  const now=typeof run==='object' && run?run.t:0;
  const signal=now-(m.signalAt??-Infinity);
  if(m.id===4 && signal>=0 && signal<.83)return 8+Math.min(3,Math.floor(signal/.205));
  if((moving && m.aimTarget?.hp>0) || (age>=0 && age<.20))
    return operatorAimCel(m.operatorAngle??m.aimAngle??0,!moving && age>=.038 && age<.135);
  if(moving)return operatorWalkCel(m);
  const rest=paintedOperators[operatorRoles[m.id]].breathStart;
  if(reduceMotion.matches)return rest;
  const period=[1.65,0,1.85,1.55,1.72][m.id];
  const phase=((now/period+m.id*.17)%1+1)%1;
  return rest+operatorBreathBeats[Math.floor(phase*operatorBreathBeats.length)];
}
function operatorSkillCel(m,s,angle=s.angle){
  const since=s.age-s.lastFire;
  if(m.id===2){
    const aim=operatorAimCel(angle,s.phase!=='charge' && since<.13);
    if(aim!==2 && aim!==3)return aim;
    if(s.phase==='charge')return s.age<.15?8:s.age<.33?9:10;
    return since<.13?11:10;
  }
  const plant=clamp(Math.min(s.age/.64,(s.duration-s.age)/.40),0,1);
  const frame=plant<.27?0:plant<.60?1:plant<.88 || since<.13?2:3;
  return (s.awakened?32:8)+frame;
}
function operatorTip(m,index,facing=m.flip||1,x=m.x,y=m.y){
  const [px,py,a]=paintedOperators[operatorRoles[m.id]].tips[index];
  const angle=a*Math.PI/180;
  return {x:Math.round(x)+facing*(px-128)*72/256,y:Math.round(y)+(py-240)*72/256,
    angle:Math.atan2(Math.sin(angle),facing*Math.cos(angle))};
}
function drawOperatorBody(g,m,index){
  const role=operatorRoles[m.id],layers=paintedOperators[role].layers[index];
  const ratio=72/128;
  g.save();g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  const transform=g.getTransform(),scale=Math.hypot(transform.a,transform.b);
  const size=scale<=1?72:scale<=2?144:256;
  const image=art[role+(size===256?'Base':'Field'+size)];
  g.drawImage(image,index%8*size,Math.floor(index/8)*size,size,size,-36,-67.5,72,72);
  const tier=outfitTier(m),finish=art['rankSkill'+role+tier];
  if(finish){
    g.drawImage(finish,index%8*128,Math.floor(index/8)*128,128,128,-36,-67.5,72,72);
    g.restore();return;
  }
  for(let i=0;i<operatorSlots.length;i++){
    const slot=operatorSlots[i];
    const item=slot==='weapon'?m.weapon:gearByKey.get(slot==='shield'?m.shieldItem:m.loadout?.[slot]);
    const material=slot==='weapon' || slot==='shield'?item?.tier:tier;
    if(!material || !layers[i])continue;
    const [sx,sy,w,h,x,y]=layers[i];
    g.drawImage(art[role+'Finish'+rankedTiers[material].rank],sx,sy,w,h,x*ratio-36,y*ratio-67.5,w*ratio,h*ratio);
  }
  g.restore();
}
// Both atlases register the feet at the origin. Keep the sight and shoulders
// on the firing cel while the lower legs follow distance travelled.
function drawWalkingShot(g,legs,upper){
  const split=-19;
  g.save();g.beginPath();g.rect(-38,split,76,28);g.clip();
  legs();g.restore();
  g.save();g.beginPath();g.rect(-38,-74,76,74+split);g.clip();
  upper();g.restore();
}
function drawOperatorGear(g,m,age,moving){
  g.save();g.translate(Math.round(m.x),Math.round(m.y));g.scale(m.flip||1,1);
  const index=operatorCel(m,age,moving);
  // Aim frames occupy 2–7 and 12–15. Boarding and signals own the full body.
  if(moving && ((index>=2 && index<=7) || (index>=12 && index<=15))){
    drawWalkingShot(g,()=>drawOperatorBody(g,m,operatorWalkCel(m)),()=>drawOperatorBody(g,m,index));
  }else drawOperatorBody(g,m,index);
  g.restore();
}
