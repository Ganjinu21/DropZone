const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:914,height:412},isMobile:true,hasTouch:true});
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      const keys=['pistol-0','smg-0','sniper-0','rocket-0','ar-0'];
      localStorage.setItem('dropzone.armory.v1',JSON.stringify({diamonds:0,owned:keys}));
      localStorage.setItem('dropzone.equipment.v2',JSON.stringify(keys.map(weapon=>({weapon}))));
    });
    await page.goto(pathToFileURL(path.resolve('game/index.html')).href);
    const launch=require('./select-test-squad.cjs');
    await launch(page);
    await page.waitForFunction(()=>skillAudio.buffers.size===10);
    const result = await page.evaluate(()=>{
      const foes=(...cells)=>cells.map(([x,y])=>({x,y,type:0,hp:500,max:500,speed:0,phase:0,hit:0,flip:1}));
      const startAt=(id,enemies,variant=3)=>{
        cancelSquadSkill();
        if (run.lead!==id) setLeader(id);
        run.x=1280; run.y=1004;
        for (const m of run.squad) Object.assign(m,{x:run.x,y:run.y,cool:9,hurt:0,flip:1,moving:false});
        run.enemies=enemies; run.effects=[]; run.cues=[]; run.marks=[]; run.mark=null;
        const member=run.squad[id];member.weapon=gearByKey.get(weaponFamilies[id]+'-'+variant);
        member.loadout={...member.loadout,weapon:member.weapon.key};
        member.burstRecharges=[];
        run.squad[id].gear.critChance=0;run.squad[id].gear.evadeChance=0;
        run.squad[id].skillReadyAt=0;
      };
      const simulate=(seconds,onStep=()=>{})=>{
        const steps=Math.round(seconds*100);
        for (let i=0;i<steps;i++) {
          const dt=.01;
          run.t+=dt;tickSquadSkills(dt);advanceRounds(dt);
          onStep();
          run.effects=run.effects.filter(effect=>(effect.age+=dt)<effect.duration);
        }
      };
      window.skillFixture={foes,startAt,simulate};
      const result={};
      result.forms=['-0','-1','-3','-3@5','-5','-5@5','-6'].map(suffix=>
        weaponSkillForm(gearByKey.get('smg'+suffix)));
      // Capture the actual flight vector of each directional shot, including empty sectors.
      startAt(0,foes([1370,1004]));
      activateSquadSkill();
      const bunker=run.activeSkill, lock=squadSkillLocked();
      const hp=run.squad[0].hp;
      hitSquadMember(run.enemies[0],run.squad[0],routes.surface,99);
      const marks=new Set(),sectors=new Set();
      simulate(2.25,()=>{
        for(const shot of run.marks){
          marks.add(shot);
          const ux=Math.cos(shot.angle),uy=Math.sin(shot.angle);
          if ((shot.tx-shot.x)*ux+(shot.ty-shot.y)*uy<=0) throw Error('Backwards bunker round');
          sectors.add(shot.x+','+shot.y);
        }
      });
      result.bulk={lock,protected:hp===run.squad[0].hp,shots:marks.size,sectors:sectors.size,beat:bunker.beat,
        hurt:run.enemies[0].hp<500};
      cancelSquadSkill();
      result.cooldownBlocks=!activateSquadSkill();
      startAt(1,foes([1370,1004],[1200,1004]));
      activateSquadSkill();
      const raven=run.activeSkill,echoes=new Set(),hands=new Set(),phases=new Set();
      const bursts=[];
      let previousBeat=0;
      simulate(raven.duration+.4,()=>{
        if(raven.beat>previousBeat){
          if(bursts.at(-1)?.cel!==raven.poseCel)bursts.push({cel:raven.poseCel,shots:0});
          bursts.at(-1).shots+=raven.beat-previousBeat;
          previousBeat=raven.beat;
        }
        phases.add(raven.phase);
        if(raven.beat>0)hands.add(run.squad[1].shotColumn);
        for(const fx of run.effects){
          if(fx.skillFx==='spinEcho')echoes.add(fx);

        }
      });
      result.raven={phases:[...phases],echoes:echoes.size,hands:hands.size,shots:raven.beat,
        bursts:bursts.map(b=>b.shots),damage:run.enemies.map(e=>500-e.hp)};
      const ring=Array.from({length:24},(_,i)=>{
        const angle=i*TAU/24;
        return [1280+95*Math.cos(angle),1004+95*Math.sin(angle)];
      });
      startAt(1,foes(...ring));activateSquadSkill();simulate(1.0);
      result.raven.ringHits=run.enemies.filter(e=>e.hp<500).length;
      startAt(1,foes([1280,997]));activateSquadSkill();simulate(.29);
      result.raven.windup=run.activeSkill.beat===0 && run.marks.length===0 && run.enemies[0].hp===500 && run.activeSkill.poseCel===63;
      simulate(.06);
      const slowed=run.enemies[0],firstHp=slowed.hp;
      simulate(.12);const beforeSecond=slowed.hp;
      simulate(.07);result.raven.fastHits=slowed.hp<beforeSecond && firstHp===beforeSecond;
      result.raven.slow=ravenMovementScale(slowed);
      result.raven.chances=[105,105.1,155.1,210.1,265.1,315,315.1].map(ravenHitChance);
      cancelSquadSkill();simulate(.85);
      result.raven.recovered=ravenMovementScale(slowed);
      result.raven.insideRingHit=run.enemies[0].hp<500;
      startAt(2,foes([1370,1004],[1410,1008],[1440,1011]));
      activateSquadSkill();
      const beams=new Set();
      simulate(2.6,()=>{for(const fx of run.effects)if(fx.skillFx==='railBeam')beams.add(fx)});
      result.lynx={beams:beams.size,damaged:run.enemies.map(e=>500-e.hp)};
      startAt(1,foes(),6);
      const chargeStart=run.t,casts=[];
      for(let n=0;n<3;n++){
        casts.push(activateSquadSkill());simulate(.2);cancelSquadSkill();
      }
      result.charges={casts,blocked:!activateSquadSkill(),deadlines:ravenPendingCharges().map(t=>Math.round(t-chargeStart))};
      run.t=chargeStart+10;
      result.charges.firstRefill=activateSquadSkill() && ravenPendingCharges().length===3;
      const [decoy,boss]=foes([1210,1004],[1400,1004]);
      Object.assign(boss,{boss:true,type:2,hp:50000,max:50000});
      startAt(2,[decoy,boss],6);
      activateSquadSkill();simulate(.95);
      result.focus={charged:boss.hp===boss.max && run.activeSkill.phase==='charge'};
      const focusedBeams=new Set();
      simulate(1.7,()=>{for(const fx of run.effects)if(fx.skillFx==='railBeam' && fx.awakened)focusedBeams.add(fx)});
      Object.assign(result.focus,{beams:focusedBeams.size,centered:run.mark===boss,damage:boss.max-boss.hp,decoy:decoy.hp});
      pause();
      return result;
    });
    await page.click('#homebtn');
    await launch(page,[3,1,2]);
    Object.assign(result,await page.evaluate(()=>{
      const {foes,startAt,simulate}=window.skillFixture;
      const result={};
      const targets=foes([1380,1004],[1387,1013]);
      startAt(3,targets);
      shoot(run.squad[3]);
      const shell=run.effects.find(e=>e.skillFx==='shellArc');
      simulate(.15);
      result.hammer={before:targets[0].hp,travel:shell.duration};
      simulate(.75);
      result.hammer.impact=targets.map(e=>500-e.hp);
      activateSquadSkill();
      const shots=new Set(),blasts=new Set();
      simulate(3.85,()=>{
        for(const fx of run.effects){
          if(fx.large && fx.skillFx==='shellArc')shots.add(fx);
          if(fx.large && fx.skillFx==='blast')blasts.add(fx);
        }
      });
      result.hammer.salvo=[shots.size,blasts.size];
      const [stronghold]=foes([1380,1004]);
      stronghold.hp=stronghold.max=100000;
      startAt(3,[stronghold],6);
      activateSquadSkill();
      const rockets=new Set(),blastSites=new Set();
      simulate(3.85,()=>{
        for(const effect of run.effects){
          if(effect.awakened && effect.skillFx==='shellArc')rockets.add(effect);
          if(effect.awakened && effect.skillFx==='blast')blastSites.add(effect.x+','+effect.y);
        }
      });
      result.siege={rockets:rockets.size,apertures:new Set([...rockets].map(e=>e.salvoIndex)).size,
        sites:blastSites.size,hurt:stronghold.hp<stronghold.max};
      // A grenade that was already launched may finish on its original floor after a tag,
      // but cannot hurt the newly active floor or play its originating operator's audio there.
      startAt(3,foes([1380,1004]));
      shoot(run.squad[3]);
      const old={effects:run.effects,marks:[],enemies:run.enemies,crystals:[],cues:[]};
      const oldShell=old.effects[0];
      oldShell.age=oldShell.duration-.01;
      run.enemies=foes([1380,1004]);run.effects=[];setLeader(1);
      const names=[];
      const play=skillAudio.play;
      skillAudio.play=function(...args){names.push(args);return play.apply(this,args)};
      try {advanceRounds(.02,old,'surface')} finally {skillAudio.play=play}
      result.oldFloor={oldHp:old.enemies[0].hp,newHp:run.enemies[0].hp,sounds:names.length};
      mode='qa';
      return result;
    }));
    console.log(JSON.stringify(result));
    assert.deepEqual(result.forms,[0,0,1,1,1,1,2]);
    assert.deepEqual(result.charges,{casts:[true,true,true],blocked:true,deadlines:[10,20,30],firstRefill:true});
    assert.deepEqual(result.focus,{charged:true,beams:1,centered:true,damage:7308,decoy:500});
    assert.ok(result.siege.rockets===12 && result.siege.apertures===4 && result.siege.sites>=3 && result.siege.hurt);
    assert.equal(result.bulk.lock,true);
    assert.equal(result.bulk.protected,true);
    assert.ok(result.bulk.shots>=10 && result.bulk.sectors===4 && result.bulk.hurt);
    assert.equal(result.cooldownBlocks,true);
    assert.deepEqual(result.raven.phases,['spin']);
    assert.ok(result.raven.echoes>=8 && result.raven.hands===2 && result.raven.shots===96);
    assert.deepEqual(result.raven.bursts,Array(32).fill(3));
    assert.ok(result.raven.damage.every(d=>d>0));
    assert.equal(result.raven.ringHits,24);
    assert.equal(result.raven.insideRingHit,true);
    assert.equal(result.raven.fastHits,true);assert.equal(result.raven.windup,true);
    assert.deepEqual(result.raven.chances,[1,.9,.8,.7,.6,.6,0]);
    assert.equal(result.raven.slow,.65);assert.equal(result.raven.recovered,1);
    assert.equal(result.lynx.beams,4);
    assert.ok(result.lynx.damaged.every(d=>d>=58));
    assert.equal(result.hammer.before,500);
    assert.deepEqual(result.hammer.impact,[55,55]);
    assert.deepEqual(result.hammer.salvo,[8,8]);
    assert.deepEqual(result.oldFloor,{oldHp:445,newHp:500,sounds:0});
    assert.deepEqual(errors,[]);
  } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
