const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-proxy-server']}); try {
const p=await b.newPage({viewport:{width:1100,height:940}}); const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto(process.env.COMBAT_LAB_URL || 'http://127.0.0.1:8766');
const status=()=>p.evaluate(()=>document.querySelector('iframe').contentWindow.combatLab.status());
await p.waitForFunction(()=>document.querySelector('iframe').contentWindow.combatLab?.ready() && document.querySelector('#crew').options.length===5);
for(const rank of ['A','S+']) for(let i=0;i<5;i++){ await p.selectOption('#rank',rank);
 await p.selectOption('#crew',String(i)); await p.click('#reset');await p.click('#pause');await p.click('#basic');
 const fired=await status();assert(fired.effects+fired.rounds>0,'no basic shot for '+i);
 const before=(await status()).time;
 await p.click('#skill');await p.click('#step');
 assert((await status()).time>before);
 await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('스킬 재생'));
}
await p.selectOption('#scene','boss');await p.waitForTimeout(1500);await p.screenshot({path:'work/combat-lab.png'});
await p.selectOption('#speed','0.5');await p.uncheck('#trail');
const reloaded = p.waitForNavigation(); require('node:fs').utimesSync('game/render.js', new Date(), new Date()); await reloaded;await p.waitForFunction(()=>document.querySelector('#crew').options.length===5);
assert.equal(await p.inputValue('#crew'),'4');assert.equal(await p.inputValue('#speed'),'0.5');
assert.equal(await p.isChecked('#trail'),false);
assert.deepEqual(errors,[]);console.log('All five basic attacks and skills, step, boss setup, and settings retention passed');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});




