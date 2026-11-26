'use strict';
ART.riverMotion='art/battlefields/water-8.png';
function drawRiver(g,image,map,view,t,still,read=(x,y,w,h,dx,dy)=>g.drawImage(image,x,y,w,h,dx,dy,w,h)){
  if(!map.water.length||!art.riverMotion)return;
  const phase=Math.floor(t*(still?2:8))%8,w=128,h=64;
  for(const r of map.water){
    const x=Math.max(r.x,view.x),y=Math.max(r.y,view.y);
    const right=Math.min(r.x+r.w,view.x+view.w),bottom=Math.min(r.y+r.h,view.y+view.h);
    if(right<=x||bottom<=y)continue;
    g.save();g.beginPath();g.rect(x,y,right-x,bottom-y);g.clip();
    for(let row=Math.floor(y/9)*9;row<bottom;row+=9){
      const sourceY=Math.max(0,row),height=Math.min(9,map.bounds.h-sourceY);
      const shift=Math.round(1.8*Math.sin(phase*Math.PI/4+row*.034));
      const xx=Math.max(2,x),end=Math.min(right,map.bounds.w-2);
      if(end>xx)read(xx+shift,sourceY,end-xx,height,xx,sourceY);
    }
    for(let yy=Math.floor(y/h)*h;yy<bottom;yy+=h){
      for(let xx=Math.floor(x/w)*w;xx<right;xx+=w){
        const fr=(phase+((yy/h)*3))%8;
        g.drawImage(art.riverMotion,fr*w,0,w,h,xx,yy,w,h);
      }
    }
    g.restore();
  }
  for(const [i,[px,py,side]] of map.layout.piers.entries()){
    const x=px*map.scale+(map.layout.axis?18*side:0),y=py*(2000/300);
    if(x<view.x-80||x>view.x+view.w+80||y<view.y-40||y>view.y+view.h+40)continue;
    const fr=(phase+i*3)%8;
    g.save();g.translate(x,y);g.scale(side,1);
    g.drawImage(art.riverMotion,fr*w,h,w,h,-49,-35,w,h);g.restore();
  }
}
