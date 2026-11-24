'use strict';

// The vest follows the underarm seam. Operator insignia and functional headgear
// are drawn on top of the shared helmet at their original body coordinates.
const assaultVest={vest:[29,37,55,44],cloth:[30,42,43,36,55,40,64,45,79,44,86,56,77,62,73,72,83,73,84,79,66,83,34,81,37,73,50,70,46,62,41,64,36,69,29,61]};
const radioVest={vest:[34,39,48,43],cloth:[34,45,45,39,54,42,59,48,75,47,82,52,80,60,75,67,81,73,79,80,62,84,38,81,39,74,53,70,49,63,43,65,40,71,34,64]};
const crewFits=[
  {...assaultVest,helmet:[38,8,45,31],details:[[45,25,57,24,62,20,80,20,86,23,83,32,76,34,63,34,58,31,57,38,47,40,44,36]]},
  {...assaultVest,helmet:[39,10,43,27],details:[[38,24,49,22,64,19,74,19,81,22,82,27,75,28,69,26,59,27,49,30,43,33,38,31]]},
  {...radioVest,helmet:[41,10,45,32],details:[[34,48,42,42,52,39,60,31,67,26,76,22,84,24,91,29,91,35,86,37,83,29,77,26,70,28,64,34,61,42,55,48,48,46,39,49]]},
  {...assaultVest,helmet:[38,9,45,31],details:[[40,29,44,22,56,16,61,16,63,19,57,23,51,24,45,30],[44,32,51,28,58,30,60,35,55,40,46,40,43,36]]},
  {...radioVest,helmet:[43,5,54,35],details:[[68,7,91,6,97,12,98,20,92,25,73,24,67,20],[48,23,60,20,62,26,50,30,47,30]]}
];
const crewOutfits=[];
const wornSlots=['helmet','top','pants','boots'];
function fieldGear(row,slot){
  const item=gearByKey.get(row?.[slot]);
  return item?.tier>0?art[item.key]:null;
}
function traceGearSeam(g,points){
  g.moveTo(points[0],points[1]);
  for(let i=2;i<points.length;i+=2)g.lineTo(points[i],points[i+1]);
  g.closePath();
}
function fitVest(g,image,fit){
  g.save();g.beginPath();traceGearSeam(g,fit.cloth);
  g.clip();g.drawImage(image,...fit.vest);g.restore();
}
function fitHelmet(g,image,fit,id){
  g.drawImage(image,...fit.helmet);
  g.save();g.beginPath();
  for(const feature of fit.details)traceGearSeam(g,feature);
  g.clip();g.drawImage(art.crewBodies,id*192,0,192,128,0,0,192,128);g.restore();
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
      if(helmet)fitHelmet(g,helmet,fit,m.id);
      g.restore();
    }
  }
  crewOutfits[m.id]={keys:{...row},sheet};
  return sheet;
}
