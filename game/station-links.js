'use strict';

// Station artwork is registered under the street in world coordinates. Each passage
// starts at the same physical XY stair as its entrance; only elevation changes.
let paintedStation;
function makeUnderground(exits,bounds=SURFACE.bounds) {
  const offset={x:240,y:725};
  const worldBox=b=>({x:b.x+offset.x,y:b.y+offset.y,w:b.w,h:b.h});
  const rooms=METRO.rooms.map(worldBox);
  const passages=[], segments=[];
  function passage(a,b) {
    const margin=52;
    return {x:Math.min(a.x,b.x)-margin,y:Math.min(a.y,b.y)-margin,
      w:Math.abs(a.x-b.x)+2*margin,h:Math.abs(a.y-b.y)+2*margin};
  }
  const hall={x:718,y:1144};
  for(const e of exits){
    // Turn at the open lower landing before joining the ticket hall. Routing
    // back along a staircase would put its closed upper wall across the link.
    const lip=TransitKit.stairPoint(e,TransitKit.stairLength+30);
    const vertical=e.facing==='N'||e.facing==='S';
    const corner=vertical?{x:hall.x,y:lip.y}:{x:lip.x,y:hall.y};
    const path=[e,lip,corner,hall];
    if(vertical && Math.abs(lip.x-hall.x)<108){
      const x=lip.x+140;path.splice(2,1,{x,y:lip.y},{x,y:hall.y});
    }else if(!vertical && Math.abs(lip.y-hall.y)<108){
      const y=lip.y+140;path.splice(2,1,{x:lip.x,y},{x:hall.x,y});
    }
    if(exits.length===8 && e.number===2){
      // Gwanghwamun's two west-facing landings share a bank. Pass west
      // of the first stairwell before turning south into the ticket hall.
      path.splice(2,path.length-3,{x:630,y:lip.y},{x:630,y:hall.y});
    }
    for(let j=1;j<path.length;j++){
      passages.push(passage(path[j-1],path[j]));
      segments.push([path[j-1],path[j]]);
    }
  }
  // Derive wall collision from the very same open rectangles used to paint the floor.
  let solids=[bounds];
  for(const open of [...rooms,...passages])solids=solids.flatMap(w=>TransitKit.subtractRect(w,open));
  // Furniture must leave the shared passages and their stair landings usable.
  const props=METRO.props.filter(item=>{
    const box=worldBox(item);
    return !passages.some(p=>box.x<p.x+p.w&&box.x+box.w>p.x&&box.y<p.y+p.h&&box.y+box.h>p.y);
  });
  solids.push(...props.map(worldBox),...exits.flatMap(e=>TransitKit.stairRails(e,true)));

  // Trace only exposed walls of the passage union. Shared edges at elbows,
  // intersections and doors into the ticket hall stay completely open.
  function drawPassageWalls(g){
    const all=[...rooms,...passages], done=new Set();
    const contains=(r,x,y)=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h;
    function trim(x,y,length,vertical,outer){
      if(vertical){
        const left=x+(outer?-2:-4);
        g.fillStyle='#253436';g.fillRect(left,y,6,length);
        g.fillStyle='#80918b';g.fillRect(left+1,y,2,length);
        for(let yy=y+12;yy<y+length-12;yy+=46){g.fillStyle='#a5ada0';g.fillRect(left,yy,4,2)}
        return;
      }
      if(!outer){
        g.fillStyle='#273537';g.fillRect(x,y-3,length,6);
        g.fillStyle='#929c8c';g.fillRect(x,y-4,length,2);
        g.fillStyle='#50605b';g.fillRect(x,y-2,length,2);
        return;
      }
      g.fillStyle='#374642';g.fillRect(x,y-20,length,23);
      g.fillStyle='#78857c';g.fillRect(x,y-18,length,13);
      for(let xx=x+13;xx<x+length;xx+=22){g.fillStyle='#586b63';g.fillRect(xx,y-18,1,12)}
      g.fillStyle='#4c7467';g.fillRect(x,y-9,length,4);
      g.fillStyle='#a0aa95';g.fillRect(x,y-5,length,1);
      g.fillStyle='#28373370';g.fillRect(x,y+3,length,5);
      for(let xx=x+16;xx<x+length-38;xx+=117){
        g.fillStyle='#32413e';g.fillRect(xx,y-20,32,4);
        g.fillStyle='#d9e4c4';g.fillRect(xx+2,y-18,28,2);
        const light=g.createRadialGradient(xx+16,y,0,xx+16,y,52);
        light.addColorStop(0,'#c7e7be30');light.addColorStop(1,'#c7e7be00');
        g.fillStyle=light;g.fillRect(xx-36,y-19,104,70);
      }
    }
    for(const p of passages)for(const [vertical,outer] of [[true,true],[true,false],[false,true],[false,false]]){
      const length=vertical?p.h:p.w;
      const x=p.x+(vertical&&!outer?p.w:0), y=p.y+(!vertical&&!outer?p.h:0);
      let start=-1;
      for(let i=0;i<=length;i++){
        const xx=x+(vertical?0:i), yy=y+(vertical?i:0), key=(yy*4096+xx)*2+Number(vertical);
        const outside=outer?-.5:.5;
        const wall=i<length&&!done.has(key)&&!all.some(r=>contains(r,xx+(vertical?outside:.5),yy+(vertical?.5:outside)));
        if(wall){done.add(key);if(start<0)start=i}
        else if(start>=0){trim(x+(vertical?0:start),y+(vertical?start:0),i-start,vertical,outer);start=-1}
      }
    }
  }
  function paintStairs(g,e){
    const len=TransitKit.stairLength,w=TransitKit.halfWidth;
    const fill=(start,end,left,right,color)=>{
      const r=TransitKit.stairRect(e,start,end,left,right);
      g.fillStyle=color;g.fillRect(r.x,r.y,r.w,r.h);
    };
    fill(-3,len+3,-w-4,w+4,'#2e3c40');
    for(let t=0;t<len;t+=7){
      fill(t,t+6,-w,w,t<len/2?'#63736e':'#73817a');
      fill(t+5,t+7,-w,w,'#b0baaa');
    }
    for(const side of [-w-3,w]){
      fill(0,len,side,side+3,'#7f9189');
      fill(1,len-1,side,side+1,'#c0c9b6');
      for(let t=5;t<len;t+=23)fill(t,t+3,side-1,side+4,'#425550');
    }
    for(let side=-w+3;side<w-2;side+=5)fill(len+1,len+4,side,side+3,'#d7b868');
    const p=TransitKit.stairPoint(e,len+10,-21);
    g.fillStyle='#273e3c';g.fillRect(p.x-7,p.y-7,14,13);
    g.fillStyle='#f1d891';g.font='bold 10px Arcade, sans-serif';g.textAlign='center';
    g.fillText(String(e.number),p.x,p.y+3);
  }
  const density=1.25;
  let sheet,usesPainting=false;
  function bake(painted){
    const c=document.createElement('canvas');c.width=Math.ceil(bounds.w*density);c.height=Math.ceil(bounds.h*density);
    const g=c.getContext('2d',{alpha:painted});g.scale(density,density);g.imageSmoothingEnabled=true;
    if(!painted){g.fillStyle='#202b2e';g.fillRect(0,0,c.width,c.height)}
    g.save();g.translate(offset.x,offset.y);
    METRO.paint(g,props,painted);g.restore();
    // Draw passages only in the unoccupied ceiling space; the historic halls,
    // shops and platform retain their original tiles and furniture.
    g.save();g.beginPath();
    for(const area of passages){
      let pieces=[area];
      for(const room of rooms)pieces=pieces.flatMap(p=>TransitKit.subtractRect(p,room));
      for(const p of pieces)g.rect(p.x,p.y,p.w,p.h);
    }
    g.clip();
    for(const p of passages){
      g.fillStyle='#55625f';g.fillRect(p.x,p.y,p.w,p.h);
      for(let y=Math.floor(p.y/18)*18;y<p.y+p.h;y+=18){
        for(let x=Math.floor(p.x/28)*28;x<p.x+p.w;x+=28){
          g.fillStyle=(x/28+y/18)%3?'#79847b':'#768078';g.fillRect(x+1,y+1,27,17);
        }
      }
    }
    for(const [a,b] of segments){
      g.strokeStyle='#a39765';g.lineWidth=6;g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
      g.strokeStyle='#c0b281';g.lineWidth=2;g.setLineDash([2,4]);g.stroke();g.setLineDash([]);
    }
    g.globalAlpha=.62;g.fillStyle=g.createPattern(art.stationPatina,'repeat');g.fillRect(0,0,c.width,c.height);
    g.restore();
    drawPassageWalls(g);
    for(const e of exits)paintStairs(g,e);
    return c;
  }
  function prepare(){
    if(!paintedStation){
      paintedStation=new Image();
      paintedStation.decoding='async';
      paintedStation.src='art/battlefields/metro-painted.webp';
    }
    const ready=paintedStation.complete && paintedStation.naturalWidth>0;
    if(!sheet||usesPainting!==ready){sheet=bake(ready);usesPainting=ready}
  }
  function draw(g,v){
    prepare();
    if(usesPainting){
      g.fillStyle='#202b2e';g.fillRect(v.x,v.y,v.w,v.h);
      const x=Math.max(v.x,offset.x),y=Math.max(v.y,offset.y);
      const w=Math.min(v.x+v.w,offset.x+2120)-x,h=Math.min(v.y+v.h,offset.y+1280)-y;
      if(w>0&&h>0)g.drawImage(paintedStation,(x-offset.x)*2,(y-offset.y)*2,w*2,h*2,x,y,w,h);
    }
    g.drawImage(sheet,v.x*density,v.y*density,v.w*density,v.h*density,v.x,v.y,v.w,v.h);
  }
  return {bounds,exits,solids,offset,draw,prepare};
}
let underground;
