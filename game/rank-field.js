'use strict';

const rankRoleNames=['bulk','raven','lynx','hammer','cct'];
const rankBase='art/armory/rank-crew/';
const rankArt={};
for(const role of rankRoleNames){
  for(const tier of [2,3,4])rankArt['rankSkill'+role+tier]=rankBase+role+'-skill-'+tier+'.webp';
  rankArt['rankWalk'+role]=rankBase+role+'.webp';
  rankArt['rankAim'+role]=rankBase+role+'-aim.webp';
}

function memberTier(m){
  const gun=m.weapon?.tier??gearByKey.get(m.loadout?.weapon)?.tier??0;
  return m.id===0?Math.min(gun,gearByKey.get(m.shieldItem??m.loadout?.shield)?.tier??0):gun;
}

const poseSize=192, fieldPoseScale=72/poseSize;
function aimRow(angle){
  return angle<-.45?0:angle>.45?2:1;
}
function rankPose(m,age,moving){
  const firing=age>=0 && age<.21;
  const tier=memberTier(m),role=rankRoleNames[m.id];
  const pitch=m.aimPitch||0;
  const row=firing?aimRow(pitch):(moving&&!reduceMotion.matches?crewStrideFrame(m)>>1:0);
  const base=firing?rankSightlines[role][tier][row]:null;
  const angle=base?clamp(pitch-base[2]*Math.PI/180,-.48,.48):0;
  const kick=firing&&!reduceMotion.matches?Math.sin(Math.PI*clamp(age/.14,0,1))*1.6:0;
  return {tier,role,row,base,angle,kick,firing};
}
function rankedBarrel(m,col,aiming=false){
  const p=rankPose(m,aiming?0:Math.max(0,run.t-(m.lastShot??run.t)),false);
  if(!p.base)return null;
  const [x,y]=col===3&&p.base.length>3?p.base.slice(3):p.base;
  const u=(x-96)*fieldPoseScale,v=(y-99)*fieldPoseScale;
  const c=Math.cos(p.angle),s=Math.sin(p.angle),flip=m.flip||1;
  return {x:Math.round(m.x)+flip*(u*c-v*s-p.kick),y:Math.round(m.y)+(99-182)*fieldPoseScale+u*s+v*c,
    angle:Math.atan2(Math.sin(m.aimPitch),flip*Math.cos(m.aimPitch))};
}
function drawRankedMember(g,m,age,moving){
  const p=rankPose(m,age,moving);
  const im=art[(p.firing?'rankAim':'rankWalk')+p.role];
  if(!im)return false;
  const feet=(182-99)*fieldPoseScale;
  g.save();g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  g.translate(Math.round(m.x),Math.round(m.y));g.scale(m.flip||1,1);
  if(p.firing){g.translate(-p.kick,-feet);g.rotate(p.angle);g.translate(0,feet)}
  else if(!moving && !reduceMotion.matches){
    const t=(run?.t??0)*3+m.id;
    g.scale(1,1+.007*Math.sin(t));
  }
  g.drawImage(im,p.tier*poseSize,p.row*poseSize,poseSize,poseSize,-36,-182*fieldPoseScale,72,72);
  g.restore();return true;
}

// Effects are stamped onto each shot at launch, including rounds still in flight
// when a test operator switches equipment.
const shotPalettes=[
  ['#c49669','#fce3af','#fff4cb'],['#b4cb65','#d9f699','#f2ffcf'],
  ['#ae2837','#ff6960','#ffe1aa'],['#cf7b15','#ffd248','#ffffc0'],
  ['#175fc7','#4bdfff','#f2ffff']
];
function fxStroke(g,x,y,x2,y2,color,width){
  g.beginPath();g.moveTo(x,y);g.lineTo(x2,y2);g.strokeStyle=color;g.lineWidth=width;g.stroke();
}
function drawRankRound(g,shot,x,y,angle){
  const tier=shot.tier;if(!Number.isInteger(tier))return false;
  const [shadow,body,light]=shotPalettes[tier],id=shot.id;
  const length=[6,10,16,23,29][tier]*[.82,.88,1.7,.92,1][id];
  const w=[1.4,1.7,2,2.8,3.1][tier];
  g.save();g.translate(x,y);g.rotate(angle);
  if(tier>=2){
    g.globalAlpha*=.4;
    fxStroke(g,-length,0,1,0,shadow,w*2.7);
    g.restore();g.save();g.translate(x,y);g.rotate(angle);
  }
  fxStroke(g,-length,0,-1,0,body,w);
  fxStroke(g,-length*.43,0,2,0,light,w*.65);
  if(id===3){
    g.fillStyle=tier===4?'#80d6da':'#888778';g.fillRect(-7,-2.5,10,5);
    g.fillStyle=body;g.fillRect(-8,-4,3,8);g.fillStyle=light;g.fillRect(2,-1.5,4,3);
  }
  if(tier===3){
    for(const sign of [-1,1])fxStroke(g,-length*.7,sign*2,-length*.29,sign,body,1);
  }
  if(tier===4){
    if(id===0||id===3){
      for(let i=0;i<(id===3?3:2);i++){
        g.strokeStyle=i?body:light;g.lineWidth=1.25;g.beginPath();g.ellipse(-6-i*7,0,2,4+i*.65,0,0,TAU);g.stroke();
      }
    }else if(id===1||id===2){
      for(const sign of [-1,1])fxStroke(g,-length,sign*(id===1?3:2.5),-5,sign*1.8,body,1.2);
    }else{
      for(let i=1;i<=3;i++){g.fillStyle=i===1?light:body;g.fillRect(-length-i*4,-1,2.2,2)}
    }
  }
  g.restore();return true;
}
function rankFlash(g,e,x,y,angle,impact=false){
  const n=e.tier,phase=clamp(e.age/e.duration,0,1);
  const [shadow,body,light]=shotPalettes[n];
  const radius=([4,6,9,14,19][n])*(impact?1:1.12)*(e.id===3&&impact?1.6:1)*(reduceMotion.matches?.68:1);
  g.save();g.translate(x,y);g.rotate(angle);g.globalAlpha*=1-phase;
  if(impact){
    const r=radius*(.35+.75*phase);
    for(let i=0;i<3+n;i++){
      const a=i*TAU/(3+n)+.52;
      fxStroke(g,Math.cos(a)*r*.52,Math.sin(a)*r*.52,Math.cos(a)*r,Math.sin(a)*r,i%2?body:light,n<3?1:1.6);
    }
    if(n>=3){
      const edges=n===4?6:4;
      g.beginPath();for(let i=0;i<=edges;i++){
        const a=i*TAU/edges;const px=Math.cos(a)*r*.83,py=Math.sin(a)*r*.83;i?g.lineTo(px,py):g.moveTo(px,py);
      }g.strokeStyle=body;g.lineWidth=1.5;g.stroke();
    }
  }else{
    const l=radius*(1-.55*phase),w=radius*.25;
    g.fillStyle=body;g.beginPath();g.moveTo(-1,0);g.lineTo(l*.5,-w);g.lineTo(l,0);g.lineTo(l*.5,w);g.closePath();g.fill();
    fxStroke(g,0,0,l*.85,0,light,1.6);
    if(n>=3)for(const k of [-1,1])fxStroke(g,1,k*2,l*.59,k*w*1.65,shadow,1.5);
  }
  g.restore();
}
