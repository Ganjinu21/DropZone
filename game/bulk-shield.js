'use strict';

// Shield bounds measured on the standing portrait, the 160-unit recruit cels,
// the 128-unit painted poses and the 192-unit ranked uniforms respectively.
const recruitShieldStand=[93,47,138,210];
const recruitShieldPoses=[
  [88,62,106,123],[88,62,106,122],[86,63,103,122],[88,63,104,123],
  [87,62,111,126],[85,62,108,126],[89,65,101,122],[89,65,102,123],
  [80,65,102,127],[79,65,102,127],[80,68,101,127],[81,69,99,126],
  [82,60,103,122],[78,69,100,129],[81,70,109,143],[86,74,113,147]
];
const paintedShieldPoses=[
  [81,37,101,99],[79,34,100,99],[81,48,99,100],[80,40,103,102],
  [28,46,47,103],[28,44,46,101],[78,42,104,102],[81,40,103,101],
  [80,50,106,117],[78,48,104,120],[79,49,106,119],[69,52,104,121],
  [25,47,46,104],[24,45,46,104],[80,43,106,103],[82,42,106,104],
  [83,34,101,97],[80,35,99,99],[83,34,100,97],[80,35,98,101],
  [82,34,98,97],[80,35,98,99],[78,34,95,99],[79,34,97,97],
  [74,32,99,98],[75,34,98,99],[75,30,99,97],[74,32,100,98],
  [29,32,50,95],[31,32,51,96],[31,30,51,95],[31,32,51,96],
  [85,40,107,100],[86,39,108,100],[87,40,109,100],[88,36,108,100],
  [86,48,109,113],[85,49,107,115],[82,49,106,117],[79,51,106,119],
  [77,51,107,121],[77,52,109,120],[74,52,111,120],[70,52,111,120]
];
const uniformShieldPoses=[
  [[117,71,166,157],[113,71,158,157],[117,71,165,157],[111,72,160,157],
   [112,70,152,151],[109,64,155,152],[110,56,153,143]],
  [[123,51,162,149],[116,52,153,150],[123,52,161,149],[117,52,155,150],
   [118,69,153,148],[117,65,155,150],[118,58,161,141]],
  [[98,67,167,159],[94,67,162,159],[98,67,167,159],[94,67,162,159],
   [99,69,159,152],[93,65,164,154],[95,58,157,150]]
];

// These aiming poses cross the shield. Repaint the illustrated hand and
// sidearm in front after fitting the replacement to the support arm.
const recruitShieldHands={
  0:[72,74,95,75,96,80,78,82],1:[72,74,96,75,96,81,78,83],
  2:[72,74,97,76,97,81,78,83],3:[74,76,99,77,99,82,78,82],
  6:[78,73,103,80,102,84,79,80],7:[79,75,108,82,107,87,80,81],
  11:[72,69,91,75,112,85,111,88,87,79,75,78],
  12:[76,80,82,84,83,106,78,107],14:[74,85,88,85,88,92,73,92],
  15:[73,92,90,92,93,100,71,99]
};

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
