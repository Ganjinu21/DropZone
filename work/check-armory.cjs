const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true,isMobile:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0});
    await page.goto(pathToFileURL(path.resolve(__dirname,'../game/index.html')).href);
    await page.locator('#select-team:enabled').waitFor();
    const newSortie=async()=>{
      await page.locator('#start:enabled').tap();
      if(await page.locator('#replace-run').isVisible()){await page.locator('#ask-replace').tap();await page.locator('#replace-confirm').tap();}
      if(await page.locator('#upgrade').isVisible())await page.locator('#equip').tap();
      await page.locator('#hud').waitFor();
    };
    const screenshot=async name=>{
      if(!process.env.PREVIEW_DIR)return;
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.src).map(i=>i.decode().catch(()=>{})))});
      await page.screenshot({path:path.join(process.env.PREVIEW_DIR,name+'.png')});
    };
    await screenshot('Start');
    // This scenario equips the full catalog, including pieces normally earned by fusion.
    await page.evaluate(()=>changeArmory(state=>{
      for(const item of equipmentCatalog)state.counts[item.key]=Math.max(1,state.counts[item.key]||0);
    }));
    const iconPaths=await page.evaluate(async()=>Promise.all(equipmentCatalog.map(async item=>{
      const img=new Image();img.src=inventoryImage(item);await img.decode();
      if(Math.max(img.naturalWidth,img.naturalHeight)<300)throw Error(item.key+' inventory image too small');
      return img.src;
    })));
    assert.equal(new Set(iconPaths).size,55);
    await page.locator('#select-team').tap();
    // A rank change must reach both the detail panel and the specific operator's equipped slot.
    for(const [id,family] of [[0,'pistol'],[1,'smg'],[2,'sniper']]){
      const operator=page.locator('[data-inspect="'+id+'"]');
      if(await operator.getAttribute('aria-pressed')!=='true')await operator.tap();
      const slot=page.locator('[data-slot="weapon"]');
      await slot.tap();
      for(const [variant,file] of [[0,'C'],[1,'B'],[3,'A'],[5,'S'],[6,'S-plus']]){
        const key=family+'-'+variant;
        await page.locator('[data-item="'+key+'"]').tap();
        const detail=await page.locator('#item-icon').evaluate(async img=>{await img.decode();return img.src});
        assert.ok(detail.endsWith('/catalog/'+family+'/'+file+'.webp'),key+' detail art');
        const equip=page.locator('#item-action');
        if(await equip.isEnabled())await equip.tap();
        assert.equal(await slot.locator('img').evaluate(img=>img.src),detail,key+' equipped art');
      }
    }
    await page.locator('[data-inspect="0"]').tap();
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
    await page.reload();await newSortie();
    assert.deepEqual(await page.evaluate(()=>run.squad.slice(0,3).map(m=>m.weapon.key)),['pistol-6','smg-6','sniper-6']);
    const kit=await page.evaluate(()=>{
      const m=run.squad[0], w=m.weapon;
      magazineReady(m,w);m.ammo=1;
      const random=Math.random;
      try{Math.random=()=>.99;spendRound(m,w)}finally{Math.random=random}
      return [m.baseMax,m.gear.evadeChance,m.gear.critChance,
        Math.round(1000*(m.reloadAt-run.t)*(1+run.talents.reloadBonus)/w.reload),Math.round(100*m.gear.movement)];
    });
    assert.deepEqual(kit,[294,.15,.22,741,122]);
    await page.locator('#pause').tap();await page.locator('#homebtn').tap();
    await page.locator('#shop').tap();
    assert.ok(await page.evaluate(()=>developerMode && equipmentCatalog.filter(i=>i.weapon).every(i=>owns(i.key))));
    assert.ok(await page.locator('#crate-open').isEnabled());
    const gearCrate=page.locator('[data-supply-kind="gear"]');
    const weaponCrate=page.locator('[data-supply-kind="weapon"]');
    assert.equal(await page.locator('#diamond-packs button').count(),6);
    const packTiles=await page.locator('#diamond-packs button').evaluateAll(list=>list.map(b=>({x:b.offsetLeft,y:b.offsetTop})));
    assert.equal(packTiles[0].y,packTiles[2].y);assert.ok(packTiles[3].y>packTiles[0].y);
    assert.equal(packTiles[0].x,packTiles[3].x);
    await weaponCrate.locator('[data-rates]').tap();
    const rates=page.locator('#supply-rates-dialog');
    assert.ok(await rates.isVisible());
    assert.equal(await rates.locator('#rates-table-body tr').count(),20);
    const highlighted=rates.locator('tr[aria-current="true"]');
    assert.equal(await highlighted.getAttribute('data-level'),'1');
    assert.match(await highlighted.innerText(),/60(?:\.0+)?%/);
    await rates.locator('#rates-close').tap();
    const startDiamonds=await page.evaluate(()=>armory.diamonds);
    await page.locator('#diamond-packs button').first().tap();
    await page.locator('#diamond-confirm button[value="cancel"]').tap();
    assert.equal(await page.evaluate(()=>armory.diamonds),startDiamonds);
    await page.locator('#diamond-packs button').first().tap();await page.locator('#confirm-diamonds').tap();
    await page.waitForFunction(n=>armory.diamonds===n+100,startDiamonds,{polling:20});
    await screenshot('Shop');
    await page.setViewportSize({width:320,height:568});
    const shopPage=page.locator('#shop-page');
    const shopBox=await shopPage.boundingBox();
    assert.ok(shopBox.x>=0 && shopBox.x+shopBox.width<=320 && shopBox.height<=568);
    assert.ok(await shopPage.evaluate(el=>el.tagName==='SECTION' && el.scrollWidth<=el.clientWidth));
    assert.ok((await weaponCrate.locator('[data-draw]').boundingBox()).height>=44);
    await page.locator('#diamond-packs button').last().tap();
    assert.match(await page.locator('#purchase-title').innerText(),/6,500/);
    await page.locator('#diamond-confirm button[value="cancel"]').tap();
    await page.setViewportSize({width:393,height:852});
    await page.locator('#profile-mode').tap();await page.locator('#shop:enabled').tap();
    assert.equal(await page.locator('#diamond-packs button:disabled').count(),6);
    assert.ok(await page.locator('#crate-open').isDisabled());
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#hub-talents').getAttribute('aria-current'),'page');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#hub-home').getAttribute('aria-current'),'page');
    await page.locator('#select-team').tap();await screenshot('Preparation');
    assert.deepEqual(await page.evaluate(()=>savedEquipment.map(i=>i.weapon)),['pistol-0','smg-0','sniper-0','rocket-0','ar-0']);
    assert.deepEqual(await page.evaluate(()=>Object.keys(armory.counts).filter(k=>gearByKey.get(k)?.weapon).sort()),['ar-0','pistol-0','rocket-0','smg-0','sniper-0']);
    assert.deepEqual(await page.locator('[data-slot="weapon"]').evaluate(e=>[e.innerText,e.querySelector('img').src.split('/').pop()]),['C','C.webp']);
    await page.locator('[data-slot="weapon"]').tap();
    await page.locator('#gear-detail').waitFor();
    assert.equal(await page.locator('#item-title').textContent(),'시작 권총');
    assert.ok(await page.locator('#item-action').isDisabled());
    assert.equal(await page.locator('[data-item]').count(),5);
    await page.locator('[data-item="pistol-6"]').tap();
    assert.match(await page.locator('#item-action').innerText(),/합성/);
    assert.equal(await page.locator('#item-detail').innerText(),'1발 피해 192');
    const rack=await page.locator('#gear-inventory').boundingBox(),detail=await page.locator('#gear-detail').boundingBox();
    assert.ok(detail.y>=rack.y+rack.height-1 && detail.y+detail.height<=853);
    await page.locator('#prep-save').tap();await newSortie();
    await page.locator('#hud').waitFor();
    await screenshot('Combat');
    await page.evaluate(()=>{
      for(let i=0;i<boxPrice;i++)damageEnemy({type:0,x:run.x+50,y:run.y+30,hp:1},2);
    });
    await page.waitForFunction(()=>armory.diamonds===boxPrice,null,{polling:20});
    await page.locator('#pause').tap();await page.locator('#homebtn').tap();
    await page.locator('#shop').tap();
    await page.evaluate(async()=>{
      await awardDiamonds(2*boxPrice);
      window.realRandom=Math.random;
      const rolls=[.75,0,.01,0,.01,0];
      Math.random=()=>rolls.shift()??0;
    });
    await weaponCrate.locator('[data-draw]').tap();
    await page.waitForFunction(()=>armory.supplyCounts.weapon===1,null,{polling:20});
    assert.match(await weaponCrate.locator('[data-drop] b').innerText(),/^B/);
    assert.match(await gearCrate.locator('[data-guarantee]').innerText(),/20회/);
    for(let n=1;n<=2;n++){
      await gearCrate.locator('[data-draw]').tap();
      await page.waitForFunction(n=>armory.supplyCounts.gear===n,n,{polling:20});
    }
    assert.match(await weaponCrate.locator('[data-guarantee]').innerText(),/19회/);
    assert.match(await gearCrate.locator('[data-guarantee]').innerText(),/18회/);
    await screenshot('Crate');
    await page.evaluate(()=>{Math.random=window.realRandom});
    const drop=await page.evaluate(()=>equipmentCatalog.find(i=>i.weapon&&i.rank==='B'&&armory.counts[i.key]));
    assert.equal(drop.family,'pistol');
    assert.equal(await page.locator('#crate-family').count(),0);
    assert.equal(await page.evaluate(()=>armory.diamonds),0);
    assert.ok(await page.locator('#crate-open').isDisabled());
    await page.reload();await page.locator('#select-team:enabled').tap();
    await page.locator('[data-inspect="1"]').tap();assert.equal(await page.locator('[data-item="'+drop.key+'"]').count(),0);
    await page.locator('[data-inspect="0"]').tap();
    await page.locator('[data-item="'+drop.key+'"]').tap();await screenshot('Item');
    assert.equal(await page.evaluate(()=>draftEquipment[0].weapon),'pistol-0');
    await page.locator('#item-action').tap();await page.locator('#prep-save').tap();await newSortie();
    const actual=await page.evaluate(()=>{
      const seen=new Set(),original=ctx.drawImage;
      ctx.drawImage=function(img,...args){seen.add(img);return original.call(this,img,...args)};
      const finish=()=>gearDecals.get('bulk-0-'+recruitPose(run.squad[0],Infinity,false)+'-gun:'+run.squad[0].weapon.tier)?.canvas;
      drawHero(run.squad[0]);const front=seen.has(finish());seen.clear();
      setLeader(1);drawHero(run.squad[0]);const rear=seen.has(finish());
      ctx.drawImage=original;return [run.squad[0].weapon.key,front,rear];
    });
    assert.deepEqual(actual,[drop.key,true,true]);
    const cases=await page.evaluate(()=>{
      const failures=[];
      for(const [id,family] of weaponFamilies.entries()){
        const member=run.squad[id];
        for(const i of equipmentCatalog.filter(x=>x.weapon)){
          const allowed=i.family===family;
          if(canEquip(id,'weapon',i)!==allowed)failures.push(i.key);
          if(!allowed)continue;
          const original=ctx.drawImage,seen=new Set();
          ctx.drawImage=function(img,...args){seen.add(img);return original.call(this,img,...args)};
          const before=member.weapon;member.weapon=i;
          try{
            drawEquippedMember(member);
            const role=operatorRoles[id];
            const frame=recruitPose(member,run.t-(member.lastShot??-Infinity),member.moving);
            const finish=gearDecals.get(role+'-0-'+frame+'-gun:'+i.tier)?.canvas;
            if(!seen.has(art[role+'Recruitframes']) || (i.tier && !seen.has(finish)))failures.push(i.key);
          }
          finally{ctx.drawImage=original;member.weapon=before}
        }
      }
      for(const shield of equipmentCatalog.filter(i=>i.family==='shield')){
        const drawn=[],original=ctx.drawImage;
        ctx.drawImage=function(img,...args){drawn.push(img);return original.call(this,img,...args)};
        try{drawEquippedMember({...run.squad[0],weapon:gearByKey.get('pistol-0'),shieldItem:shield.key})}finally{ctx.drawImage=original}
        if(drawn.length!==1 || drawn[0]!==art.bulkRecruitframes)failures.push(shield.key);
      }
      return failures;
    });
    assert.deepEqual(cases,[]);
    const hits=await page.evaluate(()=>{
      run.floor='surface';run.activeSkill=null;
      for(const member of run.squad)member.gear.critChance=0;
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
    assert.deepEqual(hits,{pistol:[16,26,40,88,192],
      smg:[11,18,28,61,132],sniper:[38,61,95,209,456],rocket:[22,35,55,121,264],ar:[14,22,35,77,168]});
    await page.reload();await newSortie();
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
      localStorage.setItem(armoryKey,JSON.stringify({diamonds:500,counts:{'smg-2':1,'smg-4':1,'smg-5':1,'shield-4':1,'boots-4':1,'carbine-3@2':2,'pistol-3@2':1}}));
      localStorage.setItem(equipmentKey,JSON.stringify([{weapon:'carbine-3@2',shield:'shield-4'},{weapon:'pistol-3@2',boots:'boots-4'},{weapon:'pistol-3@2'}]));
    });
    await page.reload();await page.locator('#select-team:enabled').tap();
    assert.deepEqual(await page.evaluate(()=>[savedEquipment[1].weapon,savedEquipment[0].shield,
      savedEquipment[1].boots,owns('smg-1'),owns('smg-6'),armory.diamonds,
      savedEquipment[0].weapon,armory.counts['pistol-3@2'],savedEquipment[2].weapon]),['smg-3','shield-3','boots-3',true,false,500,'pistol-3@2',3,'sniper-0']);
    await page.locator('[data-inspect="1"]').tap();
    await page.locator('#gear-rank').selectOption('S+');
    assert.equal(await page.locator('[data-item]').count(),1);
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
        const before=armory.diamonds,result=await openSupplyCrate('weapon');
        if(!result.drops)return {drops,before,after:armory.diamonds};
        drops.push(...result.drops.map(i=>i.rank));
      }
    });
    assert.ok(exhausted.drops.length>=5 && exhausted.after===0);
    assert.equal(exhausted.before,exhausted.after);
    await page.evaluate(()=>changeArmory(state=>{
      state.diamonds=boxPrice;state.supplyCounts.weapon=19;state.supplyCounts.gear=6;
    }));
    await page.reload();await page.locator('#shop:enabled').tap();
    assert.match(await weaponCrate.locator('[data-guarantee]').innerText(),/이번 개봉 A등급 확정/);
    assert.match(await gearCrate.locator('[data-guarantee]').innerText(),/14회/);
    await weaponCrate.locator('[data-rates]').tap();
    assert.match(await rates.locator('#rates-guarantee').innerText(),/A.*100%/);
    await rates.locator('#rates-close').tap();
    await weaponCrate.locator('[data-draw]').tap();
    await page.waitForFunction(()=>armory.supplyCounts.weapon===20,null,{polling:20});
    assert.match(await weaponCrate.locator('[data-drop] b').innerText(),/^A/);
    assert.match(await weaponCrate.locator('[data-level]').innerText(),/Lv.2/);
    assert.match(await weaponCrate.locator('[data-guarantee]').innerText(),/20회/);
    assert.match(await gearCrate.locator('[data-guarantee]').innerText(),/14회/);
    assert.deepEqual(errors,[]);console.log('Portrait start, locker, combat, earned currency, crate reload, class restrictions and equipped models on all five classes passed.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
