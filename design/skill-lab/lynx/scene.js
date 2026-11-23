(() => {
  'use strict';
  const duration=4000, special=[650,1410,2170,2930], basic=[710,2260];
  const x=69,y=117,shotHeight=93,flight=340;
  const targets=[199,266,340],kinds=[0,1,2];
  const muzzleCoords=[[81,32],[82,34],[82,35],[76,36],[78,36],[80,35],[81,34]];
  const last=(events,t)=>events.reduce((found,start)=>start<=t?start:found,-Infinity);
  const clamp=n=>Math.min(1,Math.max(0,n));
  const kick=age=>age<0||age>185?0:age<48?1:Math.pow(1-(age-48)/137,2);
  function crop(g,kit,row,col,cx,cy,scale=1){
    const pivot=[[7,24],[32,24],[17,24]][row];g.save();g.translate(Math.round(cx),Math.round(cy));g.scale(scale,scale);
    g.drawImage(kit.image('lynx/pierce-fx.png'),col*56,row*48,56,48,-pivot[0],-pivot[1],56,48);g.restore();
  }
  function frame(age){
    return age<0?-1:age<24?0:age<56?1:age<96?2:age<144?3:age<192?4:-1;
  }
  function reticle(g,x,y,phase){
    const d=Math.round(13-4*clamp(phase));
    g.save();g.globalAlpha=clamp(phase*3)*.86;g.fillStyle='#9fddcf';
    for(const sx of [-1,1])for(const sy of [-1,1]){
      g.fillRect(x+sx*d+(sx>0?-3:0),y+sy*d,4,1);
      g.fillRect(x+sx*d,y+sy*d+(sy>0?-3:0),1,4);
    }g.restore();
  }
  function enemies(g,t,kit,charged){
    for(const [i,tx] of targets.entries()){
      const age=charged?t-last(special,t):i===0?t-last(basic.map(s=>s+flight),t):Infinity;
      const ty=charged?shotHeight:88;
      const foot=ty+[18,17,25][kinds[i]];
      kit.shadow(g,tx+2,foot,10+(i===2?4:0));
      kit.enemy(g,tx+Math.round(7*kick(age)),foot,kinds[i],t+i*97,age<78,-1);
      if(charged&&i===2&&t<special[0])reticle(g,tx,ty,(t-90)/520);
    }
  }
  function casing(g,kit,age,portX,portY){
    if(age<0||age>=540)return;
    const u=Math.min(1,age/240),bounce=clamp((age-240)/130);
    const bx=portX-25*u-6*bounce,by=portY-19*Math.sin(Math.PI*u)+23*u-4*Math.sin(Math.PI*bounce);
    g.save();g.globalAlpha=clamp((540-age)/125);
    kit.fx(g,'brass',age%156,bx,by,-u*3,1.8);g.restore();
  }
  function pulseBeam(g,kit,ms,sx){
    const ends=[32,72,120,178,238,313,410],row=ends.findIndex(n=>ms<n);
    if(ms<0||row<0)return;
    const beam=kit.image('lynx/laser.png');
    const len=399-sx;
    g.drawImage(beam,0,26*row,160,26,sx,shotHeight-13,len,26);
    if(ms<162){
      // Vent rings at the muzzle and at each exit expand around one common axis.
      const u=ms/162;
      g.save();g.globalAlpha=1-u;
      for(const tx of [sx+11,...targets.map(n=>n+8)]){
        const rad=Math.round(5+12*u);
        g.strokeStyle='#c4ffff';g.lineWidth=ms<42?2:1;
        g.beginPath();g.ellipse(tx+Math.round(u*3),shotHeight,rad*.32,rad,0,0,Math.PI*2);g.stroke();
      }g.restore();
    }
  }
  function skill(g,t,kit){
    const latest=last(special,t),age=t-latest,remaining=special.filter(s=>s>t).length;
    let col=t<230?0:t<430?1:2;
    if(Number.isFinite(age)){
      col=age<64?3:age<136?4:age<270?5:age<422?6:2;
      if(remaining===0&&age>540)col=age<710?1:0;
    }
    const bodyX=x-Math.round(kick(age)*3);
    enemies(g,t,kit,true);kit.shadow(g,x,y,14);
    g.drawImage(kit.image('lynx/precision.png'),col*96,0,96,64,bodyX-32,y-60,96,64);
    const [mx]=muzzleCoords[col];
    for(const at of special){
      const d=t-at;if(d<0||d>605)continue;
      const startX=bodyX-32+mx,flash=frame(d);
      pulseBeam(g,kit,d,startX);
      if(flash>=0)crop(g,kit,0,flash,startX,shotHeight,1.28);
      casing(g,kit,d-95,x+16,shotHeight-3);
      for(const tx of targets){
        if(flash>=0)crop(g,kit,2,flash,tx+5,shotHeight,1.03);
        if(d<68)kit.fx(g,'hit_spark',d,tx-4,shotHeight,Math.PI,.9);
      }
    }
  }
  function single(g,t,kit){
    enemies(g,t,kit,false);kit.shadow(g,x,y,13);
    const age=t-last(basic,t),col=age<62?1:age<165?2:0,bodyX=x-Math.round(kick(age)*6);
    kit.unit(g,2,col,bodyX,y,true,1);
    for(const at of basic){
      const d=t-at,start=x+38,aimY=88;
      if(d>=0&&d<142)kit.fx(g,'lynx_muzzle',d,bodyX+44,aimY,0,1.22);
      if(d>=0&&d<flight)crop(g,kit,1,Math.floor(d/36)%5,start+(targets[0]-start)*d/flight,aimY,1.38);
      casing(g,kit,d-25,x+20,aimY-3);
      const hit=d-flight,sub=frame(hit);
      if(sub>=0)crop(g,kit,2,sub,targets[0],aimY,1.2);
      if(hit>=0&&hit<115)kit.fx(g,'hit_spark',hit,targets[0]-3,aimY,0,1.2);
    }
  }
  window.SkillLab.lynx={
    assets:['lynx/precision.png','lynx/pierce-fx.png','lynx/laser.png'],duration,
    draw(g,t,mode,kit){g.save();g.imageSmoothingEnabled=false;
      if(mode==='basic')single(g,t,kit);else skill(g,t,kit);g.restore()},
    sounds(mode){
      const charged=mode!=='basic',times=charged?special:basic,result=[];
      for(const at of times){result.push([at,charged?'pierce':'rifle'],[at+(charged?0:flight),'hit']);
        if(charged)result.push([at+158,'bolt']);
      }return result.sort((a,b)=>a[0]-b[0]);
    }
  };
})();
