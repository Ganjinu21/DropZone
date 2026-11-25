const { chromium }=require('playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROME_PATH});
 try{
 const p=await b.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await p.route('http://operators.test/**',r=>r.fulfill({path:path.join(process.cwd(),'game',new URL(r.request().url()).pathname)}));
 await p.goto('http://operators.test/index.html');await require('./select-test-squad.cjs')(p);
 const results=await p.evaluate(()=>{
  const ids=[0,2,3,4],w=720,h=174,count=76,strip=document.createElement('canvas');strip.width=w*4;strip.height=h*Math.ceil(count/4);
  const out=strip.getContext('2d');cv.width=w;cv.height=h;
  const labels=['대기','측면 이동','전진','후진','기본 공격','스킬 동작'];
  for(let k=0;k<count;k++){
   ctx.setTransform(1,0,0,1,0,0);ctx.imageSmoothingEnabled=false;ctx.fillStyle='#202a30';ctx.fillRect(0,0,w,h);
   const scene=k<12?0:k<28?1:k<36?2:k<44?3:k<56?4:5;
   ctx.fillStyle='#ecdad0';ctx.font='12px sans-serif';ctx.fillText(labels[scene],12,20);
   run.t=k/12;
   ids.forEach((id,j)=>{
    ctx.save();ctx.translate(j*180+76,137);ctx.scale(1.55,1.55);
    const m={...run.squad[id],x:0,y:0,flip:1,weapon:gearByKey.get(weaponFamilies[id]+'-0'),loadout:{...savedEquipment[id]},aimPitch:0,aimTarget:null,signalAt:undefined};
    const age=scene===4?(k%4)*.045:Infinity;
    m.operatorAngle=[0,-Math.PI/4,Math.PI/2][Math.floor((k-44)/4)]??0;
    const moving=scene>0&&scene<4;m.moving=moving;m.gait=(k%8)*crewStrideLength/8;m.walkRow=scene===2?6:scene===3?7:1;
    footShadow(0,0,13);
    if(scene!==5)drawMemberGear(ctx,m,age,moving);
    else{
     const t=(k-56)/12,s={id,x:0,y:0,plantFacing:1,angle:0,age:t,lastFire:.5+Math.floor(Math.max(0,t-.5)/.42)*.42,duration:3.6,phase:t<.38?'charge':'fire'};
     if(id===0){
      if(t<.68)drawMemberGear(ctx,{...m,boarding:t/.68},Infinity,false);
      else drawBunker({...s,hp:100,maxHp:100,phase:'fire'});
     }
     if(id===2)drawRifleSkill(m,s);
     if(id===3)drawHammerSkill(m,s);
     if(id===4)drawMemberGear(ctx,{...m,signalAt:56/12},Infinity,false);
    }
    ctx.restore();ctx.fillStyle='#bfc9cc';ctx.textAlign='center';ctx.font='bold 14px sans-serif';ctx.fillText(names[id],j*180+83,162);ctx.textAlign='left';
   });
   out.drawImage(cv,k%4*w,Math.floor(k/4)*h);
  }
  // Verify all five independent equipment slots still affect the registered poses.
  for(const id of ids)for(const slot of [...wornSlots,'gloves']){
   const seen=new Set();
   for(const grade of rankedTiers){
    const m={...run.squad[id],x:75,y:80,flip:1,loadout:{...savedEquipment[id],[slot]:slot+'-'+grade.variant}};
    ctx.clearRect(0,0,w,h);drawMemberGear(ctx,m,Infinity,false);seen.add(cv.toDataURL());
   }
   if(seen.size!==5)throw Error('Indistinct grades: '+id+' '+slot);
  }
  const idle=document.createElement('canvas'),bw=800,bh=226,frames=80;
  idle.width=bw*5;idle.height=bh*Math.ceil(frames/5);
  cv.width=bw;cv.height=bh;
  for(let frame=0;frame<frames;frame++){
   run.t=frame/24;
   ctx.fillStyle='#202a30';ctx.fillRect(0,0,bw,bh);
   ids.forEach((id,col)=>{
    const m={...run.squad[id],x:0,y:0,flip:1,moving:false,signalAt:undefined};
    ctx.save();ctx.translate(96+200*col,180);ctx.scale(2.65,2.65);
    footShadow(0,0,13);drawMemberGear(ctx,m,Infinity,false);ctx.restore();
    ctx.fillStyle='#dbe2df';ctx.font='16px sans-serif';ctx.textAlign='center';ctx.fillText(names[id],96+200*col,208);
   });
   idle.getContext('2d').drawImage(cv,frame%5*bw,Math.floor(frame/5)*bh);
  }
  return [strip,idle].map(canvas=>canvas.toDataURL().split(',')[1]);
 });
 if(errors.length)throw Error(errors.join('\n'));
 for(const [n,key] of ['operator-preview-strip','operator-breath-strip'].entries())
  fs.writeFileSync('work/'+key+'.png',Buffer.from(results[n],'base64'));
 console.log('All four operator renders, skills and 100 independent slot/grade combinations passed.');
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
