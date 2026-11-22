const {chromium}=require('playwright');
const path=require('path'), {pathToFileURL}=require('url');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu','--disable-crash-reporter']});try{
const page=await browser.newPage({viewport:{width:1000,height:560}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto(pathToFileURL(path.resolve('game/index.html')).href);await page.locator('#start:enabled').waitFor();
await page.screenshot({path:'work/lobby-preview.png'});await page.click('#start');await page.keyboard.down('KeyD');await page.waitForTimeout(400);await page.keyboard.up('KeyD');await page.keyboard.press('2');if(await page.evaluate(()=>run.lead!==1||run.x<=W/2))throw Error('move or leader');
await page.screenshot({path:'work/play-preview.png'});await page.click('#pause');await page.click('#resume');
const state=await page.evaluate(()=>{for(let i=0;i<2400&&mode==='play';i++){const gems=run.crystals.slice().sort((a,b)=>dist(run,a)-dist(run,b));if(gems.length){const g=gems[0],l=dist(run,g)||1;stick={dx:(g.x-run.x)/l,dy:(g.y-run.y)/l,x:0,y:0}}update(1/60)}return {mode,level:run.level,kills:run.kills,xp:run.xp}});console.log('Natural level-up',state);
if(state.mode!=='upgrade')throw Error('no upgrade');
await page.screenshot({path:'work/augment-preview.png'});let k=await page.evaluate(()=>offers[1]);await page.locator('.card').nth(1).click();await page.click('#equip');if(await page.evaluate(k=>run.up[k]!==1,k))throw Error('equip');
await page.evaluate(()=>{run.t=299.99;update(.02)});if(await page.locator('#dialogtitle').innerText()!=='분대 생존')throw Error('victory');await page.click('#resume');await page.evaluate(()=>{run.squad.forEach(m=>{m.hp=.1;m.hurt=0;m.cool=999});run.enemies=run.squad.map((m,i)=>({...m,type:2,phase:i,speed:0,hp:100,max:100}));for(let i=0;i<120&&mode==='play';i++)update(.03)});if(await page.locator('#dialogtitle').innerText()!=='분대 전멸')throw Error('defeat');
await page.click('#homebtn');await page.click('#start');console.log('fresh run',await page.evaluate(()=>[run.level,run.kills,run.up.reduce((a,b)=>a+b,0)]));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1})


