(() => {
  'use strict';
  const duration=4000, basicFire=[560,1720,2880], basicFlight=402;
  const origin={x:112,y:22}, drop=[0,0,0,0,0,6,13,19];
  const keys=[0,330,490,1210,1280,1380,1480,1580];
  const aims=[[.12,.10],[.50,.04],[.97,0],[.93,-.39],[.87,.49],[.68,-.19],[.69,.24]];
  const shoulders=[[20,37],[115,26]];
  const targets=[
    {x:40,y:42,kind:1,side:0,pose:3},{x:40,y:131,kind:0,side:0,pose:4},
    {x:322,y:28,kind:1,side:1,pose:3},{x:330,y:122,kind:2,side:1,pose:4}
  ];
  const sequence=[0,2,0,2,1,3,1,3];
  function muzzle(side,index){
    const [vx,vy]=aims[index], sign=side===0?-1:1,scale=side===1?1.14:1;
    return {x:origin.x+shoulders[side][0]+sign*vx*13*scale,
            y:origin.y+shoulders[side][1]+19+(1+vy*13)*scale};
  }
  const barrage=Array.from({length:22},(_,i)=>{
    const at=1670+i*94,target=sequence[i%sequence.length],p=targets[target],from=muzzle(p.side,p.pose);
    return {at,target,side:p.side,pose:p.pose,from,flight:Math.round(Math.hypot(p.x-from.x,p.y-from.y)/.48)};
  });
  const clamp=n=>Math.min(1,Math.max(0,n));
  const smooth=n=>{n=clamp(n);return n*n*(3-2*n)};
  const last=(times,t)=>times.reduce((found,start)=>start<=t?start:found,-Infinity);
  const recoil=age=>age<0||age>180?0:age<42?1:1-smooth((age-42)/138);
  function crop(g,kit,row,col,x,y,angle=0,scale=1){
    const pivot=[[33,16],[20,16],[16,16]][row];
    g.save();g.translate(Math.round(x),Math.round(y));g.rotate(angle);g.scale(scale,scale);
    g.drawImage(kit.image('bulk/ballistics.png'),40*col,32*row,40,32,-pivot[0],-pivot[1],40,32);g.restore();
  }
  function impact(g,kit,age,x,y,angle=0){
    if(age<0||age>=180)return;
    crop(g,kit,2,Math.min(4,Math.floor(age/36)),x,y,angle);
    if(age<90)kit.fx(g,'hit_spark',age,x,y,angle,.85);
  }
  function casing(g,kit,age){
    if(age<0||age>=490)return;
    const u=clamp(age/250),bounce=clamp((age-250)/90);
    // Short vertical arc under the receiver. Ends on the ground beside Bulk's boot.
    const x=114+2*u+bounce,y=89+25*u-19*Math.sin(Math.PI*u)-3*Math.sin(Math.PI*bounce);
    g.save();g.globalAlpha=clamp((490-age)/120);
    crop(g,kit,1,Math.min(4,Math.floor(age/62)),x,y,0,.53);g.restore();
  }
  function dust(g,x,y,age){
    if(age<0||age>300)return;
    const u=age/300;g.save();g.globalAlpha=.8*(1-u);
    for(const s of [-1,1])for(let i=0;i<4;i++){
      g.fillStyle=['#b3a98c','#92866e','#d9c8a4'][i%3];
      g.fillRect(Math.round(x+s*(4+u*(8+4*i))),Math.round(y-i%2-Math.sin(u*Math.PI)*(i+2)),i%3+2,2);
    }g.restore();
  }
  function drawBasic(g,t,kit){
    const hitAge=t-last(basicFire.map(s=>s+basicFlight),t);
    kit.shadow(g,305,113,13);kit.enemy(g,305+Math.round(7*recoil(hitAge)),113,2,t,hitAge<92,-1);
    const age=t-last(basicFire,t),kick=Math.round(4*recoil(age));
    const col=age<62?1:age<170?2:0;
    kit.shadow(g,109,118,12);kit.unit(g,0,col,109-kick,118,true,1);
    for(const start of basicFire){
      const d=t-start,mx=130,sy=88;
      if(d>=0&&d<144)kit.fx(g,'bulk_muzzle',d,109-kick+(col===1?23:25),sy,0,1.38);
      if(d>=0&&d<basicFlight)crop(g,kit,0,0,mx+(299-mx)*d/basicFlight,sy,0,.86);
      casing(g,kit,d-22);impact(g,kit,d-basicFlight,299,sy);
    }
  }
  function panel(g,kit,col,row){
    g.drawImage(kit.image('bulk/bunker.png'),136*col,108*row,136,108,origin.x,origin.y,136,108);
  }
  function pod(g,kit,t,side,stage){
    const events=barrage.filter(s=>s.side===side);
    const next=events.find(s=>s.at>t),previous=events.filter(s=>s.at<=t).at(-1);
    const timeToNext=next?next.at-t:Infinity;
    let pose=previous?previous.pose:0;
    if(next&&pose!==next.pose&&timeToNext<135){
      if(timeToNext<36)pose=next.pose;
      else if(timeToNext<78)pose=next.pose===3?5:6;
      else pose=1;
    }
    const age=previous?t-previous.at:Infinity,[vx,vy]=aims[pose],sign=side===0?-1:1;
    const kick=age<75?(1-age/75)*2:0;
    const x=origin.x+shoulders[side][0]-sign*Math.round(kick*vx);
    const y=origin.y+shoulders[side][1]+drop[stage]-Math.round(kick*vy);
    const scale=side===1?1.14:1;
    g.save();g.translate(x,y);g.scale(sign*scale,scale);
    g.drawImage(kit.image('bulk/pods.png'),pose*42,0,42,40,-20,-18,42,40);g.restore();
  }
  // Three soldiers enter one at a time. Their unarmed reaching hands and raised
  // boots remain visible outside the cab until each crosses its front rim.
  const crew=[
    {id:2,x:76,y:100,start:145,end:750},
    {id:1,x:88,y:125,start:300,end:985},
    {id:0,x:121,y:124,start:535,end:1210}
  ];
  function personnel(g,kit,t){
    for(const soldier of crew){
      if(t>=soldier.end)continue;
      const u=clamp((t-soldier.start)/(soldier.end-soldier.start));
      const walk=smooth(u/.55),climb=smooth((u-.55)/.32),sit=smooth((u-.87)/.13);
      const x=Math.round(soldier.x+(149-soldier.x)*walk+23*climb+5*sit);
      const y=Math.round(soldier.y+(113-soldier.y)*walk-36*climb+9*sit
                         -(u>0&&u<.55?Math.abs(Math.sin(u*23))*2:0));
      const pose=u<.43?0:u<.63?1:u<.87?2:3;
      if(u<.57)kit.shadow(g,x,y,9);
      g.save();
      if(u>.74){
        g.beginPath();g.rect(0,0,400,Math.round(118-43*smooth((u-.74)/.26)));g.clip();
      }
      g.drawImage(kit.image('bulk/deploy.png'),pose*96,soldier.id*64,96,64,x-32,y-60,96,64);
      g.restore();
    }
  }
  function drawSkill(g,t,kit){
    const stage=keys.findLastIndex(v=>t>=v);
    for(const [i,p] of targets.entries()){
      const hits=barrage.filter(s=>s.target===i).map(s=>s.at+s.flight);
      const da=t-last(hits,t),facing=p.side===0?1:-1,h=[18,17,25][p.kind];
      kit.shadow(g,p.x,p.y+h,10+(p.kind===2?4:0));
      kit.enemy(g,p.x-Math.round(3*recoil(da))*facing,p.y+h,p.kind,t+i*140,da<65,facing);
    }
    kit.shadow(g,174,120,40);panel(g,kit,stage,0);
    personnel(g,kit,t);panel(g,kit,stage,1);
    pod(g,kit,t,0,stage);pod(g,kit,t,1,stage);
    dust(g,151,119,t-1580);dust(g,195,124,t-1580);
    for(const shot of barrage){
      const d=t-shot.at;if(d<0||d>=shot.flight+180)continue;
      const p=targets[shot.target],{x,y}=shot.from,angle=Math.atan2(p.y-y,p.x-x);
      if(d<106)kit.fx(g,'raven_muzzle',d,x,y,angle,1.05);
      if(d<shot.flight){
        const u=d/shot.flight;
        crop(g,kit,0,0,x+(p.x-x)*u,y+(p.y-y)*u,angle,.66);
      }else impact(g,kit,d-shot.flight,p.x,p.y,angle);
    }
  }
  window.SkillLab.bulk={
    assets:['bulk/bunker.png','bulk/pods.png','bulk/deploy.png','bulk/ballistics.png'],duration,
    draw(g,t,mode,kit){g.save();g.imageSmoothingEnabled=false;
      if(mode==='basic')drawBasic(g,t,kit);else drawSkill(g,t,kit);g.restore()},
    sounds(mode){
      const groups=mode==='basic'?[[basicFire,'bulk'],[basicFire.map(n=>n+basicFlight),'hit']]:
        [[[330,1280],'lock'],[[1580],'plant'],[barrage.map(s=>s.at),'cannon']];
      return groups.flatMap(([times,name])=>times.map(t=>[t,name])).sort((a,b)=>a[0]-b[0]);
    }
  };
})();
