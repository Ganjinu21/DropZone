'use strict';
// South-facing city-kit modules, stone courses and tile ribs use world pixels.
function paintSeoulParcel(g,id,w,h){
  const box=(x,y,ww,hh,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(ww),Math.round(hh))};
  const poly=(points,c)=>{g.fillStyle=c;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(Math.round(x),Math.round(y)):g.moveTo(Math.round(x),Math.round(y)));g.closePath();g.fill()};
  const roof=(x,y,width,depth)=>{
    const mid=x+width/2;
    poly([[x,y+depth-6],[x+width*.18,y+4],[mid,y],[x+width*.82,y+4],[x+width,y+depth-6],[x+width-5,y+depth],[x+5,y+depth]],'#394e53');
    for(let xx=7;xx<width-5;xx+=5){
      const u=xx/width, start=Math.max(4,(Math.abs(u-.5)-.31)*depth*4.3);
      box(x+xx,y+start+3,2,depth-start-6,xx%3?'#72827c':'#849189');
      box(x+xx,y+depth-4,3,2,'#abb09b');
    }
    box(x+width*.18,y+2,width*.64,3,'#acafa0');box(x+4,y+depth,width-8,4,'#354c44');
    for(let xx=8;xx<width-7;xx+=7)box(x+xx,y+depth+1,3,3,'#a77e59');
  };
  const columns=(x,y,width,height)=>{
    box(x,y,width,height,'#455349');
    for(let xx=x+4;xx<x+width;xx+=16){box(xx,y,6,height,'#875346');box(xx,y,2,height,'#b18164');box(xx-1,y+height-3,8,3,'#bab59d')}
  };
  if([2,9,10].includes(id)){
    const base=id===2?12:Math.floor(h*.36);
    const bottom=h-base;
    box(5,bottom,w-10,base,'#aaa99b');
    for(let y=3;y<base;y+=6){
      box(6,bottom+y,w-12,1,'#929488');
      for(let x=8+(y%12?6:0);x<w-7;x+=15)box(x,bottom+y+1,1,4,'#c3c1ae');
    }
    if(id!==2){
      const count=id===10?3:1;
      for(let n=0;n<count;n++){
        const center=w*((n+1)/(count+1)),r=Math.round(w*(count===3?.055:.095));
        for(let x=-r;x<=r;x++){const arch=Math.sqrt(r*r-x*x);box(center+x,h-base*.52-arch,1,base*.52+arch,'#414845')}
      }
    }
    columns(w*.09,bottom-h*.19,w*.82,h*.19);roof(0,bottom-h*.42,w,h*.23);
    if(id!==2){columns(w*.22,h*.16,w*.56,h*.17);roof(w*.12,1,w*.76,h*.19)}
    else {box(w*.42,h*.53,w*.16,h*.23,'#887e56');box(w*.40,h*.74,w*.20,4,'#c1aa72')}
    return;
  }
  if(id===11||id===12){
    const seated=id===11,metal=seated?'#ba974a':'#566a60',lit=seated?'#ecd081':'#98a99b',cx=Math.round(w/2);
    box(w*.08,h*.86,w*.84,h*.14,'#777b73');box(w*.15,h*.53,w*.7,h*.34,'#a09f8e');
    box(w*.22,h*.56,w*.56,h*.26,'#858a81');box(w*.4,h*.65,w*.2,5,'#aea383');
    if(seated){box(cx-13,h*.28,26,h*.23,metal);poly([[cx-11,19],[cx-20,42],[cx-16,48],[cx+16,48],[cx+18,36],[cx+9,19]],metal);box(cx-16,41,26,3,lit);box(cx-12,34,12,3,lit)}
    else{box(cx-5,19,10,h*.33,metal);box(cx-6,h*.43,4,h*.11,metal);box(cx+3,h*.43,4,h*.11,metal);box(cx-11,21,5,18,metal);box(cx+9,25,2,h*.29,lit)}
    box(cx-5,9,10,11,metal);box(cx-4,10,4,7,lit);box(cx-6,5,12,6,metal);return;
  }
  if(id===3){
    box(0,4,w,h-8,'#b1ada0');
    for(let y=8;y<h-7;y+=8){box(1,y,w-2,1,'#93988f');for(let x=(y%16?8:0);x<w;x+=19)box(x,y+1,1,6,'#c3c1af')}
    for(const y of [0,h-7]){box(0,y+3,w,4,'#7b847c');for(let x=4;x<w-4;x+=20){box(x,y-3,5,9,'#d0ceba');box(x+1,y-4,3,2,'#dad6c1')}}
    return;
  }
  const kind=({1:'warehouse',4:'market',5:'office',6:'retail',7:'office',8:'market'})[id];
  CityKit.draw(g,{x:0,y:0,w,h,kind,facing:'S',seed:id*177});
  if(id===1||id===4||id===8){
    const colors=id===1?['#607e90','#8fa5ab']:id===4?['#77826a','#b0a284']:['#a86659','#c5a88a'];
    for(let x=4;x<w-10;x+=12){box(x,h-37,12,12,colors[(x-4)/12%2]);box(x,h-25,12,3,'#585e53')}
  }else if(id===5){
    for(let y=0;y<h-10;y+=3){
      const radius=Math.sqrt(Math.max(0,1-((y-h*.47)/(h*.48))**2));
      const left=(1-radius)*w/2;box(left,y,radius*w,3,y>h*.66?'#819397':y%9?'#afbcb9':'#c1cac2');
      for(let x=left+9;x<w-left-4;x+=21)box(x,y,1,3,'#90a1a2');
    }
  }else if(id===6){
    box(w*.39,h*.18,w*.22,h*.7,'#a07163');poly([[w*.36,h*.23],[w*.5,0],[w*.64,h*.23]],'#526a68');
    for(let j=0;j<3;j++)box(w*.42+j*9,h*.42,4,14,'#485b60');
    box(w*.5,0,2,8,'#c3bda4');box(w*.5-3,3,8,2,'#c3bda4');
  }else drawCulturalHall(g,{w,h});
}
