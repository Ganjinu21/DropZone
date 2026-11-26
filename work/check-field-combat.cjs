const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || undefined});
  try {
    const page = await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
    const errors = [];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;localStorage.setItem('dropzone.developer-mode','false');localStorage.setItem('dropzone.squad.v1','[0,4,3]')});
    await page.goto(pathToFileURL(path.resolve(__dirname,'../game/index.html')).href);
    await page.locator('#start:enabled').tap();
    await page.locator('#hud').waitFor();
    const field = await page.evaluate(() => {
      const need=(condition,message)=>{if(!condition)throw Error(message)};
      const nav=routes.surface,bulk=run.squad[0],chief=run.squad[4],hammer=run.squad[3];
      Object.assign(run,{x:1257,y:1004,heading:0,enemies:[],remaining:999});
      Object.assign(bulk,{x:1280,y:1004});
      nav.aimAt(run.x,run.y);
      const enemy=(x,y)=>({x,y,type:0,hp:3000,max:3000,speed:0,phase:0,hit:0,flip:1,contactDamage:12});
      const target=enemy(run.x+65,run.y);
      run.enemies=[target];
      initializeRadioTeam();
      for(const ally of run.radioTeam){ally.x=run.x;ally.y=run.y}
      const stops=[new Set(),new Set()];
      for(let i=0;i<360;i++){
        updateRadioSupport(1/60);
        run.radioTeam.forEach((a,j)=>{
          need(dist(a,run)<=70,'Patrol left its radius');
          need(!nav.blocked(a.x,a.y,4),'Patrol crossed a wall');
          stops[j].add(Math.round(a.x/5)+','+Math.round(a.y/5));
        });
      }
      need(stops.every(a=>a.size>=5) && target.hp<target.max,'Support did not patrol and fire');
      Object.assign(run.radioTeam[0],{x:run.x+120,y:run.y});
      for(let i=0;i<60;i++)updateRadioSupport(1/60);
      need(dist(run.radioTeam[0],run)<80,'Support did not return');
      // Force XP thresholds, then choose only cards offered by the actual level-up flow.
      // When Bulk is absent, take a repair kit or strengthen another deployed weapon.
      function levelUp(){run.xp=run.need;update(.001);need(mode==='upgrade','No level-up selection')}
      setLeader(4);need(!activateSquadSkill() && !run.cobra,'C-grade Cobra unlocked');
      setLeader(0);need(!activateSquadSkill() && $('cast').disabled,'Starting bunker unlocked');
      const baseDamage=basicHitDamage(bulk,basicWeaponProfile(bulk,true));
      for(let level=0;weaponRank(0)<3 && level<50;level++){
        levelUp();
        need(offers.length===3 && new Set(offers).size===3,'Invalid card count');
        need(offers.every(k=>k>=fieldKit || run.lineup.includes(Math.floor(k/2))),'Reserve upgrade offered');
        need(!offers.some(key=>key<fieldKit && key%2),'Obsolete awakening card');
        const index=offers.indexOf(0);
        choose(index>=0?index:offers.findIndex(k=>k>=fieldKit));applyUpgrade();
      }
      need(weaponRank(0)===3 && basicHitDamage(bulk,basicWeaponProfile(bulk,true))===Math.round(baseDamage*1.6),'Three weapon boosts');
      need(!activateSquadSkill() && $('cast').disabled,'Run boost unlocked C-grade bunker');
      bulk.weapon=gearByKey.get('pistol-3');bulk.loadout={...bulk.loadout,weapon:bulk.weapon.key};
      updateHud();need($('cast').disabled,'Weapon grade bypassed bunker training');
      run.talents.bulkSkill=true;updateHud();need(!$('cast').disabled,'Trained bunker unavailable');
      need(activateSquadSkill(),'Bunker did not deploy');
      const fort=run.activeSkill;
      for(let i=0;i<400;i++){moveFormation(.02);updateRadioSupport(.02);tickSquadSkills(.02)}
      need(run.radioTeam.every((m,i)=>dist(m,fort.radioCover[i])<3),'Support did not reach cover');
      need(fort===run.activeSkill && fort.phase==='fire','Bunker timed out');
      const before=bulk.hp;
      hitSquadMember(target,bulk,nav);
      hitSquadMember(target,bulk,nav);
      need(fort.hp===fort.maxHp-12,'Contact damage cadence');
      const health=fort.hp;
      run.xp=run.need;update(.01);
      need(mode==='upgrade' && run.activeSkill===fort,'XP interrupted bunker');
      choose(offers.findIndex(k=>k>=fieldKit));applyUpgrade();
      need(run.activeSkill===fort && fort.hp===health,'Upgrade reset bunker durability');
      switchLead(4);need(run.lead===0,'Tag exited bunker');
      beginWave(run.wave+1);need(run.activeSkill===fort,'Wave transition removed bunker');
      Object.assign(target,{x:fort.x+18,y:fort.y});run.enemies=[target];
      const far=enemy(fort.x+140,fort.y);
      run.enemies.push(far);
      const allyHP=run.radioTeam.map(a=>a.hp);
      hitSquadMember(target,bulk,nav,health);
      need(!run.activeSkill && target.x>fort.x+30 && far.x===fort.x+140,'Collapse did not push near enemies');
      need(run.effects.some(e=>e.skillFx==='blast') && bulk.hp>=before && run.radioTeam.every((a,i)=>a.hp===allyHP[i]),'Explosion or occupant protection');
      hitSquadMember(target,hammer,nav,10000); // collapse grants brief exit protection
      need(hammer.hp>0,'Immediate exit damage');
      hammer.gear.evadeChance=0;hammer.hurt=0;hitSquadMember(target,hammer,nav,10000);
      need(hammer.hp===0 && hammer.downFloor==='surface','Downed position not recorded');
      Object.assign(bulk,{x:hammer.x,y:hammer.y,moving:false});run.moving=false;
      updateRescues(2.9);need(hammer.hp===0,'Early revive');
      run.moving=true;updateRescues(.01);run.moving=false;
      need(hammer.reviveTime===0,'Movement did not interrupt revive');
      hammer.downFloor='metro';updateRescues(3);need(hammer.hp===0,'Revived through a floor');
      hammer.downFloor='surface';bulk.x+=55;updateRescues(3);need(hammer.hp===0,'Revived at a distance');
      bulk.x=hammer.x;updateRescues(2.9);updateRescues(.1);
      need(Math.abs(hammer.hp-hammer.max*.3)<.001,'Incorrect revived health');
      function getOffer(key){
        for(let i=0;i<100;i++){
          openUpgrade();if(offers.includes(key)){choose(offers.indexOf(key));return}
        }
        throw Error('Missing squad upgrade');
      }
      chief.hp=chief.max*.25;run.radioTeam[0].hp=0;
      getOffer(fieldKit);applyUpgrade();
      need(Math.abs(chief.hp-chief.max*.75)<.001 && run.radioTeam[0].hp===0,'Field kit healing');
      const hpRank=run.up[vitality];getOffer(vitality);applyUpgrade();
      need(chief.max===Math.round(chief.baseMax*(1+.3*(hpRank+1))) &&
           Math.abs(chief.hp/chief.max-.75)<.0001 && run.radioTeam[0].hp===0,'Maximum HP and downed states');
      while(run.up[firepower]<3){
        getOffer(firepower);applyUpgrade();
        const shot=enemy(100,100);damageEnemy(shot,100);
        need(Math.abs(shot.max-shot.hp-(100+run.up[firepower]*10))<.001,'Firepower multiplier');
      }
      run.crystals=[{x:run.x+30,y:run.y,val:2},{x:run.x+90,y:run.y,val:3},{x:run.x+400,y:run.y,val:7}];
      const xp=run.xp;getOffer(magnet);applyUpgrade();
      need(run.xp===xp+5 && run.crystals.length===1 && run.magnetUntil===run.t+magnetSeconds,'Instant local magnet collection');
      setLeader(4);
      run.talents.cctSkill=true;chief.weapon=gearByKey.get('ar-5');chief.loadout={...chief.loadout,weapon:chief.weapon.key};
      need(weaponRank(4)===0 && activateSquadSkill() && run.cobra && !run.cobra.awakened,'S-grade Cobra unavailable without run boosts');
      run.swap=0;switchLead(0);
      need(run.lead===0 && run.cobra,'CCT support lost after lead switch');
      for(const id of run.lineup)run.up[id*2]=3;
      openUpgrade();
      need(offers.length===3 && new Set(offers).size===3 && !offers.includes(firepower),'Exhausted pool or damage cap');
      return {patrol:stops.map(a=>a.size),bunkerHP:health,revived:hammer.max*.3};
    });
    for(const width of [320,393,430]){
      await page.setViewportSize({width,height:852});
      const cards=await page.locator('#cards .card').evaluateAll(nodes=>nodes.map(n=>{
        const b=n.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,scroll:n.scrollWidth,client:n.clientWidth};
      }));
      assert.equal(cards.length,3);
      assert.ok(cards.every((b,i)=>b.x===cards[0].x && b.x>=0 && b.right<=width && (!i || b.y>=cards[i-1].bottom) && b.scroll<=b.client+1));
    }
    assert.equal(await page.getByRole('heading',{name:'전투 증강 선택'}).isVisible(),true);
    if(process.env.PREVIEW_DIR){
      await page.setViewportSize({width:393,height:852});
      await page.screenshot({animations:'disabled',path:path.join(process.env.PREVIEW_DIR,'Field-Augments.png')});
    }
    await page.locator('.card').first().tap();await page.locator('#equip').tap();
    assert.equal(await page.locator('#hud').isVisible(),true);
    assert.deepEqual(errors,[]);
    console.log('Field combat, rescue and mobile augment layout passed.',field);
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
