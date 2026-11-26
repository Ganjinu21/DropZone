const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});
  try {
    const page = await browser.newPage({viewport:{width:914,height:412},isMobile:true,hasTouch:true});
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.addInitScript(()=>{
      localStorage.setItem('dropzone.developer-mode','false');
      const keys=['pistol-0','smg-0','sniper-0','rocket-0','ar-0'];
      localStorage.setItem('dropzone.armory.v1',JSON.stringify({diamonds:0,owned:keys}));
      localStorage.setItem('dropzone.equipment.v2',JSON.stringify(keys.map(weapon=>({weapon}))));
    });
    await page.goto(pathToFileURL(path.resolve('game/index.html')).href);
    await require('./select-test-squad.cjs')(page);
    await page.waitForFunction(()=>gunAudio.buffers.has('rocket-launch') && Object.keys(COMBAT_SOUNDS).every(name=>gunAudio.buffers.has(name)));
    const results = await page.evaluate(()=>{
      // Run controlled encounters on the actual street, with the same actor,
      // projectile, wall, animation socket, and audio code as a live update.
      mode='qa';
      run.t=5;run.floor='surface';run.marks=[];run.cues=[];run.effects=[];
      run.squad.forEach(m=>Object.assign(m,{x:1155,y:950,flip:1,moving:false,aimSector:0}));
      for(const m of run.squad)Object.assign(m.gear,{critChance:0,evadeChance:0});
      const barrelY=combatMuzzle(run.squad[2],1).y;
      const foe=(dx,type=0)=>({type,x:1155+dx,y:barrelY+enemyChest[type],
        hp:120,max:120,phase:0,hit:0,flip:-1,speed:0});
      const setTargets=(...enemies)=>{run.enemies=enemies;run.marks=[]};
      const [bulk,raven,lynx]=run.squad;
      setLeader(1);
      const one=foe(85);
      setTargets(one);
      const beat=[];
      for(let i=0;i<4;i++){shoot(raven);beat.push([raven.shotColumn,raven.cool])}
      const early=one.hp;
      advanceRounds(.004);
      const inFlight=one.hp;
      advanceRounds(.3);
      const afterBurst=one.hp;
      setLeader(2);
      const heavy=foe(85,2), far=foe(119), further=foe(157), decoy=foe(45);
      decoy.y+=49;
      setTargets(heavy,far,further,decoy);
      shoot(lynx);const heavyMarked=run.mark===heavy;
      advanceRounds(.4);
      const pierced=[heavy.hp,far.hp,further.hp];
      run.up[4]=1;
      setTargets(heavy,far,further);
      shoot(lynx);advanceRounds(.4);
      const rankedHit=[far.hp,further.hp];
      run.up[4]=0;
      const supports=[];
      for (const member of [bulk,raven,lynx]) {
        setLeader((member.id+1)%3);
        const a=foe(66),b=foe(99);setTargets(a,b);
        shoot(member);advanceRounds(.35);
        supports.push([member.shotColumn,member.cool,a.hp,b.hp]);
      }
      setLeader(0);run.heading=0;run.shield=1;
      const initial=bulk.hp;
      absorbContact({...foe(11),y:bulk.y},bulk,routes.surface);
      const front=initial-bulk.hp;
      const before=bulk.hp;
      absorbContact({...foe(-11),y:bulk.y},bulk,routes.surface);
      const rear=before-bulk.hp;
      setLeader(1);
      const close=foe(8);setTargets(close);shoot(raven);advanceRounds(.016);
      return {beat,early,inFlight,afterBurst,heavyMarked,pierced,rankedHit,supports,front,rear,pointBlank:close.hp};
    });
    assert.deepEqual(results.beat.map(([c])=>c),[1,3,1,3]);
    assert.deepEqual(results.beat.map(([,delay])=>delay),[.068,.068,.49,.068]);
    assert.deepEqual([results.early,results.inFlight,results.afterBurst],[120,120,76]);
    assert.equal(results.heavyMarked,true);
    assert.deepEqual(results.pierced,[65,82,120]);
    assert.deepEqual(results.rankedHit,[36,120]);
    assert.deepEqual(results.supports,[[1,1.18,113,120],[1,.068,109,120],[1,1.16,82,82]]);
    assert.ok(Math.abs(results.front-3.6)<.001 && results.rear===8);
    assert.equal(results.pointBlank,109);
    const audio=await page.evaluate(()=>{
      const played=[];
      const original=sound.createBufferSource.bind(sound);
      sound.createBufferSource=()=>{
        const source=original(), start=source.start.bind(source);
        source.start=(...args)=>{
          played.push([...gunAudio.buffers].find(([,buffer])=>buffer===source.buffer)[0]);
          return start(...args);
        };
        return source;
      };
      try {
        mode='play';
        const tag=id=>{
          run.swap=0;
          document.querySelector('#party [data-operator="'+id+'"]').click();
        };
        function volley(member,swapTo=null){
          // Each audio case starts with a fresh magazine.
          member.ammoKey=null;
          const enemy={type:0,x:member.x+85,y:member.y,hp:120,max:120,phase:0,hit:0,flip:-1,speed:0};
          run.enemies=[enemy];run.marks=[];run.effects=[];
          played.length=0;gunAudio.lastImpact=-1;
          shoot(member);
          if(swapTo!==null)tag(swapTo);
          advanceRounds(.4);
          return {played:played.slice(),hit:enemy.hp<120,muzzle:run.effects.some(e=>e.clip?.endsWith('_muzzle'))};
        }
        const salvos=[];
        for(const id of [0,1,2]){
          tag(id);
          for(const member of run.squad)salvos.push(volley(member));
        }
        // In-flight lead rounds and support rounds retain their role across a tag.
        const outgoing=volley(run.squad[2],1);
        const promoted=volley(run.squad[0],0);
        const fresh=volley(run.squad[0]);
        return {salvos,outgoing,promoted,fresh};
      } finally {sound.createBufferSource=original}
    });
    const audible=(...played)=>({played,hit:true,muzzle:true});
    const reserve={played:[],hit:false,muzzle:false};
    assert.deepEqual(audio.salvos,[
      audible('bulk','hit'),audible(),audible(),reserve,reserve,
      audible(),audible('raven-a','hit'),audible(),reserve,reserve,
      audible(),audible(),audible('lynx','hit'),reserve,reserve
    ]);
    assert.deepEqual(audio.outgoing,audible('lynx'));
    assert.deepEqual(audio.promoted,audible());
    assert.deepEqual(audio.fresh,audible('bulk','hit'));
    const armorRolls=await page.evaluate(()=>{
      const member=run.squad[1],random=Math.random;
      const result=[];
      try{
        // Resolve a reserve operator's shot and an unguarded hit on that operator.
        run.lead=2;
        for(const rank of rankedTiers){
          const row={...member.loadout,helmet:'helmet-'+rank.variant,pants:'pants-'+rank.variant};
          const gear=gearStats(1,run.squad.map(m=>m===member?row:m.loadout));
          member.gear=gear;
          for(const succeeds of [true,false]){
            const enemy={x:member.x+8,y:member.y,type:0,hp:100,max:100};
            const floor={cues:[],effects:[]};
            Math.random=()=>gear.critChance+(succeeds?-.00001:0);
            roundImpact({id:1,damage:10,family:'smg',angle:0,hit:new Set(),remaining:1},enemy,0,0,floor);
            const hp=member.hp=member.max;
            run.cues=[];
            Math.random=()=>gear.evadeChance+(succeeds?-.00001:0);
            absorbContact(enemy,member,routes[run.floor],10);
            result.push([100-enemy.hp,hp-member.hp,floor.cues.some(c=>c.kind==='critical'),run.cues.some(c=>c.kind==='evade')]);
          }
        }
      }finally{Math.random=random}
      return result;
    });
    assert.deepEqual(armorRolls,Array.from({length:5},()=>[[15,0,true,true],[10,10,false,false]]).flat());
    assert.deepEqual(errors,[]);
    console.log('Raven cadence, moving rounds, Lynx priority/pierce, support roles, shield facing, point-blank shots, gun audio buffers and leader-only fire/impact across tags passed.');
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
