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
    // Preserve each doorway's world footprint while using all available source pixels.
    function bounds(image,x,y,w,h){
      const c=document.createElement('canvas');c.width=w;c.height=h;
      const g=c.getContext('2d');g.drawImage(image,x,y,w,h,0,0,w,h);
      const data=g.getImageData(0,0,w,h).data;
      let l=w,r=-1,t=h,b=-1;
      for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(data[(yy*w+xx)*4+3]>42){
        l=Math.min(l,xx);r=Math.max(r,xx);t=Math.min(t,yy);b=Math.max(b,yy);
      }
      return [x+l,y+t,r-l+1,b-t+1];
    }
    const entrances=await sourceImage('painted/entrances.png'),cells=[];
    for(let row=0;row<2;row++)for(let col=0;col<4;col++){
      const colX=Math.floor(col*entrances.width/4),rowY=Math.floor(row*entrances.height/2);
      const source=bounds(entrances,colX,rowY,Math.floor((col+1)*entrances.width/4)-colX,Math.floor((row+1)*entrances.height/2)-rowY);
      const [x,y,w,h]=bounds(art.transitKit,col*128,row*128,128,128);
      cells.push({source,x:x-col*128,y:y-row*128,w,h});
    }
    window.paintedEntrances={image:entrances,cells};
    window.decalBank={};
    for(const id of ['wrecks','scars'])decalBank[id]=atlasCells(await sourceImage('painted/'+id+'.png'));
  });
  const args=process.argv.slice(2).map(Number),ids=args.length?args:Array.from({length:10},(_,i)=>i+1);
  for(const id of ids){
    const size=await page.evaluate(async id=>{
      const map=DistrictMaps[id-1],master=await sourceImage('painted/'+id+'.webp');
      const density=2,c=document.createElement('canvas');c.width=map.bounds.w*density;c.height=map.bounds.h*density;
      const g=c.getContext('2d',{alpha:false});g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
      g.scale(density,density);
      g.drawImage(master,0,0,map.bounds.w,map.bounds.h);
      bakeAftermath(g,id,decalBank);
      for(const e of map.exits)TransitKit.drawEntrance(g,e,paintedEntrances);
      window.paintedMap=c;
      return [map.bounds.w,map.bounds.h];
    },id);
    const tileRoot=path.join(game,'art/battlefields/painted',String(id));
    fs.mkdirSync(tileRoot,{recursive:true});
    const render=async(name,crop,w,h)=>{
      const data=await page.evaluate(({crop,w,h})=>{
        const c=document.createElement('canvas');c.width=w;c.height=h;
        const g=c.getContext('2d',{alpha:false});g.imageSmoothingQuality='high';
        g.drawImage(paintedMap,...crop,0,0,w,h);
        return c.toDataURL('image/webp',.96).split(',')[1];
      },{crop,w,h});
      fs.writeFileSync(name,Buffer.from(data,'base64'));
    };
    for(let y=0;y<size[1];y+=512)for(let x=0;x<size[0];x+=512){
      // Two texels of neighbouring paint at interior seams for filtered mobile sampling.
      const left=Math.max(0,x-1),top=Math.max(0,y-1);
      const w=(Math.min(x+513,size[0])-left)*2,h=(Math.min(y+513,size[1])-top)*2;
      await render(path.join(tileRoot,(x/512)+'-'+(y/512)+'.webp'),[left*2,top*2,w,h],w,h);
    }
    await render(path.join(game,'art/battlefields/seoul-'+id+'.webp'),[0,0,size[0]*2,size[1]*2],...size);
    const crop=await page.evaluate(id=>{
      const m=DistrictMaps[id-1],[x,y,w]=m.layout.card,width=w*m.scale*2;
      return [x*m.scale*2,y*(2000/300)*2,width,width*350/650];
    },id);
    await render(path.join(game,'art/stages/stage-'+id+'.webp'),crop,1040,560);
    console.log('Baked',id);
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
