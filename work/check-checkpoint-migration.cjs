const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  try{
    const context=await browser.newContext({viewport:{width:393,height:852}});
    await context.route('http://battle.test/**',route=>{
      const file=path.join(__dirname,'../game',new URL(route.request().url()).pathname);
      return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});
    });
    const errors=[];
    await context.addInitScript(()=>{
      window.requestAnimationFrame=()=>0;
      // Model a background tab whose storage notifications haven't been delivered.
      addEventListener('storage',e=>{if(window.holdCheckpointEvents)e.stopImmediatePropagation()},true);
    });
    async function tab(){
      const p=await context.newPage();
      p.on('pageerror',e=>errors.push(e.message));
      await p.goto('http://battle.test/index.html');await p.locator('#start:enabled').waitFor();
      return p;
    }
    const older=await tab();
    await require('./select-test-squad.cjs')(older,[0,1,4]);
    const migration=await older.evaluate(()=>{
      const results=[];
      for(const variant of [0,1,3,5,6]){
        for(const id of [0,1,4]){
          const m=run.squad[id];run.lead=id;
          const key=weaponFamilies[id]+'-'+variant;
          m.weapon=gearByKey.get(key);m.loadout={...m.loadout,weapon:key};
          run.activeSkill=id===4?null:{id,phase:'fire',floor:'surface',age:1.1,hp:60};
          run.cobra=id===4?{age:2.5,duration:7}:null;
          const archive=JSON.parse(encodeBattle());archive.version=1;
          const saved=decodeBattle(JSON.stringify(archive)).state;
          const skill=id===4?saved.cobra:saved.activeSkill;
          results.push({variant,id,active:!!skill,base:skill?.awakened===false});
        }
      }
      return results;
    });
    for(const row of migration){
      assert.equal(row.active,row.variant>=3,'restored invalid skill form '+JSON.stringify(row));
      if(row.active)assert.ok(row.base,'previously fired base skill turned into awakened');
    }
    const crossover=await older.evaluate(()=>{
      run.activeSkill=null;run.cobra=null;run.lead=0;
      const m=run.squad[0];
      m.loadout={...m.loadout,weapon:'pistol-3'};m.weapon=gearByKey.get(m.loadout.weapon);
      if(!activateSquadSkill())throw Error('missing legacy base bunker fixture');
      delete run.activeSkill.awakened;
      m.loadout.weapon='pistol-6';m.weapon=gearByKey.get(m.loadout.weapon);
      const legacy=JSON.parse(encodeBattle());legacy.version=1;
      run=decodeBattle(JSON.stringify(legacy)).state;
      const preserved=deployedBunker() && run.activeSkill.hp>0;
      activateSquadSkill();run.t=run.squad[0].skillReadyAt+.1;activateSquadSkill();
      const awakened=run.activeSkill?.awakened===true;
      const current=decodeBattle(encodeBattle()).state;
      return {preserved,awakened,restoredMech:current.activeSkill?.awakened===true};
    });
    assert.deepEqual(crossover,{preserved:true,awakened:true,restoredMech:true});
    // Release a v1 graph into the old public key, with one retired card between
    // two valid cards and an unconfirmed choice. Then navigate through the actual menu.
    const fixture=await older.evaluate(()=>{
      run.lead=0;run.activeSkill=null;run.cobra=null;run.level=7;run.up[0]=3;
      const archive=JSON.parse(encodeBattle());
      Object.assign(archive,{version:1,phase:'upgrade',choices:[fieldKit,1,vitality],choice:1});
      mode='home';localStorage.removeItem(checkpointSlot(observedOwner));
      localStorage.removeItem(activeCheckpointKey);
      localStorage.setItem(checkpointKey,JSON.stringify(archive));
      return {fieldKit,vitality,before:[...run.up]};
    });
    await older.reload();await older.locator('#continue-run:visible').click();await older.locator('#upgrade').waitFor();
    const offer=await older.evaluate(()=>({cards:[...offers],selected,up:[...run.up],level:run.level}));
    assert.equal(offer.selected,1);assert.equal(offer.cards[0],fixture.fieldKit);assert.equal(offer.cards[2],fixture.vitality);
    assert.ok(offer.cards[1]!==1 && new Set(offer.cards).size===3);assert.deepEqual(offer.up,fixture.before);
    assert.equal(offer.level,7);
    await older.locator('#equip').click();
    assert.deepEqual(await older.evaluate(()=>run.up),fixture.before.map((v,i)=>v+Number(i===offer.cards[1])));
    await older.evaluate(()=>{window.holdCheckpointEvents=true;run.t=26;saveBattleCheckpoint()});
    const latest=await tab();
    await latest.locator('#continue-run').click();await latest.locator('#hud').waitFor();
    await latest.evaluate(()=>{run.t=49;saveBattleCheckpoint()});
    await older.evaluate(()=>{run.t=30;saveBattleCheckpoint()});
    await older.waitForFunction(()=>mode==='home');
    assert.equal(await latest.evaluate(()=>decodeBattle(persistentBattle()).state.t),49,'stale writer changed newer run');
    await older.locator('#continue-run').click();await older.locator('#hud').waitFor();
    await latest.waitForFunction(()=>mode==='home');
    await latest.evaluate(()=>{window.holdCheckpointEvents=true});
    await latest.locator('#continue-run').click();await latest.locator('#hud').waitFor();
    // The older tab has not observed the second takeover. Ending its old graph
    // cannot delete the current run. Later, an old save cannot resurrect a win.
    await older.evaluate(()=>end(false));await older.waitForFunction(()=>mode==='home');
    assert.equal(await latest.evaluate(()=>decodeBattle(persistentBattle()).state.t),49,'stale clear deleted current run');
    await latest.evaluate(()=>{end(true);show('home')});
    await older.evaluate(()=>{mode='play';saveBattleCheckpoint();mode='home';readBattleCheckpoint()});
    assert.equal(await older.evaluate(()=>savedBattle),null);
    assert.equal(await latest.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith(checkpointKey+'.save.')).length),0);
    // Quota exhaustion is intermittent on devices. Save and resume locally,
    // then return to persistent storage without restoring an older snapshot.
    await latest.evaluate(()=>{
      const set=Storage.prototype.setItem;
      Storage.prototype.setItem=function(k,v){
        if(k.startsWith(checkpointKey))throw Error('quota');
        return set.call(this,k,v);
      };
      window.restoreStorage=()=>{Storage.prototype.setItem=set};
      start();run.t=94;show('home');
    });
    await latest.locator('#continue-run').click();await latest.locator('#hud').waitFor();
    assert.equal(await latest.evaluate(()=>run.t),94);
    await latest.evaluate(()=>{restoreStorage();run.t=95;saveBattleCheckpoint();show('home')});
    assert.equal(await latest.evaluate(()=>decodeBattle(persistentBattle()).state.t),95);
    assert.equal(await latest.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith(checkpointKey+'.save.')).length),1);
    assert.deepEqual(errors,[]);
    console.log('Legacy cards, skill ranks, combat continuity, two-tab takeover, terminal saves and quota fallback passed.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
