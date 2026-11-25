'use strict';

// Art coordinates in the single 1448 × 1086 master. Geometry scales with its
// 2600 × 2000 export. Barriers describe feet; foreground paths describe pixels.
const Gwanghwamun=(()=>{
  const sx=2600/1448,sy=2000/1086;
  const world=(x,y)=>({x:Math.round(x*sx),y:Math.round(y*sy)});
  const box=(x,y,w,h)=>({...world(x,y),w:Math.round(w*sx),h:Math.round(h*sy)});
  const obstacles=[],parts=[];
  function foreground(points,base){
    const coords=points.map(([x,y])=>world(x,y)),xs=coords.map(p=>p.x),ys=coords.map(p=>p.y);
    const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
    const path=new Path2D();coords.forEach((p,i)=>i?path.lineTo(p.x,p.y):path.moveTo(p.x,p.y));path.closePath();
    parts.push({x,y,w,h,path,bottom:world(0,base).y});
  }
  function block(x,y,w,h){obstacles.push(box(x,y,w,h))}
  // Palace wall and four masonry piers leave all three archways walkable.
  block(0,186,548,22);block(906,186,265,22);
  for(const [x,w] of [[546,57],[652,42],[755,40],[844,61]])block(x,203,w,23);
  foreground([[0,127],[540,127],[540,205],[0,206]],205);
  foreground([[910,128],[1176,128],[1170,205],[910,205]],205);
  foreground([[540,225],[550,139],[534,114],[541,87],[571,76],[569,59],[553,42],[559,13],[581,26],[625,4],[810,4],[855,27],[887,8],[890,45],[863,65],[857,78],[892,91],[911,79],[912,117],[899,131],[908,225],[844,225],[842,192],[836,179],[822,173],[808,176],[798,187],[795,225],[756,225],[754,186],[746,170],[726,163],[709,168],[698,181],[694,225],[653,225],[651,188],[642,177],[628,172],[614,178],[606,190],[603,225]],225);
  foreground([[644,425],[644,388],[651,384],[651,353],[670,353],[673,331],[689,329],[690,315],[678,306],[680,299],[697,299],[705,293],[713,290],[715,265],[724,258],[731,267],[732,287],[741,291],[757,309],[763,329],[772,338],[777,354],[794,354],[797,385],[805,387],[805,426]],426);
  block(646,399,158,27);
  foreground([[641,1019],[640,986],[648,980],[649,945],[689,943],[688,854],[696,844],[691,814],[687,773],[692,764],[698,790],[701,769],[710,759],[716,752],[718,738],[726,732],[729,750],[745,762],[757,778],[749,794],[743,800],[752,844],[758,852],[759,944],[795,944],[801,982],[808,988],[807,1020]],1020);
  block(642,982,164,38);
  // The western performing arts centre recedes in steps toward the north.
  for(const [y,w,h] of [[216,201,120],[336,183,113],[449,161,110],[559,128,105],[664,97,123]])block(0,y,w,h);
  foreground([[0,177],[43,177],[51,218],[201,219],[222,258],[201,355],[195,480],[176,514],[156,614],[137,663],[111,737],[83,789],[0,789]],789);
  block(1397,0,51,1086);foreground([[1387,0],[1448,0],[1448,1086],[1411,1086],[1397,671],[1391,412]],1086);
  for(const [x,y,w,h] of [[551,379,65,34],[829,377,67,36],[611,966,29,39],[805,964,32,39],[1219,401,24,57],[1221,611,28,91]])block(x,y,w,h);
  const trees=[[283,333,50],[384,310,39],[388,381,43],[391,505,58],[357,680,57],[350,847,58],[336,1008,56],
    [1062,294,37],[1063,414,35],[1067,552,38],[1069,685,36],[1067,843,39],[1074,1008,37],
    [1351,116,30],[1342,237,33],[1350,465,36],[1354,630,34],[1353,886,36]];
  for(const [x,y,r] of trees){
    block(x-6,y-7,12,13);
    foreground([[x-6,y],[x-5,y-22],[x-r*.8,y-37],[x-r,y-52],[x-r*.85,y-68],
      [x-r*.5,y-r-32],[x+1,y-r-43],[x+r*.57,y-r-33],[x+r*.91,y-64],
      [x+r,y-46],[x+r*.55,y-31],[x+6,y-21],[x+5,y]],y);
  }
  const anchors=[[458,480],[498,259],[270,725],[228,842],[995,459],[1335,333],[999,778],[1331,941]];
  const exits=SURFACE.exits.map((e,i)=>({...e,...world(...anchors[i])}));
  let solids=obstacles;
  for(const e of exits){
    const lane=TransitKit.stairRect(e,-15,TransitKit.stairLength+14,-34,34);
    solids=solids.flatMap(b=>TransitKit.subtractRect(b,lane));
    solids.push(...TransitKit.stairRails(e,false));
  }
  function paving(g,image,area){
    const tile=box(590,466,121,73);
    g.save();g.beginPath();g.rect(area.x,area.y,area.w,area.h);g.clip();
    for(let y=Math.floor(area.y/tile.h)*tile.h;y<area.y+area.h;y+=tile.h)
      for(let x=Math.floor(area.x/tile.w)*tile.w;x<area.x+area.w;x+=tile.w)
        g.drawImage(image,tile.x,tile.y,tile.w,tile.h,x,y,tile.w,tile.h);
    g.restore();
  }
  return {parts,solids,exits,paving};
})();
