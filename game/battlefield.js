'use strict';

// One registered 1:1 world image per district. Cutaway paths refer to pixels
// in that same image, so buildings have no independent sprites or transforms.
ART.asphaltGrain='art/battlefields/asphalt-grain.jpg';
const Battlefield=(()=>{
  let active;
  const hitTest=document.createElement('canvas').getContext('2d');
  // Bake the street finish once per district. Roofs, vehicles and river water
  // retain their own materials. World registration keeps the grain still on pans.
  function groundFinish(map){
    const sheet=document.createElement('canvas');
    sheet.width=Math.ceil(map.bounds.w/2);sheet.height=Math.ceil(map.bounds.h/2);
    const g=sheet.getContext('2d');
    g.scale(.5,.5);
    const pattern=g.createPattern(art.asphaltGrain,'repeat');
    pattern.setTransform(new DOMMatrix().scale(.72));
    g.fillStyle=pattern;g.fillRect(0,0,map.bounds.w,map.bounds.h);
    for(const part of map.parts){
      const reach=Math.min(27,part.h*.14);
      g.save();g.translate(reach,reach*.72);
      g.shadowBlur=4;g.shadowColor='#232c35';g.fillStyle='#1b242e';
      g.fill(part.path);g.restore();
    }
    g.globalCompositeOperation='destination-out';g.fillStyle='#000';
    for(const part of map.parts)g.fill(part.path);
    for(const r of map.water)g.fillRect(r.x,r.y,r.w,r.h);
    return sheet;
  }
  function prepare(stage){
    if(active?.stage===stage)return active;
    const image=new Image();
    const map=DistrictMaps[stage-1],parts=map.parts;
    image.src='art/battlefields/seoul-'+stage+'.webp';
    return active={stage,image,parts,map,finish:groundFinish(map),tiles:new Map()};
  }
  const intersects=(a,b)=>a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;
  // Decode only the 2x painted tiles near the camera. The full painting covers
  // stage changes, first decode and the occasional offscreen paving sample.
  const tileSize=512;
  function warm(scene,view){
    const {bounds}=scene.map;
    const left=Math.max(0,Math.floor((view.x-16)/tileSize)),top=Math.max(0,Math.floor((view.y-16)/tileSize));
    const right=Math.floor(Math.min(bounds.w-1,view.x+view.w+16)/tileSize);
    const bottom=Math.floor(Math.min(bounds.h-1,view.y+view.h+16)/tileSize);
    for(const [key,t] of scene.tiles)if(t.col<left-1||t.col>right+1||t.row<top-1||t.row>bottom+1)scene.tiles.delete(key);
    for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++){
      const key=col+','+row;
      if(scene.tiles.has(key))continue;
      const image=new Image();image.decoding='async';
      image.src='art/battlefields/painted/'+scene.stage+'/'+col+'-'+row+'.webp';
      scene.tiles.set(key,{col,row,image});
    }
  }
  function sample(g,scene,x,y,w,h,dx=x,dy=y){
    g.drawImage(scene.image,x,y,w,h,dx,dy,w,h);
    const right=x+w,bottom=y+h;
    for(let row=Math.floor(y/tileSize);row*tileSize<bottom;row++){
      for(let col=Math.floor(x/tileSize);col*tileSize<right;col++){
        const tile=scene.tiles.get(col+','+row)?.image;
        if(!tile?.complete||!tile.naturalWidth)continue;
        const ox=col*tileSize,oy=row*tileSize;
        const tx=Math.max(x,ox-(col>0?.4:0)),ty=Math.max(y,oy-(row>0?.4:0));
        const ex=Math.min(right,ox+tileSize,scene.map.bounds.w),ey=Math.min(bottom,oy+tileSize,scene.map.bounds.h);
        if(ex>tx&&ey>ty)g.drawImage(tile,(tx-Math.max(0,ox-1))*2,(ty-Math.max(0,oy-1))*2,
          (ex-tx)*2,(ey-ty)*2,dx+tx-x,dy+ty-y,ex-tx,ey-ty);
      }
    }
  }
  function draw(g,view,stage,actors,opacity){
    const scene=prepare(stage),{image,parts,map}=scene;
    warm(scene,view);
    if(!image.complete||image.naturalWidth!==map.bounds.w||image.naturalHeight!==map.bounds.h){
      g.fillStyle='#555954';g.fillRect(view.x,view.y,view.w,view.h);return;
    }
    const read=(x,y,w,h,dx,dy)=>sample(g,scene,x,y,w,h,dx,dy);
    const blit=(area)=>read(area.x,area.y,area.w,area.h);
    blit(view);
    drawRiver(g,image,map,view,run.t,reduceMotion.matches,read);
    g.save();
    g.globalCompositeOperation='soft-light';g.globalAlpha*=run.light==='overcast'?.50:.75;
    g.drawImage(scene.finish,view.x/2,view.y/2,view.w/2,view.h/2,view.x,view.y,view.w,view.h);
    g.restore();
    const allies=run.floor==='surface'?[...run.squad.filter(m=>m.deployed),...(run.radioTeam||[])]:[];
    for(const part of parts){
      if(!intersects(part,view))continue;
      const behind=allies.some(actor=>{
        const m={x:actor.x/sceneryScale,y:actor.y/sceneryScale};
        return m.x>part.x-13&&m.x<part.x+part.w+13&&m.y>part.y&&m.y<part.bottom &&
        (hitTest.isPointInPath(part.path,m.x,m.y) || hitTest.isPointInPath(part.path,m.x,m.y-18/sceneryScale));
      });
      const x=Math.max(part.x,view.x),y=Math.max(part.y,view.y);
      const region={x,y,w:Math.min(part.x+part.w,view.x+view.w)-x,h:Math.min(part.bottom,view.y+view.h)-y};
      if(behind||opacity<1){
        g.save();g.clip(part.path);
        map.paving(g,image,region,read);
        g.restore();
      }
      // Restore only foreground pixels above characters and ground effects.
      actors.push({o:{y:part.bottom*sceneryScale},opacity:opacity*(behind?.28:1),draw(){
        g.save();g.scale(sceneryScale,sceneryScale);g.imageSmoothingEnabled=true;g.clip(part.path);blit(region);light(g,region);g.restore();
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
