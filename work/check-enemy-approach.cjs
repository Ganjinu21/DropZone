const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || undefined});
  try {
    const page = await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.requestAnimationFrame=()=>0;
      localStorage.setItem('dropzone.squad.v1','[1,0,2]');
    });
    await page.goto(pathToFileURL(path.join(__dirname,'../game/index.html')).href);
    await page.locator('#start:enabled').tap();
    await page.locator('#hud').waitFor();
    await page.evaluate(()=>{
      const check=(condition,message)=>{if(!condition)throw Error(message)};
      const dt=1/60;
      function arrange(x,y) {
        Object.assign(run,{x,y,heading:0,spawn:999,remaining:999,enemies:[]});
        for(const [slot,id] of run.lineup.entries()){
          const [front,side]=formationSlots[slot];
          Object.assign(run.squad[id],{x:x+front,y:y+side,cool:999,hurt:0});
        }
        routes[run.floor].aimAt(x,y);
      }
      let passedNearerAlly=false;
      function checkStraightStep(enemy) {
        const before={x:enemy.x,y:enemy.y};
        update(dt);
        const leader=run.squad[run.lead],nav=routes[run.floor];
        const dx=leader.x-before.x,dy=leader.y-before.y,distance=Math.hypot(dx,dy);
        check(nav.clear(before.x,before.y,leader.x,leader.y,4),'Open approach fixture obstructed');
        passedNearerAlly ||= run.squad.some(m=>m.deployed && m!==leader && dist(before,m)<distance);
        const step=enemy.speed*dt;
        const error=Math.hypot(enemy.x-before.x-step*dx/distance,enemy.y-before.y-step*dy/distance);
        check(error<1e-6,'Enemy deviated from leader '+run.lead+' on '+run.floor+', error '+error);
      }
      for(const angle of [45,135,225,315]){
        arrange(1300,1000);
        const radians=angle*Math.PI/180, radius=150;
        const enemy=spawn(radians,radius);
        check(enemy && Math.abs(enemy.x-run.x-radius*Math.cos(radians))<.01 &&
          Math.abs(enemy.y-run.y-radius*Math.sin(radians))<.01,'Expected first diagonal spawn');
        for(let frame=0;frame<16;frame++){
          stick={dx:0,dy:frame<8?1:-1};
          checkStraightStep(enemy);
        }
        stick=null;
      }
      check(passedNearerAlly,'Test must include an ally closer than the leader');

      // Approach from the opposite side of the parked sedan on the boulevard.
      arrange(1420,1182);
      const leader=run.squad[run.lead],nav=routes.surface;
      const enemy=spawn(Math.PI,170);
      check(enemy && !nav.clear(enemy.x,enemy.y,leader.x,leader.y,4),'Expected sedan blocking the direct path');
      const hp=leader.hp;
      for(let frame=0;frame<1000 && leader.hp===hp;frame++){
        const before={x:enemy.x,y:enemy.y};
        update(dt);
        check(nav.clear(before.x,before.y,enemy.x,enemy.y,4),'Enemy crossed a solid footprint');
      }
      check(leader.hp<hp,'Enemy could not get around the sedan and reach the leader');
      const wing=run.squad[run.lineup[1]];
      Object.assign(enemy,{x:wing.x,y:wing.y});
      const wingHP=wing.hp;
      wing.hurt=0;
      update(dt);
      check(wing.hp<wingHP,'Enemy passed through a squadmate without contact damage');

      // Descend through a real entrance, then follow a tag across the open west concourse.
      Object.assign(run,TransitKit.stairPoint(SURFACE.exits[0],TransitKit.stairLength*.7));
      updateStairDepth();
      check(run.floor==='metro','Could not enter station');
      arrange(615,1035);
      const inbound=spawn(3*Math.PI/4,175);
      check(inbound,'Missing station spawn');
      checkStraightStep(inbound);
      switchLead(run.lineup[2]);
      check(run.lead===run.lineup[2],'Leader switch failed');
      for(const m of run.squad)m.cool=999;
      for(let frame=0;frame<15;frame++)checkStraightStep(inbound);
    });
    assert.deepEqual(errors,[]);
    console.log('Four diagonal approaches, moving leader, contact, obstruction and underground tag passed.');
  } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
