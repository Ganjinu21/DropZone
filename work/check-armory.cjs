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
    // Verify all 25 item images, their shared loadout rules, and a saved five-piece S+ kit in combat.
    await page.locator('#select-team').tap();
    for(const family of ['helmet','gloves','top','pants','boots']){
      await page.locator('[data-slot="'+family+'"]').tap();
      const tiles=page.locator('[data-item]');
      assert.equal(await tiles.count(),5);
      await tiles.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
      await page.locator('[data-item="'+family+'-6"]').tap();
      assert.match(await page.locator('#item-context').innerText(),/모든 대원 공용/);
      await page.locator('#item-action').tap();
      assert.match(await page.locator('[data-slot="'+family+'"]').innerText(),/S\+/);
    }
    assert.ok(await page.evaluate(()=>equipmentCatalog.filter(i=>armorStats[i.family]).every(i=>
      weaponFamilies.every((_,id)=>canEquip(id,i.family,i)) && owns(i.key))));
    await page.locator('#prep-save').tap();
    await page.reload();await page.locator('#start:enabled').tap();
    const kit=await page.evaluate(()=>{
      const m=run.squad[0], w=m.weapon;
      magazineReady(m,w);m.ammo=1;spendRound(m,w);
      const hp=m.hp;
      absorbContact({x:m.x-1,y:m.y,type:0},m,routes.surface,100);
      return [m.max-memberHealth[0],Math.round(100/m.gear.interval),hp-m.hp,
        Math.round(1000*(m.reloadAt-run.t)/w.reload),Math.round(100*m.gear.movement)];
    });
    assert.deepEqual(kit,[65,124,74,680,122]);
    await page.locator('#pause').tap();await page.locator('#homebtn').tap();
    await page.locator('#shop').tap();
    assert.ok(await page.evaluate(()=>developerMode && equipmentCatalog.filter(i=>i.weapon).every(i=>owns(i.key))));
    assert.ok(await page.locator('#crate-open').isEnabled());
    await page.locator('#profile-mode').tap();await page.locator('#shop:enabled').tap();
    assert.ok(await page.locator('#crate-open').isDisabled());
    await page.locator('#crate-popup [data-dismiss]').last().tap();
    await page.locator('#select-team').tap();await screenshot('Preparation');
    assert.deepEqual(await page.evaluate(()=>savedEquipment.map(i=>i.weapon)),Array(5).fill('pistol-0'));
    assert.deepEqual(await page.locator('[data-slot="weapon"]').evaluate(e=>[e.innerText,e.querySelector('img').src.split('/').pop()]),['C','C.png']);
    await page.locator('[data-slot="weapon"]').tap();
    assert.equal(await page.locator('#item-title').textContent(),'시작 권총');
    assert.ok(await page.locator('#item-action').isDisabled());
    assert.equal(await page.locator('[data-item]').count(),10);
    await page.locator('[data-item="carbine-6"]').tap();
    assert.match(await page.locator('#item-action').innerText(),/합성/);
    assert.equal(await page.locator('#item-detail').innerText(),'1발 피해 240');
    const rack=await page.locator('#gear-inventory').boundingBox(),detail=await page.locator('#gear-detail').boundingBox();
    assert.ok(detail.y>=rack.y+rack.height-1 && detail.y+detail.height<=853);
    await page.locator('#prep-save').tap();await page.locator('#start').tap();
    await page.locator('#hud').waitFor();
    await screenshot('Combat');
    await page.evaluate(()=>{
      for(let i=0;i<boxPrice;i++)damageEnemy({type:0,x:run.x+50,y:run.y+30,hp:1},2);
    });
    await page.waitForFunction(()=>armory.diamonds===boxPrice);
    await page.locator('#pause').tap();await page.locator('#homebtn').tap();
    await page.locator('#shop').tap();
    await page.evaluate(()=>{window.realRandom=Math.random;Math.random=()=>.23});
    await page.locator('#crate-open').tap();
    await page.waitForFunction(()=>document.querySelectorAll('#crate-result b').length===2);
    await screenshot('Crate');
    await page.evaluate(()=>{Math.random=window.realRandom});
    const drop=await page.evaluate(()=>Object.keys(armory.counts).map(k=>gearByKey.get(k)).find(i=>i.weapon&&i.key!=='pistol-0'));
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
          try{
            drawEquippedMember(member);
            if(!seen.has(art[i.key]) || (i.family==='smg' && !seen.has(art[i.key+'-far'])))failures.push(i.key);
          }
          finally{ctx.drawImage=original;member.weapon=before}
        }
      }
      for(const shield of equipmentCatalog.filter(i=>i.family==='shield')){
        const drawn=[],original=ctx.drawImage;
        ctx.drawImage=function(img,...args){drawn.push(img);return original.call(this,img,...args)};
        try{drawEquippedMember({...run.squad[0],shieldItem:shield.key})}finally{ctx.drawImage=original}
        if(!drawn.includes(art[shield.key]))failures.push(shield.key);
      }
      return failures;
    });
    assert.deepEqual(cases,[]);
    const hits=await page.evaluate(()=>{
      run.floor='surface';run.up.fill(0);run.activeSkill=null;
      const hits={};
      for(const item of equipmentCatalog.filter(i=>i.weapon)){
        const id=Math.max(0,weaponFamilies.indexOf(item.family));
        const member=run.squad[id];
        Object.assign(member,{x:1280,y:1004,weapon:item,deployed:true,hp:100,flip:1,moving:false});
        for(const lead of [true,false]){
          run.lead=lead?id:(id+1)%5;run.t+=5;
          const enemy={type:0,x:1380,y:1004,hp:1000,hit:0};
          run.enemies=[enemy];run.marks=[];run.effects=[];
          shoot(member);advanceRounds(1);
          const profile=equippedProfile(item,lead);
          if(1000-enemy.hp!==equipmentDamage(item,profile))throw Error('Hit mismatch: '+item.key);
          if(lead)(hits[item.family]??=[]).push(1000-enemy.hp);
        }
      }
      return hits;
    });
    assert.deepEqual(hits,{pistol:[16,26,40,88,192],carbine:[20,32,50,110,240],
      smg:[11,18,28,61,132],sniper:[38,61,95,209,456],rocket:[22,35,55,121,264],ar:[14,22,35,77,168]});
    await page.reload();await page.locator('#start:enabled').tap();
    assert.equal(await page.evaluate(()=>run.squad[0].weapon.key),drop.key);
    await page.locator('#pause').tap();await page.locator('#homebtn').tap();await page.locator('#select-team').tap();
    await page.locator('#change-crew').tap();await page.locator('[data-pick="2"]').tap();await page.locator('[data-pick="4"]').tap();await page.locator('#save-team').tap();
    await page.locator('[data-inspect="4"]').tap();
    assert.equal(await page.locator('#crew-name').textContent(),'CCT-공중통제사');
    await screenshot('CCT');
    assert.deepEqual(await page.evaluate(()=>{const s=restoredArmory({counts:{'top-4':2,'top-3':3,'boots-2':2}});
      return [s.counts['top-3'],s.counts['boots-1'],s.counts['top-4']??0]}),[5,2,0]);
    // Migrate the old duplicated B/A patterns without making them paid entitlements.
    await page.evaluate(()=>{
      localStorage.setItem(armoryKey,JSON.stringify({diamonds:500,owned:['smg-2','smg-4','smg-5','shield-4','boots-4']}));
      localStorage.setItem(equipmentKey,JSON.stringify([{shield:'shield-4'},{weapon:'smg-4',boots:'boots-4'}]));
    });
    await page.reload();await page.locator('#select-team:enabled').tap();
    assert.deepEqual(await page.evaluate(()=>[savedEquipment[1].weapon,savedEquipment[0].shield,
      savedEquipment[1].boots,owns('smg-1'),owns('smg-6'),armory.diamonds]),['smg-3','shield-3','boots-3',true,false,500]);
    await page.locator('[data-inspect="1"]').tap();
    await page.locator('#gear-rank').selectOption('S+');
    assert.equal(await page.locator('[data-item]').count(),2);
    await page.locator('[data-item="smg-6"]').tap();
    assert.equal(await page.locator('#item-title').innerText(),'쌍도깨비');
    assert.ok(await page.locator('#item-action').isDisabled());
    await page.locator('#gear-rank').selectOption('');
    await page.locator('[data-item="smg-5"]').tap();
    assert.ok(await page.locator('#item-action').isEnabled());
    await screenshot('Raven-S');
    await page.locator('[data-item="smg-6"]').tap();
    await screenshot('Raven-S-plus');
    await page.setViewportSize({width:320,height:568});
    await page.locator('[data-item="smg-5"]').tap();await page.locator('#item-action').tap();
    assert.equal(await page.evaluate(()=>draftEquipment[1].weapon),'smg-5');
    const narrow=await page.locator('#gear-detail').boundingBox();
    assert.ok(narrow.x>=0 && narrow.x+narrow.width<=320 && narrow.y+narrow.height<=569);
    await page.locator('#prep-save').tap();
    const exhausted=await page.evaluate(async()=>{
      const drops=[];
      while(true){
        const before=armory.diamonds,result=await openWeaponCrate('smg');
        if(!result.drops)return {drops,before,after:armory.diamonds};
        drops.push(...result.drops.map(i=>i.rank));
      }
    });
    assert.ok(exhausted.drops.length>=5 && exhausted.after===0);
    assert.equal(exhausted.before,exhausted.after);
    assert.deepEqual(errors,[]);console.log('Portrait start, locker, combat, earned currency, crate reload, class restrictions and equipped models on all five classes passed.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
