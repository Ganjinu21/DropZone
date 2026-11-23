(() => {
  'use strict';
  const sockets = /*SOCKETS*/;
  const cellW=112, cellH=72, foot=[54,65], duration=3200;
  const TAU=Math.PI*2;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const smooth=v=>{const u=clamp(v,0,1);return u*u*(3-2*u)};
  const times=/*SHOT_MS*/;
  function turn(t) {
    const launch=clamp((t-520)/1970,0,1);
    // Start and finish facing the original direction. Scarf and feet make
    // full turns without ever rotating the whole character on the canvas.
    return 2*launch-.055*Math.sin(TAU*launch);
  }
  function coordinate(mode,t){
    if(mode==='spin'){
      const a=clamp((t-520)/1970,0,1)*2*TAU;
      return [Math.round(200+13*Math.sin(a)),Math.round(109+4*(Math.cos(a)-1))];
    }
    if(mode==='forward'){
      const advance=smooth((t-500)/1760);
      const reset=smooth((t-2430)/720);
      return [91+Math.round(60*(advance-reset)),106-Math.round(7*(advance-reset))];
    }
    return [107,104];
  }
  function pose(mode,t) {
    const [x,y]=coordinate(mode,t), pattern=times[mode];
    if(mode==='spin' && t>=520 && t<2490){
      const i=(Math.floor(turn(t)*16+.5)%16+16)%16;
      return {x,y,row:2+Math.floor(i/8),col:i%8,direction:i*TAU/16};
    }
    const index=pattern.findLastIndex(at=>at<=t);
    const age=index<0?Infinity:t-pattern[index];
    const far=index%2===1;
    let col=age<42?(far?3:1):age<96?(far?4:2):0;
    if(col===0 && mode==='forward' && t>2350 && t<3020)col=Math.floor(t/120)%2?6:7;
    if(index<0 && t>=410)col=6;
    return {x,y,row:mode==='forward'?1:0,col,direction:0};
  }
  function targetList(mode){
    if(mode==='spin')return [[302,94,1],[100,112,0],[224,142,1],[163,46,0]];
    if(mode==='basic')return [[285,102,0],[327,116,1]];
    return [[260,84,1],[312,108,0],[342,130,2]];
  }
  function rounds(mode){
    const targets=targetList(mode);
    return times[mode].map((at,index)=>{
      const frame=pose(mode,at),hand=index%2;
      const [mx,my]=sockets[frame.row][frame.col][hand];
      const x=frame.x-foot[0]+mx, y=frame.y-foot[1]+my;
      let angle;
      if(mode==='spin'){
        const dir=frame.direction+(hand?Math.PI-.32:.32);
        angle=Math.atan2(Math.sin(dir)*.52,Math.cos(dir));
      }else{
        const who=targets[mode==='basic'?0:Math.floor(index/4)%targets.length];
        const tx=who[0],ty=who[1]-[18,17,25][who[2]];
        angle=Math.atan2(ty-y,tx-x)+(index%3-1)*.014;
      }
      const dx=Math.cos(angle),dy=Math.sin(angle),speed={basic:.68,forward:1.04,spin:.92}[mode];
      let nearest=Math.min(dx>0?(402-x)/dx:(-2-x)/dx,dy>0?(162-y)/dy:(-2-y)/dy),targetIndex=-1;
      targets.forEach(([tx,fy,type],i)=>{
        const ty=fy-[18,17,25][type], rx=tx-x,ry=ty-y;
        const along=rx*dx+ry*dy,side=Math.abs(rx*dy-ry*dx);
        if(along>0&&along<nearest&&side<(type===2?10:7.5)){
          nearest=along;targetIndex=i;
        }
      });
      return {at,index,x,y,angle,dx,dy,travel:nearest,life:nearest/speed,speed,targetIndex,
        ix:x+nearest*dx,iy:y+nearest*dy};
    });
  }
  const tracks={basic:rounds('basic'),forward:rounds('forward'),spin:rounds('spin')};
  function sprite(g,kit,frame){
    g.drawImage(kit.image('raven/raven-smg.png'),frame.col*cellW,frame.row*cellH,cellW,cellH,
      Math.round(frame.x-foot[0]),Math.round(frame.y-foot[1]),cellW,cellH);
  }
  function motionStrength(t){
    return smooth((t-520)/190)*(1-smooth((t-2310)/180));
  }
  function spinEchoes(g,kit,t){
    const strength=motionStrength(t);
    if(!strength)return;
    const [x,y]=coordinate('spin',t),a=TAU*turn(t);
    g.save();
    [[210,0,.43,27],[130,1,.56,18],[68,2,.75,9]].forEach(([delay,bank,alpha,offset])=>{
      const ghost=pose('spin',Math.max(521,t-delay));
      g.globalAlpha=alpha*strength;
      const oldAngle=a-delay*.006;
      const lx=ghost.x-Math.cos(oldAngle)*offset, ly=ghost.y+Math.sin(oldAngle)*offset*.42;
      const row=bank*2+ghost.row-2;
      g.drawImage(kit.image('raven/spin-echo.png'),ghost.col*cellW,row*cellH,cellW,cellH,
        Math.round(lx-foot[0]),Math.round(ly-foot[1]),cellW,cellH);
    });
    // Two independent arm sweeps in ground perspective. Broken slivers follow
    // the bright noses and leave a darker, tapered bed of angular pixels.
    for(let hand=0;hand<2;hand++){
      const tip=a+hand*Math.PI+.24,sweep=hand?1.9:2.4,rx=hand?57:62,ry=hand?22:20;
      for(let i=0;i<9;i++){
        const f=i/9,q=(i+1)/9;
        const a0=tip-sweep*(1-f),a1=tip-sweep*(1-q);
        const width=1+q*3;
        const px=(r,phase)=>Math.round(x+r*Math.cos(phase));
        const py=(r,phase)=>Math.round(y-27+r*Math.sin(phase));
        g.globalAlpha=strength*(.18+.72*q);
        g.fillStyle=['#b95348','#da7351','#ffbd76'][i<3?0:i<7?1:2];
        g.beginPath();g.moveTo(px(rx,a0),py(ry,a0));g.lineTo(px(rx,a1),py(ry,a1));
        g.lineTo(px(rx-width,a1),py(ry-width*.62,a1));g.lineTo(px(rx-width*.45,a0),py(ry-width*.3,a0));
        g.closePath();g.fill();
        if(i%3===1){
          g.fillStyle='#f5ad71';
          g.fillRect(px(rx+3+i%2,a0),py(ry+2,a0),i===7?4:2,1);
        }
      }
      g.globalAlpha=strength*.82;g.fillStyle='#ffe1a1';
      g.fillRect(Math.round(x+rx*Math.cos(tip))-1,Math.round(y-27+ry*Math.sin(tip)),4,1);
    }
    g.restore();
  }
  function ballistics(g,kit,row,col,x,y,angle,scale){
    const [px,py]=[[40,28],[7,28],[34,28]][row];
    g.save();g.translate(Math.round(x),Math.round(y));g.rotate(angle);g.scale(scale,scale);
    g.drawImage(kit.image('raven/ballistics.png'),col*72,row*56,72,56,-px,-py,72,56);g.restore();
  }
  function fxFrame(age,ends){
    return ends.findIndex(limit=>age<limit);
  }
  function tracer(g,shot,age,mode){
    const hold=mode==='spin'?188:204,after=Math.max(0,age-shot.life);
    if(age<0||after>=hold)return;
    const head=Math.min(shot.travel,age*shot.speed);
    if(head<6)return;
    const span=mode==='spin'?88:103;
    const tail=Math.max(4,head-span+after*.20),length=head-tail;
    if(length<3)return;
    const fade=(1-after/hold)**1.3;
    g.save();g.translate(Math.round(shot.x),Math.round(shot.y));g.rotate(shot.angle);
    const wedge=(a,b,h,color,alpha)=>{
      if(b<=a)return;
      g.globalAlpha=alpha*fade;g.fillStyle=color;
      g.beginPath();g.moveTo(a,0);g.lineTo(b-3,-h);g.lineTo(b,0);
      g.lineTo(b-4,h);g.closePath();g.fill();
    };
    wedge(tail,head,mode==='spin'?2.2:2.6,'#a84f47',.80);
    wedge(tail+length*.24,head,1.45,'#f38a56',.97);
    wedge(tail+length*.57,head,1,'#ffe4a5',.94);
    if(length>27){
      g.globalAlpha=fade*.58;g.fillStyle='#e8a678';
      const side=shot.index%2?2:-3;
      g.fillRect(tail+length*.26,side,Math.round(length*.17),1);
      g.fillRect(tail+length*.78,-side,Math.min(7,length*.11),1);
    }
    g.restore();
  }
  function draw(g,t,mode,kit){
    if(!tracks[mode])mode='basic';
    const events=tracks[mode],frame=pose(mode,t);
    const targets=targetList(mode);
    if(mode!=='basic')events.forEach(e=>tracer(g,e,t-e.at,mode));
    const actors=targets.map(([x,y,type],i)=>{
      const strikes=events.filter(e=>e.targetIndex===i&&t>=e.at+e.life);
      const last=strikes[strikes.length-1];
      const age=last?t-last.at-last.life:Infinity;
      const recoil=age<180?Math.round((mode==='basic'?10:5)*(1-age/180)**2):0;
      return {y,draw:()=>{
        kit.shadow(g,x,y,type===2?12:8);
        kit.enemy(g,x+(last?Math.round(last.dx*recoil):0),y+(last?Math.round(last.dy*recoil):0),
          type,t,age<(mode==='basic'?68:41),x>frame.x?-1:1);
      }};
    });
    actors.push({y:frame.y,draw:()=>{
      kit.shadow(g,frame.x,frame.y,13);
      if(mode==='spin')spinEchoes(g,kit,t);
      if(mode==='forward'&&t>560&&t<2240){
        const stride=(t%175)/175;
        g.save();g.globalAlpha=(1-stride)*.70;g.fillStyle='#b19f83';
        for(let i=0;i<3;i++)g.fillRect(frame.x-11-i*4-Math.round(stride*11),
          frame.y-1-((Math.floor(t/175)+i)%3),3-i%2,1);
        g.restore();
      }
      sprite(g,kit,frame);
    }});
    actors.sort((a,b)=>a.y-b.y).forEach(a=>a.draw());
    events.forEach(shot=>{
      const age=t-shot.at;
      if(age<0 || age>Math.max(240,shot.life+190))return;
      const flash=fxFrame(age,[12,33,52,67,79,90]);
      if(flash>=0){
        // A past muzzle stays at its historical socket only for its short exposure.
        ballistics(g,kit,1,flash,shot.x,shot.y,shot.angle,mode==='basic'?1:mode==='spin'?.92:.81);
      }
      if(age<shot.life){
        const px=shot.x+shot.dx*age*shot.speed,py=shot.y+shot.dy*age*shot.speed;
        ballistics(g,kit,0,Math.floor(age/30)%6,px,py,shot.angle,mode==='basic'?1:.67);
      }
      if(age<175){
        const k=age/175, flip=shot.dx<0?-1:1;
        kit.fx(g,'brass',age,shot.x-shot.dx*12-flip*(2+k*10),
          shot.y-shot.dy*10-2-11*Math.sin(k*Math.PI)+k*k*13,0,.75);
      }
      if(shot.targetIndex>=0 && age>=shot.life){
        const hit=fxFrame(age-shot.life,[16,42,74,108,147,190]);
        if(hit>=0)ballistics(g,kit,2,hit,shot.ix,shot.iy,shot.angle,mode==='basic'?1.18:.77);
      }
    });
  }
  function sounds(mode){
    const events=tracks[mode]||tracks.basic;
    const cues=events.map(e=>[e.at,e.index%2?'smgB':'smgA']);
    let prior=-Infinity;
    events.filter(e=>e.targetIndex>=0).map(e=>Math.round(e.at+e.life)).sort((a,b)=>a-b).forEach(at=>{
      if(at-prior<95)return;
      cues.push([at,'hit']);prior=at;
    });
    return cues.sort((a,b)=>a[0]-b[0]);
  }
  window.SkillLab.raven={assets:['raven/raven-smg.png','raven/dual-smg.png','raven/spin-echo.png','raven/ballistics.png'],duration,draw,sounds};
})();
