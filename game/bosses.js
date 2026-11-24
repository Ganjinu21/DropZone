'use strict';

// The marked ground stays fixed once the warning appears, including during a leader swap.
const bossPatterns = [
  {kind:'charge', range:220, radius:20, windup:.95, cooldown:2.9, damage:20},
  {kind:'pulse', range:105, radius:95, windup:1.15, expansion:.40, cooldown:3.6, damage:24},
  {kind:'barrage', range:360, radius:40, windup:.95, cooldown:3.9, damage:19}
];

function tickBossAttack(dt, nav) {
  const boss=run.boss;
  if (!boss || boss.hp<=0) return;
  if (!run.enemies.includes(boss)) {
    boss.pattern=null;
    boss.charging=false;
    return;
  }
  if (!boss.pattern || boss.pattern.floor!==run.floor || boss.pattern.stage!==run.stage) {
    boss.pattern={floor:run.floor,stage:run.stage,cool:1.2,marks:[],pending:0,nextShell:0};
    boss.charging=false;
  }
  const pattern=boss.pattern, cfg=bossPatterns[run.stage-1];
  if (!cfg) return;
  const leader=run.squad[run.lead];
  if (!leader || leader.hp<=0) return;
  pattern.cool-=dt;
  if (pattern.cool<=0 && !pattern.marks.length && !pattern.pending) {
    const dx=leader.x-boss.x, dy=leader.y-boss.y, d=Math.hypot(dx,dy);
    if (d>cfg.range || (cfg.kind!=='barrage' && !nav.clear(boss.x,boss.y,leader.x,leader.y,0))) return;
    pattern.cool=cfg.cooldown+cfg.windup;
    if (cfg.kind==='barrage') {
      pattern.pending=3;
      pattern.nextShell=0;
    } else {
      const mark={x:boss.x,y:boss.y,radius:cfg.radius,age:0,hit:new Set()};
      if (cfg.kind==='charge') {
        mark.dx=d>.01?dx/d:1;
        mark.dy=d>.01?dy/d:0;
        mark.length=0;
        for (let s=5;s<=Math.min(cfg.range,d+55);s+=5) {
          if (!nav.clear(boss.x,boss.y,boss.x+s*mark.dx,boss.y+s*mark.dy,4)) break;
          mark.length=s;
        }
        if (mark.length<5) {pattern.cool=.4;return}
        mark.travel=0;
      }
      pattern.marks.push(mark);
      boss.charging=true;
    }
  }
  if (pattern.pending) {
    pattern.nextShell-=dt;
    if (pattern.nextShell<=0) {
      pattern.marks.push({x:leader.x,y:leader.y,radius:cfg.radius,age:0,number:4-pattern.pending});
      pattern.pending--;
      pattern.nextShell=.55;
    }
  }
  const targets=run.activeSkill?.id===0?[leader]:run.squad;
  for (const mark of pattern.marks) {
    mark.age+=dt;
    if (mark.age<cfg.windup || mark.done) continue;
    if (cfg.kind==='charge') {
      const step=Math.min(mark.length-mark.travel,420*dt);
      const px=boss.x,py=boss.y;
      const tx=boss.x+step*mark.dx, ty=boss.y+step*mark.dy;
      if (nav.clear(boss.x,boss.y,tx,ty,4)) {
        boss.x=tx; boss.y=ty; mark.travel+=step;
        for (const member of targets) {
          if (!member.deployed || member.hp<=0 || mark.hit.has(member.id)) continue;
          const along=clamp((member.x-px)*mark.dx+(member.y-py)*mark.dy,0,step);
          if(Math.hypot(member.x-px-along*mark.dx,member.y-py-along*mark.dy)>mark.radius)continue;
          if (!nav.clear(tx,ty,member.x,member.y,0)) continue;
          mark.hit.add(member.id);
          hitSquadMember(boss,member,nav,cfg.damage);
          if (boss.hp<=0 || mode!=='play') return;
        }
        if (mark.travel<mark.length) continue;
      }
    } else if(cfg.kind==='pulse'){
      const previous=mark.waveRadius || 0;
      mark.waveRadius=cfg.radius*clamp((mark.age-cfg.windup)/cfg.expansion,0,1);
      for(const member of targets){
        if(!member.deployed || member.hp<=0 || mark.hit.has(member.id))continue;
        const distance=Math.hypot(member.x-mark.x,member.y-mark.y);
        if(distance<previous-5 || distance>mark.waveRadius+3 || !nav.clear(mark.x,mark.y,member.x,member.y,0))continue;
        mark.hit.add(member.id);
        hitSquadMember(boss,member,nav,cfg.damage);
        if(boss.hp<=0 || mode!=='play')return;
      }
      if(mark.waveRadius<cfg.radius)continue;
    } else {
      for (const member of targets) {
        if (!member.deployed || member.hp<=0 || Math.hypot(member.x-mark.x,member.y-mark.y)>mark.radius) continue;
        if (!nav.clear(mark.x,mark.y,member.x,member.y,0)) continue;
        hitSquadMember(boss,member,nav,cfg.damage);
        if (boss.hp<=0 || mode!=='play') return;
      }
    }
    mark.done=true;
    mark.fadeAt=mark.age+.23;
    boss.charging=false;
  }
  pattern.marks=pattern.marks.filter(mark=>!mark.done || mark.age<mark.fadeAt);
}

function drawBossWarnings(ctx) {
  const boss=run.boss, pattern=boss?.pattern;
  if (!pattern || boss.hp<=0 || pattern.floor!==run.floor || pattern.stage!==run.stage || !run.enemies.includes(boss)) return;
  const cfg=bossPatterns[pattern.stage-1];
  ctx.save();
  for (const mark of pattern.marks) {
    const progress=clamp(mark.age/cfg.windup,0,1);
    const impact=mark.done?clamp((mark.fadeAt-mark.age)/.23,0,1):1;
    ctx.save();
    ctx.globalAlpha*=impact;
    ctx.translate(mark.x,mark.y);
    if (cfg.kind==='charge') {
      ctx.rotate(Math.atan2(mark.dy,mark.dx));
      ctx.fillStyle='#cb352b55';
      ctx.strokeStyle='#ffa289';ctx.lineWidth=2;
      ctx.fillRect(0,-mark.radius,mark.length,mark.radius*2);
      ctx.strokeRect(0,-mark.radius,mark.length,mark.radius*2);
      ctx.fillStyle='#ff705b70';
      ctx.fillRect(0,-3,Math.max(0,mark.length*progress),6);
      ctx.beginPath();
      for(let x=12;x<mark.length;x+=30) {
        ctx.moveTo(x-7,-8);ctx.lineTo(x,0);ctx.lineTo(x-7,8);
      }
      ctx.stroke();
    } else if(cfg.kind==='pulse'){
      const radius=mark.radius;
      ctx.fillStyle='#839b453d';ctx.strokeStyle='#c1dc88';ctx.lineWidth=2;
      ctx.beginPath();
      ctx.arc(0,0,radius,0,TAU);ctx.fill();ctx.stroke();
      const releasing=mark.age>=cfg.windup;
      const ring=releasing?(mark.waveRadius || 0):radius*(1-progress);
      ctx.lineWidth=releasing?6:2;ctx.strokeStyle=releasing?'#e8ffac':'#91ae6d';
      ctx.beginPath();ctx.arc(0,0,ring,0,TAU);ctx.stroke();
      for(let i=0;i<8;i++){
        const angle=i*TAU/8;
        const x=Math.round(Math.cos(angle)*radius),y=Math.round(Math.sin(angle)*radius);
        ctx.fillStyle='#333f31';ctx.fillRect(x-3,y-3,6,6);
        ctx.fillStyle='#d4e99b';ctx.fillRect(x-2,y-2,4,4);
      }
    } else {
      ctx.fillStyle=mark.done?'#ffd9989c':'#ee973344';
      ctx.strokeStyle='#ffd087';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(0,0,mark.radius,0,TAU);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.arc(0,0,mark.radius-5,-Math.PI/2,-Math.PI/2+TAU*progress);ctx.stroke();
      ctx.fillStyle='#332823';ctx.fillRect(-8,-9,16,17);
      ctx.font='bold 12px Arcade, sans-serif';ctx.fillStyle='#ffdf9b';
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(mark.number),0,0);
      // The spore sac descends onto the same recorded point the squad saw.
      if(progress>.55 && !mark.done){
        const height=(1-progress)*185;
        ctx.fillStyle='#d4995b';ctx.fillRect(-2,-height-13,4,10);
        ctx.fillStyle='#502f3c';ctx.fillRect(-5,-height-5,10,10);
        ctx.fillStyle='#f5ab64';ctx.fillRect(-3,-height-4,5,4);
      }else if(mark.done){
        for(let i=0;i<8;i++){
          const angle=i*TAU/8, radius=mark.radius*(1-impact*.7);
          ctx.fillStyle='#ffd089';ctx.fillRect(Math.cos(angle)*radius-2,Math.sin(angle)*radius-2,5,4);
        }
      }
    }
    ctx.restore();
  }
  ctx.restore();
}
