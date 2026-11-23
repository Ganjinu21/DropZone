const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:914,height:412},isMobile:true,hasTouch:true});
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve('game/index.html')).href);
    await require('./select-test-squad.cjs')(page);
    await page.waitForFunction(()=>gunAudio.buffers.size===7);
    const results = await page.evaluate(()=>{
      // Run controlled encounters on the actual street, with the same actor,
      // projectile, wall, animation socket, and audio code as a live update.
      mode='qa';
      run.t=5;run.floor='surface';run.marks=[];run.cues=[];run.effects=[];
      run.squad.forEach(m=>Object.assign(m,{x:1280,y:1004,flip:1,moving:false}));
      const foe=(dx,type=0)=>({type,x:1280+dx,y:1004+enemyChest[type]-18,
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
      const thirdHit=further.hp;
      const supports=[];
      for (const member of [bulk,raven,lynx]) {
        setLeader((member.id+1)%3);
        const a=foe(66),b=foe(99);setTargets(a,b);
        shoot(member);advanceRounds(.35);
        supports.push([member.shotColumn,member.cool,a.hp,b.hp]);
      }
      setLeader(0);run.heading=0;run.shield=1;
      const initial=bulk.hp;
      absorbContact(foe(11),bulk,routes.surface);
      const front=initial-bulk.hp;
      const before=bulk.hp;
      absorbContact(foe(-11),bulk,routes.surface);
      const rear=before-bulk.hp;
      setLeader(1);
      const close=foe(8);setTargets(close);shoot(raven);advanceRounds(.016);
      return {beat,early,inFlight,afterBurst,heavyMarked,pierced,thirdHit,supports,front,rear,pointBlank:close.hp};
    });
    assert.deepEqual(results.beat.map(([c])=>c),[1,3,1,3]);
    assert.ok(results.beat[3][1]>results.beat[0][1]*3);
    assert.deepEqual([results.early,results.inFlight,results.afterBurst],[120,120,76]);
    assert.equal(results.heavyMarked,true);
    assert.deepEqual(results.pierced,[65,82,120]);
    assert.equal(results.thirdHit,82);
    assert.deepEqual(results.supports,Array.from({length:3},()=>[1,1.18,113,120]));
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
          const enemy={type:0,x:1365,y:1004,hp:120,max:120,phase:0,hit:0,flip:-1,speed:0};
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
      audible('bulk','hit'),audible(),audible(),reserve,
      audible(),audible('raven-a','hit'),audible(),reserve,
      audible(),audible(),audible('lynx','hit'),reserve
    ]);
    assert.deepEqual(audio.outgoing,audible('lynx'));
    assert.deepEqual(audio.promoted,audible());
    assert.deepEqual(audio.fresh,audible('bulk','hit'));
    assert.deepEqual(errors,[]);
    console.log('Raven cadence, moving rounds, Lynx priority/pierce, support roles, shield facing, point-blank shots, all seven audio buffers and leader-only fire/impact across tags passed.');
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
