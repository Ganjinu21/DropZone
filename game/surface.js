'use strict';

ART.groundKit = 'ground-kit.png';

// City lots and openings use the same plan for the painted scene and for collision.
const SURFACE = (() => {
  const bounds = {x:0, y:0, w:2600, h:2000};
  const spawn = {x:1300, y:1000};
  const exits = [
    [1100,839,'버스정류장','E'], [1063,338,'교차로 광장','E'],
    [515,1371,'정비 골목','S'], [434,1541,'하역장','N'],
    [1497,839,'시장 아케이드','W'], [2255,331,'시장 뒷골목','W'],
    [1770,1452,'상가 대로','E'], [2143,1688,'뒤편 주차장','W']
  ].map(([x,y,name,facing],i)=>({x,y,name,facing,number:i+1}));
  const rect = (x,y,w,h) => ({x,y,w,h});
  const boundsOf = a => rect(...a);
  const blocks = [
    [0,0,584,380], [638,0,516,380], [0,434,646,446], [706,434,448,446],
    [0,1080,552,372], [617,1080,537,372], [0,1512,552,488], [617,1512,537,488],
    [1434,0,520,374], [2016,0,584,374], [1434,436,520,444], [2016,436,584,444],
    [1434,1080,748,420], [2232,1080,368,420], [1434,1560,552,440], [2044,1560,556,440]
  ].map(boundsOf);
  const buildings = [];
  function lot(x,y,w,h,kind,facing,sign,feature={}) {
    // Keep the boundary streets wide enough for a squad to reach the outer entrances.
    const right=Math.min(x+w,bounds.w-28), bottom=Math.min(y+h,bounds.h-28);
    x=Math.max(28,x);y=Math.max(28,y);
    buildings.push({x,y,w:right-x,h:bottom-y,kind,facing,sign,...feature,seed:buildings.length*983+317,shared:{}});
  }
  // West residential quarter: perimeter buildings enclose a court open toward the north lane.
  lot(18,14,194,131,'apartment','W');
  lot(212,14,125,131,'retail','N');
  lot(421,25,125,120,'apartment','E');
  lot(18,145,137,190,'apartment','W');
  lot(155,223,215,112,'apartment','S');
  lot(370,223,176,112,'retail','S','broken');
  lot(421,145,125,78,'apartment','E',null,{ruin:2});

  // Public offices with a sheltered forecourt and a walk-through delivery lane.
  lot(662,12,198,144,'office','W');
  lot(860,12,253,144,'tower','E');
  lot(662,156,198,175,'office','W');
  lot(860,156,160,119,'office','S');

  // Printing and workshop block. Two back-to-back terraces with a cross alley between.
  lot(13,458,201,149,'warehouse','W');
  lot(214,458,145,149,'retail','N');
  lot(359,458,246,149,'office','E');
  lot(13,607,140,170,'warehouse','W');
  lot(153,686,161,128,'retail','S','broken');
  lot(314,686,170,128,'warehouse','S');
  lot(484,647,121,167,'retail','E');
  // Connected hospital wings hug the north and west edges of the ambulance court.
  lot(730,453,178,167,'hospital','W');
  lot(908,453,213,167,'hospital','E',null,{landmark:true});
  lot(730,620,178,166,'hospital','S');
  lot(908,620,98,97,'hospital','S');

  // Repair lane: a long, continuous workshop frontage with a loading strip on the eastern side.
  lot(12,1114,168,150,'warehouse','N');
  lot(180,1114,155,150,'retail','N');
  lot(335,1114,128,150,'warehouse','E');
  lot(12,1264,168,130,'warehouse','W',null,{ruin:1});
  lot(180,1264,110,130,'retail','S','broken');
  lot(290,1305,133,89,'warehouse','E');
  lot(645,1116,175,141,'office','N');
  lot(820,1116,129,141,'retail','N');
  lot(949,1116,172,180,'office','E');
  lot(645,1257,105,144,'warehouse','W');
  lot(750,1310,209,91,'warehouse','S');
  lot(959,1296,162,105,'retail','E');

  // Freight and housing to the south. The lorry yard links the two loading doors.
  lot(16,1530,178,164,'warehouse','W');
  lot(194,1530,139,127,'warehouse','N');
  lot(16,1694,178,279,'warehouse','W');
  lot(194,1823,188,150,'warehouse','N');
  lot(382,1823,139,150,'office','E');
  lot(646,1541,174,164,'apartment','W');
  lot(820,1541,178,164,'office','N');
  lot(998,1541,121,164,'retail','E');
  lot(646,1705,112,256,'apartment','W');
  lot(758,1847,215,114,'apartment','S');
  lot(973,1805,146,156,'apartment','E');

  // North-east tenements lead through the fruit market's service court.
  lot(1465,13,176,173,'apartment','W');
  lot(1641,13,119,152,'retail','N');
  lot(1800,13,121,152,'apartment','E');
  lot(1465,186,132,144,'apartment','W');
  lot(1597,222,185,108,'retail','S');
  lot(1782,165,139,165,'office','E');
  lot(2045,15,168,166,'warehouse','W');
  lot(2213,15,175,166,'market','N');
  lot(2388,15,190,166,'warehouse','E');
  lot(2045,181,246,93,'warehouse','S');
  lot(2450,181,128,153,'market','E');

  // Market arcades run across the block. A central six-metre passage opens to the street.
  lot(1463,463,124,137,'market','W');
  lot(1587,463,170,137,'market','N');
  lot(1757,463,170,137,'warehouse','E');
  lot(1463,600,124,188,'market','W','broken',{ruin:0});
  lot(1587,673,117,115,'market','S');
  lot(1772,663,155,125,'market','S','intact');
  lot(2045,462,207,145,'office','W');
  lot(2252,462,178,145,'retail','N');
  lot(2430,462,150,145,'apartment','E');
  lot(2045,607,118,210,'market','W');
  lot(2163,701,162,116,'market','S');
  lot(2325,701,135,116,'retail','S');
  lot(2460,607,120,210,'warehouse','E');

  // Business district: unlettered towers, shared podium wings and recessed court entries.
  lot(1465,1121,215,190,'tower','W');
  lot(1680,1121,166,156,'office','N');
  lot(1846,1121,124,156,'retail','N');
  lot(1970,1121,176,210,'tower','E');
  lot(1465,1311,173,112,'office','W');
  lot(1840,1350,130,111,'retail','S');
  lot(1970,1331,176,130,'office','E');
  lot(2260,1116,151,160,'office','W');
  lot(2411,1116,169,160,'apartment','E');
  lot(2260,1276,151,150,'office','S');
  lot(2411,1319,169,107,'retail','E','broken',{ruin:3});
  lot(1464,1590,176,158,'apartment','W');
  lot(1640,1590,190,158,'apartment','N');
  lot(1830,1590,124,158,'office','E');
  lot(1464,1748,176,205,'apartment','W');
  lot(1640,1846,152,107,'retail','S');
  lot(1792,1846,162,107,'apartment','E');
  // The east frontage backs onto a car park. The stair and cars occupy the same setback.
  lot(2304,1590,274,152,'office','N');
  lot(2406,1742,172,214,'tower','E');
  lot(2215,1838,191,118,'office','S');
  lot(2073,1838,142,118,'retail','W');

  const solids = buildings.map(({x,y,w,h})=>rect(x,y,w,h));
  const overlap = (a,lenA,b,lenB)=>Math.max(0,Math.min(a+lenA,b+lenB)-Math.max(a,b));
  // Openings only belong to exposed walls. Shared masonry meets across the lot line.
  for(const a of buildings)for(const b of buildings){
    if(a===b)continue;
    if(overlap(a.y,a.h,b.y,b.h)>=a.h/2){
      if(a.x+a.w===b.x)a.shared.E=true;
      if(a.x===b.x+b.w)a.shared.W=true;
    }
    if(overlap(a.x,a.w,b.x,b.w)>=a.w/2){
      if(a.y+a.h===b.y)a.shared.S=true;
      if(a.y===b.y+b.h)a.shared.N=true;
    }
  }
  for(const exit of exits)solids.push(TransitKit.entranceSolid(exit));

  // Props live in functional groups at the mouths of alleys, bays, and stair landings.
  const fixtures=[];
  function prop(id,x,y,scale=2,blocking=false) {
    const frame=StreetFixtures.bounds(id,x,y,scale);
    fixtures.push({id,x,y,scale,frame});
    if(blocking){
      const pad=Math.max(2,Math.round(frame.w*.04));
      solids.push(rect(frame.x+pad,frame.y+scale*3,frame.w-2*pad,frame.h-5*scale));
    }
  }
  // Hospital ambulance court, the opposite transit stop, and the severed information display.
  prop('ambulance',1054,764,2,true); prop('junction',1128,675,1.5);
  prop('bench',782,813,1.5); prop('hydrant',925,804,1.5);
  prop('busStop',800,861,2,true); prop('bus',790,918,2,true);
  prop('bike',869,852,1.5); prop('fallenLed',1435,959,2,true);
  prop('barrier',1474,902,1.5); prop('barrier',1526,916,1.5);
  // Market stalls, returns, empty fruit boxes and the unloading court.
  prop('crates',1572,805,1.5);prop('cart',1641,808,1.5);
  prop('crates',1768,626,1.5); prop('pallet',1879,645,1.5);
  prop('truckV',1985,571,2,true); prop('refuse',2090,842,1.5);
  prop('pallet',2317,256,2);prop('crates',2353,259,1.5);
  prop('truck',2440,384,2,true);prop('cart',2242,292,1.5);
  prop('refuse',1712,205,1.5); prop('bike',1841,349,1.5);
  // Garages and freight yards.
  prop('tires',226,1413,2);prop('cable',359,1285,1.5);prop('truckV',480,1187,1.5,true);
  prop('junction',309,1411,1.5);prop('pallet',228,1715,1.5);
  prop('truck',320,1747,2,true);prop('pallet',258,1813,2); prop('cart',231,1787,2);
  prop('crates',383,1798,2);prop('pallet',519,1782,2);
  prop('refuse',869,1296,1.5);prop('cable',805,1301,1.5);
  // Unmarked office entrances, car park, apartment service courts.
  prop('bench',1000,289,1.5);prop('sedan',1035,397,2,true);
  prop('bench',500,361,1.5);prop('refuse',168,212,1.5);
  prop('pallet',235,650,2);prop('cable',420,659,1.5);
  prop('sedanV',1378,1219,2,true);prop('sedan',1791,1332,2,true);
  prop('bench',1673,1398,1.5);prop('bench',1797,1401,1.5);
  prop('junction',2239,1387,1.5);prop('hydrant',1913,1106,1.5);
  prop('sedanV',2099,1790,2,true);prop('sedanV',2165,1789,2,true);
  prop('ambulanceV',2319,1816,1.5,true);prop('refuse',2269,1770,1.5);
  prop('sedan',978,1778,2,true);prop('bike',797,1790,1.5);
  prop('bike',1888,1790,1.5);prop('bench',1664,1823,1.5);
  // Recessed tree pits identify the hospital walk, plaza and residential courts.
  // Service yards deliberately keep hardstanding clear for trolleys and vans.
  const trees=[
    [0,742,828],[3,937,830],[1,1130,582], [1,908,309],[0,669,352],
    [0,246,182],[3,377,181],[1,358,350],
    [2,1692,196],[0,1624,349],[3,2136,304],
    [2,652,1424],[3,789,1423],[1,1088,1428],
    [1,1649,1367],[3,1756,1371],[0,1930,1331],
    [0,779,1796],[2,1020,1731],[3,1878,1802],[2,1730,1783],
    [1,2248,1480],[3,1524,1972]
  ];
  for(const [,x,y] of trees)solids.push(rect(x-13,y-8,26,16));
  fixtures.sort((a,b)=>a.y-b.y);

  const cache=new Map();
  const chunkSize=384;
  function hash(x,y){
    const v=Math.imul(x+11,0x9e3779b1)^Math.imul(y+7,0x85ebca77);
    return (v^(v>>>14))>>>0;
  }
  function visible(a,v,pad=0){
    return a.x+a.w+pad>=v.x && a.y+a.h+pad>=v.y && a.x-pad<v.x+v.w && a.y-pad<v.y+v.h;
  }
  function ink(g,x,y,w,h,c){g.fillStyle=c;g.fillRect(x,y,w,h);}
  function stroke(g,points,color,width=1){
    g.beginPath();g.strokeStyle=color;g.lineWidth=width;
    g.moveTo(points[0],points[1]);
    for(let i=2;i<points.length;i+=2)g.lineTo(points[i],points[i+1]);
    g.stroke();
  }
  function lettering(g,s,x,y,size,color){
    g.fillStyle=color;g.font='bold '+size+'px Arcade, sans-serif';g.textBaseline='middle';g.textAlign='center';g.fillText(s,x,y);
  }
  function stamp(g,col,row,x,y,w,h=w){
    g.drawImage(art.groundKit,col*32,row*32,32,32,x,y,w,h);
  }
  function fillMaterial(g,v,box,row,step){
    const x0=Math.max(box.x,v.x),y0=Math.max(box.y,v.y);
    const x1=Math.min(box.x+box.w,v.x+v.w),y1=Math.min(box.y+box.h,v.y+v.h);
    if(x1<=x0||y1<=y0)return;
    const col=Math.floor(x0/step), line=Math.floor(y0/step);
    g.save();g.beginPath();g.rect(x0,y0,x1-x0,y1-y0);g.clip();
    for(let y=line;y*step<y1;y++)for(let x=col;x*step<x1;x++){
      stamp(g,hash(x,y)%8,row,x*step,y*step,step);
    }
    g.restore();
  }
  function dash(g,x,y,len,horizontal,color,on=33,off=42,width=2){
    // Only draw marks that lie within a continuous segment of road.
    for(let n=0;n<len;n+=on+off){
      const w=Math.min(on,len-n);
      if(horizontal)ink(g,x+n,y,w,width,color);
      else ink(g,x,y+n,width,w,color);
    }
  }
  function crossing(g,x,y,horizontal,count,step,bar,length){
    for(let i=0;i<count;i++){
      const a=x+(horizontal?i*step:0), b=y+(horizontal?0:i*step);
      ink(g,a,b,horizontal?bar:length,horizontal?length:bar,'#bab5a58c');
      const h=hash(a,b); 
      if(horizontal)ink(g,a+1,b+3+(h%15),bar*.65,2,'#6d6e6a');
      else ink(g,a+2+(h%17),b+1,3,bar*.6,'#70716b');
    }
  }
  function arrow(g,x,y,turn){
    g.save();g.translate(x,y);g.rotate(turn*Math.PI/2);g.fillStyle='#adae9e76';
    g.fillRect(-16,-2,28,4);g.beginPath();g.moveTo(16,0);g.lineTo(4,-7);g.lineTo(5,7);g.closePath();g.fill();g.restore();
  }
  function roads(g){
    const center='#bea56b84', lane='#afb0a363';
    for(const [x,w] of [[0,1088],[1491,1109]]){
      for(const y of [976,981])ink(g,x,y,w,2,center);
      for(const y of [928,1031])dash(g,x,y,w,true,lane);
    }
    for(const [y,h] of [[0,811],[1116,884]]){
      for(const x of [1293,1298])ink(g,x,y,2,h,center);
      for(const x of [1229,1362])dash(g,x,y,h,false,lane);
    }
    crossing(g,1163,842,true,16,17,8,28);crossing(g,1163,1093,true,16,17,8,26);
    crossing(g,1118,893,false,13,14,6,27);crossing(g,1443,893,false,13,14,6,27);
    for(const x of [420,1003,1582,2293]){
      arrow(g,x,941,2);arrow(g,x+61,1022,0);
    }
    for(const y of [258,697,1328,1760]){
      arrow(g,1239,y,1);arrow(g,1352,y-64,3);
    }
    // Local lanes are narrow delivery streets. Stop bars meet the outer avenue.
    for(const [x,y,w,h] of [[665,828,23,3],[1964,824,35,3],[562,1100,37,3],[2193,1102,26,3],
      [1117,393,4,25],[1455,393,4,25],[1114,1475,4,22],[1454,1523,4,25]])ink(g,x,y,w,h,'#b5b7a375');
    // The municipal bus pulled out of the lane; a broken sign spills into the crossing.
    dash(g,600,886,442,true,'#a995614f',15,7);
    dash(g,600,920,442,true,'#a995614f',15,7);
    lettering(g,'BUS',968,902,16,'#c1ab777a');
    stroke(g,[1478,891,1478,929,1485,938,1480,945,1465,945,1460,953],'#25292b',2);
    ink(g,1473,885,12,7,'#354040');
    for(const [x,y] of [[552,420],[979,1025],[1272,934],[1860,1016],[1988,674],[596,1420],[1471,1525],[2259,1522]])stamp(g,1,4,x,y,32);
  }
  function kerb(g,b,i){
    const {x,y,w,h}=b, endX=x+w,endY=y+h;
    g.save();
    // Square parcels have a small clipped curb radius at each intersection.
    const k=7;
    g.beginPath();g.moveTo(x+k,y);g.lineTo(endX-k,y);g.lineTo(endX,y+k);
    g.lineTo(endX,endY-k);g.lineTo(endX-k,endY);g.lineTo(x+k,endY);g.lineTo(x,endY-k);g.lineTo(x,y+k);g.closePath();
    g.lineWidth=5;g.strokeStyle='#323838';g.stroke();g.lineWidth=2;g.strokeStyle='#b0afa0';g.stroke();
    for(let px=x+22;px<endX-18;px+=32){
      ink(g,px,y,1,3,'#5e615a');ink(g,px,endY-2,1,3,'#4c524e');
    }
    for(let py=y+22;py<endY-18;py+=32){
      ink(g,x,py,3,1,'#62645d');ink(g,endX-2,py,3,1,'#525751');
    }
    const drainX=x+Math.floor(w*(i%2?.31:.64));
    stamp(g,0,4,drainX,endY-11,26);
    g.restore();
  }
  // The ground changes inside each parcel: the brick sidewalk ends at private yards.
  const courts=[
    [146,134,282,100,2], [861,267,268,71,2],
    [137,597,459,113,3], [980,614,141,174,2],
    [279,1257,188,146,3], [750,1250,231,102,3],
    [190,1651,336,174,2], [755,1690,354,162,2],
    [1583,161,222,98,3], [2252,171,225,131,3],
    [1579,600,342,99,3], [1695,653,82,159,3],
    [2148,598,325,114,3], [1635,1270,355,148,2],
    [2393,1270,178,70,2], [1629,1732,321,128,2],
    [2070,1664,341,177,0]
  ].map(([x,y,w,h,row])=>({...rect(x,y,w,h),row}));
  function parking(g,x,y,count,step,len){
    for(let i=0;i<=count;i++)ink(g,x+step*i,y,2,len,'#b9b8a075');
    ink(g,x,y,step*count,2,'#b9b8a075');
    for(let i=0;i<count;i++){
      ink(g,x+step*i+7,y+5,step-12,4,'#484d49');
      ink(g,x+step*i+7,y+5,step-12,1,'#aba99a');
    }
  }
  function bay(g,x,y,w,h){
    g.strokeStyle='#c5b89175';g.lineWidth=2;g.strokeRect(x,y,w,h);
    for(let i=5;i+14<w;i+=13)stroke(g,[x+i,y+h-2,x+i+12,y+h-13],'#b7a67d6a',2);
  }
  function directionalSurface(g,e){
    const {x,y,facing}=e;
    const horizontal=facing==='E'||facing==='W';
    const w=horizontal?11:55,h=horizontal?55:11;
    const xx=x-w/2+(facing==='E'?9:facing==='W'?-9:0);
    const yy=y-h/2+(facing==='S'?9:facing==='N'?-9:0);
    g.save();g.beginPath();g.rect(xx,yy,w,h);g.clip();
    for(let dy=0;dy<h;dy+=16)for(let dx=0;dx<w;dx+=16)stamp(g,5,4,xx+dx,yy+dy,16);
    g.restore();
  }
  function details(g){
    bay(g,1010,730,107,52);bay(g,242,1714,134,51);
    bay(g,442,1106,64,107);bay(g,1820,607,94,49);
    parking(g,2069,1736,4,62,85);parking(g,888,1730,3,55,75);
    parking(g,1676,1297,3,67,55);
    for(const e of exits)directionalSurface(g,e);
    const scattered=[
      [1493,937,2,41],[1467,967,2,31],[915,792,6,32],[990,775,3,25],
      [835,840,6,22],[2053,609,3,34],[1549,807,3,28],[1926,748,4,42],
      [1690,773,6,29],[953,278,7,30],[2237,297,3,29],[1787,302,4,29],
      [289,1403,2,36],[285,1296,4,24],[212,1773,4,36],[369,1791,6,27],
      [2235,1738,7,28],[827,1792,6,31],[2405,1300,3,30],[1855,1334,6,27],
      [1870,1739,7,29],[1667,1771,6,35],[182,217,4,30],[321,627,4,28],
      [1912,618,6,30],[2104,1671,3,39],[488,1196,6,30],[709,1416,7,27]
    ];
    for(const [x,y,col,w] of scattered)stamp(g,col,4,x-w/2,y-w/2,w);
  }
  function shadow(g,b){
    const length={tower:28,hospital:18,office:17,apartment:14,warehouse:7,market:6,retail:8}[b.kind];
    const {x,y,w,h}=b;
    g.fillStyle='#242c313f';g.beginPath();g.moveTo(x+3,y+h-3);
    g.lineTo(x+length,y+h+length*.57);g.lineTo(x+w+length,y+h+length*.57);
    g.lineTo(x+w+length,y+length*.57);g.lineTo(x+w-3,y);
    g.lineTo(x+w-3,y+h-3);g.closePath();g.fill();
    if(!b.shared.S)ink(g,x+1,y+h,w-2,3,'#26303245');
  }
  function renderChunk(g,view){
    g.imageSmoothingEnabled=false;
    fillMaterial(g,view,bounds,0,40);
    for(let n=0;n<blocks.length;n++){
      const block=blocks[n];if(!visible(block,view,32))continue;
      fillMaterial(g,view,block,1,40);
      kerb(g,block,n);
    }
    for(const c of courts)fillMaterial(g,view,c,c.row,40);
    roads(g);drawStreetWear(g,view);details(g);
    for(const b of buildings)if(visible(b,view,30))shadow(g,b);
    for(const b of buildings)if(visible(b,view,12))CityKit.draw(g,b);
    for(const [variant,x,y] of trees){
      const frame=rect(x-32,y-38,64,64);
      if(visible(frame,view))g.drawImage(art.groundKit,variant*64,160,64,64,frame.x,frame.y,64,64);
    }
    for(const e of exits)if(visible(rect(e.x-120,e.y-120,240,240),view))TransitKit.drawEntrance(g,e);
    for(const p of fixtures)if(visible(p.frame,view,6))StreetFixtures.draw(g,p.id,p.x,p.y,p.scale);
  }
  function draw(g,v){
    const minX=Math.max(0,Math.floor(v.x/chunkSize)),maxX=Math.min(Math.ceil(bounds.w/chunkSize)-1,Math.floor((v.x+v.w)/chunkSize));
    const minY=Math.max(0,Math.floor(v.y/chunkSize)),maxY=Math.min(Math.ceil(bounds.h/chunkSize)-1,Math.floor((v.y+v.h)/chunkSize));
    ink(g,v.x,v.y,v.w,v.h,'#353a3b');
    for(let row=minY;row<=maxY;row++)for(let col=minX;col<=maxX;col++){
      const key=row*Math.ceil(bounds.w/chunkSize)+col,x=col*chunkSize,y=row*chunkSize;
      let c=cache.get(key);
      if(!c){
        c=document.createElement('canvas');c.width=Math.min(chunkSize,bounds.w-x);c.height=Math.min(chunkSize,bounds.h-y);
        const local=c.getContext('2d',{alpha:false});local.translate(-x,-y);
        renderChunk(local,rect(x,y,c.width,c.height));
      }
      cache.delete(key);cache.set(key,c);g.drawImage(c,x,y);
    }
    while(cache.size>24)cache.delete(cache.keys().next().value);
  }
  return {bounds,spawn,exits,solids,draw};
})();
