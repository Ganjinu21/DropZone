const dragControl=require('./drag-control.cjs');
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
      localStorage.setItem('dropzone.developer-mode','false');
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
    await dragControl(page,page.locator('#cast'));
    assert.ok(await page.evaluate(()=>!run.activeSkill));
    await page.evaluate(() => {
      window.skillUI = {
        sounds: [], drawn: new Set(),
        roster() { return run.squad.filter(member => member.deployed).map(member => member.id); },
        equipBase() {
          const member=run.squad[run.lead];
          run.talents[skillRoutes[member.id]+'Skill']=true;
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
          if (skill.id === 0) stick={x:0,y:0,dx:1,dy:0};
          for (let frame=0; run.activeSkill && frame<600; frame++) {
            if(skill.id===0 && frame===390)hitSquadMember(run.enemies[0],run.squad[0],routes[run.floor],skill.hp);
            if(!run.activeSkill)break;
            update(1/60);
            if (frame%5===0) render();
          }
          stick=null;
          return {start, finish:[run.x,run.y], ended:!run.activeSkill, cooldown:squadSkillCooldown(skill.id),
            drawn:[...this.drawn], sounds:this.sounds.slice()};
        }
      };
      // Capture real draws and decoded audio starts; a populated asset list alone
      // wouldn't detect a missing render hook or a sound played by a benched leader.
      const sprites = new Map(Object.keys(skillArt).map(key => [art[key],key]));
      for(const role of operatorRoles.filter(Boolean)){
        for(const part of recruitParts)sprites.set(art[role+'Recruit'+part],role);
      }
      sprites.set(art.ravenRecruitspecial,'ravenSpin');
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
      {sound:'cannon', sprites:['bunkerDeploy','bulkRounds']},
      {sound:'smgA', sprites:['ravenSpin','ravenMuzzle','ravenFlight']},
      {sound:'pierce', sprites:['lynx','lynxBeam','lynxPierce']},
      {sound:'burst', sprites:['hammer','hammerFx','hammerBlast']}
    ];
    for (const [id,cast] of expected.entries()) {
      if (id===3) {
        await page.locator('#pause').tap();
        await page.locator('#homebtn').tap();
        await launch(page,[3,1,2]);
      } else if (id) await dragControl(page,party.nth(id));
      assert.equal(await page.evaluate(() => run.lead),id);
      const roster = await page.evaluate(() => skillUI.roster());
      assert.equal(roster.length,3);
      assert.ok(roster.includes(id));
      await page.evaluate(() => skillUI.setup());
      await dragControl(page,page.locator('#cast'));
      assert.equal(await page.evaluate(() => run.activeSkill?.id),id);
      if (id===0) {
        await page.locator('#pause').tap();
        assert.ok(await page.locator('#cast').isHidden());
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
      await dragControl(page,page.locator('#cast'));
      assert.equal(await page.evaluate(() => run.activeSkill),null,'cooldown allowed another UI cast');
      if (id===0) {
        assert.equal(result.cooldown,15,'destruction must start the full cooldown');
        const button=page.locator('#cast');
        await page.evaluate(()=>{run.t=run.squad[0].skillReadyAt;updateHud()});
        await dragControl(page,button);
        await page.evaluate(()=>{
          run.t+=20;
          tickSquadSkills(bunkerDeployTime);
          if(run.activeSkill.age>bunkerBoardingAt || run.activeSkill.beat!==0)
            throw Error('The shield doors closed before boarding');
          for(let i=0;i<90;i++){moveFormation(1/60);tickSquadSkills(1/60)}
          if(run.activeSkill.phase!=='fire' || !run.lineup.filter(id=>id!==0).every(id=>run.activeSkill.entered[id]))
            throw Error('The bunker must wait for the two squadmates to board');
          hitSquadMember(run.enemies[0],run.squad[0],routes[run.floor],run.activeSkill.hp-1);
          updateHud();
        });
        assert.equal(await page.locator('#cast-name').textContent(),'벙커 해제');
        const blasts=()=>page.evaluate(()=>run.effects.filter(fx=>fx.skillFx==='blast').length);
        const before=await blasts();
        await dragControl(page,button);
        assert.equal(await blasts(),before,'manual release caused an explosion');
        assert.equal(await page.locator('#cast-status').textContent(),'접는 중');
        assert.ok(await button.isDisabled());
        assert.ok(await page.evaluate(()=>{
          const beat=run.activeSkill.beat,readyAt=run.squad[0].skillReadyAt;
          tickSquadSkills(.3);
          if(activateSquadSkill() || run.activeSkill.beat!==beat)return false;
          tickSquadSkills(bunkerDeployTime/1.25);
          return !run.activeSkill && run.squad[0].skillReadyAt===readyAt;
        }));
        await page.evaluate(()=>{run.t=run.squad[0].skillReadyAt-.01;updateHud()});
        assert.ok(await button.isDisabled());
        await dragControl(page,page.locator('#cast'));
        assert.equal(await page.evaluate(()=>run.activeSkill),null);
        await page.evaluate(()=>{run.t=run.squad[0].skillReadyAt;updateHud()});
        await dragControl(page,page.locator('#cast'));
        assert.ok(await page.evaluate(()=>run.activeSkill?.hp===squadSkillDefs[0].durability));
        await page.evaluate(()=>tickSquadSkills(.24));
        await dragControl(page,button);
        assert.ok(await page.evaluate(()=>{
          const partial=run.activeSkill.foldTime;
          tickSquadSkills(.2);
          return partial===.24 && !run.activeSkill;
        }));
      }
    }
    await page.evaluate(() => { skillUI.setup(); shoot(run.squad[3]); });
    assert.deepEqual(await page.evaluate(() => skillUI.sounds),['rocket-launch']);
    await dragControl(page,party.nth(1));
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
    await page.locator('#ask-replace').tap();await page.locator('#replace-confirm').tap();
    assert.deepEqual(await page.evaluate(() => run.squad.map(m=>squadSkillCooldown(m.id))),[0,0,0,0,0]);
    assert.deepEqual(await page.evaluate(() => skillUI.roster()),[1,2,3]);
    await dragControl(page,party.nth(2));
    assert.ok(await page.locator('#cast').isDisabled(),'new sortie retained the previous test loadout');
    await page.evaluate(()=>skillUI.equipBase());
    await dragControl(page,page.locator('#cast'));
    assert.equal(await page.evaluate(() => run.activeSkill?.id),2);
    const crossing = await page.evaluate(() => {
      Object.assign(run,TransitKit.stairPoint(cityMaps.surface.exits[0],TransitKit.stairLength*.61));
      update(1/60);
      return {floor:run.floor,cast:run.activeSkill,cooldown:squadSkillCooldown(2)};
    });
    assert.equal(crossing.floor,'metro');
    assert.equal(crossing.cast,null,'skill continued on a different floor');
    assert.ok(crossing.cooldown>0);
    // Existing partially trained developer saves should be complete on the next load.
    const testPage=await browser.newPage({viewport:{width:402,height:874},isMobile:true,hasTouch:true});
    testPage.on('pageerror',error=>errors.push(error.message));
    await testPage.addInitScript(()=>{
      window.requestAnimationFrame=()=>0;
      if(localStorage.getItem('dropzone.dev.armory.v1'))return;
      localStorage.setItem('dropzone.dev.armory.v1',JSON.stringify({diamonds:17,bossTokens:2,talentRanks:{command:1,'raven-1':1}}));
      localStorage.setItem('dropzone.armory.v1',JSON.stringify({diamonds:23,bossTokens:1,talentRanks:{command:1,'bulk-1':1}}));
    });
    await testPage.goto(pathToFileURL(path.join(__dirname,'../game/index.html')).href);
    await testPage.locator('#start:enabled').waitFor();
    await testPage.locator('#hub-talents').tap();
    const tree=await testPage.evaluate(()=>{
      const nodes=TalentTree.nodes.filter(n=>n.costs.length);
      return {ranks:nodes.map(n=>TalentTree.status(n.id).rank),limits:nodes.map(n=>n.costs.length),
        shown:document.querySelectorAll('#talent-board .is-bought').length,secret:TalentTree.status('classified-1').rank,
        balance:[armory.diamonds,armory.bossTokens]};
    });
    assert.deepEqual(tree.ranks,tree.limits);assert.equal(tree.shown,tree.limits.length);
    assert.equal(tree.secret,0);assert.deepEqual(tree.balance,[17,2]);
    assert.ok(await testPage.locator('#talent-buy').isDisabled());
    await testPage.locator('#hub-home').tap();
    await testPage.locator('#start:enabled').tap();
    await testPage.locator('#equip').tap();
    await testPage.locator('#hud').waitFor();
    await testPage.locator('#rank-test summary').tap();
    for(const tier of [0,4]){
      for(const id of [0,1,2,3,4]){
        await testPage.locator('#test-crew').selectOption(String(id));
        await testPage.locator('#test-rank').selectOption(String(tier));
        await testPage.evaluate(()=>{run.t+=60;updateHud()});
        const cast=testPage.locator('#cast');
        assert.ok(await cast.isEnabled());
        await cast.tap();
        const active=await testPage.evaluate(()=>{
          const id=run.lead,skill=id===4?run.cobra:run.activeSkill;
          return {id,live:!!skill,awakened:!!skill?.awakened,phase:skill?.phase,
            trained:!!run.talents[skillRoutes[id]+'Skill']};
        });
        assert.equal(active.id,id);assert.ok(active.live);assert.equal(active.awakened,tier===4 || id===0);
        assert.equal(active.trained,true);assert.notEqual(active.phase,'retract');
      }
    }
    for(const id of [0,1,2,3,4]){
      await testPage.locator('#test-crew').selectOption(String(id));
      for(const tier of [0,4]){
        await testPage.locator('#test-rank').selectOption(String(tier));
        for(const awakened of [false,true]){
          const button=testPage.locator(awakened?'#test-special':'#test-base');
          assert.ok(await button.isEnabled());
          await button.tap();
          const cast=await testPage.evaluate(()=>{
            const id=run.lead,skill=id===4?run.cobra:run.activeSkill;
            for(let i=0;i<84;i++){
              run.t+=1/60;moveFormation(1/60);tickSquadSkills(1/60);updateRadioSupport(1/60);
            }
            render();
            const saved=decodeBattle(encodeBattle()).state;
            const restored=id===4?saved.cobra:saved.activeSkill;
            return {awakening:skill?.awakened,advanced:skill.age>0,
              saved:restored?.awakened,rank:run.squad[id].weapon.rank,trained:!!run.talents[skillRoutes[id]+'Skill']};
          });
          assert.deepEqual(cast,{awakening:awakened,advanced:true,saved:awakened,rank:tier?'S+':'C',trained:true});
          assert.ok(await button.isDisabled(),'a second tap must not restart the current preview');
        }
      }
      await testPage.evaluate(()=>{
        for(let i=0;i<720;i++){
          run.t+=1/60;tickSquadSkills(1/60);updateRadioSupport(1/60);
        }
        updateHud();
      });
    }
    await testPage.locator('#rank-test summary').tap();
    await testPage.locator('#pause').tap();await testPage.locator('#homebtn').tap();
    await testPage.locator('#shop').tap();await testPage.locator('#profile-mode').tap();
    await testPage.locator('#start:enabled').waitFor();
    assert.deepEqual(await testPage.evaluate(()=>[developerMode,armory.talentRanks,armory.diamonds,armory.bossTokens]),
      [false,{command:1,'bulk-1':1},23,1]);
    await testPage.locator('#shop').tap();await testPage.locator('#profile-mode').tap();
    await testPage.locator('#start:enabled').waitFor();
    assert.ok(await testPage.evaluate(()=>developerMode && TalentTree.nodes.every(n=>(armory.talentRanks[n.id]||0)===n.costs.length)));
    await testPage.close();
    assert.deepEqual(errors,[]);
    console.log('Mobile drag casts, test HUD taps, and both saved skill previews for all five operators with C and S+ gear passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode=1; });
