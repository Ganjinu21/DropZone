const dragControl=require('./drag-control.cjs');
const {chromium}=require('playwright');
const path=require('path'), {pathToFileURL}=require('url');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--disable-crash-reporter']});try{
const page=await browser.newPage({viewport:{width:1000,height:560}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto(pathToFileURL(path.resolve('game/index.html')).href);await page.locator('#start:enabled').waitFor();
await page.screenshot({path:'work/lobby-preview.png'});await require('./select-test-squad.cjs')(page);const startX=await page.evaluate(()=>run.x);await page.mouse.move(200,280);await page.mouse.down();await page.mouse.move(280,280);await page.waitForTimeout(400);await page.mouse.up();await dragControl(page,page.locator('#party .operator').nth(1));if(await page.evaluate(x=>run.lead!==1||run.x<=x,startX))throw Error('move or leader');
await page.screenshot({path:'work/play-preview.png'});await page.click('#pause');await page.click('#resume');
const state=await page.evaluate(()=>{for(let i=0;i<2400&&mode==='play';i++){const gems=run.crystals.slice().sort((a,b)=>dist(run,a)-dist(run,b));if(gems.length){const g=gems[0],l=dist(run,g)||1;stick={dx:(g.x-run.x)/l,dy:(g.y-run.y)/l,x:0,y:0}}update(1/60)}return {mode,level:run.level,kills:run.kills,xp:run.xp}});console.log('Natural level-up',state);
if(state.mode!=='upgrade')throw Error('no upgrade');
await page.screenshot({path:'work/augment-preview.png'});let k=await page.evaluate(()=>offers[1]);await page.locator('.card').nth(1).click();await page.click('#equip');if(await page.evaluate(k=>run.up[k]!==1,k))throw Error('equip');
await page.evaluate(()=>{
  start();
  const assert=(condition, message)=>{if(!condition) throw Error(message)};
  run.up[2]=1;
  run.t=299.99;
  update(.02);
  assert(mode==='play' && run.stage===1 && run.wave===1,'elapsed time ended a stage');
  for(let stage=1;stage<=3;stage++){
    for(let wave=1;wave<=3;wave++){
      assert(run.stage===stage && run.wave===wave && !run.bossPhase,'incorrect wave entry');
      run.remaining=8.01;
      update(.02);
      assert(run.bigWave,'missing final rush');
      run.remaining=.01;
      for(let step=0;step<600 && run.wave===wave && !run.bossPhase;step++){
        run.enemies.length=0;
        update(1/60);
      }
    }
    assert(run.bossPhase,'missing boss phase');
    for(let i=0;i<120 && !run.boss;i++)update(1/60);
    const boss=run.boss;
    assert(boss && boss.hp>0 && run.enemies.includes(boss),'missing live boss');
    run.remaining=0;
    update(.02);
    assert(mode==='play' && run.stage===stage && run.boss===boss,'advanced past a live boss');
    damageEnemy(boss,boss.hp);
    update(.02);
    if(stage<3){
      assert(run.stage===stage+1 && run.wave===1 && !run.bossPhase,'boss kill did not start next stage');
      assert(run.up[2]===1,'upgrade lost on transition');
    }
  }
});
if(await page.locator('#dialogtitle').innerText()!=='작전 완료')throw Error('final boss victory');
await page.click('#resume');await page.evaluate(()=>{run.squad.forEach(m=>{m.hp=.1;m.hurt=0;m.cool=999});run.enemies=run.squad.map((m,i)=>({...m,type:2,phase:i,speed:0,hp:100,max:100}));for(let i=0;i<120&&mode==='play';i++)update(.03)});if(await page.locator('#dialogtitle').innerText()!=='분대 전멸')throw Error('defeat');
await page.click('#homebtn');await page.click('#start');console.log('fresh run',await page.evaluate(()=>[run.level,run.kills,run.up.reduce((a,b)=>a+b,0)]));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1})


