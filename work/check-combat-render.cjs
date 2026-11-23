const { chromium } = require('playwright');
const { pathToFileURL } = require('url');
const path = require('path');
const assert = require('assert/strict');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--no-sandbox','--disable-gpu']
  });
  try {
    const page = await browser.newPage({viewport:{width:960,height:540},isMobile:true,hasTouch:true});
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(pathToFileURL(path.resolve('game/index.html')).href);
    await require('./select-test-squad.cjs')(page);
    const maxMiss = await page.evaluate(() => {
      mode='qa';
      let miss=0;
      for (const m of run.squad) {
        for (const lead of [false,true]) {
          for (const col of (m.id===1 && lead ? [1,3] : [1])) {
            for (let sector=0;sector<12;sector++) {
              const a=sector*Math.PI/6, x=m.x+Math.cos(a)*120, y=m.y-28+Math.sin(a)*120;
              combatAim(m,x,y,col,lead);
              const tip=combatMuzzle(m,col,lead);
              const dx=x-tip.x, dy=y-tip.y;
              miss=Math.max(miss,Math.abs(dx*Math.sin(m.aimAngle)-dy*Math.cos(m.aimAngle)));
              if (dx*Math.cos(m.aimAngle)+dy*Math.sin(m.aimAngle)<0) throw Error('barrel facing away');
            }
          }
        }
      }
      return miss;
    });
    assert(maxMiss<.001, 'registered muzzle must aim at target for all poses');
    for (let role=0;role<3;role++) {
      await page.evaluate(id=>{
        run.t=12;run.lead=id;run.mark=null;run.effects=[];run.marks=[];run.cues=[];run.enemies=[];
        const m=run.squad[id], other=run.squad.filter(v=>v.id!==id);
        m.x=run.x+24;m.y=run.y+2;
        other.forEach((v,i)=>{v.x=run.x-54-i*12;v.y=run.y+(i===0?-26:23);v.lastShot=-2;v.moving=false;v.flip=1});
        m.lastShot=run.t-.022;m.shotColumn=id===1?3:1;m.moving=true;m.moveSpeed=91;m.gait=8;
        const direction=id===1?-1:1, target={x:m.x+direction*148,y:m.y-[48,-28,90][id],type:2,hp:66,max:78,phase:1,hit:0,flip:-direction};
        run.enemies.push(target);
        combatAim(m,target.x,target.y-25,m.shotColumn,true);
        const tip=combatMuzzle(m,m.shotColumn,true);
        const angle=m.aimAngle;
        run.effects.push({...tip,clip:['bulk_muzzle','raven_muzzle','lynx_muzzle'][id],lead:true,id,col:m.shotColumn,flip:m.flip,shotTime:m.lastShot,age:.022,duration:.15,angle});
        run.marks.push({...tip,tx:target.x,ty:target.y-25,id,lead:true,angle,age:.04,duration:.10});
        render();
      },role);
      await page.locator('#world').screenshot({path:'work/qa-combat-'+role+'.png'});
    }
    assert.deepEqual(errors,[]);
    console.log('Three lead poses and 84 directional muzzle attachments verified.');
  } finally {
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1});
