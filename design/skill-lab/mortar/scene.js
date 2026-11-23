(() => {
  const path = 'mortar/';
  const rounds = [
    [990, 69, 101, 640], [1290, 244, 94, 600], [1420, 282, 105, 615],
    [1550, 324, 117, 625], [2020, 56, 82, 645], [2190, 96, 130, 625],
    [2500, 287, 125, 650], [2650, 253, 104, 670]
  ];
  const basicShots = [[760, 238, 100, 520], [2480, 273, 117, 570]];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const mix = (a, b, t) => a + (b-a)*t;

  function cell(g, image, col, row, w, h, x, y, ax, ay, scale=1, angle=0) {
    g.save();
    g.translate(Math.round(x), Math.round(y)); g.rotate(angle); g.scale(scale,scale);
    g.imageSmoothingEnabled=false;
    g.drawImage(image,col*w,row*h,w,h,-ax,-ay,w,h);
    g.restore();
  }
  function op(g,kit,row,col,x,y) {
    cell(g,kit.image(path+'operator.png'),col,row,80,76,x,y,32,60);
  }
  function tube(g,kit,col,x,y,angle=0) {
    cell(g,kit.image(path+'emplacement.png'),col,0,64,64,x,y,25,54,1,angle);
  }
  function fx(g,kit,row,col,x,y,scale=1,angle=0) {
    cell(g,kit.image(path+'effects.png'),clamp(col,0,7),row,64,64,x,y,32,32,scale,angle);
  }
  const blastHolds=[36,44,57,64,74,83,86,94,103,108,116,132];
  function blast(g,kit,round,t,skill,groundOnly){
    const [fire,x,y,travel]=round, age=t-fire-travel;
    if(age<0)return;
    let elapsed=age,col=0;
    while(col<blastHolds.length && elapsed>=blastHolds[col])elapsed-=blastHolds[col++];
    if(!groundOnly && col===blastHolds.length)return;
    const band=skill?3:0;
    g.save();
    const variation=skill?(.96+(fire%13)/95):1;
    g.translate(x,y);
    // Alternate the plume silhouettes but let every crater stay anchored to its strike.
    if((fire%3)===0)g.scale(-1,1);
    const draw=row=>cell(g,kit.image(path+'blast-layers.png'),Math.min(11,col),row,124,108,0,0,62,84,variation);
    if(groundOnly){
      g.globalAlpha*=clamp(1-(age-900)/1700,0,1);
      draw(band);
    }else{
      draw(band+1);
      draw(band+2);
    }
    g.restore();
  }

  function trajectory(start, target, u, skill) {
    const a=1-u;
    const [sx,sy]=start,[tx,ty]=target;
    const c1x=skill?sx+23:sx+(tx-sx)*.34;
    const c2x=skill?tx:tx-(tx-sx)*.25;
    const c1y=skill?Math.max(3,sy-92):sy-43;
    const c2y=skill?1:ty-64;
    return [a*a*a*sx+3*a*a*u*c1x+3*a*u*u*c2x+u*u*u*tx,
            a*a*a*sy+3*a*a*u*c1y+3*a*u*u*c2y+u*u*u*ty];
  }

  function flight(g,kit,start,round,t,skill) {
    const [fire,tx,ty,travel]=round, age=t-fire;
    if(age<0||age>travel)return;
    const target=[tx,ty], u=age/travel;
    const [x,y]=trajectory(start,target,u,skill);
    const [beforeX,beforeY]=trajectory(start,target,Math.max(0,u-.015),skill);
    const angle=Math.atan2(y-beforeY,x-beforeX);
    // Expanding, broken exhaust puffs read differently from a continuous beam.
    for(let i=5;i>=1;i--){
      if(age<i*19)continue;
      const [px,py]=trajectory(start,target,u-i*18/travel,skill);
      const wobble=Math.round(Math.sin((age-i*18)/92)*1.5);
      g.fillStyle=['','#efb575','#bc9a76','#a39683','#8b8b7f','#777d75'][i];
      const size=i===5?2:i===1?3:4;
      g.fillRect(Math.round(px)-1,Math.round(py)+wobble-1,size,2);
      if(i>1&&i<5)g.fillRect(Math.round(px),Math.round(py)+wobble-2,2,3);
    }
    fx(g,kit,3,Math.floor(age/46)%8,x,y,skill?.96:.78,angle);
  }
  function ground(g,kit,round,t,skill) {
    const [fire,x,y,travel]=round, until=fire+travel-t;
    if(until<0||until>(skill?400:235))return;
    const u=1-until/(skill?400:235);
    fx(g,kit,0,Math.floor(u*8),x,y,skill?1:.62);
  }
  function foes(g,t,kit,list,points){
    const sorted=points.slice().sort((a,b)=>a[1]-b[1]);
    for(const [x,y,type] of sorted){
      let recent=Infinity;
      for(const [fire,tx,ty,travel] of list){
        const age=t-fire-travel;
        if(age>=0 && Math.hypot(tx-x,(ty-y)*1.5)<30) recent=Math.min(recent,age);
      }
      const dir=x<140?1:-1;
      const kick=recent<230?Math.round(7*Math.sin(Math.PI*recent/230))*-dir:0;
      const lift=recent<190?Math.round(6*Math.sin(Math.PI*recent/190)):0;
      kit.shadow(g,x+kick,y,8);
      kit.enemy(g,x+kick,y-lift,type,t,recent<90,dir);
    }
  }
  function basicPosition(t) {
    // Two lateral steps break up the firing beats while preserving planted feet on recoil.
    const x=t<610?mix(79,93,t/610):t<1190?93:t<2270?mix(93,107,(t-1190)/1080):
      t<3010?107:mix(107,79,(t-3010)/990);
    return [Math.round(x),118-Math.round((x-79)*.17)];
  }
  function basic(g,t,kit){
    const [x,y]=basicPosition(t);
    for(const r of basicShots){blast(g,kit,r,t,false,true);ground(g,kit,r,t,false)}
    foes(g,t,kit,basicShots,[[238,100,0],[273,117,1]]);
    const active=basicShots.find(r=>t>=r[0]-150&&t<r[0]+340);
    let pose;
    if(active){const age=t-active[0];pose=age<0?4:age<83?5:age<160?6:7}
    else pose=Math.floor(t/125)%4;
    kit.shadow(g,x,y,13); op(g,kit,0,pose,x,y);
    for(const r of basicShots){
      const pos=basicPosition(r[0]),tip=[pos[0]+32,pos[1]-30];
      if(t>=r[0]&&t<r[0]+125)kit.fx(g,'bulk_muzzle',t-r[0],...tip,-.27,.8);
      flight(g,kit,tip,r,t,false);blast(g,kit,r,t,false,false);
    }
  }
  function heldPosition(t,x,y) {
    // Frame-based handoff: draw prop where the near and far palms meet.
    const keys=[[145,x-10,y-16,-.68],[295,x-7,y-22,-.52],[420,x+8,y-32,-.35],
      [510,x+12,y-34,-.22],[560,x+17,y-23,-.14],[610,x+23,y,0]];
    if(t<=keys[0][0])return keys[0].slice(1);
    for(let i=1;i<keys.length;i++){
      const [ta,...aa]=keys[i-1],[tb,...bb]=keys[i];
      if(t<=tb)return aa.map((a,j)=>mix(a,bb[j],(t-ta)/(tb-ta)));
    }
    return keys.at(-1).slice(1);
  }
  function skill(g,t,kit) {
    const x=144,y=112,tubeX=x+23;
    const pose=t<145?0:t<295?1:t<420?2:t<540?3:t<610?4:t<776?5:t<934?6:7;
    for(const r of rounds){blast(g,kit,r,t,true,true);ground(g,kit,r,t,true)}
    foes(g,t,kit,rounds,[[69,100,0],[245,94,0],[324,119,2],[97,131,1],
                         [280,104,0],[287,124,1],[56,83,1],[252,105,0]]);
    kit.shadow(g,x,y,14);
    if(t<145)tube(g,kit,0,x-12,y-9,-.64);
    op(g,kit,1,pose,x,y);
    if(t>=145 && t<610){
      const [px,py,a]=heldPosition(t,x,y);
      tube(g,kit,0,px,py,a);
    }
    if(t>=610){
      kit.shadow(g,tubeX,y,15);
      const previous=rounds.filter(r=>r[0]<=t).at(-1);
      const age=previous?t-previous[0]:Infinity;
      const col=t<655?1:t<730?2:age<36?3:age<76?4:age<125?5:6;
      tube(g,kit,col,tubeX,y);
      const tip=[tubeX+12,y-41+([0,1,0,4,2,1,0,0][col])];
      if(age<115)kit.fx(g,'bulk_muzzle',age,...tip,-1.2,.88);
      if(t<870)fx(g,kit,1,Math.floor((t-610)/260*8),tubeX,y);
    }
    if(t>=145&&t<776)op(g,kit,2,pose,x,y);
    const tip=[tubeX+12,y-38];
    for(const r of rounds)flight(g,kit,tip,r,t,true);
    for(const r of rounds.slice().sort((a,b)=>a[2]-b[2]))blast(g,kit,r,t,true,false);
  }
  function sounds(mode) {
    if(mode==='basic')return basicShots.flatMap(([t,x,y,d])=>[[t,'thump'],[t+d,'grenade']]);
    return [[610,'plant'],...rounds.flatMap(([t,x,y,d])=>[[t,'lob'],[t+d,'burst']])].sort((a,b)=>a[0]-b[0]);
  }
  window.SkillLab.mortar={
    duration:4000,
    assets:['operator.png','emplacement.png','effects.png','blast-layers.png'].map(s=>path+s),
    sounds,
    draw(g,t,mode,kit){(mode==='basic'?basic:skill)(g,t%4000,kit)}
  };
})();

