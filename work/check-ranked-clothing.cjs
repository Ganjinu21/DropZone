const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const gameDirectory=path.join(__dirname,'../game');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('http://clothing.test/**',route=>{
      const file=path.join(gameDirectory,decodeURIComponent(new URL(route.request().url()).pathname));
      return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});
    });
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0});
    await page.goto('http://clothing.test/index.html');
    await page.locator('#start:enabled').click();
    await page.locator('#equip').click();
    await page.locator('#hud').waitFor();
    const proofs=await page.evaluate(async exportProofs=>{
      const check=(ok,detail)=>{if(!ok)throw Error(detail)};
      const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
      const shot=canvas(192,204),g=shot.getContext('2d',{willReadFrequently:true});
      const columns=[1,2,3,4,0];
      const plates=exportProofs?Array.from({length:1+Object.keys(crewMotion).length*8},()=>canvas(shot.width*5,shot.height*5)):null;
      const colours=new Map();
      function clear(){g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,shot.width,shot.height)}
      function checkUniform(id,pose,tier){
        const key=id+'/'+pose,seen=colours.get(key)??new Set();
        const rgba=g.getImageData(0,0,shot.width,shot.height).data;
        let solid=0;
        for(let i=3;i<rgba.length;i+=4)if(rgba[i]>220)solid++;
        check(solid>1000,key+' empty at '+tier);
        seen.add(shot.toDataURL());colours.set(key,seen);
      }
      for(let tier=0;tier<5;tier++){
        const rank=rankedTiers[tier];
        for(const [col,id] of columns.entries()){
          armory.crewTiers[id]=tier;
          const request=requestRecruitUniform(id,tier);
          if(request)check(await request.ready,'could not load '+id+'/'+tier);
          const row={...savedEquipment[id],weapon:weaponFamilies[id]+'-0',shield:'shield-0'};
          const m={...run.squad[id],testTier:null,loadout:row,weapon:gearByKey.get(row.weapon),shieldItem:row.shield,
            x:30,y:65,flip:1,walkRow:1,moving:true,aimTarget:{hp:100},operatorAngle:0,ravenSector:0};
          clear();drawCrewPreview(shot,id,row);checkUniform(id,'barracks',tier);
          const promoted={...row,weapon:weaponFamilies[id]+'-'+rank.variant,shield:'shield-'+rank.variant};
          const set=frameSet(m);
          check(set.frames.height===3072 && crewFrameAnchors[set.role][tier].length===67,'unexpected field atlas layout');
          for(const moving of [false,true]){
            for(const sign of [-1,1]){
              const vertical=recruitAimCel(m,moving,sign*Math.PI/2);
              check(vertical===recruitAimCel(m,moving,sign*Math.PI/4),'axial pose used for '+set.role+'/'+rank.rank);
            }
          }
          if(id===0){
            const bounds=crewFrameAnchors.bulk[tier].map(([, , ,l,t,r,b])=>[r-l,b-t].join('x'));
            check(new Set(bounds).size===1,'shield dimensions changed within '+rank.rank);
            const field=new Set(),barracks=new Set();
            for(const {variant} of rankedTiers){
              const shield='shield-'+variant;
              clear();drawCrewPreview(shot,id,{...row,shield});barracks.add(shot.toDataURL());
              clear();drawRecruit(g,{...m,shieldItem:shield},Infinity,false,crewMotion.level*6);
              field.add(shot.toDataURL());
            }
            check(field.size===1 && barracks.size===1,'shield icon covered the painted shield at '+rank.rank);
          }
          const x=col*shot.width,y=tier*shot.height;
          if(plates){
            clear();drawCrewPreview(shot,id,promoted);plates[0].getContext('2d').drawImage(shot,x,y);
          }
          const portrait=new Image();portrait.src=fieldPortrait(id);
          await portrait.decode();
          check(portrait.naturalWidth>=112 && fieldPortrait(id)!==wornPortrait(id),'portrait '+id+'/'+rank.rank);
          const feet=new Set(),crown=[];
          function drawStep(member){
            clear();g.save();g.scale(3,3);drawMemberGear(g,member,.07,true);g.restore();
          }
          for(let step=0;step<8;step++){
            m.gait=(step+.1)*crewStrideLength/8;
            drawStep(m);
            checkUniform(id,'aim'+step,tier);
            const rgba=g.getImageData(0,0,shot.width,shot.height).data;
            crown.push(Math.floor((rgba.findIndex((v,i)=>i%4===3 && v>180)/4)/shot.width));
            feet.add(shot.toDataURL());
          }
          check(feet.size===8,'missing painted firing frame '+id+'/'+rank.rank);
          check(Math.max(...crown)-Math.min(...crown)<=18,'excessive head travel '+id+'/'+rank.rank+' '+crown);
          for(const [name,action] of Object.entries(crewMotion)){
            if(id===1 && name==='skill'){
              if(plates)for(let step=0;step<6;step++){
                clear();g.save();g.scale(3,3);g.translate(m.x,m.y);
                drawRavenBody(g,{...m,weapon:gearByKey.get(promoted.weapon)},{index:48+step*3,facing:1},{phase:'spin',follow:3});
                g.restore();plates[1+action*8+step].getContext('2d').drawImage(shot,x,y);
              }
              continue;
            }
            const frames=new Set(),set=frameSet(m);
            const upper=new Set(),boots=new Set(),detail=canvas(190,64);
            const detailContext=detail.getContext('2d');
            const original=g.drawImage;
            const gait=action>=crewMotion.travel && action<=crewMotion.down;
            const count=gait?8:6;
            for(let step=0;step<count;step++){
              const cel=gait?crewStrideCel(action,step):action*6+step,draws=[];
              if(gait){
                m.gait=(step+.1)*crewStrideLength/8;
                const selected=action<=crewMotion.away?
                  recruitWalkCel({...m,walkRow:[1,6,7][action-1]}):
                  recruitAimCel(m,true,(action-crewMotion.level)*Math.PI/4);
                check(selected===cel,'wrong foot at '+id+'/'+rank.rank+'/'+name+'/'+step);
                for(const [seen,top] of [[upper,88],[boots,185]]){
                  detailContext.clearRect(0,0,190,64);
                  detailContext.drawImage(set.frames,cel%6*256+32,Math.floor(cel/6)*256+top,190,64,0,0,190,64);
                  seen.add(detail.toDataURL());
                }
              }
              g.drawImage=function(img,...coords){draws.push({img,coords});return original.call(this,img,...coords)};
              clear();g.save();g.scale(3,3);
              try{drawRecruit(g,m,Infinity,false,cel)}finally{g.restore();g.drawImage=original}
              check(draws.length===1 && draws[0].img===set.frames,'body was assembled from pieces '+name);
              check(draws[0].coords[0]===cel%6*256 && draws[0].coords[1]===Math.floor(cel/6)*256,'wrong frame '+name);
              frames.add(shot.toDataURL());
              if(plates){
                clear();g.save();g.scale(3,3);
                drawRecruit(g,{...m,weapon:gearByKey.get(promoted.weapon),shieldItem:promoted.shield},Infinity,false,cel);
                g.restore();plates[1+action*8+step].getContext('2d').drawImage(shot,x,y);
              }
            }
            check(frames.size===count,'duplicate full-body frame '+id+'/'+rank.rank+'/'+name);
            if(gait)check(upper.size===8 && boots.size===8,'reused torso or legs '+id+'/'+rank.rank+'/'+name);
          }
          {
            for(const angle of [-Math.PI/2,-Math.PI/4,0,Math.PI/4,Math.PI/2]){
              m.operatorAngle=angle;
              const barrel=recruitSocket(m);
              check(Number.isFinite(barrel.x+barrel.y+barrel.angle),'field barrel '+id+'/'+tier);
            }
          }
        }
      }
      for(const [pose,seen] of colours)check(seen.size===5,'repeated rank at '+pose);
      // A pending earlier request must never replace the selected render set.
      const requests=[1,3,2,4].map(tier=>requestRecruitUniform(0,tier).ready);
      await Promise.all(requests);
      check(recruitUniforms.get('bulk').tier===4,'stale render set');
      await changeArmory(state=>{state.crewTiers=[4,4,4,4,4]});
      return plates?.map(c=>c.toDataURL('image/webp',.94).split(',')[1])??[];
    },!!process.env.PREVIEW_DIR);
    await page.reload();await page.locator('#select-team:enabled').click();
    assert.deepEqual(await page.evaluate(()=>operatorRoles.flatMap(role=>role?[recruitUniforms.get(role)?.images?.frames?.complete]:[])),[true,true,true,true,true]);
    await page.locator('#change-crew').click();
    for(let id=0;id<5;id++){
      const src=await page.locator('[data-pick="'+id+'"] img').getAttribute('src');
      assert.equal(src,await page.evaluate(id=>uniformPortrait(id,4),id));
    }
    assert.deepEqual(errors,[]);
    if(process.env.PREVIEW_DIR){
      fs.mkdirSync(process.env.PREVIEW_DIR,{recursive:true});
      const moves=await page.evaluate(()=>Object.keys(crewMotion));
      proofs.forEach((encoded,i)=>{
        const move=moves[Math.floor((i-1)/8)],phase=(i-1)%8;
        if(i && (move==='guard'||move==='skill') && phase>=6)return;
        const file=i?move+'-'+phase+'.webp':'barracks.webp';
        fs.writeFileSync(path.join(process.env.PREVIEW_DIR,file),Buffer.from(encoded,'base64'));
      });
    }
    console.log('Verified all 25 barracks and combat uniforms, individual full-body cells, eight-step walking and moving fire, portraits, stale loads and saved grades after relaunch.');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
