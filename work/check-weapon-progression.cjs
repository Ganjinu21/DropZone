const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true,isMobile:true});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0});
    await page.goto(pathToFileURL(path.resolve(__dirname,'../game/index.html')).href);
    await page.locator('#select-team:enabled').tap();
    await page.locator('[data-inspect="1"]').tap();
    await page.locator('[data-item="smg-3"]').tap();
    await page.locator('#item-action').tap();
    await page.locator('#item-fuse').tap();
    await page.waitForFunction(()=>detailKey==='smg-3@1',null,{polling:50,timeout:4000});
    assert.equal(await page.locator('#item-detail').innerText(),'1발 피해 31');
    assert.match(await page.locator('#item-magazine').innerText(),/16발 × 2.*1.85초/);
    await page.locator('#item-action').tap();
    if(process.env.PREVIEW_DIR)await page.screenshot({path:path.join(process.env.PREVIEW_DIR,'Weapon-Fusion.png')});
    await page.locator('#prep-save').tap();await page.reload();
    await page.locator('#start:enabled').tap();
    assert.equal(await page.evaluate(()=>run.squad[1].weapon.key),'smg-3@1');
    const mags=await page.evaluate(()=>{
      const result=[];
      for(const item of equipmentCatalog.filter(i=>i.weapon)){
        const id=Math.max(0,weaponFamilies.indexOf(item.family)),m=run.squad[id];
        Object.assign(m,{weapon:item,deployed:true,hp:100,x:1280,y:1004,flip:1,burstIndex:0});
        run.lead=id;run.enemies=[];run.effects=[];run.marks=[];
        shoot(m);
        if(m.ammo!==item.capacity)throw Error('Empty street spent ammo');
        run.enemies=[{type:0,x:1380,y:1004,hp:10000}];
        for(let n=0;n<item.capacity;n++){
          shoot(m);
          if(item.family==='smg' && m.shotColumn!==(n%2?3:1))throw Error('Hands lost alternation');
        }
        const deadline=m.reloadAt,count=run.effects.length;
        run.t=deadline-.01;shoot(m);
        if(m.ammo!==0 || run.effects.length!==count)throw Error('Premature reload '+item.key);
        run.t=deadline;shoot(m);
        if(m.ammo!==item.capacity-1)throw Error('Failed to refill '+item.key);
        result.push(item.key);
      }
      return result;
    });
    assert.equal(mags.length,30);
    const enhancedHits=await page.evaluate(()=>{
      let checks=0;
      for(const w of gearByKey.values()){
        if(!w.level)continue;
        const id=Math.max(0,weaponFamilies.indexOf(w.family)),m=run.squad[id];
        Object.assign(m,{weapon:w,deployed:true,hp:100,x:1280,y:1004,flip:1});
        run.lead=id;run.effects=[];run.marks=[];
        const enemy={x:1380,y:1004,type:0,hp:5000};
        run.enemies=[enemy];shoot(m);advanceRounds(1);
        if(5000-enemy.hp!==equipmentDamage(w))throw Error('Enhanced damage mismatch '+w.key);
        checks++;
      }
      return checks;
    });
    assert.equal(enhancedHits,60);
    const tagged=await page.evaluate(()=>{
      const m=run.squad[1],w=gearByKey.get('smg-3@1');
      m.weapon=w;run.lead=1;magazineReady(m,w);m.ammo=1;
      shoot(m);const until=m.reloadAt;
      setLeader(0);setLeader(1);pause();
      const t=run.t;
      tick(last+20);const frozen=run.t===t && m.reloadAt===until && !magazineReady(m,w);
      show('play');run.t=until;return frozen && magazineReady(m,w) && m.ammo===w.capacity;
    });
    assert.ok(tagged,'A tag or pause changed the reload clock');
    await page.locator('#pause').tap();await page.locator('#homebtn').tap();
    await page.locator('#shop').tap();await page.locator('#profile-mode').tap();
    await page.locator('#shop:enabled').tap();
    assert.deepEqual(await page.evaluate(()=>[developerMode,armory.diamonds,owns('smg-3@1')]),[false,0,false]);
    const draws=await page.evaluate(async()=>{
      await awardDiamonds(33*boxPrice);
      const results=[],original=Math.random;Math.random=()=>.99;
      try{
        for(let i=0;i<33;i++)results.push((await openWeaponCrate('rocket')).drops[0].rank);
        const before=armory.boxes;
        const last=await Promise.all([openWeaponCrate('ar'),openWeaponCrate('ar')]);
        if(last.some(r=>r.drops)||armory.boxes!==before||armory.diamonds!==0)throw Error('Unpaid box');
        await awardDiamonds(boxPrice);
        const parallel=await Promise.all([openWeaponCrate('smg'),openWeaponCrate('ar')]);
        if(parallel.filter(r=>r.drops).length!==1 || armory.diamonds!==0)throw Error('Duplicate purchase');
      }finally{Math.random=original}
      return results;
    });
    assert.deepEqual(draws.slice(0,3),['C','C','B']);
    assert.deepEqual(draws.flatMap((rank,i)=>rank==='A'?[i+1]:[]),[21,33]);
    assert.ok(draws.every(rank=>['C','B','A'].includes(rank)));

    const result=await page.evaluate(async()=>{
      const base='ar-3',makeS='ar-5',apex='ar-6';
      await changeArmory(s=>{s.counts[base]=144});
      const wrong=await fuseWeapon('smg-3');
      if(wrong)throw Error('Used a different model as material');
      async function promote(key){
        for(let copy=0;copy<2;copy++){
          for(let level=0;level<5;level++){
            if(!await fuseWeapon(levelKey(key,level)))throw Error('Unexpected missing material '+key);
          }
        }
        if(!await fuseWeapon(levelKey(key,5)))throw Error('Promotion failed');
      }
      for(let i=0;i<12;i++)await promote(base);
      if(armory.counts[base] || armory.counts[makeS]!==12)throw Error('A ingredient accounting');
      await promote(makeS);
      const orphan=normalizedEquipment([null,null,null,null,{weapon:'ar-5@5'}])[4].weapon;
      return [armory.counts[apex],owns(makeS),owns(base),orphan,armory.diamonds];
    });
    assert.deepEqual(result,[1,false,false,'ar-6',0]);
    await page.reload();await page.locator('#shop:enabled').tap();
    assert.equal(await page.evaluate(()=>armory.counts['ar-6']),1);
    await page.locator('#profile-mode').tap();await page.locator('#select-team:enabled').tap();
    assert.deepEqual(await page.evaluate(()=>[developerMode,armory.diamonds,armory.counts['smg-3@1'],savedEquipment[1].weapon]),[true,3000,1,'smg-3@1']);
    assert.deepEqual(errors,[]);
    console.log('30 magazines, alternating hands, saved upgraded loadout, isolated profiles, box guarantees, concurrent spending and 144 A → S+ verified.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
