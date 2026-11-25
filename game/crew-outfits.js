'use strict';

// The vest follows the underarm seam. Operator insignia and functional headgear
// are drawn on top of the shared helmet at their original body coordinates.
const assaultVest={vest:[29,37,55,44],cloth:[30,42,43,36,55,40,64,45,79,44,86,56,77,62,73,72,83,73,84,79,66,83,34,81,37,73,50,70,46,62,41,64,36,69,29,61]};
const radioVest={vest:[34,39,48,43],cloth:[34,45,45,39,54,42,59,48,75,47,82,52,80,60,75,67,81,73,79,80,62,84,38,81,39,74,53,70,49,63,43,65,40,71,34,64]};
const crewFits=[assaultVest,assaultVest,radioVest,assaultVest,radioVest];
const portraitRoles=['bulk','raven','lynx','hammer','cct'];
function fieldPortrait(id){return 'art/armory/portraits/'+portraitRoles[id]+'-field.png'}
function wornPortrait(id,row){
  const rank=gearByKey.get(row?.helmet)?.rank??'C';
  return rank==='C'?ART['face'+id]:'art/armory/portraits/'+portraitRoles[id]+'-'+(rank==='S+'?'S-plus':rank)+'.png';
}
const crewOutfits=[];
const wornSlots=['helmet','top','pants','boots'];
function fieldGear(row,slot){
  const item=gearByKey.get(row?.[slot]);
  return item?art[item.key]:null;
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
function crewOutfitSheet(m){
  const row=m.loadout||{};
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
      if(helmet){
        g.clearRect(0,0,192,48);
        g.drawImage(helmet,m.id*192,0,192,48,0,0,192,48);
      }
      if(top)fitVest(g,top,fit);
      g.restore();
    }
  }
  crewOutfits[m.id]={keys:{...row},sheet};
  return sheet;
}
