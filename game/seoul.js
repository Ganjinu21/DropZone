'use strict';
ART.ravenMotion='art/seoul/raven-motion.webp';

// Coordinates are foot anchors. Only the masonry at the base blocks movement.
function landmark(art,x,y,w,h,baseWidth,baseDepth){
  return {art,x,y,w,h,foot:{x:x-baseWidth/2,y:y-baseDepth,w:baseWidth,h:baseDepth}};
}
// Most local landmarks occupy a city parcel. Plazas have their own low plinths.
const districtLandmarks=Array.from({length:10},()=>[]);
districtLandmarks[1]=[landmark(2,1264,902,142,99,115,28)];
districtLandmarks[2]=[landmark(3,1280,961,106,51,0,0)];
districtLandmarks[8]=[landmark(9,1290,907,168,108,141,25)];
districtLandmarks[9]=[landmark(10,1300,230,218,125,191,26),landmark(11,1300,921,49,72,38,13),landmark(12,1300,1204,37,81,27,12)];
// Native side-street lots leave the central crossing open for the wave approach.
const streetLots={
  1:[[1135,872,87,62],[1496,932,76,56]],
  4:[[1186,831,65,49],[1399,831,65,49],[1186,1090,65,49],[1399,1090,65,49]],
  5:[[1366,852,177,94]],
  6:[[1194,833,92,137]],
  7:[[1192,797,136,84]],
  8:[[1183,877,52,43],[1183,813,52,43],[1411,1080,53,44],[1411,1148,53,44]]
};
for(const [stage,lots] of Object.entries(streetLots)){
  districtLandmarks[stage-1]=lots.map(([x,y,w,h])=>landmark(+stage,x,y,w,h,w-7,Math.max(16,h*.32)));
}
const parcelThemes=['warehouse','retail','office','market','office','retail','office','market','retail','office'];
const paving=['#b6ae96','#b9b29d','#aebcaf','#baa787','#bbc2c0','#b58e7a','#b3baa5','#bea68a','#b3aca1','#c7bda8'];
// The channel follows the east–west street. Keep three bridges open in the pursuit grid.
const streamSpans=[[33,552],[679,1227],[1333,1946],[2033,2567]];
const streamSolids=streamSpans.map(([left,right])=>({x:left,y:917,w:right-left,h:44}));
function drawStream(g){
  for(const [left,right] of streamSpans){
    const width=right-left;
    g.fillStyle='#ccc6ad';g.fillRect(left,911,width,56);
    g.fillStyle='#666f64';g.fillRect(left,915,width,49);
    g.fillStyle='#528e91';g.fillRect(left,919,width,41);
    for(let n=0;n<width;n+=21){
      const y=922+(n*13)%32;
      g.fillStyle=n%2?'#8fbab4':'#72a6a6';g.fillRect(left+n,y,11,2);
      g.fillStyle='#e8e0c2';g.fillRect(left+n,911,15,2);
    }
  }
}
function drawCulturalHall(g,b){
  const w=b.w,h=b.h;
  g.fillStyle='#ddd0ae';g.fillRect(0,h-68,w,53);
  g.fillStyle='#515c60';g.fillRect(5,h-57,w-10,40);
  for(let x=9;x<w-4;x+=16){
    g.fillStyle='#ebddbd';g.fillRect(x,h-61,6,45);
    g.fillStyle='#979286';g.fillRect(x+6,h-59,2,43);
  }
  for(let k=0;k<4;k++){
    g.fillStyle=k%2?'#a6a396':'#d0ccba';g.fillRect(0,h-16+k*3,w,3);
  }
}
// District treatments follow the open streets of the original city grid.
function drawDistrictGround(g,stage){
  if(!stage)return;
  const {w,h}=SURFACE.bounds;
  const fill=(x,y,width,height,color)=>{g.fillStyle=color;g.fillRect(x,y,width,height)};
  function walk(x,y,width,height,base,stone=32){
    fill(x-2,y-2,width+4,height+4,'#777e74');fill(x,y,width,height,base);
    for(let row=0;row<height;row+=16){
      fill(x,y+row,width,1,'#5d685d37');
      for(let col=row%32?stone/2:0;col<width;col+=stone)
        fill(x+col,y+row,1,Math.min(16,height-row),'#eee7cf60');
    }
  }
  function grass(x,y,width,height){
    fill(x,y,width,height,'#748767');fill(x+2,y+2,width-4,height-4,'#98ac79');
    for(let i=4;i<width-5;i+=10)for(let j=4;j<height-4;j+=9){
      const n=(i*3+j*7)%13;
      if(n<7)fill(x+i+n%3,y+j,3,1,n<4?'#819763':'#b0bd8b');
    }
  }
  function loadingBay(x,y,length,color){
    fill(x,y,length,2,color);fill(x,y,2,14,color);fill(x+length-2,y,2,14,color);
    for(let i=4;i<length-8;i+=12){
      g.fillStyle=color;g.beginPath();g.moveTo(x+i,y+10);g.lineTo(x+i+6,y+4);
      g.lineTo(x+i+9,y+4);g.lineTo(x+i+3,y+10);g.fill();
    }
  }
  const westEast=[[0,542],[695,421],[1486,441],[2054,546]];
  const northSouth=[[0,339],[463,342],[1138,287],[1588,412]];
  const p=paving[stage-1];
  if(stage===1||stage===4||stage===8){
    // A through market/printing street, broken only at intersecting lanes.
    for(const [x,len] of westEast){
      walk(x,873,len,21,p);walk(x,1060,len,19,p);
      for(let at=x+23;at<x+len-80;at+=137){
        loadingBay(at,895,67,stage===1?'#c3ab78a8':'#c7aa8787');
        if(stage!==1){fill(at,1062,43,7,stage===4?'#8c9a80':'#ac8976');fill(at,1069,43,2,'#d9ceaa')}
      }
    }
    if(stage===1){
      // The delivery lane links the print courts with the avenue.
      for(const [y,len] of northSouth){
        walk(1155,y,29,len,'#b1aa94',20);
        for(let at=y+20;at<y+len-25;at+=84)fill(1160,at,3,22,'#d5be8b');
      }
    }
  }else if(stage===3){
    walk(0,898,w,16,'#bcbba4');walk(0,963,w,20,'#c5c1a8');drawStream(g);
    for(const [left,right] of [[552,679],[1227,1333],[1946,2033]]){
      walk(left,907,right-left,60,'#b8b7a9',24);
      for(const side of [left+1,right-5]){fill(side,909,4,56,'#727e75');fill(side,910,2,54,'#dcd8bf')}
    }
  }else if(stage===7||stage===5){
    // A civic lawn or design promenade runs into an uninterrupted civic square.
    walk(1180,429,238,444,p);walk(1164,884,253,189,p);
    if(stage===7){grass(1193,458,210,390);grass(1180,904,222,139)}
    else{
      for(let row=0;row<7;row++){
        const x=1200+(row%3)*12;
        for(let i=0;i<5;i++)fill(x+i*34,487+row*49,20,3,'#8eaba9');
      }
    }
    for(const [x,len] of westEast){walk(x,1054,len,23,p);fill(x,1057,len,3,'#d7cfb4')}
  }else if(stage===10){
    walk(1175,55,246,1888,p,40);
    for(let y=100;y<1880;y+=115){
      if(Math.abs(y-1000)<78)continue;
      grass(1181,y,17,79);fill(1407,y,6,79,'#d9d4bf');
    }
    for(const y of [203,873,1455]){
      for(let i=0;i<4;i++)fill(1210,y+i*6,178,2,'#e1d8bf');
    }
    // The paved forecourt, statue plinths and fountain all share the same axis.
    walk(1201,96,195,104,'#ccc7b5');walk(1260,866,80,65,'#b8b4a1');
    for(let i=0;i<8;i++)for(let j=0;j<4;j++)fill(1222+i*20,1483+j*15,4,3,'#89a9a3');
  }else{
    for(const [y,len] of northSouth){
      walk(1157,y,36,len,p,stage===6?18:30);walk(1398,y,32,len,p);
      for(let j=y+18;j<y+len-18;j+=62)fill(1161,j,4,18,stage===6?'#a58170':'#d8ceb4');
    }
    walk(1181,768,233,176,p);
    if(stage===9)for(let j=0;j<5;j++)fill(1191,928+j*2,213,1,'#93998d');
  }
}
let surfaceRouteStage=0;
function useDistrictRoutes(stage){
  Battlefield.prepare(stage);
  if(surfaceRouteStage===stage)return;
  const map=DistrictMaps[stage-1];
  cityMaps.surface=fieldMaps[stage-1];
  underground=makeUnderground(map.exits,map.bounds);
  cityMaps.metro=fieldGeometry(underground);
  routes.metro=new MapRoutes(cityMaps.metro);
  routes.surface=new MapRoutes(cityMaps.surface);
  surfaceRouteStage=stage;
}
// Source geometry for the full-world bake, also used during first image decode.
function cityFacades(stage){
  const signs=[
    ['을지인쇄','활판 공방','종이상회'],['종로서점','시계공방','종로상회'],
    ['광통교','천변서점','물길공방'],['직물상회','광장포목','원단도매'],
    ['디자인공방','동대문','금속공방'],['명동서점','성당길','명동양복'],
    ['시청역','광장서점','꽃시장'],['회현상회','남대문시장','그릇도매'],
    ['숭례문로','남창상회','문구상가'],['세종대로','광화문서점','종로문화']
  ][stage-1];
  const result=SURFACE.buildings.map((b,index)=>{
    const rise=b.kind==='tower'?74:b.kind==='office'?49:30;
    const hall=stage===10&&b.x===908&&b.y===453;
    const signature=[1,4,5,6,7,8].includes(stage)&&b.x===908&&b.y===453;
    // Keep the original mix of offices and housing in the outer neighbourhoods.
    const districtFront=b.x<1470&&b.x+b.w>1120||b.y<1070&&b.y+b.h>780;
    const kind=districtFront&&b.kind!=='hospital'&&b.kind!=='tower'?parcelThemes[stage-1]:b.kind;
    return {x:b.x,y:b.y-rise,w:b.w,h:b.h+rise,paint(g){
      if(signature)paintSeoulParcel(g,stage,b.w,b.h+rise);
      else CityKit.draw(g,{...b,kind,x:0,y:0,h:b.h+rise});
      if(hall)drawCulturalHall(g,{w:b.w,h:b.h+rise});
      if(!b.shared.S && b.facing==='S' && b.w>110 && index%2===0){
        const name=signs[index%signs.length],width=name.length*12+12;
        const x=Math.floor((b.w-width)/2),y=b.h+rise-35;
        g.fillStyle='#384648';g.fillRect(x+2,y+2,width,16);
        g.fillStyle=['#44626a','#875e50','#667561'][index%3];g.fillRect(x,y,width,15);
        g.fillStyle='#d0b37e';g.fillRect(x,y,width,1);
        g.fillStyle='#f0e9cc';g.font='11px Arcade, sans-serif';g.textBaseline='top';g.fillText(name,x+5,y+2);
      }
    }};
  });
  for(const o of districtLandmarks[stage-1])result.push({x:Math.round(o.x-o.w/2),y:o.y-o.h,w:o.w,h:o.h,paint:g=>paintSeoulParcel(g,o.art,o.w,o.h)});
  return result.sort((a,b)=>a.y+a.h-b.y-b.h);
}
function queueNativeBuildings(actors,view,stage,opacity){
  const allies=run.floor==='surface'?[...run.squad.filter(m=>m.deployed),...(run.radioTeam||[])]:[];
  for(const b of cityFacades(stage)){
    const bottom=b.y+b.h;
    if(b.x+b.w<view.x||b.x>view.x+view.w||bottom<view.y||b.y>view.y+view.h)continue;
    const covered=allies.some(m=>m.x>b.x-13&&m.x<b.x+b.w+13&&m.y>b.y&&m.y<bottom);
    actors.push({o:{y:bottom},opacity:opacity*(covered?.28:1),draw(){
      ctx.save();ctx.translate(b.x,b.y);b.paint(ctx);ctx.restore();
    }});
  }
}
