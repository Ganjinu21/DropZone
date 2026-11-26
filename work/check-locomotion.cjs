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
    stick={x:0,y:0,dx:1,dy:0};
    for(let t=0;t<65;t++){
      update(1/60);
      squad.forEach((m,i)=>{if(m.moving)phases[i].add(crewStrideFrame(m))});
    }
    stick=null;
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
      for(const m of run.squad){
        for(const row of [1,6,7]){
          const poses=new Set();
          for(let step=0;step<8;step++){
            const moving={...m,moving:true,gait:step*5,walkRow:row};
            render(moving);
            poses.add(canvas.toDataURL());
            const foot=g.getImageData(0,feet-7,canvas.width,10).data;
            check(foot.some((v,i)=>i%4===3 && v>128),'missing grounded feet '+m.id);
          }
          check(poses.size===(row===1 || m.id===1?8:4),'missing painted stride '+m.id+'/'+row);
        }
        for(const bearing of [-1,1]){
          for(const dy of [-140,-75,0,75,140]){
            const shooter={...m,x:cx,y:feet,lastShot:run.t};
            const tx=cx+110*bearing,ty=feet-32+dy;
            combatAim(shooter,tx,ty,1);
            const tip=combatMuzzle(shooter,1,true);
            const angle=Math.atan2(ty-tip.y,tx-tip.x);
            check(Math.abs(Math.sin(angle-shooter.aimAngle))<.001,'aim lost painted muzzle');
          }
        }
        const poses=new Set();
        for(const {variant} of rankedTiers){
          const row={...m.loadout,weapon:weaponFamilies[m.id]+'-'+variant,helmet:'helmet-'+variant};
          g.clearRect(0,0,canvas.width,canvas.height);
          drawCrewPreview(canvas,m.id,row);poses.add(canvas.toDataURL());
        }
        check(poses.size===5,'missing equipment finishes '+m.id);
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

      for(const support of run.radioTeam){
        const draw=ctx.drawImage;
        let painted=false;
        ctx.save();ctx.setTransform(1,0,0,1,0,0);
        ctx.drawImage=function(image,...args){
          if(image===art.cctRecruitstand||image===art.cctRecruitfield||image===art.cctRecruitstride)painted=true;
          return draw.call(this,image,...args);
        };
        try{cctRadioSprite(support)}finally{ctx.drawImage=draw;ctx.restore()}
        check(painted,'missing painted CCT support');
      }
    });
    // Follow the same living enemy between trigger pulls, including after it
    // crosses the shoulder. Lose the lock immediately on a floor change or KO.
    await page.evaluate(()=>{
      const chief=run.squad[run.lead],enemy={x:chief.x+28,y:chief.y-48,type:0,hp:999,max:999};
      run.activeSkill=null;run.enemies=[enemy];chief.ammoKey=null;
      shoot(chief);
      if(chief.aimTarget!==enemy || chief.aimPitch>=0)throw Error('did not acquire upper target');
      chief.cool=10;enemy.y=chief.y+43;enemy.x=chief.x-25;
      moveFormation(1/60);
      if(chief.aimPitch<=0 || chief.flip!==-1)throw Error('did not track the crossed target between shots');
      if(run.radioTeam){
        const ally=run.radioTeam[0];Object.assign(ally,{x:chief.x,y:chief.y,grace:1,cool:10});
        updateRadioSupport(1/60);
        if(ally.aimTarget!==enemy || ally.aimPitch<=0 || ally.flip!==-1)throw Error('summon did not hold lower target');
        enemy.y=ally.y-60;updateRadioSupport(1/60);
        if(ally.aimPitch>=0)throw Error('summon did not raise sights between shots');
      }
      run.enemies=[];moveFormation(1/60);
      if(chief.aimTarget)throw Error('lock crossed to old floor');
      run.enemies=[enemy];chief.aimTarget=enemy;enemy.hp=0;moveFormation(1/60);
      if(chief.aimTarget)throw Error('lock on defeated opponent');
    });
    await page.emulateMedia({reducedMotion:'reduce'});
    const reduced=await page.evaluate(()=>{
      const m={...run.squad[4],moving:true},y=shoulderAt({...m,gait:0}).y;
      return Array.from({length:8},(_,i)=>shoulderAt({...m,gait:i*5}).y===y).every(Boolean);
    });
    assert.ok(reduced,'reduced motion still bobs the firing socket');
    assert.deepEqual(errors,[]);
    console.log('Verified directional painted strides, grounded feet, equipment finishes, field muzzle alignment and CCT patrols.');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
