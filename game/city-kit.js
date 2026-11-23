'use strict';

ART.cityKit = 'city-kit.png';

// The same roof, storefront, return-wall and service parts are assembled anew
// for each parcel. Only the entrance pad is rotated. Roof lighting and gravity
// on the south elevation stay consistent across every street in the district.
const CityKit = (() => {
  const types = ['office','hospital','apartment','warehouse','market','retail','tower'];
  const palette = [
    ['#7e857c','#b8bcad','#596660','#424d4a'],
    ['#a5a894','#d6d6bd','#798678','#4e635b'],
    ['#79877a','#aeb59b','#707766','#4c574e'],
    ['#788984','#b0baab','#68685b','#454e49'],
    ['#967f6a','#bfae91','#706b59','#504f43'],
    ['#84958e','#b7bfa9','#6d7969','#495952'],
    ['#73868a','#c3c8b7','#5c7374','#3c5056']
  ];
  const extras = [[50,33],[27,25],[48,28],[55,40],[52,27],[43,45],
                  [49,25],[24,29],[58,29],[42,29],[43,31],[34,23]];
  const fittings = [[36,20],[36,16],[36,16],[25,20],[20,18],[27,18],
                    [14,29],[26,12],[14,14],[28,13],[39,8],[18,14]];
  const floorHeights = [28,27,23,29,25,24,25];
  const elevations = [2,2,3,1,1,2,3];

  function random(seed) {
    let state = (seed + 2468111) >>> 0;
    return () => {state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
  }
  function draw(ctx, parcel) {
    const {x,y,w,h,kind} = parcel;
    const facing = parcel.facing || 'S', shared=parcel.shared || {};
    const id = types.indexOf(kind);
    if(id < 0 || w < 16 || h < 18)return;
    const seed = Number.isFinite(parcel.seed)?parcel.seed:(x*71+y*31);
    const roll=random(seed);
    const [stone,lit,shaded,dark]=palette[id];
    const tex=art.cityKit;
    function fill(dx,dy,sw,sh,color) {
      if(sw<=0 || sh<=0)return;
      ctx.fillStyle=color;ctx.fillRect(Math.round(dx),Math.round(dy),Math.round(sw),Math.round(sh));
    }
    function stamp(col,row,sw,sh,dx,dy,dw=sw,dh=sh) {
      if(dw<1||dh<1||sw<1||sh<1)return;
      ctx.drawImage(tex,64*col,64*row,sw,sh,Math.round(dx),Math.round(dy),Math.round(dw),Math.round(dh));
    }
    const prop=(col,dx,dy)=>stamp(col,7,...extras[col],dx,dy);
    const fit=(col,dx,dy)=>stamp(col,8,...fittings[col],dx,dy);
    function roofArea(rx,ry,rw,rh,variant) {
      for(let yy=0;yy<rh;yy+=36)for(let xx=0;xx<rw;xx+=36) {
        const v=roll()<.2?(variant+1)%3:variant;
        stamp(v,id,Math.min(36,rw-xx),Math.min(36,rh-yy),rx+xx,ry+yy);
      }
    }
    function rim(rx,ry,rw,rh,depth) {
      fill(rx,ry,rw,depth,stone);fill(rx+1,ry+1,rw-2,2,lit);
      fill(rx,ry,2,rh,lit);fill(rx+2,ry+depth,2,rh-depth-2,shaded);
      fill(rx+rw-depth,ry+depth,depth,rh-depth,shaded);
      fill(rx+rw-2,ry+1,2,rh-1,dark);
      fill(rx,ry+rh-depth,rw,depth,stone);
      fill(rx+2,ry+rh-depth,rw-5,2,lit);fill(rx,ry+rh-1,rw,1,dark);
    }
    ctx.save();ctx.translate(Math.round(x),Math.round(y));
    // Setbacks, mechanical wells and entry notches all stay inside this one footprint.
    ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
    const southFront=facing==='S' && !shared.S;
    const northFront=facing==='N' && !shared.N;
    const sideFront=(facing==='E'||facing==='W') && !shared[facing];
    const heightRatio=kind==='tower'?.63:kind==='office'?.48:.43;
    // Upper storeys of a tower still rise above a lower adjoining roof.
    const floors=kind==='tower'?(shared.S?4:5):shared.S?0:elevations[id];
    const floorStep=kind==='tower'?19:floorHeights[id];
    const wallHeight=Math.min(Math.floor(h*heightRatio),floors*floorStep+4);
    const roofBottom=h-wallHeight;
    const frontWidth=sideFront?8:0;
    const marginL=shared.W?0:3+(facing==='W'?frontWidth:0);
    const marginR=shared.E?0:4+(facing==='E'?frontWidth:0);
    const top=northFront?7:shared.N?0:2;
    const roofW=w-marginL-marginR,roofH=roofBottom-top;
    fill(0,0,w,h,dark);
    roofArea(marginL,top,roofW,roofH,Math.floor(roll()*3));
    if(roofW>5&&roofH>5)rim(marginL,top,roofW,roofH,shared.S?3:5);
    // Weathered coping stones and the drain channel along the east parapet.
    for(let n=18;n<roofW-4;n+=26){
      fill(marginL+n,top+1,1,3,shaded);fill(marginL+n+4,roofBottom-5,1,4,shaded);
    }
    for(let n=14;n<roofH-4;n+=31)fill(w-marginR-4,top+n,3,1,dark);
    // Coping casts a narrow interior shadow. The slope is expressed in tonal
    // bands so each wing reads as a volume even in a dense row of party walls.
    for(const [n,color] of [[0,'#23302b3d'],[1,'#28352d25'],[2,'#32403617']]){
      fill(marginL+4+n*2,top+4+n*2,roofW-9-n*4,2,color);
      fill(marginL+4+n*2,top+6+n*2,2,roofH-12-n*4,color);
    }
    if(roofW>110 && roofH>54 && parcel.ruin===undefined && (seed%7<3 || kind==='hospital' && facing==='W')){
      const pad=9;
      // Cable trays follow the stair/service core around the perimeter.
      const tx=marginL+pad+(seed%19), ty=roofBottom-12;
      const tw=Math.max(15,roofW-35-(seed%34));
      fill(tx,ty+2,tw,4,'#3d4a454c');
      fill(tx,ty,tw,3,shaded);fill(tx,ty,tw,1,lit);
      const riser=11+(seed%17);
      fill(tx+tw-3,ty-riser,3,riser,shaded);fill(tx+tw-3,ty-riser,1,riser,lit);
      for(let j=13;j<tw-4;j+=21)fill(tx+j,ty-1,2,5,dark);
      fill(tx+tw-7,ty-riser-2,12,4,shaded);
      for(let j=0;j<3;j++)fill(tx+tw-5+j*3,ty-riser-2,1,3,dark);
    }
    if(roofW>93 && roofH>53) {
      const count=seed%4===1?1:0;
      for(let j=0;j<count;j++) {
        const dx=marginL+5+roll()*(roofW-39);
        const dy=top+7+roll()*(roofH-30);
        fit(roll()<.6?5:9,dx,dy);
      }
    }

    // Give each roof its own massing. The tower has a setback upper storey,
    // the clinic has linked cooling plant and flats have tank-and-stair pairs.
    const equipL=marginL+8,equipR=w-marginR-8,equipW=equipR-equipL;
    const equipTop=top+8,equipH=roofH-16;
    if(equipW>=24 && equipH>=26 && parcel.ruin===undefined){
      const rooftopParts={
        office: [[3], [1,8], [], [9], [4,0]],
        hospital: [parcel.landmark?[5]:southFront && w>140?[4]:southFront?[]:[0,9]],
        apartment: [[10,2], [2], [3], [5,10], [9], []],
        market: [[7], [4], [], [1,7], []],
        retail: [[1], [10], [9,1], [], [3]],
        warehouse: [[4,4], [9], [], [10], [7,7]],
        tower: [[0], [5], [3,5], [8], [1]]
      };
      const choices=rooftopParts[kind],items=choices[(seed%19)%choices.length];
      let left=equipL, right=equipR, cy=equipTop, ch=equipH;
      function penthouse(sx,sy,sw,sh,faceHeight){
        // A raised volume with its own coping, clerestory and a cast shadow
        // across part of the main deck. Paint it before any plant on top.
        const shadow=kind==='tower'?12:8;
        fill(sx+4,sy+4,sw+1,sh+3,'#2634333d');
        fill(sx+shadow,sy+shadow,sw,sh,'#2833384b');
        fill(sx,sy,sw,sh,'#526662');
        roofArea(sx,sy,sw,sh-faceHeight,seed%2);rim(sx,sy,sw,sh-faceHeight,3);
        const fy=sy+sh-faceHeight;
        fill(sx,fy,sw,faceHeight,kind==='tower'?'#546666':shaded);
        fill(sx+1,fy,sw-2,2,'#3d4b48');
        for(let q=4;q<sw-11;q+=kind==='tower'?11:18) {
          fill(sx+q,fy+3,kind==='tower'?9:12,faceHeight-6,kind==='tower'?'#3a5359':'#4b5956');
          fill(sx+q+1,fy+4,kind==='tower'?5:8,2,'#8e9e93');
        }
        fill(sx+2,sy+sh-2,sw-4,1,lit);
        return [sx+4,sx+sw-3,sy+3,sh-faceHeight-6];
      }
      if(kind==='tower' && equipW>66 && equipH>38){
        // Multiple ledges read as a stacked tower, even when its south wall
        // is hidden behind another wing on a shared boundary.
        let sw=Math.floor(equipW*(.70+roll()*.19));
        const sh=Math.floor(equipH*.87);
        const sx=left+Math.floor((equipW-sw)*(.15+.7*roll()));
        [left,right,cy,ch]=penthouse(sx,cy+2,sw,sh,Math.min(17,Math.floor(sh*.27)));
        if(ch>44 && right-left>90) {
          sw=Math.floor((right-left)*.68);
          [left,right,cy,ch]=penthouse(left+7,cy+3,sw,ch-6,11);
        }
      }else if(equipW>82 && equipH>58 &&
               (kind==='hospital' && facing==='W' || kind==='office' && seed%4!==1 ||
                kind==='apartment' && seed%4===2)){
        const sw=Math.floor(equipW*(kind==='hospital'?.69:.53));
        const sh=Math.floor(equipH*(kind==='hospital'?.73:.65));
        const sx=seed%2===0?left+3:right-sw-4;
        [left,right,cy,ch]=penthouse(sx,cy+5,sw,sh,Math.min(14,Math.floor(sh*.24)));
      }
      if(kind==='hospital' && parcel.landmark && right-left>95 && ch>54){
        // One weathered rooftop landing pad identifies the whole medical complex.
        const pw=Math.min(64,ch-3),px=left+4,py=cy+Math.floor((ch-pw)/2);
        fill(px,py,pw,pw,'#677e72');fill(px+2,py+2,pw-4,pw-4,'#6d8376');
        ctx.strokeStyle='#bdbb99';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(Math.round(px+pw/2),Math.round(py+pw/2),Math.floor(pw*.38),0,Math.PI*2);ctx.stroke();
        const hl=Math.floor(pw*.26),hh=Math.floor(pw*.36);
        const hx=Math.round(px+(pw-hl)/2),hy=Math.round(py+(pw-hh)/2);
        fill(hx,hy,3,hh,'#ccc8a8');fill(hx+hl-3,hy,3,hh,'#ccc8a8');
        fill(hx,hy+Math.floor(hh/2),hl,3,'#ccc8a8');
        for(let k=0;k<26;k++)fill(px+roll()*pw,py+roll()*pw,1+roll()*4,1,'#73887a');
        left+=pw+9;
      }
      const occupied=items.reduce((sum,index)=>sum+extras[index][0]+5,0);
      let cursor=left+Math.floor(roll()*Math.max(0,right-left-occupied));
      for(let i=0;i<items.length;i++){
        const part=items[i],pw=extras[part][0],ph=extras[part][1];
        if(cursor+pw>right || ph>ch)continue;
        const yy=cy+Math.floor(roll()*Math.max(1,ch-ph));
        if(![5,6,9,11].includes(part)){
          fill(cursor+2,yy+4,pw-2,ph-3,'#2c372f60');
          fill(cursor-2,yy+1,pw+1,ph-2,'#576459');
          fill(cursor-1,yy,pw-1,1,'#b7bba5');
          fill(cursor-1,yy+ph-2,pw-1,2,'#7c8474');
        }
        prop(part,cursor,yy);
        cursor+=pw+3+Math.floor(roll()*8);
      }
    }

    if(parcel.ruin!==undefined)CityDamage.draw(ctx,marginL+7,top+8,roofW-14,roofH-15,parcel.ruin);

    const bayCount=Math.max(2,Math.round(w/(kind==='tower'?32:36)));
    const doorBay=Math.min(bayCount-1,Math.floor((.33+.34*roll())*bayCount));
    const bayX=j=>Math.round(j*w/bayCount);
    let entranceX=bayX(doorBay),entranceW=bayX(doorBay+1)-entranceX;
    const rowCount=wallHeight>4?Math.max(1,Math.min(floors,Math.round((wallHeight-3)/floorStep))):0;
    for(let row=0;row<rowCount;row++){
      const yy=roofBottom+2+Math.floor(row*(wallHeight-4)/rowCount);
      const next=roofBottom+2+Math.floor((row+1)*(wallHeight-4)/rowCount);
      for(let j=0;j<bayCount;j++){
        const bx=bayX(j),bw=bayX(j+1)-bx,bh=next-yy;
        if(southFront){
          const isDoor=row===rowCount-1 && j===doorBay;
          stamp(isDoor?7:3+Math.floor(roll()*3),id,40,isDoor?32:30,bx,yy,bw,bh);
        }else {
          // A return wall looks like masonry or a blind curtain wall, with occasional
          // stair lights and downpipes. Retail glazing appears only at its frontage.
          stamp(6,id,40,30,bx,yy,bw,bh);
          if(kind==='tower' && bw>18 && bh>9){
            const inset=j%4===1?8:4;
            fill(bx+inset,yy+2,bw-2*inset,bh-5,'#3c525c');
            fill(bx+inset+1,yy+3,bw-2*inset-2,2,'#8aa0a0');
            fill(bx+inset,yy+bh-6,bw-2*inset,2,'#526a71');
            fill(bx+Math.floor(bw*.52),yy+3,2,bh-6,'#65777b');
          }else if((kind==='office'||kind==='apartment'||kind==='hospital') && j%3!==1 && bh>=15 && bw>=22)
            fit(11,bx+(bw-18)/2,yy+4);
          else if(row===rowCount-1 && j%4===1 && bw>=28 && bh>=22)
            fit(3,bx+3,yy+2);
        }
      }
      if(!southFront && w>70) {
        const pipeX=(seed%2)?8:w-13;
        fill(pipeX,yy,3,next-yy,shaded);fill(pipeX,yy,1,next-yy,lit);
        fill(pipeX-1,yy+6,5,2,dark);
      }
    }
    if(wallHeight>0){
      // Recess under the parapet and a deeper sill at pavement level.
      fill(1,roofBottom+2,w-2,3,'#202b2e58');
      fill(1,roofBottom+5,w-2,2,'#24302c29');
      for(let j=0;j<bayCount;j++)if((j+seed)%4===0 && roofBottom+10<h-5){
        fit(5,bayX(j)+3,roofBottom+2);
        if(!southFront && wallHeight>39 && j%2===1)
          fit(4,bayX(j)+4,h-22);
      }
      fill(1,roofBottom,w-2,2,'#364340');fill(1,h-3,w-2,2,shaded);
      if(roll()<.62)fit(5,Math.floor(roll()*Math.max(1,w-30)),roofBottom+1);
      if(!southFront && wallHeight>26 && roll()<.55)fit(6,Math.floor(w*.7),h-29);
    }
    if(southFront && wallHeight>12){
      if((kind==='retail'||kind==='market') && roll()<.67)
        fit(10,entranceX+(entranceW-39)/2,h-Math.min(31,wallHeight-2));
      if(kind==='hospital' && w>=140){
        // Single sheltered ambulance lobby shared by the adjoining clinic wings.
        const lobbyL=Math.max(4,entranceX-13),lobbyW=Math.min(w-lobbyL-3,entranceW+28);
        fill(lobbyL+2,h-27,lobbyW,8,'#46564d');
        fill(lobbyL,h-30,lobbyW,7,'#bcc8b3');fill(lobbyL,h-25,lobbyW,4,'#638b82');
        fill(lobbyL+2,h-21,2,17,'#a0aca0');fill(lobbyL+lobbyW-4,h-21,2,17,'#a0aca0');
        fit(8,lobbyL+1,h-29);
      }
      if(parcel.sign && parcel.sign!=='absent' && parcel.sign!=='none'){
        const col=parcel.sign==='intact'?2:1;
        fit(col,Math.max(3,entranceX-4),h-Math.min(43,wallHeight));
      }else if(roll()<.2 && wallHeight>26)fit(7,entranceX,h-Math.min(39,wallHeight));
    }
    if(sideFront) {
      const isEast=facing==='E',sx=isEast?w-10:0;
      fill(sx,top,10,h-top,shaded);fill(sx+(isEast?1:8),top,2,h-top,lit);
      // Orthogonal side entry glazings and a narrow stoop following the street.
      for(let yy=top+11;yy+15<roofBottom;yy+=26){
        fill(sx+3,yy,5,15,dark);fill(sx+4,yy+2,2,10,'#879c96');
      }
      const yy=Math.max(top+2,Math.min(h-41,Math.round(roofBottom*.54)));
      const entryX=isEast?w-20:0;
      stamp(isEast?9:11,id,20,38,entryX,yy);
      if(parcel.sign==='broken'||parcel.sign==='intact'){
        fill(sx+1,yy-16,7,12,stone);fill(sx+2,yy-14,5,6,parcel.sign==='broken'?'#8f7966':'#779282');
      }
    }else if(northFront){
      fill(0,0,w,7,shaded);
      for(let n=4;n+20<w;n+=32){fill(n,2,18,4,dark);fill(n+1,2,13,1,'#8c9d96');}
      stamp(10,id,38,20,Math.max(0,Math.min(w-38,entranceX)),0);
    }
    if(shared.E)fill(w-2,0,2,h,'#48534d');
    if(shared.W)fill(0,0,1,h,shaded);
    ctx.restore();
  }
  return {draw};
})();
