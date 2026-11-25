// NODE_PATH must contain Playwright. CHROME_PATH can select an installed browser.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const game=path.resolve(__dirname,'../../game');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
 try{
  const page=await browser.newPage();page.on('pageerror',e=>console.error(e.message));
  await page.route('http://battlefield.test/**',r=>{
    const uri=new URL(r.request().url()).pathname;
    const file=uri.startsWith('/source/')?path.join(__dirname,uri.slice(8)):path.join(game,uri);
    return fs.existsSync(file)&&fs.statSync(file).isFile()?r.fulfill({path:file}):r.fulfill({status:404,body:''});
  });
  await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
  await page.addScriptTag({path:path.join(__dirname,'water-frames.js')});
  const water=await page.evaluate(()=>makeWaterAtlas().toDataURL('image/png').split(',')[1]);
  fs.writeFileSync(path.join(game,'art/battlefields/water-8.png'),Buffer.from(water,'base64'));
  await page.goto('http://battlefield.test/index.html');await page.locator('#start:enabled').waitFor();
  await page.addScriptTag({path:path.join(__dirname,'aftermath.js')});
  await page.evaluate(async()=>{
    window.sourceImage=async uri=>{const im=new Image();im.src='/source/'+uri;await im.decode();return im};
    window.decalBank={};
    for(const id of ['wrecks','scars'])decalBank[id]=atlasCells(await sourceImage('districts/'+id+'.png'));
  });
  const args=process.argv.slice(2).map(Number),ids=args.length?args:Array.from({length:10},(_,i)=>i+1);
  for(const id of ids){
    const result=await page.evaluate(async id=>{
      const map=DistrictMaps[id-1],master=await sourceImage('restored/stage-'+id+'.png');
      const c=document.createElement('canvas');c.width=map.bounds.w;c.height=map.bounds.h;
      const g=c.getContext('2d',{alpha:false});g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
      g.filter=map.layout.axis?'saturate(.88) brightness(.99)':'saturate(.53) brightness(.82) contrast(1.06)';g.drawImage(master,0,0,c.width,c.height);g.filter='none';
      g.fillStyle='rgba(111,86,54,.07)';g.fillRect(0,0,c.width,c.height);
      bakeAftermath(g,id,decalBank);
      for(const e of map.exits)TransitKit.drawEntrance(g,e);
      const card=document.createElement('canvas');card.width=1040;card.height=560;
      const crop=map.layout.card;
      card.getContext('2d').drawImage(c,crop[0]*map.scale,crop[1]*2000/300,crop[2]*map.scale,crop[2]*map.scale*350/650,0,0,card.width,card.height);
      const encode=(canvas)=>canvas.toDataURL('image/webp',.975).split(',')[1];
      return [encode(c),encode(card)];
    },id);
    for(const [i,file] of ['battlefields/seoul-','stages/stage-'].entries())
      fs.writeFileSync(path.join(game,'art',file+id+'.webp'),Buffer.from(result[i],'base64'));
    console.log('Baked',id);
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
