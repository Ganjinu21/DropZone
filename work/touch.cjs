const {chromium}=require('playwright'),path=require('path'),{pathToFileURL}=require('url');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu']});
try{const page=await browser.newPage({viewport:{width:780,height:360},hasTouch:true,isMobile:true});await page.goto(pathToFileURL(path.resolve('game/index.html')).href);await require('./select-test-squad.cjs')(page);
const c=await page.context().newCDPSession(page);let x=await page.evaluate(()=>run.x);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:100,y:220,id:1}]});await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:155,y:220,id:1}]});await page.waitForTimeout(300);
const b=await page.locator('.operator').nth(2).boundingBox(), p={x:b.x+b.width/2,y:b.y+b.height/2,id:2};await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:155,y:220,id:1},p]});await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:155,y:220,id:1},{...p,x:p.x+18}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{x:155,y:220,id:1}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
let state=await page.evaluate(()=>({x:run.x,lead:run.lead,stick}));console.log('touch',state);if(state.x<=x||state.stick)throw Error('joystick');if(state.lead!==2)throw Error('simultaneous touch switch');
await page.evaluate(()=>{run.level++;openUpgrade()});await page.locator('.card').nth(2).tap();await page.locator('#equip').tap();if(await page.evaluate(()=>mode!=='play'||run.up.reduce((a,b)=>a+b,0)!==1))throw Error('touch upgrade');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1})

