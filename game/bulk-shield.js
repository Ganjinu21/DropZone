'use strict';

function drawFittedShield(g,m,box,drawBody,{x=0,y=0,scale=1,foreground}={}){
  const item=gearByKey.get(m.shieldItem??m.loadout?.shield);
  const shield=item && art[item.artKey];
  if(!box || !shield){drawBody();return}
  const [left,top,right,bottom]=box;
  const width=right-left,height=bottom-top;
  // Preserve the foreshortening of the support arm even when a model has wings.
  const aspect=shield.width/shield.height;
  const newWidth=width*Math.max(.89,Math.min(1.9,aspect/.66));
  const newLeft=left+(width-newWidth)*.42;
  const polygon=points=>{
    g.moveTo(x+points[0]*scale,y+points[1]*scale);
    for(let n=2;n<points.length;n+=2)g.lineTo(x+points[n]*scale,y+points[n+1]*scale);
    g.closePath();
  };
  g.save();
  g.beginPath();g.rect(x-500*scale,y-500*scale,1000*scale,1000*scale);
  polygon([left+width*.12,top,left+width*.93,top,right,top+height*.055,right,bottom-height*.045,
    right-width*.09,bottom,left+width*.10,bottom,left,bottom-height*.07,left,top+height*.12]);
  g.clip('evenodd');drawBody();g.restore();
  g.drawImage(shield,x+newLeft*scale,y+(top-1)*scale,newWidth*scale,(height+2)*scale);
  if(foreground){
    g.save();g.beginPath();polygon(foreground);g.clip();drawBody();g.restore();
  }
}
