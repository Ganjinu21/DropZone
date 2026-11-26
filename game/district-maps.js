'use strict';

// The layout catalogue uses a 400 × 300 survey grid registered to the full painting.
// Walking geometry is in world pixels, including the rotated hulls of the wrecks.
const DistrictMaps=(()=>{
  const sx=SURFACE.bounds.w/400,sy=SURFACE.bounds.h/300;
  const world=([x,y],scale=sx)=>({x:x*scale,y:y*sy});
  const rect=([x,y,w,h],scale=sx)=>({x:x*scale,y:y*sy,w:w*scale,h:h*sy});
  const sizes=[[7.4,15],[7.5,15],[10,25],[17,23],[14,21],[10,20]];
  function rotate(x,y,angle){return [x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle)]}
  function shape(points,scale=sx){
    const coords=points.map(p=>world(p,scale)),path=new Path2D();
    const xs=coords.map(p=>p.x),ys=coords.map(p=>p.y);
    const x=Math.min(...xs),y=Math.min(...ys),bottom=Math.max(...ys);
    coords.forEach((p,i)=>i?path.lineTo(p.x,p.y):path.moveTo(p.x,p.y));path.closePath();
    return {x,y,w:Math.max(...xs)-x,h:bottom-y,path,bottom};
  }
  function polyBlocks(points,scale=sx){
    // Horizontal strips register curved banks and diagonally parked vehicles
    // with the same rect-based clearance tests used by bullets and squads.
    const ys=points.map(p=>p[1]),result=[],end=Math.max(...ys);
    for(let y=Math.min(...ys);y<end;y+=1.5){
      const h=Math.min(1.5,end-y),line=y+h/2,cuts=[];
      for(let i=0;i<points.length;i++){
        const [x1,y1]=points[i],[x2,y2]=points[(i+1)%points.length];
        if((y1<=line&&line<y2)||(y2<=line&&line<y1))cuts.push(x1+(x2-x1)*(line-y1)/(y2-y1));
      }
      cuts.sort((a,b)=>a-b);
      for(let j=0;j+1<cuts.length;j+=2)result.push(rect([cuts[j],y,cuts[j+1]-cuts[j],h],scale));
    }
    return result;
  }
  function make(layout,index){
    const bounds=layout.axis?{...SURFACE.bounds,w:1800,h:3900}:SURFACE.bounds,scale=bounds.w/400;
    const base=index===9?Gwanghwamun:null;
    const parts=base?base.parts.slice():[], solids=base?base.solids.slice():[];
    const exits=base?base.exits:layout.stairs.map(([x,y,facing],i)=>({...SURFACE.exits[i],...world([x,y],scale),facing}));
    for(const area of layout.blocks||[])solids.push(rect(area,scale));
    for(const polygon of layout.banks||[])solids.push(...polyBlocks(polygon,scale));
    for(const [x,y,w,h,rise] of layout.houses||[]){
      solids.push(rect([x,y+rise,w,h-rise]));
      parts.push(shape([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]));
    }
    for(const [x,y,r] of layout.trees||[]){
      solids.push(rect([x-1,y-1.5,2,2]));
      parts.push(shape([[x-1,y],[x-1,y-3],[x-r,y-r*.7],[x-r*.85,y-r*1.55],[x,y-r*2],[x+r*.8,y-r*1.6],[x+r,y-r*.65],[x+1,y-3],[x+1,y]]));
    }
    const wrecks=layout.wrecks.map(([kind,x,y,degrees])=>{
      const angle=degrees*Math.PI/180,[w,h]=sizes[kind];
      const outline=(a,b)=>[[-a*.76,-b],[a*.75,-b],[a,-b*.74],[a,b*.88],[a*.72,b],[-a*.78,b],[-a,b*.72],[-a,-b*.70]]
        .map(([dx,dy])=>{const [xx,yy]=rotate(dx,dy,angle);return [x+xx*sx/scale,y+yy]});
      solids.push(...polyBlocks(outline(w*.40,h*(kind===3?.33:.40)),scale));
      parts.push(shape(outline(w*.48,h*.48),scale));
      return {kind,x,y,angle,w,h};
    });
    if(!base)for(const e of exits)solids.push(...TransitKit.stairRails(e,false));
    const tile=rect(layout.tile,scale);
    function paving(g,image,area,read){
      g.save();g.beginPath();g.rect(area.x,area.y,area.w,area.h);g.clip();
      for(let y=Math.floor(area.y/tile.h)*tile.h;y<area.y+area.h;y+=tile.h)
        for(let x=Math.floor(area.x/tile.w)*tile.w;x<area.x+area.w;x+=tile.w)
          read(tile.x,tile.y,tile.w,tile.h,x,y);
      g.restore();
    }
    return {bounds,scale,water:(layout.water||[]).map(region=>rect(region,scale)),spawn:world(layout.spawn||[200,150],scale),parts,solids,exits,paving,wrecks,layout};
  }
  return seoulLayouts.map(make);
})();
// Authoring coordinates stay fixed to the painting. Runtime map geometry uses
// a smaller metre-to-screen ratio while actors and equipment keep their size.
const sceneryScale=.84;
function fieldGeometry(source){
  const point=p=>({...p,x:p.x*sceneryScale,y:p.y*sceneryScale});
  const box=b=>({...point(b),w:b.w*sceneryScale,h:b.h*sceneryScale});
  return {bounds:box(source.bounds),exits:source.exits.map(point),solids:source.solids.map(box),
    spawn:source.spawn && point(source.spawn)};
}
const fieldMaps=DistrictMaps.map(fieldGeometry);
function drawAftermath(g,stage,view,t,still){
  if(still)return;
  const wrecks=DistrictMaps[stage-1].wrecks;
  g.save();
  for(let i=0;i<wrecks.length;i+=3){
    const car=wrecks[i],x=car.x*DistrictMaps[stage-1].scale,y=car.y*2000/300;
    if(x<view.x-40||x>view.x+view.w+40||y<view.y-42||y>view.y+view.h+50)continue;
    for(let j=0;j<4;j++){
      const a=(t*.40+j*.25+i*.19)%1,r=2+a*6;
      const dx=a*14+Math.sin(a*5+i)*3;
      g.fillStyle='rgba(43,42,40,'+(.20*(1-a))+')';g.beginPath();
      g.ellipse(x+dx,y-8-a*34,r,r*.82,0,0,2*Math.PI);g.fill();
    }
  }
  g.restore();
}
