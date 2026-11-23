const { chromium } = require('playwright');
const { pathToFileURL } = require('url');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true
  });
  try {
    const page = await browser.newPage({viewport:{width:960,height:540}});
    await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
    await page.goto(pathToFileURL(path.resolve('game/index.html')).href);
    await page.locator('#start:enabled').waitFor();
    await require('./select-test-squad.cjs')(page);
    const results = await page.evaluate(()=>{
      const expect=(ok,message)=>{if(!ok)throw Error(message)};
      const len=TransitKit.stairLength, report=[];
      for(const [i,e] of SURFACE.exits.entries()){
        start();
        run.enemies=[];run.spawn=999;run.remaining=999;
        const stone={x:SURFACE.spawn.x,y:SURFACE.spawn.y,val:4};
        run.crystals=[stone];
        const top=TransitKit.stairPoint(e,-18),foot=TransitKit.stairPoint(e,len+15);
        const downhill=TransitKit.stairPoint(e,1);
        const dx=downhill.x-e.x,dy=downhill.y-e.y;
        expect(!routes.surface.blocked(top.x,top.y,10),'blocked street approach '+e.number);
        expect(!routes.metro.blocked(foot.x,foot.y,10),'blocked station approach '+e.number);
        const lane=TransitKit.stairRect(e,4,len-4,-TransitKit.halfWidth,TransitKit.halfWidth);
        for(const floor of Object.values(cityMaps)){
          const overlap=floor.solids.some(b=>b.x<lane.x+lane.w&&b.x+b.w>lane.x&&b.y<lane.y+lane.h&&b.y+b.h>lane.y);
          expect(!overlap,'obstacle extends into stair lane '+e.number);
        }
        routes.surface.aimAt(SURFACE.spawn.x,SURFACE.spawn.y);
        expect(routes.surface.distance[routes.surface.node(top.x,top.y)]>=0,'unreachable street entrance '+e.number);
        routes.metro.aimAt(650,1100);
        expect(routes.metro.distance[routes.metro.node(foot.x,foot.y)]>=0,'isolated station landing '+e.number);
        Object.assign(run,top);Object.assign(run.camera,top);
        for(const m of run.squad)Object.assign(m,top);
        function walk(dir,steps){
          stick={dx:dir*dx,dy:dir*dy};
          for(let j=0;j<steps;j++){
            const prev={x:run.x,y:run.y},camera={...run.camera};
            update(1/60);
            expect(dist(prev,run)<1.76,'XY discontinuity '+e.number);
            expect(dist(camera,run.camera)<1.76,'camera discontinuity '+e.number);
            for(const member of run.squad.filter(m=>m.deployed)){
              expect(dist(member,run)<70,'squad member left behind at '+e.number);
              expect(!routes[run.floor].blocked(member.x,member.y,4),'squad member inside wall at '+e.number+' floor='+run.floor+' id='+member.id+' step='+j+' direction='+dir+' center='+JSON.stringify([run.x,run.y])+' member='+JSON.stringify([member.x,member.y]));
            }
          }
          stick=null;
        }
        walk(1,27);const mid=run.depth;
        expect(mid>.15&&mid<.5,'no partial descent '+e.number);render();
        for(let j=0;j<8;j++)update(1/60);
        expect(run.depth===mid,'auto-transition while stationary '+e.number);
        walk(-1,27);expect(run.depth===0,'could not back out '+e.number);
        walk(1,68);
        expect(run.floor==='metro'&&run.depth===1,'did not arrive '+e.number);
        expect(run.floors.surface.crystals.includes(stone)&&!run.crystals.includes(stone),'street loot changed floor');
        const chaser={...TransitKit.stairPoint(e,20),type:0,hp:999,max:999,speed:35,phase:0,hit:0,flip:1};
        run.floors.surface.enemies.push(chaser);
        for(let n=0;n<100&&!run.enemies.includes(chaser);n++){
          const prev={x:chaser.x,y:chaser.y};update(1/60);
          expect(dist(prev,chaser)<1.3,'pursuer skipped steps '+e.number);
        }
        expect(run.enemies.includes(chaser)&&!run.floors.surface.enemies.includes(chaser),'enemy lost stairs '+e.number);
        const stationDrop={x:650,y:1100,val:1};run.crystals.push(stationDrop);
        walk(-1,32);
        expect(run.depth>0&&run.depth<1,'no partial ascent '+e.number);
        walk(1,32);expect(run.floor==='metro'&&run.depth===1,'cannot reverse ascent '+e.number);
        walk(-1,68);
        expect(run.floor==='surface'&&run.depth===0&&dist(run,top)<.01,'round trip drift '+e.number);
        expect(run.crystals.includes(stone)&&run.floors.metro.crystals.includes(stationDrop),'lost floor loot');
        report.push(e.number);
      }
      return report;
    });
    console.log('Continuous walking, return, mid-stair reversal, world/camera coordinates and floor loot:',results);
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
