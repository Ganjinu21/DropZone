const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const launchSquad=require('./select-test-squad.cjs');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined});
  try{
    const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.requestAnimationFrame=()=>0;
      localStorage.setItem('dropzone.dev.equipment.v2',JSON.stringify([
        {weapon:'pistol-6',shield:'shield-0'},{weapon:'smg-3'},{},{},{weapon:'ar-6'}
      ]));
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,'../game/index.html')).href);
    await launchSquad(page,[4,0,1]);
    assert.equal(await page.locator('#cast-name').innerText(),'A-10 공중지원');
    await page.locator('#cast').tap();
    assert.ok(await page.evaluate(()=>run.cobra.awakened && run.cobra.duration===11 && !run.activeSkill));
    await page.locator('#party [data-i="0"]').tap();
    assert.equal(await page.locator('#cast-name').innerText(),'미니건 메카');
    await page.locator('#cast').tap();
    const result=await page.evaluate(()=>{
      const pilot=run.squad[0],wing=run.squad[1],mech=run.activeSkill,craft=run.cobra;
      const start={x:run.x,y:run.y};
      const boss={x:run.x+100,y:run.y,type:2,hp:900000,max:900000,hit:0,speed:0,phase:0,contactDamage:8};
      run.enemies=[boss];run.spawn=999;
      wing.gear.evadeChance=0;wing.hurt=0;
      hitSquadMember(boss,wing,routes[run.floor],5);
      const exposed=wing.hp<wing.max && mech.hp===mech.maxHp;
      hitSquadMember(boss,pilot,routes[run.floor],5);
      const armored=pilot.hp===pilot.max && mech.hp===mech.maxHp-5;
      pressed.add('KeyD');
      let traced=false;
      for(let i=0;i<95;i++){
        update(1/60);
        for(const e of run.effects)if(e.clip==='support_tracer' && e.awakened)traced=true;
      }
      pressed.clear();
      switchLead(1);
      render();
      return {sameMech:run.activeSkill===mech && run.lead===0 && !deployedBunker(),
        movement:run.x-start.x,attached:mech.x===pilot.x && mech.y===pilot.y,
        exposed,armored,shots:mech.beat,airFire:traced && boss.hp<boss.max,
        alive:run.radioTeam.every(m=>m.hp>0),airAge:craft.age,mechHp:mech.hp};
    });
    assert.ok(result.sameMech && result.attached && result.airFire && result.alive && result.exposed && result.armored);
    assert.ok(result.movement>45 && result.shots>8);
    await page.locator('#pause').tap();await page.locator('#homebtn').tap();
    await page.reload();await page.locator('#start:enabled').waitFor();await page.locator('#continue-run').tap();
    assert.deepEqual(await page.evaluate(()=>[run.activeSkill.awakened,run.cobra.awakened,run.activeSkill.hp,run.cobra.age]),
      [true,true,result.mechHp,result.airAge]);
    const ended=await page.evaluate(()=>{
      for(let i=0;i<400 && run.activeSkill;i++)update(1/60);
      const unlocked=!run.activeSkill && squadSkillCooldown(0)>19.9;
      switchLead(1);
      const overlap=run.lead===1 && !!run.cobra && activateSquadSkill() && run.activeSkill.id===1;
      for(let i=0;i<195;i++)update(1/60);
      return [unlocked,overlap,!run.cobra,squadSkillCooldown(4)>0];
    });
    assert.deepEqual(ended,[true,true,true,true]);
    assert.deepEqual(errors,[]);
    console.log('Rank-equipped A-10 and mobile mech, separate ally armor, active swap locks, moving gunfire, saved overlap and cooldowns passed.');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
