const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  try {
    const page = await browser.newPage({viewport:{width:914,height:412},isMobile:true,hasTouch:true});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Drive the game's real update/render functions at a deterministic frame rate.
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.addInitScript(()=>{
      const keys=['pistol-0','smg-0','sniper-0','rocket-3','ar-0'];
      localStorage.setItem('dropzone.armory.v1',JSON.stringify({diamonds:0,owned:keys}));
      localStorage.setItem('dropzone.equipment.v2',JSON.stringify(keys.map(weapon=>({weapon}))));
    });
    await page.goto(pathToFileURL(path.join(__dirname, '../game/index.html')).href);
    const launch=require('./select-test-squad.cjs');
    await launch(page);
    await page.evaluate(() => Promise.all([gunAudio.loading, skillAudio.loading]));
    const party = page.locator('#party [data-operator]');
    assert.equal(await party.count(), 3);
    assert.ok(await page.locator('#cast').isDisabled());
    await page.keyboard.press('Space');
    assert.ok(await page.evaluate(()=>!run.activeSkill));
    await page.evaluate(() => {
      window.skillUI = {
        sounds: [], drawn: new Set(),
        roster() { return run.squad.filter(member => member.deployed).map(member => member.id); },
        equipBase() {
          const member=run.squad[run.lead];
          member.weapon=gearByKey.get(weaponFamilies[run.lead]+'-3');
          member.loadout={...member.loadout,weapon:member.weapon.key};
          updateHud();
        },
        setup() {
          this.equipBase();
          Object.assign(run,{x:1257,y:1004,heading:0,spawn:999,remaining:999,marks:[],effects:[],cues:[]});
          Object.assign(run.camera,{x:run.x,y:run.y});
          for (const member of run.squad) Object.assign(member,{x:1280,y:1004,flip:1,cool:999});
          run.enemies = [75,98].map(offset => ({
            x:1280+offset,y:998,type:0,hp:2000,max:2000,phase:0,hit:0,flip:-1,speed:0
          }));
          this.sounds.length = 0;
          this.drawn.clear();
        },
        playCast() {
          const skill = run.activeSkill, start = [run.x,run.y];
          if (skill.id === 0) pressed.add('KeyD');
          for (let frame=0; run.activeSkill && frame<600; frame++) {
            if(skill.id===0 && frame===390)hitSquadMember(run.enemies[0],run.squad[0],routes[run.floor],skill.hp);
            if(!run.activeSkill)break;
            update(1/60);
            if (frame%5===0) render();
          }
          pressed.delete('KeyD');
          return {start, finish:[run.x,run.y], ended:!run.activeSkill, cooldown:squadSkillCooldown(skill.id),
            drawn:[...this.drawn], sounds:this.sounds.slice()};
        }
      };
      // Capture real draws and decoded audio starts; a populated asset list alone
      // wouldn't detect a missing render hook or a sound played by a benched leader.
      const sprites = new Map(Object.keys(skillArt).map(key => [art[key],key]));
      for(const role of operatorRoles.filter(Boolean)){
        for(const suffix of ['Base','Field72','Field144'])sprites.set(art[role+suffix],role);
      }
      sprites.set(art.ravenFollow,'ravenSpin');
      const draw = ctx.drawImage.bind(ctx);
      ctx.drawImage = (image,...args) => {
        if (sprites.has(image)) skillUI.drawn.add(sprites.get(image));
        return draw(image,...args);
      };
      const audio = new Map([...skillAudio.buffers,...gunAudio.buffers].map(([name,buffer])=>[buffer,name]));
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        if (audio.has(this.buffer)) skillUI.sounds.push(audio.get(this.buffer));
        return start.apply(this,args);
      };
    });
    assert.deepEqual(await page.evaluate(() => skillUI.roster()),[0,1,2]);
    const expected = [
      {sound:'cannon', sprites:['mechFold','bunker','bulk','bulkRounds']},
      {sound:'smgA', sprites:['ravenSpin','ravenMuzzle','ravenFlight']},
      {sound:'pierce', sprites:['lynx','lynxBeam','lynxPierce']},
      {sound:'burst', sprites:['hammer','hammerFx','hammerBlast']}
    ];
    for (const [id,cast] of expected.entries()) {
      if (id===3) {
        await page.locator('#pause').tap();
        await page.locator('#homebtn').tap();
        await launch(page,[3,1,2]);
      } else if (id) await party.nth(id).tap();
      assert.equal(await page.evaluate(() => run.lead),id);
      const roster = await page.evaluate(() => skillUI.roster());
      assert.equal(roster.length,3);
      assert.ok(roster.includes(id));
      await page.evaluate(() => skillUI.setup());
      if (id%2) await page.keyboard.press('Space');
      else await page.locator('#cast').tap();
      assert.equal(await page.evaluate(() => run.activeSkill?.id),id);
      if (id===0) {
        await page.locator('#pause').tap();
        await page.keyboard.press('Space');
        const paused = await page.evaluate(() => {
          const before = [run.t,run.activeSkill.age];
          for (let frame=0;frame<5;frame++) tick(last+16);
          return {mode,before,after:[run.t,run.activeSkill.age]};
        });
        assert.equal(paused.mode,'pause');
        assert.deepEqual(paused.after,paused.before);
        await page.locator('#resume').tap();
      }
      const result = await page.evaluate(() => skillUI.playCast());
      assert.equal(result.ended,true);
      assert.ok(result.cooldown>0);
      if (id===0) assert.deepEqual(result.finish,result.start,'bunker moved under held movement input');
      for (const sprite of cast.sprites) assert.ok(result.drawn.includes(sprite),'not drawn on game canvas: '+sprite);
      assert.ok(result.sounds.includes(cast.sound),'not played through Web Audio: '+cast.sound);
      await page.keyboard.press('Space');
      assert.equal(await page.evaluate(() => run.activeSkill),null,'cooldown allowed another UI cast');
      if (id===0) {
        assert.equal(result.cooldown,15,'destruction must start the full cooldown');
        const button=page.locator('#cast');
        await page.evaluate(()=>{run.t=run.squad[0].skillReadyAt;updateHud()});
        await button.tap();
        await page.evaluate(()=>{
          run.t+=20;
          hitSquadMember(run.enemies[0],run.squad[0],routes[run.floor],run.activeSkill.hp-1);
          updateHud();
        });
        assert.equal(await page.locator('#cast-name').textContent(),'벙커 해제');
        const blasts=()=>page.evaluate(()=>run.effects.filter(fx=>fx.skillFx==='blast').length);
        const before=await blasts();
        await button.tap();
        assert.equal(await blasts(),before,'manual release caused an explosion');
        assert.equal(await page.locator('#cast-status').textContent(),'10초');
        await page.evaluate(()=>{run.t=run.squad[0].skillReadyAt-.01;updateHud()});
        assert.ok(await button.isDisabled());
        await page.keyboard.press('Space');
        assert.equal(await page.evaluate(()=>run.activeSkill),null);
        await page.evaluate(()=>{run.t=run.squad[0].skillReadyAt;updateHud()});
        await page.keyboard.press('Space');
        assert.ok(await page.evaluate(()=>run.activeSkill?.hp===squadSkillDefs[0].durability));
        await button.tap();
      }
    }
    await page.evaluate(() => { skillUI.setup(); shoot(run.squad[3]); });
    assert.deepEqual(await page.evaluate(() => skillUI.sounds),['lob']);
    await party.nth(1).tap();
    const impact = await page.evaluate(() => {
      skillUI.sounds.length=0;
      for (let f=0;f<85;f++) update(1/60);
      return {damage:run.enemies.map(e=>e.max-e.hp),sounds:skillUI.sounds};
    });
    assert.equal(impact.damage.length,2);
    assert.ok(impact.damage.every(damage=>damage>0));
    assert.ok(!impact.sounds.includes('grenade'),'outgoing leader played grenade impact');
    await page.locator('#pause').tap();
    await page.locator('#homebtn').tap();
    await page.locator('#start:enabled').tap();
    await page.locator('#replace-confirm').tap();
    assert.deepEqual(await page.evaluate(() => run.squad.map(m=>squadSkillCooldown(m.id))),[0,0,0,0,0]);
    assert.deepEqual(await page.evaluate(() => skillUI.roster()),[1,2,3]);
    await party.nth(2).tap();
    assert.ok(await page.locator('#cast').isDisabled(),'new sortie retained the previous test loadout');
    await page.evaluate(()=>skillUI.equipBase());
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => run.activeSkill?.id),2);
    const crossing = await page.evaluate(() => {
      Object.assign(run,TransitKit.stairPoint(SURFACE.exits[0],TransitKit.stairLength*.61));
      update(1/60);
      return {floor:run.floor,cast:run.activeSkill,cooldown:squadSkillCooldown(2)};
    });
    assert.equal(crossing.floor,'metro');
    assert.equal(crossing.cast,null,'skill continued on a different floor');
    assert.ok(crossing.cooldown>0);
    assert.deepEqual(errors,[]);
    console.log('Mobile tap/Space casts across two selected trios, real draws/audio, pause, bunker movement lock, tag, restart and stairs passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode=1; });
