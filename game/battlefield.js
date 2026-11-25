'use strict';

// One registered 1:1 world image per district. Cutaway paths refer to pixels
// in that same image, so buildings have no independent sprites or transforms.
const Battlefield=(()=>{
  let active;
  const hitTest=document.createElement('canvas').getContext('2d');
  function prepare(stage){
    if(active?.stage===stage)return active;
    const image=new Image();
    const map=DistrictMaps[stage-1],parts=map.parts;
    image.src='art/battlefields/seoul-'+stage+'.webp';
    return active={stage,image,parts,map};
  }
  const intersects=(a,b)=>a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;
  function draw(g,view,stage,actors,opacity){
    const {image,parts,map}=prepare(stage);
    if(!image.complete||image.naturalWidth!==map.bounds.w||image.naturalHeight!==map.bounds.h){
      g.fillStyle='#555954';g.fillRect(view.x,view.y,view.w,view.h);return;
    }
    const blit=(area)=>g.drawImage(image,area.x,area.y,area.w,area.h,area.x,area.y,area.w,area.h);
    blit(view);
    drawRiver(g,image,map,view,run.t,reduceMotion.matches);
    const allies=run.floor==='surface'?[...run.squad.filter(m=>m.deployed),...(run.radioTeam||[])]:[];
    for(const part of parts){
      if(!intersects(part,view))continue;
      const behind=allies.some(actor=>{
        const m={x:actor.x/sceneryScale,y:actor.y/sceneryScale};
        return m.x>part.x-13&&m.x<part.x+part.w+13&&m.y>part.y&&m.y<part.bottom &&
        (hitTest.isPointInPath(part.path,m.x,m.y) || hitTest.isPointInPath(part.path,m.x,m.y-18/sceneryScale));
      });
      if(behind||opacity<1){
        g.save();g.clip(part.path);
        const x=Math.max(part.x,view.x),y=Math.max(part.y,view.y);
        const region={x,y,w:Math.min(part.x+part.w,view.x+view.w)-x,h:Math.min(part.bottom,view.y+view.h)-y};
        map.paving(g,image,region);
        g.restore();
      }
      // Restore only foreground pixels above characters and ground effects.
      actors.push({o:{y:part.bottom*sceneryScale},opacity:opacity*(behind?.28:1),draw(){
        g.save();g.scale(sceneryScale,sceneryScale);g.imageSmoothingEnabled=true;g.clip(part.path);blit(part);light(g,part);g.restore();
      }});
    }
  }
  function light(g,area){
    if(run.light==='day')return;
    const bridge=!!seoulLayouts[run.stage-1].axis;
    if(run.light==='sunset'){
      const warm=g.createLinearGradient(0,0,DistrictMaps[run.stage-1].bounds.w,1100);
      warm.addColorStop(0,bridge?'#744e4445':'#98563e66');warm.addColorStop(.5,'#80544a38');warm.addColorStop(1,'#292d494d');
      g.fillStyle=warm;
    }else g.fillStyle=bridge?'#1a2a3c26':'#1c32454a';
    g.fillRect(area.x,area.y,area.w,area.h);
  }
  return {draw,prepare,light};
})();
