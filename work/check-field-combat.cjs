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
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;localStorage.setItem('dropzone.squad.v1','[0,4,3]')});
    await page.goto(pathToFileURL(path.resolve(__dirname,'../game/index.html')).href);
    await page.locator('#start:enabled').tap();
    await page.locator('#hud').waitFor();
    const strideBytes=require('node:fs').readFileSync(path.resolve(__dirname,'../game/art/armory/crew-stride.png'));
    const field = await page.evaluate(async strideURL => {
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
      need(activateSquadSkill(),'Bunker did not deploy');
      const fort=run.activeSkill;
      need(run.radioTeam.every(m=>m.x===fort.x && m.y===fort.y),'Support did not board');
      for(let i=0;i<400;i++)tickSquadSkills(.02);
      need(fort===run.activeSkill && fort.phase==='fire','Bunker timed out');
      const before=bulk.hp;
      hitSquadMember(target,bulk,nav);
      hitSquadMember(target,bulk,nav);
      need(fort.hp===fort.maxHp-12,'Contact damage cadence');
      const health=fort.hp;
      run.xp=run.need;update(.01);
      need(mode==='upgrade' && run.activeSkill===fort,'XP interrupted bunker');
      applyUpgrade();
      need(run.activeSkill===fort && fort.hp===health,'Upgrade reset bunker durability');
      switchLead(4);need(run.lead===0,'Tag exited bunker');
      advanceStage();need(run.activeSkill===fort,'Stage transition removed bunker');
      Object.assign(target,{x:fort.x+18,y:fort.y});run.enemies=[target];
      const far=enemy(fort.x+140,fort.y);
      run.enemies.push(far);
      const allyHP=run.radioTeam.map(a=>a.hp);
      hitSquadMember(target,bulk,nav,health);
      need(!run.activeSkill && target.x>fort.x+30 && far.x===fort.x+140,'Collapse did not push near enemies');
      need(run.effects.some(e=>e.skillFx==='blast') && bulk.hp>=before && run.radioTeam.every((a,i)=>a.hp===allyHP[i]),'Explosion or occupant protection');
      hitSquadMember(target,hammer,nav,10000); // collapse grants brief exit protection
      need(hammer.hp>0,'Immediate exit damage');
      hammer.hurt=0;hitSquadMember(target,hammer,nav,10000);
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
      need(Math.abs(chief.hp-chief.max*.55)<.001 && run.radioTeam[0].hp===0,'Field kit healing');
      const rank=run.up[firepower];getOffer(firepower);applyUpgrade();
      const shot=enemy(100,100);damageEnemy(shot,100);
      need(Math.abs(shot.max-shot.hp-(110+rank*10))<.001,'Firepower multiplier');
      // Check the native lower body pixels independently of weapon, head bob and camera.
      const canvas=document.createElement('canvas');canvas.width=96;canvas.height=64;
      const g=canvas.getContext('2d');g.imageSmoothingEnabled=false;
      const strideImage=new Image();strideImage.src=strideURL;await strideImage.decode();
      const draw=g.drawImage.bind(g);
      g.drawImage=(image,...parts)=>{if(image===art.crewStride)draw(strideImage,...parts)};
      for(const m of run.squad){
        const phases=new Set();
        for(let i=0;i<8;i++){
          g.clearRect(0,0,96,64);drawMemberGear(g,{...m,x:32,y:60,flip:1,gait:i*5},0,true);
          phases.add(Array.from(g.getImageData(0,47,64,15).data).join(','));
        }
        need(phases.size===8,'Walking poses missing for '+m.id);
      }
      for(let i=0;i<100;i++){
        openUpgrade();
        if(offers.includes(fieldKit) && offers.includes(firepower))break;
      }
      need(new Set(offers).size===3,'Duplicate upgrade choices');
      return {patrol:stops.map(a=>a.size),bunkerHP:health,revived:hammer.max*.3};
    },'data:image/png;base64,'+strideBytes.toString('base64'));
    for(const width of [320,393,430]){
      await page.setViewportSize({width,height:852});
      const cards=await page.locator('#cards .card').evaluateAll(nodes=>nodes.map(n=>{
        const b=n.getBoundingClientRect();return [b.x,b.y,b.right,n.scrollWidth,n.clientWidth];
      }));
      assert.equal(cards.length,3);
      assert.ok(cards.every((b,i)=>b[1]===cards[0][1] && b[0]>=0 && b[2]<=width && (!i || b[0]>cards[i-1][2]) && b[3]<=b[4]+1));
    }
    assert.equal(await page.getByText('증강 선택',{exact:true}).count(),0);
    if(process.env.PREVIEW_DIR){
      await page.setViewportSize({width:393,height:852});
      await page.screenshot({animations:'disabled',path:path.join(process.env.PREVIEW_DIR,'Field-Augments.png')});
    }
    await page.locator('.card').first().tap();await page.locator('#equip').tap();
    assert.equal(await page.locator('#hud').isVisible(),true);
    assert.deepEqual(errors,[]);
    console.log('Field combat, rescue, all five walking sprites and three-column augment layout passed.',field);
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
