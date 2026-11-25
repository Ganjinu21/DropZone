// Offline art pass. Paint the aftermath directly onto each registered world map.
function bakeAftermath(g,stage,atlases){
  const scene=DistrictMaps[stage-1],data=scene.layout;
  let rng=8653*stage;
  const random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);
  const stamp=(atlas,id,x,y,w,h,angle=0,alpha=1)=>{
    g.save();g.translate(x,y);g.rotate(angle);g.globalAlpha=alpha;
    g.drawImage(atlas[id],-w/2,-h/2,w,h);g.restore();
  };
  const line=(points,color,width)=>{
    g.beginPath();g.strokeStyle=color;g.lineWidth=width;
    points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();
  };
  function burn(x,y,w,h,alpha){
    g.save();g.translate(x,y);g.scale(w,h);
    const gradient=g.createRadialGradient(0,0,0,0,0,1);
    gradient.addColorStop(0,'rgba(22,22,21,'+alpha+')');gradient.addColorStop(.52,'rgba(43,37,29,'+alpha*.65+')');gradient.addColorStop(1,'rgba(55,46,35,0)');
    g.fillStyle=gradient;g.fillRect(-1,-1,2,2);g.restore();
  }
  function cracks(x,y,r){
    for(let arm=0;arm<5;arm++){
      let a=arm*1.26+random(),px=x,py=y;
      for(let j=0;j<4;j++){
        const step=r*(.12+random()*.17);a+=(random()-.5)*.9;
        const xx=px+Math.cos(a)*step,yy=py+Math.sin(a)*step;
        line([[px,py],[xx,yy]],'#3938369c',.13+(4-j)*.055);
        if(j%2)line([[px,py],[px+Math.cos(a+.8)*step*.7,py+Math.sin(a+.8)*step*.7]],'#493d345c',.17);
        px=xx;py=yy;
      }
    }
  }
  g.save();g.scale(scene.scale,2000/300);
  paintFictionalSigns(g,data.signs);
  // Dust accumulates in damaged areas, leaving the main walkways legible.
  for(const [x,y,r,kind] of data.sites){
    burn(x+1,y+1,r*1.45,r,.46);cracks(x,y,r*1.23);
    stamp(atlases.scars,kind,x,y,r*1.55,r*1.12,(random()-.5)*.7);
    for(let j=0;j<9;j++){
      const a=random()*Math.PI*2,d=(.35+random()*.85)*r,ww=.3+random()*1.1;
      g.fillStyle=j%3?'#584d40a3':'#ad9e829c';g.fillRect(x+Math.cos(a)*d,y+Math.sin(a)*d,ww,ww*.58);
    }
  }
  for(const [x,y,w] of data.ruins){
    // Broken roof skin: asymmetric opening, splintered edges and exposed beams.
    burn(x,y,w*1.28,w*.88,.86);g.beginPath();
    for(let k=0;k<17;k++){const a=k*Math.PI*2/17,r=w*(.32+random()*.26);
      const xx=x+Math.cos(a)*r,yy=y+Math.sin(a)*r*.63;k?g.lineTo(xx,yy):g.moveTo(xx,yy);}
    g.closePath();g.fillStyle='#282826';g.fill();g.strokeStyle='#827463';g.lineWidth=.55;g.stroke();
    g.save();g.clip();
    for(let k=-w;k<w;k+=3.7){line([[x+k,y-w],[x+k+4.5,y+w]],'#5a4937',.84);line([[x+k+.3,y-w],[x+k+4.8,y+w]],'#96836b',.22)}
    g.restore();cracks(x,y,w*.9);
    stamp(atlases.scars,1,x+w*.43,y+w*.2,w*.67,w*.47,-.23,.95);
  }
  for(const [x,y,a] of data.skirmishes||[])paintAbandonedPost(g,x,y,a,random);
  for(const [i,v] of scene.wrecks.entries()){
    const {x,y,w,h,angle,kind}=v;
    g.save();g.translate(x,y);g.scale(6.5/scene.scale,1);g.rotate(angle);
    burn(.8,1,w*1.25,h*.88,.84);
    const tank=kind===3||kind===4;
    for(const side of [-1,1]){
      const a=side*w*.32;
      line([[a,h*.25],[a+.18,h*.8],[a+1.1,h*1.13],[a+2.6,h*1.37]],tank?'#3d372d86':'#302e2c88',tank?1.2:.55);
      if(tank)for(let j=0;j<12;j++)line([[a-.8+j*.09,h*.46+j*.93],[a+.8+j*.09,h*.51+j*.93]],'#625749b0',.34);
    }
    stamp(atlases.scars,i%2?2:0,-w*.40,-h*.35,w*.97,w*.78,-angle,.93);
    stamp(atlases.wrecks,kind,.5,.6,w,h,0,.35);
    stamp(atlases.wrecks,kind,0,0,w,h);
    g.restore();
  }
  g.restore();
}
function atlasCells(image){
  const out=[];
  for(let row=0;row<2;row++)for(let col=0;col<3;col++){
    const w=Math.floor(image.width/3),h=Math.floor(image.height/2),c=document.createElement('canvas');
    c.width=w;c.height=h;const t=c.getContext('2d');t.drawImage(image,col*w,row*h,w,h,0,0,w,h);
    const rgba=t.getImageData(0,0,w,h).data;let l=w,r=-1,top=h,b=-1;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      if(rgba[(y*w+x)*4+3]<32)continue;
      l=Math.min(l,x);r=Math.max(r,x);top=Math.min(top,y);b=Math.max(b,y);
    }
    if(r<l)throw Error('Empty decal cell '+row+','+col);
    const tile=document.createElement('canvas');tile.width=r-l+1;tile.height=b-top+1;
    tile.getContext('2d').drawImage(c,l,top,tile.width,tile.height,0,0,tile.width,tile.height);out.push(tile);
  }
  return out;
}

function paintFictionalSigns(g,signs){
  const panels=[['#394a50','#ddc9a8'],['#60554b','#eddfbb'],['#334c4b','#c8d1be'],['#62453e','#e6c1a2']];
  signs.forEach(([x,y,w,h,label,dy=0],i)=>{
    g.save();g.transform(1,dy/w,0,1,x,y);
    const [base,ink]=panels[i%panels.length];g.fillStyle='#272d2e';g.fillRect(-.4,-.5,w+.8,h+1);
    g.fillStyle=base;g.fillRect(0,0,w,h);g.fillStyle=ink;g.fillRect(.6,.7,w-1.2,.22);
    g.textBaseline='middle';g.textAlign='center';
    if(h>w*1.4){
      const size=Math.min(w*.78,h/(label.length+.8));g.font='bold '+size+'px Arcade, sans-serif';
      [...label].forEach((c,j)=>g.fillText(c,w*.5,h*(j+1)/(label.length+1)));
    }else{
      const size=Math.min(h*.64,(w-3)/label.length);g.font='bold '+size+'px Arcade, sans-serif';g.fillText(label,w*.5,h*.54,w-2);
    }
    g.fillStyle='#262a2760';g.fillRect(1,h-1.4,w*.45,.5);
    g.fillStyle='#bdad922b';g.fillRect(w*.75,h*.3,w*.16,.35);g.restore();
  });
}
function paintAbandonedPost(g,x,y,a,rand){
  g.save();g.translate(x,y);g.rotate(a);
  // Slumped sandbags, a stencilled supply case and scuffed retreat tracks.
  for(let j=0;j<7;j++){
    const dx=j*1.75-5,dy=j%3*.6;
    g.fillStyle='#3a3931';g.fillRect(dx,dy,2.3,1.3);
    g.fillStyle=j%2?'#83775d':'#9a896b';g.fillRect(dx,dy,2,.85);
  }
  g.fillStyle='#343a31';g.fillRect(-4,3,3.8,2.2);g.fillStyle='#73765d';g.fillRect(-3.7,3.2,3.2,1.3);
  g.fillStyle='#d1c59b';g.fillRect(-2.8,3.6,1.3,.4);
  for(let j=0;j<25;j++){
    const off=j*.45,side=j%2?.8:-.8;
    g.fillStyle=j%5===0?'#4d382f8a':'#33363570';
    g.fillRect(off+side+rand()*.7,4+off,.5,.92);
  }
  g.restore();
}
