const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const selectSquad = require('./select-test-squad.cjs');

function combatSnapshot() {
  const boss = run.boss, shot = run.marks[0], chief = run.squad[4];
  return {
    stage:run.stage, wave:run.wave, floor:run.floor, time:run.t, level:run.level,
    xp:run.xp, need:run.need, kills:run.kills, position:[run.x,run.y],
    lead:run.lead, lineup:run.lineup, ranks:run.up, magnetUntil:run.magnetUntil,
    equipment:run.squad.map(m=>({gear:m.gear, loadout:m.loadout, key:m.weapon.key,
      power:m.weapon.power, hp:m.hp, max:m.max, ammo:m.ammo, reloadAt:m.reloadAt})),
    support:run.radioTeam.map(m=>[m.x,m.y,m.hp,m.max,m.respawn]),
    cobra:run.cobra, cooldown:chief.skillReadyAt, bunker:[run.activeSkill.id,run.activeSkill.hp],
    bossHP:boss.hp, bossIdentity:run.enemies.includes(boss), targetIdentity:run.mark===boss,
    bossHitSet:boss.pattern.marks[0].hit instanceof Set && boss.pattern.marks[0].hit.has(4),
    shotHits:shot.hit instanceof Set && shot.hit.has(boss), contactIdentity:run.enemies.includes(shot.contact),
    remoteCrystals:run.floors.metro.crystals
  };
}

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || undefined});
  try {
    const page = await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
    const errors = [];
    page.on('pageerror',e=>errors.push(e.message));
    // Freeze frames across navigations; actual game time must not advance in the lobby.
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0});
    const tap = id=>page.locator('#'+id).tap();
    const reload = async () => {
      await page.reload();
      await page.locator('#start:enabled').waitFor();
    };
    const home = async () => {await tap('pause'); await tap('homebtn')};
    const resume = async (screen='hud') => {
      await tap('start');await tap('continue-run');
      await page.locator('#'+screen).waitFor();
    };
    const switchProfile = async () => {
      await tap('shop');
      await Promise.all([page.waitForEvent('load'),tap('profile-mode')]);
      await page.locator('#start:enabled').waitFor();
    };
    const saveKey = 'dropzone.dev.run.v1';
    const hasSave = key=>page.evaluate(k=>localStorage.getItem(k)!==null,key);
    const canContinue = ()=>page.evaluate(()=>Number(Boolean(savedBattle)));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../game/index.html')).href);
    await selectSquad(page,[4,0,3]);
    assert.ok(await hasSave(saveKey),'start did not immediately checkpoint');

    await page.evaluate(() => {
      Object.assign(run,{t:73.25,level:8,xp:6,need:20,kills:45,stage:2,magnetUntil:75.75});
      Object.assign(run.talents,{bulkSkill:true,cctSkill:true,rocketSkill:true});
      beginWave(3);beginBossFight();updateEncounter(1.2);
      const boss=run.boss, chief=run.squad[4], bulk=run.squad[0];
      for(const member of [bulk,chief]){
        member.weapon=gearByKey.get(weaponFamilies[member.id]+'-3');
        member.loadout={...member.loadout,weapon:member.weapon.key};
      }
      run.up[0]=run.up[8]=3;
      run.up[6]=2;run.up[firepower]=1;
      if(!activateSquadSkill()) throw Error('Cobra fixture failed');
      run.cobra.age=2.5;setLeader(0);
      if(!activateSquadSkill()) throw Error('Bunker fixture failed');
      hitBunker(boss,routes[run.floor],23,false);
      run.radioTeam[1].hp=0;run.radioTeam[1].respawn=3.25;
      bulk.hp-=17;chief.hp-=19;
      magazineReady(chief,chief.weapon);chief.ammo=0;chief.reloadAt=run.t+1.4;
      // Create both object-keyed (projectile) and numeric-keyed (boss pulse) hit sets.
      Object.assign(boss,{x:run.x+18,y:run.y,hp:boss.max-100});
      tickBossAttack(.001,routes[run.floor]);boss.pattern.cool=0;
      tickBossAttack(.001,routes[run.floor]);boss.pattern.marks[0].hit.add(4);
      run.mark=boss;
      fireSkillBullet(bulk,run.activeSkill,0,null,0);
      run.marks[0].hit.add(boss);run.marks[0].contact=run.enemies.find(e=>e!==boss);
      run.floors.metro.crystals.push({x:100,y:110,val:3});
      updateHud();
    });
    const expected=await page.evaluate(combatSnapshot);
    assert.ok(expected.bossIdentity && expected.targetIdentity && expected.bossHitSet && expected.shotHits && expected.contactIdentity);
    // A reload during active play takes the pagehide path, without a trip to pause.
    await reload();await resume();
    assert.deepEqual(await page.evaluate(combatSnapshot),expected,'pagehide restore changed combat');
    await home();await tap('select-team');
    assert.equal(await page.locator('[data-inspect="4"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-item="ar-1"]').tap();await tap('item-action');await tap('prep-save');
    assert.equal(await page.evaluate(()=>savedEquipment[4].weapon),'ar-1');
    await tap('start');await page.locator('#replace-run').waitFor();
    await tap('replace-cancel');await resume();
    assert.deepEqual(await page.evaluate(combatSnapshot),expected,'cancelled replacement changed combat');

    // Use the actual upgrade threshold, including a selected but unconfirmed card.
    await page.evaluate(()=>{run.xp=run.need;update(.001)});
    await page.locator('#upgrade').waitFor();
    await page.locator('#cards .card').nth(1).tap();
    const pending=await page.evaluate(()=>({offers:[...offers],selected,up:[...run.up],level:run.level}));
    await tap('upgrade-home');await reload();await resume('upgrade');
    assert.deepEqual(await page.evaluate(()=>({offers:[...offers],selected,up:[...run.up],level:run.level})),pending);
    assert.equal(await page.locator('#cards [aria-pressed="true"]').getAttribute('data-i'),'1');
    await tap('equip');
    const upgraded=[...pending.up];upgraded[pending.offers[1]]++;
    assert.deepEqual(await page.evaluate(()=>run.up),upgraded,'upgrade selection was not applied exactly once');
    await reload();await resume();
    assert.deepEqual(await page.evaluate(()=>run.up),upgraded,'applied card was lost or duplicated on load');

    await home();await switchProfile();
    assert.equal(await canContinue(),0,'normal profile can continue developer sortie');
    await tap('start');await page.locator('#hud').waitFor();
    await page.evaluate(()=>{run.t=9.75});await home();await switchProfile();
    await resume();
    assert.deepEqual(await page.evaluate(()=>run.up),upgraded,'normal sortie overwrote developer sortie');
    assert.ok((await page.evaluate(()=>run.t))>73);
    await home();await tap('start');await tap('ask-replace');await tap('replace-confirm');await page.locator('#hud').waitFor();
    assert.ok(await page.evaluate(()=>run.stage===1 && run.t===0 && run.up.every(rank=>rank===0) &&
      !run.activeSkill && !run.cobra && !run.boss && run.squad[4].weapon.key==='ar-1'),
      'replacement failed to start fresh with the current locker');
    await page.evaluate(()=>end(false));await tap('homebtn');await reload();
    assert.equal(await canContinue(),0,'loss can be resumed');assert.equal(await hasSave(saveKey),false);
    await switchProfile();await resume();
    assert.equal(await page.evaluate(()=>run.t),9.75,'normal checkpoint was not preserved');
    await page.evaluate(()=>end(true));await tap('homebtn');await reload();
    assert.equal(await canContinue(),0,'win can be resumed');assert.equal(await hasSave('dropzone.run.v1'),false);
    // A partial write from another version must never strand the main menu.
    for(const invalid of ['{',JSON.stringify({version:99}),JSON.stringify({version:1,nodes:[],root:{ref:0},phase:'play'})]){
      await page.evaluate(value=>localStorage.setItem('dropzone.run.v1',value),invalid);
      await reload();assert.equal(await canContinue(),0);
    }
    await tap('start');await page.locator('#hud').waitFor();
    const checkpointTime=await page.evaluate(()=>{
      const initial=run.t;
      run.t+=2.2;tick(performance.now());
      return [initial,decodeBattle(persistentBattle()).state.t];
    });
    assert.ok(checkpointTime[1]>=checkpointTime[0]+2,'live battle did not autosave');
    assert.deepEqual(errors,[]);
    console.log('Continue preserved the active combat graph, pending upgrade, profile saves, replacement and end cleanup.');
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1});
