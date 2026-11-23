'use strict';

// Station artwork is registered under the street in world coordinates. Each passage
// starts at the same physical XY stair as its entrance; only elevation changes.
const underground = (() => {
  const offset={x:240,y:725}, bounds=SURFACE.bounds, exits=SURFACE.exits;
  const worldBox=b=>({x:b.x+offset.x,y:b.y+offset.y,w:b.w,h:b.h});
  const rooms=METRO.rooms.map(worldBox);
  const bends=[
    [[656,839],[656,920]], [[738,338],[738,920]], [], [],
    [[1930,839],[1930,920]], [[2420,331],[2420,1110],[2170,1110]],
    [[1600,1452],[1600,1225]], [[2305,1688],[2305,1570],[2160,1570]]
  ];
  const passages=[], segments=[];
  function passage(a,b) {
    const margin=34;
    return {x:Math.min(a.x,b.x)-margin,y:Math.min(a.y,b.y)-margin,
      w:Math.abs(a.x-b.x)+2*margin,h:Math.abs(a.y-b.y)+2*margin};
  }
  for(const [i,e] of exits.entries()){
    const lip=TransitKit.stairPoint(e,TransitKit.stairLength+18);
    const path=[e,lip,...bends[i].map(([x,y])=>({x,y}))];
    for(let j=1;j<path.length;j++){
      passages.push(passage(path[j-1],path[j]));
      segments.push([path[j-1],path[j]]);
    }
  }
  // Derive wall collision from the very same open rectangles used to paint the floor.
  let solids=[bounds];
  for(const open of [...rooms,...passages])solids=solids.flatMap(w=>TransitKit.subtractRect(w,open));
  solids.push(...METRO.props.map(worldBox),...exits.flatMap(e=>TransitKit.stairRails(e,true)));

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
  let sheet;
  function bake(){
    const c=document.createElement('canvas');c.width=bounds.w;c.height=bounds.h;
    const g=c.getContext('2d',{alpha:false});g.imageSmoothingEnabled=false;
    g.fillStyle='#202b2e';g.fillRect(0,0,c.width,c.height);
    g.save();g.translate(offset.x,offset.y);
    METRO.paint(g);g.restore();
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
  function prepare(){sheet??=bake()}
  function draw(g,v){
    g.drawImage(sheet,v.x,v.y,v.w,v.h,v.x,v.y,v.w,v.h);
  }
  return {bounds,exits,solids,offset,draw,prepare};
})();
