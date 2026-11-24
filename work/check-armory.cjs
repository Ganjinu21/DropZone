const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true,isMobile:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../game/index.html')).href);
    await page.locator('#select-team:enabled').waitFor();
    const screenshot=async name=>{
      if(!process.env.PREVIEW_DIR)return;
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.src).map(i=>i.decode().catch(()=>{})))});
      await page.screenshot({path:path.join(process.env.PREVIEW_DIR,name+'.png')});
    };
    await screenshot('Start');
    await page.locator('#shop').tap();
    assert.ok(await page.locator('#crate-open').isDisabled());
    await page.locator('#crate-popup [data-dismiss]').last().tap();
    await page.locator('#select-team').tap();await screenshot('Preparation');
    assert.deepEqual(await page.evaluate(()=>savedEquipment.map(i=>i.weapon)),Array(5).fill('pistol-0'));
    assert.deepEqual(await page.locator('[data-slot="weapon"]').evaluate(e=>[e.innerText,e.querySelector('img').src.split('/').pop()]),['C','pistol-0.png']);
    await page.locator('[data-slot="weapon"]').tap();
    assert.equal(await page.locator('#item-title').textContent(),'보급 권총');
    await page.locator('#item-action').tap();
    assert.equal(await page.locator('[data-item]').count(),1);
    await page.locator('#prep-save').tap();await page.locator('#start').tap();
    await page.locator('#hud').waitFor();
    await screenshot('Combat');
    await page.evaluate(()=>{
      for(let i=0;i<10;i++)damageEnemy({type:0,x:run.x+50,y:run.y+30,hp:1},2);
    });
    await page.waitForFunction(()=>armory.diamonds===10);
    await page.locator('#pause').tap();await page.locator('#homebtn').tap();
    await page.locator('#shop').tap();
    await page.evaluate(()=>{window.realRandom=Math.random;Math.random=()=>.27});
    await page.locator('#crate-open').tap();
    await page.waitForFunction(()=>document.querySelectorAll('#crate-result b').length===2);
    await screenshot('Crate');
    await page.evaluate(()=>{Math.random=window.realRandom});
    const drop=await page.evaluate(()=>armory.owned.map(k=>gearByKey.get(k)).find(i=>i.weapon&&i.key!=='pistol-0'));
    assert.equal(drop.family,'carbine');
    assert.equal(await page.evaluate(()=>armory.diamonds),0);
    assert.ok(await page.locator('#crate-open').isDisabled());
    await page.reload();await page.locator('#select-team:enabled').tap();
    await page.locator('[data-inspect="1"]').tap();assert.equal(await page.locator('[data-item="'+drop.key+'"]').count(),0);
    await page.locator('[data-inspect="0"]').tap();
    await page.locator('[data-item="'+drop.key+'"]').tap();await screenshot('Item');
    assert.equal(await page.evaluate(()=>draftEquipment[0].weapon),'pistol-0');
    await page.locator('#item-action').tap();await page.locator('#prep-save').tap();await page.locator('#start').tap();
    const actual=await page.evaluate(()=>{
      const seen=new Set(),original=ctx.drawImage;
      ctx.drawImage=function(img,...args){seen.add(img);return original.call(this,img,...args)};
      drawHero(run.squad[0]);const front=seen.has(art[run.squad[0].weapon.key]);seen.clear();
      setLeader(1);drawHero(run.squad[0]);const rear=seen.has(art[run.squad[0].weapon.key]);
      ctx.drawImage=original;return [run.squad[0].weapon.key,front,rear];
    });
    assert.deepEqual(actual,[drop.key,true,true]);
    const cases=await page.evaluate(()=>{
      const failures=[];
      for(const [id,family] of weaponFamilies.entries()){
        const member=run.squad[id];
        for(const i of equipmentCatalog.filter(x=>x.weapon)){
          const allowed=i.family==='pistol'||i.family===family;
          if(canEquip(id,'weapon',i)!==allowed)failures.push(i.key);
          if(!allowed)continue;
          const original=ctx.drawImage,seen=new Set();
          ctx.drawImage=function(img,...args){seen.add(img);return original.call(this,img,...args)};
          const before=member.weapon;member.weapon=i;
          try{drawEquippedMember(member);if(!seen.has(art[i.key]))failures.push(i.key)}
          finally{ctx.drawImage=original;member.weapon=before}
        }
      }
      return failures;
    });
    assert.deepEqual(cases,[]);
    await page.reload();await page.locator('#start:enabled').tap();
    assert.equal(await page.evaluate(()=>run.squad[0].weapon.key),drop.key);
    await page.locator('#pause').tap();await page.locator('#homebtn').tap();await page.locator('#select-team').tap();
    await page.locator('#change-crew').tap();await page.locator('[data-pick="2"]').tap();await page.locator('[data-pick="4"]').tap();await page.locator('#save-team').tap();
    await page.locator('[data-inspect="4"]').tap();
    assert.equal(await page.locator('#crew-name').textContent(),'CCT-공중통제사');
    await screenshot('CCT');
    assert.deepEqual(errors,[]);console.log('Portrait start, locker, combat, earned currency, crate reload, class restrictions and equipped models on all five classes passed.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
