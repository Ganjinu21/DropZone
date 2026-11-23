const {chromium}=require('playwright'),{pathToFileURL}=require('url'),path=require('path'),fs=require('fs');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu']});try{
 const page=await browser.newPage({viewport:{width:1120,height:630}});await page.goto(pathToFileURL(path.resolve('game/index.html')).href);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.locator('#start:enabled').waitFor();await page.evaluate(()=>document.fonts.ready);
 const shot=async id=>{await page.waitForTimeout(90);await page.screenshot({path:'work/'+id+'-preview.png'})};
 await shot('lobby');await require('./select-test-squad.cjs')(page);await page.evaluate(()=>{for(let i=0;i<1150;i++){if(mode==='upgrade')applyUpgrade();if(mode==='play')update(1/60)}render()});await shot('play');
 await page.click('#pause');await shot('pause');await page.click('#resume');
 await page.evaluate(()=>{run.level++;openUpgrade()});await page.locator('.card').nth(1).click();await shot('augment');
 const check=await page.evaluate(()=>({font:document.fonts.check('700 24px Arcade','증강'),regular:document.fonts.check('400 12px Arcade','사격'),icons:[...document.querySelectorAll('.item img')].every(i=>i.complete&&i.naturalWidth>0)}));console.log(check);if(Object.values(check).includes(false))throw Error('art/font');
 await page.click('#equip');await page.evaluate(()=>end(true));await shot('win');await page.click('#resume');await page.evaluate(()=>{run.squad.forEach(v=>v.hp=0);end(false)});await shot('loss');
 if(errors.length)throw Error(errors.join('\n'))}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1})
