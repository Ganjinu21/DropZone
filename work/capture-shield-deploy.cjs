const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
  try{
    const page=await browser.newPage({viewport:{width:420,height:780},deviceScaleFactor:2});
    await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
    await page.route('http://bunker.test/**',r=>r.fulfill({path:path.join(process.cwd(),'game',new URL(r.request().url()).pathname)}));
    await page.goto('http://bunker.test/index.html');
    await require('./select-test-squad.cjs')(page);
    const strip=await page.evaluate(()=>{
      run.talents.bulkSkill=true;
      run.squad[0].weapon=gearByKey.get('pistol-3');
      run.enemies=[];run.spawn=999;
      const w=460,h=330,n=92;
      const sequence=document.createElement('canvas');
      sequence.width=5*w;sequence.height=Math.ceil(n/5)*h;
      const g=sequence.getContext('2d'),forward=new Set(),reverse=new Set();
      const rising=new Set(),lowering=new Set();
      const sounds=[],play=skillAudio.play;
      skillAudio.play=function(id,name,...args){
        if(id===0 && run.activeSkill)sounds.push([name,run.activeSkill.age]);
        return play.call(this,id,name,...args);
      };
      const draw=ctx.drawImage;let center;
      const wing=run.lineup.filter(id=>id!==0);
      const drawMember=drawHero,seen=new Set();
      drawHero=m=>{if(ctx.globalAlpha>.99)seen.add(m.id);drawMember(m)};
      ctx.drawImage=function(im,...args){
        if(im===art.bunkerDeploy && args[2]===im.width/6){
          const [sx,sy,sw,sh,x,y]=args;
          const cel=sy/sh*6+sx/sw;
          if(cel<19)(run.activeSkill.phase==='retract'?reverse:forward).add(cel);
          else (run.activeSkill.phase==='retract'?lowering:rising).add(cel);
          center=this.getTransform().transformPoint(new DOMPoint(0,-42));
        }
        if([art.bulkBase,art.bulkField144,art.bulkField72].includes(im)){
          center=this.getTransform().transformPoint(new DOMPoint(0,-42));
        }
        return draw.call(this,im,...args);
      };
      try{
        for(let i=0;i<n*2;i++){
          if(i===16 && !activateSquadSkill())throw Error('Cast failed');
          if(i===110){
            const fort=run.activeSkill;
            if(fort.phase!=='fire' || !wing.every(id=>fort.entered[id] && dist(run.squad[id],fort.seats[id])<1))throw Error('Crew failed to board');
            if(!activateSquadSkill())throw Error('Recall failed');
          }
          const before=wing.map(id=>({...run.squad[id]}));
          seen.clear();
          render();
          const fort=run.activeSkill;
          const time=fort?.phase==='retract'?fort.foldTime:fort?.age;
          const shut=fort && time>=bunkerFrameEnds[16];
          if(!wing.every(id=>seen.has(id)===!shut))throw Error('Crew drawn on wrong side of doors at '+i);
          if(i%2===0){const j=i/2;g.drawImage(cv,center.x-w/2,center.y-h/2,w,h,(j%5)*w,Math.floor(j/5)*h,w,h)}
          update(1/60);
          if(before.some((m,j)=>dist(m,run.squad[wing[j]])>6))throw Error('A teammate snapped at '+i+' '+before.map((m,j)=>dist(m,run.squad[wing[j]])));
        }
      }finally{ctx.drawImage=draw;drawHero=drawMember;skillAudio.play=play}
      const expected=Array.from({length:bunkerFrameEnds.length},(_,i)=>i);
      if([...forward].join()!==expected.join() || [...reverse].join()!==expected.reverse().join() || run.activeSkill)
        throw Error('The live renderer skipped assembly or retraction frames');
      const walls=Array.from({length:16},(_,i)=>19+i);
      if([...rising].join()!==walls.join() || [...lowering].join()!==walls.reverse().join())
        throw Error('Missing rear wall frame during assembly or recall');
      const slams=sounds.filter(([name])=>name==='plant');
      const cannon=sounds.find(([name])=>name==='cannon');
      if(slams.length!==1 || slams[0][1]<bunkerSlamAt || slams[0][1]>=bunkerLampAt ||
        !cannon || cannon[1]<bunkerDeployTime)throw Error('Door impact, ignition and first shot out of order');
      return sequence.toDataURL().split(',')[1];
    });
    fs.writeFileSync('work/bulk-deploy-capture.png',Buffer.from(strip,'base64'));
    console.log('Verified both passengers enter, close behind armor, fire and leave through the open doors.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
