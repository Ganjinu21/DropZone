// Render the exact browser scenes at 25 fps, then run pack-clips.py with Pillow.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root=path.resolve(__dirname,'../../design/skill-lab'), out=path.resolve(__dirname,'../../work/skill-lab-bake');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.woff2':'font/woff2','.wav':'audio/wav'};
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';
    const asset=path.resolve(root,pathname);
    if(!asset.startsWith(root+path.sep)||!fs.existsSync(asset)||!fs.statSync(asset).isFile()){res.writeHead(404).end();return}
    res.setHeader('Content-Type',mime[path.extname(asset)]||'application/octet-stream');
    fs.createReadStream(asset).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>window.labReady);await page.evaluate(()=>document.fonts.ready);
    const jobs=await page.evaluate(()=>Object.entries(catalog).flatMap(([id,s])=>Object.keys(s.moves).map(mode=>({id,mode,duration:SkillLab[id].duration}))));
    for(const job of jobs){
      const data=await page.evaluate(({id,mode,duration})=>{
        const n=Math.ceil(duration/40), sheet=document.createElement('canvas'), c=document.createElement('canvas');
        sheet.width=400*8;sheet.height=160*Math.ceil(n/8);c.width=400;c.height=160;
        const g=sheet.getContext('2d'),frame=c.getContext('2d');
        for(let i=0;i<n;i++){drawScene(frame,id,mode,i*40);g.drawImage(c,400*(i%8),160*Math.floor(i/8))}
        return sheet.toDataURL('image/png').split(',')[1];
      },job);
      fs.writeFileSync(path.join(out,job.id+'-'+job.mode+'.png'),Buffer.from(data,'base64'));
    }
    fs.writeFileSync(path.join(out,'clips.json'),JSON.stringify(jobs));
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    await page.waitForFunction(()=>window.labReady);
    for(const {id,mode} of jobs){
      await page.locator('#roster button[data-id="'+id+'"]').click();
      await page.locator('#modes button[data-mode="'+mode+'"]').click();
      await page.locator('#frames button').nth(2).click();
      const ok=await page.evaluate(()=>!playing&&$('frames').children.length===4&&$('portrait').complete&&$('portrait').naturalWidth>0);
      if(!ok)throw Error('Review controls or portrait failed: '+id+'/'+mode);
    }
    await page.locator('#sound').click();await page.locator('#speed').click();
    await page.screenshot({path:path.join(out,'review-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    if(await page.evaluate(()=>document.body.scrollWidth>innerWidth))throw Error('mobile horizontal overflow');
    if(errors.length)throw Error(errors.join('; '));console.log(jobs.length+' scenes rendered; file:// controls and mobile width passed');
  }finally{if(browser)await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
