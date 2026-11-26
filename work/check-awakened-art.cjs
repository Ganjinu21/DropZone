const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:820,height:960}});
    const problems=[];
    page.on('pageerror',err=>problems.push(err.message));
    await page.route('http://forms.test/**',route=>{
      const src=path.join(__dirname,'../game',decodeURIComponent(new URL(route.request().url()).pathname));
      return fs.existsSync(src)?route.fulfill({path:src}):route.fulfill({status:404,body:''});
    });
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0});
    await page.goto('http://forms.test/index.html');
    await page.locator('#start:enabled').click();
    await page.locator('#equip').click();
    await page.locator('#hud').waitFor();
    const plate=await page.evaluate(async()=>{
      const check=(test,message)=>{if(!test)throw Error(message)};
      const forms=[],w=300,h=142;
      const ground='#3b4343',newCanvas=(width,height)=>Object.assign(document.createElement('canvas'),{width,height});
      const makePanel=(id,awakened)=>{
        start();
        applyUpgrade();
        const member=run.squad[id],grade=awakened?6:3;
        Object.assign(run,{x:1250,y:1004,lead:id,marks:[],effects:[],enemies:[],cues:[],activeSkill:null,cobra:null});
        Object.assign(member,{x:run.x,y:run.y,hp:member.max,skillReadyAt:0,flip:1,deployed:true,moving:false,
          weapon:gearByKey.get(weaponFamilies[id]+'-'+grade),shieldItem:'shield-'+grade});
        run.lineup=[id,...names.map((_,i)=>i).filter(i=>i!==id).slice(0,2)];
        member.loadout={...member.loadout,helmet:'helmet-'+grade,gloves:'gloves-'+grade,top:'top-'+grade,pants:'pants-'+grade,boots:'boots-'+grade};
        const target={x:run.x+140,y:run.y-1,hp:1e8,max:1e8,type:1,phase:0,speed:0,hit:0,flip:-1};
        const wing={...target,x:target.x+16,y:target.y-18};run.enemies=[target,wing];
        check(activateSquadSkill(awakened?2:1),'activate '+id+' '+grade);
        const time=(awakened?[.94,.68,1.06,.80,.74]:[1.0,.68,.48,1.29,.64])[id];
        const step=.01;
        for(let i=0;i<Math.round(time/step);i++){
          run.t+=step;
          if(id===4)updateRadioSupport(step);else tickSquadSkills(step);
          advanceRounds(step);
          for(const effect of run.effects)effect.age+=step;
          run.effects=run.effects.filter(e=>e.age<e.duration);
        }
        const skill=id===4?run.cobra:run.activeSkill;
        check(!!skill && !!skill.awakened===awakened,'wrong form '+id);
        if(awakened && id===1)check(run.marks.some(m=>m.awakened)||run.effects.some(e=>e.awakened && e.skillFx==='smgFire'),'missing energized rounds');
        if(awakened && id===2)check(run.effects.some(e=>e.skillFx==='railBeam' && e.awakened),'missing charged rail');
        if(awakened && id===3){
          const shells=run.effects.filter(e=>e.skillFx==='shellArc');
          check(shells.length>1 && shells.every(e=>e.awakened),'missing multiple rockets');
          check(new Set([0,1,2,3].map(i=>{const socket=skillShotSocket(member,skill,0,i);return [socket.x,socket.y].join(',')})).size===4,'missing rack ports');
        }
        if(awakened && id===0){
          for(const angle of [0,2.5]){
            const point=skillShotSocket(member,skill,angle),gun=mechGunPose(skill,angle);
            check(Math.hypot(point.x-gun.x-gun.reach*Math.cos(angle),point.y-gun.y-gun.reach*Math.sin(angle))<.001,'mech barrel origin');
          }
        }
        if(awakened && id===4){
          const point=a10Muzzle(skill);check(Math.hypot(point.x-skill.x,point.y-skill.y)>70,'A-10 nose origin');
        }
        const painted=new Set(),original=ctx.drawImage;
        ctx.save();ctx.resetTransform();ctx.imageSmoothingEnabled=false;ctx.fillStyle=ground;ctx.fillRect(0,0,w,h);
        ctx.fillStyle='#444d4a';ctx.fillRect(0,118,w,1);
        ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
        ctx.drawImage=function(img,...args){painted.add(img);return original.call(this,img,...args)};
        try{
          if(id===4){
            const craft=run.cobra,anchor={x:craft.x,y:craft.y};
            // Present the two operational silhouettes together while preserving every sprite pixel.
            ctx.save();ctx.translate(182-anchor.x,59-anchor.y);drawCobraSupport();ctx.restore();
            ctx.save();ctx.translate(60-member.x,118-member.y);drawHero(member);ctx.restore();
          }else{
            ctx.translate(80-member.x,116-member.y);
            if(id===0)(awakened?drawMech:drawBunker)(skill);
            else drawHero(member);
            for(const e of run.effects)if(e.skillFx && ['railBeam','shellArc','smgFire','smgTrail'].includes(e.skillFx))drawSkillFX(e);
            for(const m of run.marks)drawTracer(m);
          }
        }finally{ctx.drawImage=original;ctx.restore()}
        if(id===0)check(painted.has(awakened?art.mech:art.bunkerDeploy),'wrong Bulk art');
        if(id===4)check(painted.has(awakened?art.a10:art.cobra) && !painted.has(awakened?art.cobra:art.a10),'wrong air support');
        if(id===3)check(painted.has(art.rocketBank)===awakened,'wrong Hammer rig');
        const frame=newCanvas(w,h);frame.getContext('2d').drawImage(cv,0,0,w,h,0,0,w,h);return frame;
      };
      await document.fonts.ready;
      for(let i=0;i<5;i++)forms.push([makePanel(i,false),makePanel(i,true)]);
      const board=newCanvas(910,980),g=board.getContext('2d');g.imageSmoothingEnabled=false;
      g.fillStyle='#182022';g.fillRect(0,0,board.width,board.height);
      g.fillStyle='#eee5d0';g.font='bold 32px Arcade,sans-serif';g.fillText('분대 특수공격',28,50);
      g.font='bold 21px Arcade,sans-serif';g.fillStyle='#99c5bc';g.fillText('A · S 무기',135,92);
      g.fillStyle='#efbd7c';g.fillText('S+ 각성 무기',521,92);
      names.forEach((name,i)=>{
        const top=108+i*170;
        g.fillStyle='#d3d4c8';g.font='bold 21px Arcade,sans-serif';g.fillText(name,26,top+85);
        forms[i].forEach((img,j)=>{
          const x=130+j*385;g.fillStyle=j?'#a87c4c':'#59877e';g.fillRect(x,top,370,2);
          g.fillStyle='#333d3d';g.fillRect(x,top+2,370,160);
          g.drawImage(img,x+35,top+2);
          g.font='17px Arcade,sans-serif';g.fillStyle='#eee4ce';g.fillText(skillDisplayName(i,j?2:1),x+12,top+151);
        });
      });
      return board.toDataURL('image/png').split(',')[1];
    });
    assert.deepEqual(problems,[]);
    if(process.env.PREVIEW_DIR)fs.writeFileSync(path.join(process.env.PREVIEW_DIR,'Special-Weapon-Forms.png'),Buffer.from(plate,'base64'));
    console.log('Verified ten equipped special forms, four siege launch sockets, charged rail, twin pulse fire, mech gun origins and orbiting aircraft with the live field renderer.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
