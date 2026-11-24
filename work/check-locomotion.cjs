const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {chromium} = require('playwright');
const launchSquad = require('./select-test-squad.cjs');

const gameDirectory = path.resolve(__dirname,'../game');

// Use a same-origin document so the actual in-game textures can be read back from the canvas.
async function openGame(page) {
  await page.route('http://dropzone.test/**', route => {
    const filename = path.join(gameDirectory,decodeURIComponent(new URL(route.request().url()).pathname));
    return fs.existsSync(filename)
      ? route.fulfill({path:filename})
      : route.fulfill({status:404,body:''});
  });
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0});
  await page.goto('http://dropzone.test/index.html');
}

async function exerciseFormation(page) {
  return page.evaluate(()=>{
    const squad=run.lineup.map(id=>run.squad[id]);
    Object.assign(run,{x:1257,y:1004,heading:0,enemies:[],remaining:999,spawn:999});
    squad.forEach((m,i)=>Object.assign(m,{x:run.x+formationSlots[i][0],y:run.y+formationSlots[i][1],cool:999}));
    const phases=squad.map(()=>new Set());
    pressed.add('KeyD');
    for(let t=0;t<65;t++){
      update(1/60);
      squad.forEach((m,i)=>{if(m.moving)phases[i].add(crewStrideFrame(m))});
    }
    pressed.delete('KeyD');
    for(let t=0;t<90;t++)update(1/60);
    return squad.map((m,i)=>({id:m.id,frames:phases[i].size,stopped:!m.moving}));
  });
}

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined});
  try {
    const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await openGame(page);
    await launchSquad(page,[0,1,2]);
    const first=await exerciseFormation(page);
    await page.locator('#pause').tap();await page.locator('#homebtn').tap();
    await launchSquad(page,[4,3,0]);
    const second=await exerciseFormation(page);
    for(const {id,frames,stopped} of [...first,...second]){
      assert.equal(frames,8,'missing real movement frames for operator '+id);
      assert.ok(stopped,'standing formation kept walking for operator '+id);
    }

    await page.evaluate(()=>{
      function check(ok,message){if(!ok)throw Error(message)}
      const canvas=document.createElement('canvas');
      canvas.width=160;canvas.height=84;
      const g=canvas.getContext('2d',{willReadFrequently:true});
      g.imageSmoothingEnabled=false;
      const cx=80, feet=72;
      const render=(m,flip=1,moving=true)=>{
        g.clearRect(0,0,canvas.width,canvas.height);
        drawMemberGear(g,{...m,x:cx,y:feet,flip,moving},Infinity,moving);
      };
      // Compare mirrored silhouettes on the authored 192×128 grid. At half size,
      // left and right nearest-neighbour sampling can legitimately pick different source pixels.
      const mirrorCanvas=document.createElement('canvas');
      mirrorCanvas.width=canvas.width*2;mirrorCanvas.height=canvas.height*2;
      const mirror=mirrorCanvas.getContext('2d',{willReadFrequently:true});
      mirror.imageSmoothingEnabled=false;mirror.scale(2,2);
      function footSilhouette(m,flip){
        mirror.clearRect(0,0,canvas.width,canvas.height);
        drawMemberGear(mirror,{...m,x:cx,y:feet,flip,moving:true},Infinity,true);
        return mirror.getImageData(0,(feet-12)*2,mirrorCanvas.width,32).data;
      }
      for(const member of run.squad){
        const id=member.id,weapon=gearByKey.get(weaponFamilies[id]+'-3');
        const m={...member,weapon,loadout:{...savedEquipment[id]},shieldItem:'shield-3',moving:true};
        const legs=new Set(),soles=[],parts=['helmet','gloves','top','pants','boots'];
        for(let i=0;i<8;i++){
          m.gait=i*5;
          render(m);
          const data=g.getImageData(0,feet-12,canvas.width,16).data;
          legs.add(data.join(','));
          const normal=canvas.toDataURL();
          for(const slot of parts){
            const upgraded={...m.loadout,[slot]:slot+'-6'};
            render({...m,loadout:upgraded});
            check(canvas.toDataURL()!==normal,'missing moving '+slot+' on '+id+' phase '+i);
          }
          const right=footSilhouette(m,1),left=footSilhouette(m,-1),w=mirrorCanvas.width;
          let visible=0,lowest=-1;
          for(let y=0;y<32;y++)for(let x=0;x<w;x++){
            const a=right[(y*w+x)*4+3]>127,b=left[(y*w+w-1-x)*4+3]>127;
            check(a===b,'incorrectly mirrored foot on '+id+' phase '+i);
            if(a){visible++;lowest=y}
          }
          check(visible>80,'missing feet on '+id+' phase '+i);
          soles.push(lowest);
          // Follow the equipped barrel to the world-coordinate position used by shots, including recoil.
          g.clearRect(0,0,canvas.width,canvas.height);
          const actor={...m,x:cx,y:feet,flip:i%2?-1:1,aimPitch:.2,shotColumn:1};
          let tip,shield=false,far=false;
          const drawImage=g.drawImage;
          g.drawImage=function(image,...args){
            if(image===art[weapon.artKey]){
              const [x,y,w,h]=args.slice(-4), p=weaponMount(actor,1,2);
              tip=this.getTransform().transformPoint({x:x+w,y:y+h*p.bore});
            }
            if(image===art['shield-3'])shield=true;
            if(image===art[weapon.artKey+'-far'])far=true;
            return drawImage.call(this,image,...args);
          };
          try{drawMemberGear(g,actor,0,true)}finally{g.drawImage=drawImage}
          const shot=combatMuzzle(actor,1,true);
          check(tip && Math.hypot(tip.x-shot.x,tip.y-shot.y)<.01,'barrel detached on '+id+' phase '+i);
          if(id===0)check(shield,'shield missing while moving');
          if(id===1)check(far,'second SMG missing while moving');
        }
        check(legs.size===8,'duplicate walking legs on '+id);
        check(Math.max(...soles)-Math.min(...soles)<=3,'planted feet leave the ground on '+id);
        render(m,1,false);const idle=canvas.toDataURL();
        render({...m,gait:m.gait+13},1,false);
        check(canvas.toDataURL()===idle,'idle depends on distance for '+id);
      }
      // A patrol and a fast leash return must advance stride by actual distance traveled.
      const ally=run.radioTeam[0],nav=routes.surface;
      const travel=(offset,postOffset)=>{
        Object.assign(ally,{gait:0,shoot:0,x:run.x+offset,y:run.y,post:{x:run.x+postOffset,y:run.y},patrolTime:1});
        const before=ally.gait,x=ally.x,y=ally.y;
        moveRadioAlly(ally,null,nav,1/60);
        return {walked:Math.hypot(ally.x-x,ally.y-y),gait:ally.gait-before};
      };
      const patrol=travel(0,30),rejoin=travel(84,0);
      check(patrol.walked>0 && rejoin.walked>patrol.walked*2,'summon did not change speeds');
      check(Math.abs(patrol.gait*.8-patrol.walked)<1e-6
        && Math.abs(rejoin.gait*.8-rejoin.walked)<1e-6,'summon stride is out of scale with footsteps');
      const backing={...run.squad[0],gait:0,moving:true,flip:1,shoot:.15};
      updateCrewStride(backing,-5,0,1/60);
      check(backing.flip===1 && crewStrideFrame(backing)===7,'backpedal did not reverse the cycle');
      updateCrewStride(backing,5,0,1/60);
      check(crewStrideFrame(backing)===0,'forward stride did not reverse the retreat');
      Object.assign(ally,{x:run.x,y:run.y,post:{x:run.x,y:run.y},patrolTime:1});
      const gait=ally.gait;
      moveRadioAlly(ally,null,nav,1/60);
      check(!ally.moving && ally.gait===gait,'stationary patrol advanced');

      // Both support troops use the CCT body row and the chief's equipped weapon at 80% scale.
      for(const support of run.radioTeam){
        const draw=ctx.drawImage,chief=run.squad[4];
        let body=false,gun=false;
        ctx.drawImage=function(image,...args){
          if(image===art.crewStride){
            const [sx,sy,w,h]=args;
            body=sy/h===4 && sx/w===crewStrideFrame(support)
              && Math.abs(Math.abs(this.getTransform().a)-summonScale)<1e-5;
          }
          if(image===art[chief.weapon.artKey])gun=true;
          return draw.call(this,image,...args);
        };
        try{support.moving=true;cctRadioSprite(support)}finally{ctx.drawImage=draw}
        check(body && gun,'CCT support body, weapon or draw scale');
      }
    });
    // At actual field resolution each fired barrel must have painted pixels at the shot origin.
    // This catches a transparent margin, disappearing thin barrel or mismatched far-hand sprite.
    await page.evaluate(()=>{
      const canvas=document.createElement('canvas'),g=canvas.getContext('2d',{willReadFrequently:true});
      for(const family of ['pistol','carbine','smg','sniper']){
        const models=new Set();
        for(const item of equipmentCatalog.filter(i=>i.family===family)){
          const id=Math.max(0,weaponFamilies.indexOf(family));
          const member={...run.squad[id],weapon:item,x:0,y:0,flip:1,moving:false,aimPitch:0};
          for(const col of family==='smg'?[1,3]:[1]){
            const part=weaponMount(member,col,2);
            canvas.width=part.w;canvas.height=part.h;
            g.imageSmoothingEnabled=false;g.drawImage(part.image,0,0,part.w,part.h);
            const rgba=g.getImageData(0,0,part.w,part.h).data;
            const pivot=shoulderAt(member),hit=combatMuzzle(member,col,true,0);
            const tx=hit.x-pivot.x-part.x,ty=hit.y-pivot.y-part.y;
            let closest=Infinity;
            for(let y=0;y<part.h;y++)for(let x=0;x<part.w;x++){
              if(rgba[4*(y*part.w+x)+3]>=96)closest=Math.min(closest,Math.hypot(x+.5-tx,y+.5-ty));
            }
            if(closest>2)throw Error('Empty muzzle on '+item.key+' hand '+col+' ('+closest.toFixed(1)+' field px)');
            if(col===1)models.add(canvas.toDataURL());
          }
          if(family==='smg'||family==='sniper'){
            const weapon=gearByKey.get(levelKey(item.artKey,1))||item;
            const draw=ctx.drawImage;
            let firingFrame=false;
            ctx.drawImage=function(img,...args){
              if(img===art[item.artKey+'-skill'])firingFrame=true;
              return draw.call(this,img,...args);
            };
            try{
              drawRifleSkill({...member,weapon,moving:true,shotColumn:1},{angle:0,age:.5,lastFire:.5,phase:'fire'});
            }finally{ctx.drawImage=draw}
            if(!firingFrame)throw Error('Ranked firing frame missing for '+weapon.key);
          }
        }
        if(models.size!==5)throw Error('Indistinguishable field ranks on '+family);
      }
    });
    // Both arm planes of the sixteen-direction turn must surround the live
    // dressed body, including at half a step where the muzzle moves vertically.
    const turns=await page.evaluate(()=>{
      const m={...run.squad[1],loadout:{...savedEquipment[1],helmet:'helmet-6'},
        moving:true,gait:5,weapon:gearByKey.get('smg-6')};
      const body=crewOutfitSheet(m),arms=art['smg-6-skill'];
      const draw=ctx.drawImage,seen=[];
      ctx.drawImage=function(image,...args){
        if(image===body)seen.push('body');
        if(image===arms)seen.push(args[1]/72);
        return draw.call(this,image,...args);
      };
      try{
        return Array.from({length:16},(_,i)=>{
          seen.length=0;
          const skill={phase:'spin',angle:i*TAU/16};
          drawSpinner(m,skill);
          const stand=skillShotSocket({...m,moving:false},skill,skill.angle);
          const walk=skillShotSocket(m,skill,skill.angle);
          return [seen.join(','),walk.y-stand.y];
        });
      }finally{ctx.drawImage=draw}
    });
    turns.forEach(([planes,dy],i)=>{
      assert.equal(planes,[3+(i>>3),'body',5+(i>>3)].join(','));
      assert.equal(dy,1);
    });
    await page.emulateMedia({reducedMotion:'reduce'});
    const reduced=await page.evaluate(()=>{
      const m={...run.squad[4],moving:true},y=shoulderAt({...m,gait:0}).y;
      return Array.from({length:8},(_,i)=>shoulderAt({...m,gait:i*5}).y===y).every(Boolean);
    });
    assert.ok(reduced,'reduced motion still bobs the firing socket');
    assert.deepEqual(errors,[]);
    console.log('Verified all five operators, 40 moving poses with armor and muzzle alignment, both facings, idle and CCT patrols.');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
