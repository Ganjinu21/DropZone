const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const selectTestSquad = require('./select-test-squad.cjs');

(async () => {
  const browser = await chromium.launch({
    executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true
  });
  try {
    const page = await browser.newPage({viewport:{width:780,height:360}, isMobile:true, hasTouch:true});
    const errors = [];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve('game/index.html')).href);
    await selectTestSquad(page,[1,0,2]);
    const waves = await page.evaluate(()=>{
      const check=(condition,message)=>{if(!condition)throw Error(message)};
      let seed=27;
      const random=Math.random, originalSpawn=spawn;
      const counts=[[0,0,0],[0,0,0],[0,0,0]];
      try{
        Math.random=()=>((seed=Math.imul(1664525,seed)+1013904223>>>0)/4294967296);
        spawn=(a,d,boss,rush)=>{
          const e=originalSpawn(a,d,boss,rush);
          if(rush && e)counts[run.stage-1][run.wave-1]++;
          return e;
        };
        const tick=(dt=.05)=>{run.t+=dt;updateEncounter(dt)};
        // Force the cap before the final batch; attempts blocked by the cap must be retried.
        const atCap=Array.from({length:stages[0].cap},()=>({hp:20}));
        run.enemies=atCap;
        run.remaining=.01;
        tick();tick(.5);
        check(run.wave===1 && run.bigWave && run.rushLeft===10,'capped rush counted missed spawns');
        check(!$('encounter-alert').hidden && $('encounter-alert').dataset.kind==='rush','rush warning missing');
        run.squad[1].hp=72;
        run.up[2]=3;
        for(let s=1;s<=3;s++){
          for(let w=1;w<=3;w++){
            const sentinel={hp:10,type:0};
            if(w===3)run.floors[otherFloor()].enemies.push(sentinel);
            for(let step=0;step<1600 && run.wave===w && !run.bossPhase;step++){
              // Free a few places as an active squad fights. Use the normal spawn
              // routine and navigation checks on every successful insertion.
              if(step%12===0 && run.enemies.length>7)run.enemies.splice(0,2);
              tick();
            }
            check(counts[s-1][w-1]===stages[s-1].waves[w-1].rush,'big wave '+s+'.'+w+' spawn count');
            if(w===3){
              check(run.bossPhase && !run.boss,'boss should be announced before arriving');
              check($('encounter-alert').dataset.kind==='boss','boss warning missing');
              check(run.floors[otherFloor()].enemies.includes(sentinel)===(s===2),'off-floor escort not handled');
              check((run.enemies.length>0)===(s===2),'current-floor escort not handled');
            }
          }
          for(let step=0;!run.boss && step<80;step++)tick();
          const boss=run.boss;
          check(boss?.hp===stages[s-1].bossHp && run.enemies.includes(boss),'boss spawn');
          for(let step=0;step<40;step++)tick();
          check(run.stage===s && run.boss===boss,'timer advanced past living boss');
          check(!$('boss-status').hidden && $('boss-health').value===100,'mobile boss bar missing');
          if(s===1){
            const entrance=SURFACE.exits[0];
            const enter=TransitKit.stairPoint(entrance,TransitKit.stairLength*.6);
            Object.assign(run,enter); updateStairDepth();tickBossAttack(.02,routes[run.floor]);tick();
            check(run.floor==='metro' && run.stage===1 && run.boss===boss && run.floors.surface.enemies.includes(boss),'boss lost at stairs');
            Object.assign(run,TransitKit.stairPoint(entrance,TransitKit.stairLength*.3));
            updateStairDepth();
            check(run.enemies.includes(boss) && run.boss===boss,'boss replaced when returning');
            Object.assign(run,SURFACE.spawn);routes.surface.aimAt(run.x,run.y);
          }
          damageEnemy(boss,boss.hp);tick();
          check(run.squad[1].hp===72 && run.up[2]===3 && run.lead===1,'squad did not persist');
        }
        check(mode==='end' && $('dialogtitle').textContent==='작전 완료','third boss victory');
        return counts;
      } finally {Math.random=random;spawn=originalSpawn}
    });
    assert.deepEqual(waves,[[10,14,18],[20,26,32],[12,15,18]]);
    const patterns=await page.evaluate(()=>{
      const summary={};
      // Use a clear floor and fixed positions to measure each warned attack independently.
      const nav={clear:()=>true};
      function stage(n){
        start();
        run.stage=n;
        for(const m of run.squad)m.gear.evadeChance=0;
        const boss=run.boss={stage:n,hp:500,max:500,x:0,y:0,contactDamage:10};
        run.enemies=[boss];
        for(const m of run.squad)Object.assign(m,{x:300,y:300,hurt:0});
        const leader=run.squad[run.lead];Object.assign(leader,{x:65,y:0});
        tickBossAttack(0,nav);boss.pattern.cool=0;tickBossAttack(0,nav);
        return {boss,leader};
      }
      function advance(t){
        for(let i=0;i<Math.round(t*100);i++)tickBossAttack(.01,nav);
      }
      {
        const {boss,leader}=stage(1), mark=boss.pattern.marks[0], hp=leader.hp;
        advance(.85);leader.y=60;advance(.5);
        summary.charge={locked:mark.dy===0,moved:boss.x>85,dodged:leader.hp===hp};
      }
      {
        const {boss,leader}=stage(2), hp=leader.hp, mark=boss.pattern.marks[0];
        advance(1.26);const safe=leader.hp===hp && mark.waveRadius>0;
        advance(.4);
        summary.pulse={safeUntilRing:safe,damage:Math.round((hp-leader.hp)*100)/100,hitOnce:mark.hit.size===1};
      }
      {
        const {boss,leader}=stage(3), first=boss.pattern.marks[0];
        leader.x=105;advance(.58);const second=boss.pattern.marks.find(m=>m.number===2);
        leader.x=150;advance(.58);const third=boss.pattern.marks.find(m=>m.number===3);
        const hp=leader.hp;advance(.96);
        summary.barrage={locked:[first.x,second.x,third.x],damage:Math.round((hp-leader.hp)*100)/100,pending:boss.pattern.pending};
      }
      return summary;
    });
    assert.deepEqual(patterns.charge,{locked:true,moved:true,dodged:true});
    assert.deepEqual(patterns.pulse,{safeUntilRing:true,damage:24,hitOnce:true});
    assert.deepEqual(patterns.barrage,{locked:[65,105,150],damage:19,pending:0});
    assert.deepEqual(errors,[]);
    console.log('Big waves',waves,'three bosses',patterns);
  } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
