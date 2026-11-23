'use strict';

// The two ticket halls meet at the underground arcade and again on the platform.
// The train, shutter row and closed service wing share the visible wall footprints.
const METRO = (() => {
  const bounds = {x:0, y:0, w:2120, h:1280};
  const box = (x,y,w,h) => ({x,y,w,h});
  const west = 128, east = 1992, north = 156, south = 1048;
  const left = 560, right = 1560;
  const arcadeTop = 334, arcadeEnd = 554, platformTop = 774;
  const props = [];
  function fixture(type,x,y,w,h,style=0) {
    const item = {type,x,y,w,h,style};
    props.push(item);
  }
  [302,404,1692,1794].forEach((x,i)=>fixture('gate',x,476,20,48,i));
  fixture('tickets',138,334,74,44);
  fixture('lockers',1900,332,79,45);
  fixture('vending',135,740,59,45);
  fixture('vending',1925,870,48,45,1);
  fixture('bench',391,660,73,23);
  fixture('bench',1630,642,73,23);
  fixture('bench',791,813,76,24);
  fixture('bench',1260,813,76,24);
  fixture('map',306,787,64,28);
  fixture('map',1786,791,64,28);
  fixture('mop',492,537,27,28);
  fixture('mop',1620,356,27,28,1);
  fixture('fallenMachine',1848,876,76,42);
  function paint(g) {
    g.imageSmoothingEnabled=false;
    let seed=9141;
    function rand() { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }
    const choose = a=>a[Math.floor(rand()*a.length)];
    function r(x,y,w,h,color) {g.fillStyle=color; g.fillRect(Math.round(x),Math.round(y),w,h);}
    function poly(points,col) {
      g.fillStyle=col;g.beginPath();g.moveTo(...points[0]);
      points.slice(1).forEach(p=>g.lineTo(...p));g.closePath();g.fill();
    }
    function wire(points,color,width=2) {
      g.beginPath();g.moveTo(...points[0]);points.slice(1).forEach(p=>g.lineTo(...p));
      g.strokeStyle=color;g.lineWidth=width;g.stroke();
    }
    function txt(s,x,y,size,col,align='left') {
      g.font='bold '+size+'px Arcade, monospace';g.fillStyle=col;g.textAlign=align;
      g.textBaseline='alphabetic';g.fillText(s,x,y);
    }
    function texture(x,y,w,h,n,palette) {
      for(let k=0;k<n;k++){
        const sx=x+Math.floor(rand()*w),sy=y+Math.floor(rand()*h);
        r(sx,sy,choose([1,2,2,3,5]),choose([1,1,2]),choose(palette));
      }
    }
    function stone(x,y,w,h,platform=false) {
      g.save();g.beginPath();g.rect(x,y,w,h);g.clip();
      const tiles=platform?['#58646a','#5b676a','#59656a','#596467']:['#65716f','#626e6d','#687270','#64706e'];
      r(x,y,w,h,platform?'#434f54':'#52615e');
      for(let sy=y;sy<y+h;sy+=30)for(let sx=x;sx<x+w;sx+=44) {
        r(sx+1,sy+1,43,29,choose(tiles));r(sx+2,sy+1,41,1,'#c2c5ae18');
        if(rand()<.14) r(sx+3,sy+26,5,1,'#46544d45');
      }
      texture(x,y,w,h,w*h/170,['#69777366','#49595588','#8d969080']);
      g.restore();
    }
    function studs(x,y,w) {
      r(x,y,w,9,'#a99055');
      for(let i=x+2;i<x+w-1;i+=6){r(i,y+2,2,2,'#d0b776');r(i,y+6,2,1,'#655f47');}
    }
    function grime(x,y,scale=1) {
      g.save();g.translate(x,y);g.scale(scale,scale);
      poly([[0,-3],[14,-7],[22,-5],[38,-11],[56,-8],[59,0],[52,3],[34,2],[25,8],[7,5]],'#34484685');
      r(10,-2,11,1,'#829895');r(34,-5,13,1,'#7d8f87');g.restore();
    }
    function scraps(x,y,count,spread=34) {
      for(let i=0;i<count;i++){
        const dx=Math.floor((rand()-.5)*spread)*2,dy=Math.floor((rand()-.5)*spread);
        const w=choose([3,4,6,8,11]),h=choose([2,3,4]);
        r(x+dx+1,y+dy+h,w,2,'#33403c80');
        r(x+dx,y+dy,w,h,choose(['#99988a','#a7a69a','#828c88','#928376','#6b736e']));
        if(w>=8)r(x+dx+2,y+dy+1,3,1,'#565d58');
      }
    }
    function fluorescent(x,y,w,lit=true) {
      r(x-3,y-2,w+6,8,'#242c2e');r(x,y,w,2,'#768987');
      r(x,y+2,w,2,lit?'#dae5cc':'#67716c');
      if(lit){
        const glow=g.createRadialGradient(x+w/2,y,0,x+w/2,y,77);
        glow.addColorStop(0,'#a7d6c31a');glow.addColorStop(1,'#a7d6c300');g.fillStyle=glow;g.fillRect(x-78,y-44,w+156,124);
      }
    }
    function tiledWall(x,y,w,h) {
      r(x,y,w,h,'#545e5c');
      for(let sy=y;sy<y+h;sy+=12)for(let sx=x; sx<x+w; sx+=24){
        r(sx,sy,Math.min(23,x+w-sx),Math.min(11,y+h-sy),choose(['#8d9790','#89938b','#7b8883','#87938c']));
      }
      r(x,y+h-20,w,6,'#456d61');r(x,y+h-14,w,2,'#a3ac94');
      r(x,y+h-5,w,5,'#384644');r(x,y+h,w,6,'#1e292a55');
    }
    function arrow(x,y,dir,c) {
      g.save();g.translate(x,y);g.scale(dir,1);
      r(-9,-2,15,4,c);poly([[1,-8],[10,0],[1,8]],c);g.restore();
    }
    function wallSign(x,y,ko,en) {
      r(x-91,y-3,182,40,'#33423f');r(x-89,y-2,178,37,'#c2c4ad');r(x-88,y+29,176,4,'#518274');
      txt(ko,x,y+15,16,'#33473f','center');txt(en,x,y+25,7,'#526258','center');
    }
    function poster(x,y,n) {
      const palette=[['#cbb58c','#59796a','#7e513e'],['#98b4af','#426373','#e2cb9a'],['#c6b399','#825c50','#464f50']][n%3];
      r(x+2,y+3,34,42,'#3c4543');r(x,y,34,42,'#bec1ad');r(x+2,y+2,30,38,palette[0]);
      poly([[x+4,y+29],[x+13,y+15],[x+19,y+24],[x+28,y+12],[x+30,y+32],[x+4,y+32]],palette[1]);
      r(x+5,y+6,19,2,palette[2]);r(x+5,y+10,12,1,palette[2]);r(x+6,y+35,19,1,palette[2]);
    }

    // Dark ceiling cutaway, with pipe runs on the central utility wing.
    r(0,0,bounds.w,bounds.h,'#202b2e');
    for(let sy=0;sy<bounds.h;sy+=40)for(let sx=0;sx<bounds.w;sx+=68){
      r(sx+1,sy+1,66,38,choose(['#202c2f','#233033','#243034','#222f31']));
    }
    stone(west,north,left-west,south-north);
    stone(right,north,east-right,south-north);
    stone(left,arcadeTop,right-left,arcadeEnd-arcadeTop);
    stone(left,platformTop,right-left,south-platformTop,true);
    for(const x of [west,right]){
      tiledWall(x,north-57,left-west,57);
      r(x-10,north,10,south-north,'#81918a');r(x-6,north,6,south-north,'#495956');
      r(x,north,6,south-north,'#111f262c');r(x,north+4,left-west,4,'#10242b25');
      wallSign(x+214,113,'을지로3가','EULJIRO 3(SAM)-GA');
      poster(x+22,106,x===west?0:2);poster(x+366,106,1);
      fluorescent(x+58,99,66);fluorescent(x+294,99,66,x===west);
    }
    // Open the east hall's west edge wherever the arcade and platform meet it.
    stone(right-11,arcadeTop,18,arcadeEnd-arcadeTop);
    stone(right-11,platformTop,18,south-platformTop,true);
    const shops=[
      ['을지문고','BOOKS','#64786a','#c4c4a7'],
      ['필름 현상소','PHOTO','#52687b','#d4d1b8'],
      ['라디오 수리','AUDIO','#756652','#d6c79e'],
      ['만복 다방','COFFEE','#765a50','#dcc4a4'],
      ['세운 열쇠','KEY SHOP','#566e70','#d0cbaa']
    ];
    for(let i=0;i<shops.length;i++){
      const x=left+i*200, y=arcadeTop-106, [name,en,accent,letter]=shops[i];
      const w=200;
      r(x,y-6,w,113,'#283333');r(x+3,y-3,w-7,4,'#77817a');
      // The ceramic mounting strip continues behind missing shop signs. Most
      // units still have their physical identity in their windows or shutters.
      r(x+4,y,w-8,28,'#81867a');
      for(let k=12;k<w-8;k+=23) r(x+k,y+1,1,26,'#69766d');
      for(let k=9;k<w-11;k+=9) r(x+k,y+14,5,2,'#737c70');
      for(const sx of [12,93,178]){
        r(x+sx,y+6,4,12,'#536157');r(x+sx,y+6,2,2,'#b6ba9f');r(x+sx+1,y+17,6,2,'#676a5a');
      }
      if(i===0 || i===3 || i===2){
        const width=i===2?103:w-8;
        r(x+4,y,width,28,accent);r(x+7,y+2,width-5,2,'#e1dac04a');
        g.save();g.beginPath();g.rect(x+4,y,width,28);g.clip();
        txt(name,x+16,y+21,17,letter);txt(en,x+w-14,y+19,8,letter,'right');
        if(i===3){
          r(x+21,y+10,18,2,'#65584a');r(x+77,y+15,23,1,'#755f52');
          r(x+154,y+8,32,2,'#67564b');
        }
        g.restore();
        if(i===2){
          poly([[x+107,y+6],[x+93,y+13],[x+102,y+19],[x+91,y+28],[x+107,y+28]],'#676f65');
          wire([[x+103,y+25],[x+109,y+30],[x+107,y+37],[x+112,y+41]],'#36463e',2);
        }
      }
      r(x+6,y+30,w-12,70,'#384549');
      if(i===0 || i===3) {
        r(x+10,y+33,w-20,61,'#394945');
        for(let p=0;p<3;p++){
          const sx=x+14+p*57;r(sx,y+36,50,51,'#617470');
          if(i===0) {
            for(let k=0;k<7;k++) r(sx+2+k*6,y+67-rand()*6,4,11+rand()*5,choose(['#9a8e72','#778a81','#a3a086','#766b60']));
            r(sx+1,y+80,48,3,'#434a40');
          } else { r(sx+5,y+65,34,3,'#b8aa87');r(sx+13,y+60,6,5,'#cebea0'); }
          poly([[sx+3,y+37],[sx+18,y+37],[sx+3,y+60]],'#93a79c44');
        }
      } else {
        for(let row=0;row<10;row++){
          const end=i===2&&row>4?Math.max(0,171-(row-4)*17):181;
          r(x+10,y+33+row*6,end,4,choose(['#78817a','#747f79','#828981']));r(x+10,y+34+row*6,end,1,'#b8bbb03a');
        }
        if(i===2) {
          wire([[x+115,y+68],[x+129,y+75],[x+116,y+86],[x+129,y+93],[x+120,y+108]],'#3c4847',2);
          scraps(x+145,arcadeTop+8,18);grime(x+110,arcadeTop+19,.8);
        }
      }
      r(x+1,arcadeTop-9,w-2,8,'#59645e');r(x+2,arcadeTop-9,w-4,2,'#a3aa9b');r(x,arcadeTop,w,8,'#2d343033');
      fluorescent(x+75,y-1,48,i!==2);
    }
    r(left,arcadeEnd,right-left,11,'#919b91');r(left,arcadeEnd+2,right-left,3,'#bbc0ac');
    r(left,arcadeEnd+11,right-left,8,'#44504f');
    for(let n=0;n<2;n++){
      const py=arcadeEnd+45+n*11;
      wire([[left+20,py],[left+101,py],[left+125,py+17],[right-139,py+17],[right-119,py],[right-12,py]],'#354342',7);
      wire([[left+20,py-1],[left+101,py-1],[left+125,py+16],[right-139,py+16],[right-119,py-1],[right-12,py-1]],'#475350',2);
    }
    tiledWall(left,platformTop-68,right-left,68);
    for(let x=left+36;x<right-30;x+=139) fluorescent(x,platformTop-71,64,x!==left+314);
    wallSign(1040,727,'을지로3가','EULJIRO 3(SAM)-GA');
    for(const x of [665,714,1330,1379])poster(x,714,x%3);
    for(let k=0;k<3;k++) {
      const x=left+129+k*312;
      r(x,622,78,34,'#182426');r(x+2,623,74,31,'#48534f');
      for(let j=0;j<6;j++)r(x+5,626+j*4,68,2,'#293635');
    }

    // The far rail and ballast are visible behind the standing three-car train.
    r(west,south,east-west,165,'#333c3f');
    for(let x=west;x<east-1;x+=23) r(x,south+16,8,120,'#4a4943');
    for(const y of [1074,1151]){r(west,y,east-west,7,'#242d2e');r(west,y+1,east-west,3,'#79817a');}
    studs(west,south-15,east-west);
    r(west,south-3,east-west,3,'#aeb5a2');r(west,south,east-west,7,'#232d31');
    TransitKit.drawTrain(g,355,1078);

    function lightPanel(x,y,title,sub,dir) {
      r(x+3,y+6,171,36,'#27333166');r(x,y,170,32,'#242f34');r(x+1,y,168,2,'#87948b');
      arrow(x+17,y+16,dir,'#e3bf70');txt(title,x+34,y+15,12,'#e1dfca');txt(sub,x+35,y+26,8,'#9faea5');
      r(x+166,y+9,2,4,'#a3bc9a');
    }
    lightPanel(625,335,'서쪽 개찰구  1–4','WEST HALL',-1);
    lightPanel(1330,335,'동쪽 개찰구  5–8','EAST HALL',1);
    lightPanel(137,394,'1·2 큰길   3·4 정비 골목','WEST HALL',-1);
    lightPanel(1801,393,'5·6 시장   7·8 상가','EAST HALL',1);

    // Braille guide paths lead to the actual stair lips and gate lanes.
    function guideSegment(x,y,length,vertical) {
      const segment=18;
      for(let i=0;i<length;i+=segment) {
        const len=Math.min(segment-1,length-i);
        const xx=x+(vertical?0:i),yy=y+(vertical?i:0);
        r(xx,yy,vertical?7:len,vertical?len:7,'#8e896a');
        for(let k=1;k<7;k+=3) r(xx+(vertical?k:0),yy+(vertical?0:k),vertical?1:len,vertical?len:1,'#b0a378');
      }
    }
    guideSegment(238,274,215,false);guideSegment(352,274,514,true);
    guideSegment(232,730,123,false);guideSegment(352,786,86,false);guideSegment(431,789,120,true);
    guideSegment(1669,274,221,false);guideSegment(1748,274,530,true);
    guideSegment(1749,730,146,false);guideSegment(1685,801,66,false);guideSegment(1685,801,112,true);
    // A burst water main sweeps a tide of tile grit and paper into the west hall.
    function flood(x,y,scale) {
      g.save();g.translate(x,y);g.scale(scale,scale);
      const shape=[[0,33],[8,20],[29,19],[33,8],[64,10],[77,3],[94,6],[105,0],[130,4],[136,12],[157,12],[163,20],[191,27],[184,35],[155,39],[144,48],[115,44],[94,54],[77,47],[56,53],[46,44],[26,45],[24,38]];
      poly(shape,'#3c4f4d');g.translate(2,-2);poly(shape,'#4a6260');
      for(let i=0;i<58;i++) {
        const sx=26+rand()*134,sy=15+rand()*20;
        r(sx,sy,choose([3,5,11,16]),1,choose(['#8a9e8c','#6a8580','#3b5656','#485c59']));
      }
      for(const [sx,sy] of [[81,27],[60,18],[128,34]]) {
        g.beginPath();g.ellipse(sx,sy,9,2,0,0,Math.PI*2);
        g.strokeStyle='#8d9f8a';g.lineWidth=1;g.stroke();
      }
      g.restore();
    }
    flood(138,553,1.04);
    wire([[136,545],[173,545],[184,549],[184,560],[198,560]],'#31494d',7);
    wire([[136,543],[173,543],[184,548],[184,557],[198,557]],'#81908a',3);
    wire([[196,551],[200,560],[215,568]],'#8daaa3',2);
    scraps(161,588,15);scraps(297,609,12);
    r(143,620,35,12,'#3b4d50');
    for(let i=0;i<8;i++)r(146+i*4,622,2,8,'#788580');
    // Floor-level directional insets and service access panels break the long tile runs.
    function floorStamp(x,y,number,en,dir) {
      const c='#bbc5ac7a';r(x,y,2,26,c);r(x+1,y,81,2,c);r(x+1,y+24,81,2,c);
      txt(number,x+12,y+17,13,c);arrow(x+69,y+12,dir,c);txt(en,x,y+37,8,'#b0bba279');
    }
    floorStamp(929,422,'1 – 4','WEST CONCOURSE',-1);
    floorStamp(1165,922,'5 – 8','EAST CONCOURSE',1);
    function serviceDoor(x,y,label) {
      r(x,y,54,62,'#33413f');r(x+3,y+3,48,55,'#596c64');r(x+7,y+6,39,22,'#73837a');
      txt(label,x+26,y+20,8,'#dae0c7','center');r(x+38,y+35,6,2,'#c3c2ab');
      for(let j=0;j<4;j++)r(x+9,y+39+j*3,21,1,'#3b514a');
      r(x+4,y+56,46,3,'#45534d');
    }
    serviceDoor(578,709,'직원실');serviceDoor(1478,709,'전기실');
    // The east vestibule stands open; one missing door lies on the platform.
    g.save();g.translate(1617,1001);g.rotate(-.18);
    TransitKit.drawLooseDoor(g,0,0);g.restore();
    for(let i=0;i<33;i++){
      const xx=1601+rand()*132,yy=959+rand()*87;
      poly([[xx,yy],[xx+3+rand()*6,yy-2],[xx+1,yy+3]],choose(['#a1b3a7','#89968b','#55716c','#a19c85']));
    }
    scraps(1690,1045,35,48);
    function luggage(x,y) {
      r(x+1,y+5,20,12,'#443f39');r(x+2,y+2,17,12,'#856957');
      r(x+6,y,7,3,'#434c46');r(x+5,y+2,2,11,'#baa682');r(x+14,y+2,2,11,'#baa682');
    }
    for(const item of props){
      const {type,x,y,w,h,style}=item;
      r(x+4,y+h-3,w,9,'#273a3677');
      if(type==='gate'){
        r(x+3,y+2,w-3,h,'#39484a');r(x,y,w-2,h-4,'#808e87');
        r(x+2,y+2,w-6,h-9,'#a2aba0');r(x+4,y+4,9,11,'#405158');r(x+5,y+5,7,3,style===2?'#ce8766':'#9fd1b0');
        r(x+3,y+h-8,w-7,3,'#536864');r(x+5,y+22,8,7,'#626f68');
      }else if(type==='bench'){
        r(x+5,y+12,5,14,'#394442');r(x+w-9,y+12,5,14,'#394442');
        for(let s=0;s<3;s++){
          const sx=x+s*(w/3);r(sx,y,w/3-2,11,'#82928d');r(sx+1,y,w/3-4,3,'#b1b8a9');
          r(sx,y+12,w/3-2,8,'#929d93');r(sx,y+16,w/3-2,2,'#64756e');
        }
      }else if(type==='tickets'||type==='vending'){
        r(x,y,w,h,'#35413f');r(x+2,y+2,w-4,h-4,style?'#875e4f':'#7b8e86');
        if(type==='tickets'){
          for(let j=0;j<2;j++){
            const xx=x+j*36;r(xx+5,y+5,27,17,'#364a4e');r(xx+8,y+8,20,10,'#6e9c9c');
            r(xx+6,y+25,18,3,'#46504a');r(xx+23,y+27,6,7,'#435249');
          }
        }else{
          r(x+4,y+4,w-15,26,'#394d52');
          for(let i=0;i<5;i++)for(let j=0;j<2;j++)r(x+7+i*6,y+7+j*10,3,6,choose(['#d2b177','#bd8270','#91b5aa']));
          r(x+6,y+33,w-20,5,'#35443f');r(x+w-8,y+13,3,7,'#ddc486');
        }
      }else if(type==='lockers'){
        r(x,y,w,h,'#384947');
        for(let j=0;j<5;j++)for(let i=0;i<2;i++){
          const sx=x+2+j*15,sy=y+2+i*21;r(sx,sy,13,19,'#82958d');r(sx+2,sy+4,9,1,'#55675f');r(sx+9,sy+10,2,3,'#c5bfa1');
        }
      }else if(type==='map'){
        r(x+5,y+9,4,20,'#444f4c');r(x+w-10,y+9,4,20,'#444f4c');
        r(x,y,w,22,'#667970');r(x+2,y+2,w-4,18,'#b8bba5');
        wire([[x+7,y+13],[x+20,y+13],[x+27,y+7],[x+52,y+7]],'#507464',2);
        wire([[x+34,y+4],[x+34,y+15],[x+43,y+18]],'#ae775b',2);
      }else if(type==='fallenMachine'){
        // The red drink cabinet fell onto its face; cans trace its slide.
        g.save();g.translate(x+3,y+2);g.rotate(.06);
        r(0,1,72,38,'#34403e');r(2,0,68,32,'#916a57');
        r(3,2,64,3,'#bb8970');r(4,6,42,21,'#404e4e');
        wire([[6,7],[24,11],[15,17],[36,20],[30,25]],'#94a496',2);
        r(48,5,14,22,'#aa7b62');for(let j=0;j<4;j++)r(50,9+j*3,9,1,'#695444');
        r(8,30,48,2,'#b48670');g.restore();
        for(const [ox,oy] of [[0,39],[-13,45],[-19,32],[-31,51],[-52,57],[-58,40],[7,55]]){
          r(x+ox,y+oy+3,8,2,'#434d45');r(x+ox,y+oy,7,4,'#ad7c60');r(x+ox+1,y+oy,2,4,'#b5b7a1');
        }
        scraps(x-7,y+42,13,24);
      }else{
        r(x+2,y+10,21,16,style?'#7b7256':'#9b895d');r(x+5,y+13,16,2,'#cfbb80');
        r(x+15,y-5,3,19,'#9d9780');r(x+20,y+1,2,13,'#778777');r(x+5,y+25,4,4,'#3b4642');r(x+18,y+25,4,4,'#3b4642');
      }
    }

    // Damage gathers around its source; most of the walking lanes stay quiet.
    const damage=[[727,377],[1126,362],[1371,505],[581,823],[1520,977],[272,622],[1840,853],[1394,978]];
    for(const [x,y] of damage){
      scraps(x,y,11);wire([[x-26,y+2],[x-16,y+4],[x-10,y],[x+1,y+3],[x+8,y],[x+14,y+4]],'#43534f',1);
    }
    grime(178,870,1.3);grime(1722,614,1.8);grime(977,996,2.1);
    luggage(405,674);luggage(1296,844);luggage(148,365);
    // A ceiling route display came down at the east end, its torn cable left on the tiles.
    g.save();g.translate(1478,486);g.rotate(.10);
    r(-47,-8,92,26,'#26333388');r(-50,-13,92,25,'#33423f');r(-48,-11,88,20,'#171f21');
    txt('운행 중단',-41,3,12,'#cd9c65');r(17,-7,18,2,'#806746');r(20,0,13,1,'#79674b');
    wire([[16,-10],[11,-2],[19,-3],[12,7]],'#98a394',1);g.restore();
    wire([[1513,487],[1525,493],[1533,484],[1539,490],[1544,488]],'#35453f',2);scraps(1498,488,17);
    // Patches of cool fluorescent light and shadows anchor floor materials to the walls.
    for(const [x,y] of [[270,300],[1680,316],[831,362],[1313,360],[794,824],[1346,820]]){
      const a=g.createRadialGradient(x,y,8,x,y,149);
      a.addColorStop(0,'#c1d6b915');a.addColorStop(1,'#a4cfc100');g.fillStyle=a;g.fillRect(x-150,y-150,300,300);
    }
    // Lit stair wells throw cool pools across the concourse. A damaged circuit at
    // the market end leaves a local shadow rather than tinting the whole map.
    function pool(x,y,rx,ry,color) {
      g.save();g.translate(x,y);g.scale(rx,ry);
      const light=g.createRadialGradient(0,0,0,0,0,1);
      light.addColorStop(0,color);light.addColorStop(1,'#00000000');
      g.fillStyle=light;g.fillRect(-1,-1,2,2);g.restore();
    }
    pool(128,762,332,209,'#10252b66');pool(1930,649,318,289,'#10242c80');
    pool(1200,503,253,119,'#142b344d');pool(1140,1000,352,149,'#142d3455');
    pool(1497,407,211,122,'#182e3450');pool(835,363,180,92,'#cce1ab39');
    pool(1022,786,228,88,'#cce3b22d');pool(215,256,157,112,'#d6e9c03f');
    pool(1866,240,129,99,'#c7dfbb3f');pool(1599,1005,160,126,'#bfc5a12d');
    // Soot collects beneath the ceiling lip and beneath the shuttered shops.
    for (const [x,y,w,height] of [[west,north,left-west,62],[right,north,east-right,62],
      [left,arcadeTop,right-left,53],[left,platformTop,right-left,44]]) {
      const shade=g.createLinearGradient(0,y,0,y+height);
      shade.addColorStop(0,'#14202763');shade.addColorStop(.32,'#20313529');
      shade.addColorStop(1,'#20313500');g.fillStyle=shade;g.fillRect(x,y,w,height);
    }
    g.save();
    g.fillStyle=g.createPattern(art.stationPatina,'repeat');
    g.globalAlpha=.66;g.fillRect(west,97,east-west,1107);
    g.restore();
  }
  const rooms=[box(west,north,left-west,south-north),box(right,north,east-right,south-north),
    box(left,arcadeTop,right-left,arcadeEnd-arcadeTop),box(left,platformTop,right-left,south-platformTop)];
  return {rooms,props,paint};
})();
