const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const rules=require('../game/supply-rules.js');
const earlyRates=[[60,40],[59,40],[56,43],[53,45],[50,48],[47,50],[44,53],[41,55],[38,58],[35,60],[34,56],[33,52],[32,48],[30,44]];

for(const [index,threshold] of rules.thresholds.entries()){
  const level=index+1;
  assert.equal(rules.progress(threshold).level,level);
  if(threshold)assert.equal(rules.progress(threshold-1).level,level-1);
  const samples={C:0,B:0,A:0,S:0};
  for(let ticket=0;ticket<10000;ticket++)samples[rules.rankForRoll(level,(ticket+.5)/10000)]++;
  assert.deepEqual(samples,rules.odds(level));
  assert.equal(Object.values(samples).reduce((sum,n)=>sum+n,0),10000);
  const [expectedC,expectedB]=earlyRates[index]??[20,40];
  assert.equal(samples.C,expectedC*100);
  assert.equal(samples.B,expectedB*100);
  assert.equal(samples.A,10000-samples.C-samples.B-samples.S);
  assert.equal(samples.S,[1,2,4,8,12,20][level-15]??0);
}
assert.equal(rules.progress(740).nextLevelAt,null);

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  try{
    const context=await browser.newContext({viewport:{width:393,height:852},hasTouch:true,isMobile:true});
    const page=await context.newPage();
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
    assert.match(await page.locator('#item-magazine').innerText(),/16발 × 2.*1\.76초/);
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
    assert.equal(mags.length,25);
    const enhancedHits=await page.evaluate(()=>{
      let checks=0;
      for(const member of run.squad)member.gear.critChance=0;
      for(const w of gearByKey.values()){
        if(!w.weapon || !w.level)continue;
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
    assert.equal(enhancedHits,75); // Includes previously saved S +4 and +5 weapons.
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
    await page.evaluate(async()=>{
      await awardDiamonds(60*boxPrice);
      const original=Math.random;Math.random=()=>0;
      try{
        const shieldsBefore=armory.counts['shield-0'],pistolsBefore=armory.counts['pistol-0'];
        for(const [kind,total] of [['weapon',40],['gear',20]]){
          for(let n=1;n<=total;n++){
            // Include a random A immediately before the fixed guarantee.
            let pickRank=kind==='weapon' && n===39;
            Math.random=()=>{if(pickRank){pickRank=false;return .9999}return 0};
            const {drops,guaranteed,level}=await openSupplyCrate(kind);
            if(drops.length!==1 || drops[0].weapon!==(kind==='weapon'))throw Error('Wrong supply pool');
            if(guaranteed!==(n%20===0) || drops[0].rank!==(guaranteed||n===39?'A':'C'))throw Error('Wrong guarantee');
            if(level!==(n<=20?1:2))throw Error('Level applied to the wrong opening');
          }
          if(kind==='weapon' && crateProgress('gear').count!==0)throw Error('Shared box progress');
        }
        if(armory.counts['pistol-0']!==pistolsBefore+37 || armory.counts['shield-0']!==shieldsBefore+19){
          throw Error('Duplicate rewards were discarded');
        }
        const before=JSON.stringify(armory);
        const last=await Promise.all([openSupplyCrate('weapon'),openSupplyCrate('gear')]);
        if(last.some(r=>r.drops) || JSON.stringify(armory)!==before)throw Error('Unpaid box');
        await awardDiamonds(boxPrice);
        const parallel=await Promise.all([openSupplyCrate('weapon'),openSupplyCrate('gear')]);
        if(parallel.filter(r=>r.drops).length!==1 || armory.diamonds!==0)throw Error('Duplicate purchase');
        const kept=JSON.stringify(armory);
        // Seed an old combined save and verify both its earlier guarantee and the fixed twentieth draws.
        try{
          localStorage.setItem(armoryKey,JSON.stringify({boxes:21,sinceA:19,diamonds:40*boxPrice,counts:{'pistol-3':7}}));
          for(const kind of ['weapon','gear']){
            const first=await openSupplyCrate(kind);
            if(!first.guaranteed || first.level!==2 || first.drops[0].rank!=='A')throw Error('Lost legacy guarantee');
            for(let n=23;n<=40;n++){
              const draw=await openSupplyCrate(kind);
              if(draw.guaranteed!==(n===40))throw Error('Legacy guarantee displaced fixed draw');
            }
          }
          if(armory.counts['pistol-3']!==9 || armory.diamonds!==2*boxPrice)throw Error('Legacy inventory or currency changed');
          await changeArmory(s=>{s.supplyCounts.weapon=418;s.diamonds=3*boxPrice});
          Math.random=()=>.99999;
          const draws=[];
          for(let i=0;i<3;i++){const {drops,level}=await openSupplyCrate('weapon');draws.push([drops[0].rank,level])}
          if(JSON.stringify(draws)!==JSON.stringify([['A',14],['A',14],['S',15]]))throw Error('S unlock boundary');
          await changeArmory(s=>{s.supplyCounts={weapon:739,gear:739};s.diamonds=4*boxPrice});
          for(const kind of ['weapon','gear']){
            const fixed=await openSupplyCrate(kind),next=await openSupplyCrate(kind);
            if(fixed.level!==20 || !fixed.guaranteed || fixed.drops[0].rank!=='A' ||
               next.guaranteed || next.drops[0].rank!=='S')throw Error('Level 20 fixed A override in '+kind);
          }
        }finally{localStorage.setItem(armoryKey,kept);await changeArmory(()=>{})}
      }finally{Math.random=original}
    });

    // Two tabs share the balance and use the same Web Lock for both kinds.
    const other=await page.context().newPage();
    try{
      await other.goto(page.url());
      await other.waitForFunction(()=>typeof openSupplyCrate==='function');
      const before=await page.evaluate(async()=>{
        await awardDiamonds(boxPrice);
        return armory.supplyCounts.weapon+armory.supplyCounts.gear;
      });
      const attempts=await Promise.all([
        page.evaluate(()=>openSupplyCrate('weapon')),other.evaluate(()=>openSupplyCrate('gear'))
      ]);
      assert.equal(attempts.filter(r=>r.drops).length,1);
      assert.deepEqual(await page.evaluate(()=>{
        const saved=readLocal(armoryKey);
        return [saved.diamonds,saved.supplyCounts.weapon+saved.supplyCounts.gear];
      }),[0,before+1]);
    }finally{await other.close()}

    const result=await page.evaluate(async()=>{
      const base='ar-3',makeS='ar-5',apex='ar-6';
      await changeArmory(s=>{s.counts[base]=1024});
      const wrong=await fuseGear('smg-3');
      if(wrong)throw Error('Used a different model as material');
      async function fuseBatch(key,limit,copies){
        for(let level=0;level<=limit;level++){
          copies/=2;
          for(let n=0;n<copies;n++){
            if(!await fuseGear(levelKey(key,level)))throw Error('Missing pair '+key+' +'+level);
          }
        }
      }
      await fuseBatch(base,5,1024);
      if(armory.counts[base] || armory.counts[makeS]!==16)throw Error('A ingredient accounting');
      await fuseBatch(makeS,3,16);
      const orphan=normalizedEquipment([null,null,null,null,{weapon:'ar-5@5'}])[4].weapon;
      return [armory.counts[apex],owns(makeS),owns(base),orphan,armory.diamonds];
    });
    assert.deepEqual(result,[1,false,false,'ar-6',0]);
    await page.reload();await page.locator('#shop:enabled').tap();
    assert.equal(await page.evaluate(()=>armory.counts['ar-6']),1);
    await page.locator('#profile-mode').tap();await page.locator('#select-team:enabled').tap();
    assert.deepEqual(await page.evaluate(()=>[developerMode,armory.diamonds,armory.counts['smg-3@1'],savedEquipment[1].weapon]),[true,3000,1,'smg-3@1']);
    assert.deepEqual(errors,[]);
    console.log('25 magazines, saved loadouts, profiles, all 20 loot tables, independent crates, save migration, exact A guarantees, concurrent spending and 1,024 A → S+ verified.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
