'use strict';

ART.transitKit = 'transit-kit.png';

const TransitKit = (() => {
  const directions = ['N','E','S','W'];
  const normals = {N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]};
  const modules = {
    window:[0,256,74,99], brokenWindow:[80,256,74,99],
    door:[160,256,38,99], openDoor:[202,256,38,99],
    cab:[245,256,53,99], end:[302,256,14,99], joint:[320,256,10,99],
    cooler:[339,256,63,19], bogie:[339,279,62,15], looseDoor:[408,256,24,53]
  };
  function stamp(ctx,rect,x,y) {
    const [sx,sy,w,h]=rect;
    ctx.drawImage(art.transitKit,sx,sy,w,h,Math.round(x),Math.round(y),w,h);
  }
  function entranceSolid({x,y,facing}) {
    const [dx,dy]=normals[facing];
    return {x:x-dx*72-36,y:y-dy*72-36,w:72,h:72};
  }
  function drawEntrance(ctx,{x,y,facing,number}) {
    const [dx,dy]=normals[facing], dir=directions.indexOf(facing);
    const cx=x-dx*45,cy=y-dy*45;
    const covered=[1,4,6,7].includes(number);
    stamp(ctx,[dir*128,covered?128:0,128,128],cx-64,cy-65);
    // Keep numbering upright on a separate sign at the street-facing side.
    const poleX=cx+dx*22+dy*32, poleY=cy+dy*22-dx*32;
    ctx.save();
    ctx.fillStyle='#32413f';ctx.fillRect(poleX-2,poleY-31,4,31);
    ctx.fillStyle='#b3b9a6';ctx.fillRect(poleX-1,poleY-23,1,21);
    ctx.fillStyle='#252f30';ctx.fillRect(poleX-11,poleY-39,23,21);
    ctx.fillStyle='#8f9c88';ctx.fillRect(poleX-10,poleY-39,21,1);
    ctx.fillStyle='#d6b56b';ctx.fillRect(poleX-9,poleY-37,18,15);
    ctx.fillStyle='#29383a';ctx.font='bold 13px Arcade, sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(number),poleX,poleY-29);
    ctx.fillStyle='#58917b';ctx.fillRect(poleX-9,poleY-20,18,2);
    ctx.restore();
  }

  function car(ctx,x,y,hasCab,flip,section){
    const sequence=['end','window','door','window','door','window','door','window',hasCab?'cab':'end'];
    if(section===1)sequence[3]='brokenWindow';
    if(section===2)sequence[6]='openDoor';
    const w=sequence.reduce((length,part)=>length+modules[part][2],0);
    ctx.save();
    ctx.translate(x+(flip?w:0),y);
    if(flip)ctx.scale(-1,1);
    ctx.fillStyle='#1d2a2dbd';
    ctx.fillRect(3,84,w-(hasCab?25:8),11);
    if(hasCab)ctx.fillRect(w-24,84,12,8);
    stamp(ctx,modules.bogie,40,84);
    stamp(ctx,modules.bogie,w-111,84);
    let cursor=0;
    for(const part of sequence){
      stamp(ctx,modules[part],cursor,0);
      cursor+=modules[part][2];
    }
    for(const off of [53,Math.round(w*.65)])stamp(ctx,modules.cooler,off,9);
    for(const off of [125,Math.round(w*.6)]){
      ctx.fillStyle='#68796e';ctx.fillRect(off,90,45,5);
      ctx.fillStyle='#849285';ctx.fillRect(off+2,90,41,1);
      for(let k=0;k<8;k++){ctx.fillStyle='#465653';ctx.fillRect(off+4+k*5,92,2,2);}
    }
    ctx.restore();
    ctx.save();ctx.font='bold 7px Arcade, monospace';ctx.textAlign='left';
    ctx.fillStyle='#344844';ctx.fillText(String(2031+section),x+Math.floor(w*.52),y+78);ctx.restore();
    return w;
  }
  function drawTrain(ctx,x,y) {
    for(let i=0;i<3;i++){
      x+=car(ctx,x,y,i!==1,i===0,i);
      if(i<2){stamp(ctx,modules.joint,x,y);x+=modules.joint[2];}
    }
  }
  return {drawEntrance,entranceSolid,drawTrain,
    drawLooseDoor(ctx,x,y){stamp(ctx,modules.looseDoor,x,y);}
  };
})();
