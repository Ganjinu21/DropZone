'use strict';

// Fittings use the same 192×128 pixel coordinates as the original character art.
// The vest mask leaves each operator's face, scarf and exposed arm visible.
const crewFits=[
  {helmet:[56,16,40,31],vest:[34,39,40,44],cloth:[36,48,47,37,59,38,62,48,50,50,45,61,50,73,66,72,67,79,41,82,36,74]},
  {helmet:[47,22,41,30],vest:[39,43,38,41],cloth:[45,47,52,43,60,49,56,51,49,53,49,64,54,72,66,73,73,82,42,81,39,70]},
  {helmet:[48,23,40,31],vest:[38,48,37,38],cloth:[42,52,55,47,65,49,66,56,57,60,53,68,48,72,65,71,69,80,42,85,38,77]},
  {helmet:[39,8,43,32],vest:[29,37,55,44],cloth:[30,42,43,36,55,40,64,45,79,44,86,56,77,62,73,72,83,73,84,79,66,83,34,81,37,73,53,72,62,67,66,61,59,58,52,61,45,66,36,69,29,61]},
  {helmet:[43,5,54,35],vest:[34,39,48,43],cloth:[34,45,45,39,54,42,59,48,75,47,82,52,80,60,75,67,81,73,79,80,62,84,38,81,39,74,54,71,65,66,66,62,59,60,48,65,40,71,34,64]}
];
const crewOutfits=[];
const wornSlots=['helmet','top','pants','boots'];
function fieldGear(row,slot){
  const item=gearByKey.get(row?.[slot]);
  return item?.tier>0?art[item.key]:null;
}
function fitVest(g,image,fit){
  const shape=fit.cloth;
  g.save();g.beginPath();g.moveTo(shape[0],shape[1]);
  for(let i=2;i<shape.length;i+=2)g.lineTo(shape[i],shape[i+1]);
  g.closePath();g.clip();g.drawImage(image,...fit.vest);g.restore();
}
function crewOutfitSheet(m){
  const row=m.loadout;
  if(!row)return null;
  const cached=crewOutfits[m.id];
  if(cached && wornSlots.every(slot=>cached.keys[slot]===row[slot]))return cached.sheet;
  const [helmet,top,pants,boots]=wornSlots.map(slot=>fieldGear(row,slot));
  let sheet=null;
  if(helmet||top||pants||boots){
    sheet=document.createElement('canvas');sheet.width=192*9;sheet.height=128;
    const g=sheet.getContext('2d'),fit=crewFits[m.id];
    g.imageSmoothingEnabled=false;
    for(let cell=0;cell<9;cell++){
      const frame=cell-1;
      g.save();g.translate(cell*192,0);
      if(cell)g.drawImage(art.crewStride,frame*192,m.id*128,192,128,0,0,192,128);
      else g.drawImage(art.crewBodies,m.id*192,0,192,128,0,0,192,128);
      // The two independently equipped lower layers use the original joint transforms
      // and the same occlusion order as the body underneath them.
      for(const garment of [pants,boots]){
        if(garment)g.drawImage(garment,cell*112,m.id*56,112,56,8,68,112,56);
      }
      g.translate(0,cell?2*crewStepY[frame]:0);
      if(top)fitVest(g,top,fit);
      if(helmet)g.drawImage(helmet,...fit.helmet);
      g.restore();
    }
  }
  crewOutfits[m.id]={keys:{...row},sheet};
  return sheet;
}
