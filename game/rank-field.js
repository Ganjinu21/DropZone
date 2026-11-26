'use strict';

const rankRoleNames=['bulk','raven','lynx','hammer','cct'];
const rankBase='art/armory/rank-crew/';
// Packed sheets use red, yellow, white in their last three columns.
const uniformColumn=[0,1,3,2,4];
const rankArt={};
for(const role of rankRoleNames.filter(name=>name!=='raven')){
  rankArt['uniformWalk'+role]=rankBase+role+'.webp';
  rankArt['uniformSteps'+role]=rankBase+role+'-steps.webp';
  rankArt['uniformAim'+role]=rankBase+role+'-aim.webp';
  for(const tier of [2,3,4])rankArt['rankSkill'+role+tier]=rankBase+role+'-skill-'+uniformColumn[tier]+'.webp';
}

function memberTier(m){
  const gun=m.weapon?.tier??gearByKey.get(m.loadout?.weapon)?.tier??0;
  return m.id===0?Math.min(gun,gearByKey.get(m.shieldItem??m.loadout?.shield)?.tier??0):gun;
}

function outfitTier(m){
  return (developerMode?m.testTier:null)??armory.crewTiers[m.id];
}
function usesFieldUniform(m){
  return m.id!==1 && outfitTier(m)>=2 && m.boarding==null &&
    !(m.id===4 && run && run.t-(m.signalAt??-Infinity)<.83);
}

const uniformCell=192,uniformScale=72/uniformCell;
function uniformAimRow(pitch){
  return pitch<-.45?0:pitch>.45?2:1;
}
function uniformSocket(m,col,pitch){
  const role=rankRoleNames[m.id],column=uniformColumn[outfitTier(m)];
  const socket=rankSightlines[role][column][uniformAimRow(pitch)];
  const hand=col===3 && socket.length===5?3:0;
  return {x:Math.round(m.x)+(m.flip||1)*(socket[hand]-96)*uniformScale,
    y:Math.round(m.y)+(socket[hand+1]-182)*uniformScale,angle:m.aimAngle};
}

function drawFieldUniform(g,m,age,moving){
  const role=rankRoleNames[m.id],column=uniformColumn[outfitTier(m)];
  const step=moving?crewStrideFrame(m)>>1:0;
  const aiming=(age>=0 && age<.21) || m.aimTarget?.hp>0;
  const draw=(action,row)=>g.drawImage(art[action+role],
    column*uniformCell,row*uniformCell,uniformCell,uniformCell,-36,-182*uniformScale,72,72);
  g.save();
  g.translate(Math.round(m.x),Math.round(m.y));g.scale(m.flip||1,1);
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  const walk=()=>draw('uniformWalk',step);
  const aim=()=>draw('uniformAim',uniformAimRow(m.uniformElevation??m.aimPitch??0));
  if(aiming && moving){
    const row=uniformAimRow(m.uniformElevation??m.aimPitch??0);
    const knee=133,strip=uniformCell-knee;
    g.drawImage(art['uniformAim'+role],column*uniformCell,row*uniformCell,uniformCell,knee,
      -36,-182*uniformScale,72,knee*uniformScale);
    g.drawImage(art['uniformSteps'+role],crewStrideFrame(m)*uniformCell,
      ((outfitTier(m)-2)*3+row)*strip,uniformCell,strip,-36,(knee-182)*uniformScale,72,strip*uniformScale);
  }else if(aiming)aim();
  else walk();
  g.restore();
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
