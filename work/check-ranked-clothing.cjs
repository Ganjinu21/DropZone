const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const gameDirectory=path.join(__dirname,'../game');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:393,height:852}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('http://clothing.test/**',route=>{
      const file=path.join(gameDirectory,decodeURIComponent(new URL(route.request().url()).pathname));
      return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});
    });
    await page.addInitScript(()=>{
      window.requestAnimationFrame=()=>0;
      localStorage.setItem('dropzone.dev.squad.v1','[4,0,3]');
    });
    await page.goto('http://clothing.test/index.html');
    await page.locator('#start:enabled').waitFor();
    await page.locator('#select-team').click();
    const rows=await page.evaluate(async()=>{
      const check=(test,message)=>{if(!test)throw Error(message)};
      const gearSlots=['helmet','top','gloves','pants','boots'];
      const colours=['#b8c5ab','#acc687','#82beb3','#c1a9ce','#f1ba6c'];
      const rankTitles=['민간 장구','야전 장구','돌입 장구','중장 장구','펄스 장구'];
      const slots=['헬멧','상의','장갑','하의','신발'];
      await document.fonts.ready;
      const loadImage=async url=>{const img=new Image(); img.src=url;await img.decode();return img};
      const iconRows=await Promise.all(gearSlots.map(slot=>Promise.all(rankedTiers.map(async grade=>{
        const item=gearByKey.get(slot+'-'+grade.variant);
        return {img:await loadImage(itemImage(item)),label:item.label};
      }))));
      const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
      const lensPixels=(image,box)=>{
        const c=canvas(box[2],box[3]),g=c.getContext('2d');g.drawImage(image,...box,0,0,c.width,c.height);
        const rgb=g.getImageData(0,0,c.width,c.height).data;let count=0;
        for(let n=0;n<rgb.length;n+=4)if(rgb[n+3]>220 && rgb[n+1]>135 && rgb[n+1]>rgb[n]+35 && rgb[n+2]>rgb[n]+28)count++;
        return count;
      };
      const frames=[];
      for(const id of names.keys()){
        const samples=[];
        for(const [tier,{rank,variant}] of rankedTiers.entries()){
          const row={...draftEquipment[id]};
          for(const slot of gearSlots)row[slot]=slot+'-'+variant;
          const op={id,loadout:row},sheet=crewOutfitSheet(op);
          const capBox=[22,0,90,42];
          check((lensPixels(sheet,capBox)>3)===(tier===4),'field optics '+id+' '+rank);
          for(let frame=0;frame<8;frame++){
            const box=[192*(frame+1)+22,0,90,44];
            check((lensPixels(sheet,box)>3)===(tier===4),'walking optics '+id+' '+rank+' frame '+frame);
          }
          const portrait=await loadImage(wornPortrait(id,row));
          check((lensPixels(portrait,[0,0,112,61])>3)===(tier===4),'portrait optics '+id+' '+rank);
          const preview=canvas(168,128);drawCrewPreview(preview,id,row);samples.push(preview);
        }
        frames.push(samples);
      }
      // Every grade must draw a different shape or material even when mixed with four starter slots.
      for(const id of names.keys()){
        for(const slot of gearSlots){
          const signatures=new Set();
          for(const {variant} of rankedTiers){
            const row={...draftEquipment[id],[slot]:slot+'-'+variant},preview=canvas(168,128);
            drawCrewPreview(preview,id,row);signatures.add(preview.toDataURL());
          }
          check(signatures.size===5,'indistinguishable grades '+id+' '+slot);
        }
      }
      function board(title,labels,cells,drawCell){
        const c=canvas(1190,922),g=c.getContext('2d');g.imageSmoothingEnabled=false;
        g.fillStyle='#171f21';g.fillRect(0,0,c.width,c.height);
        g.fillStyle='#ede6d2';g.font='bold 31px Arcade, sans-serif';g.fillText(title,29,53);
        const left=125,step=208,top=119,height=155;
        for(let j=0;j<5;j++){
          const x=left+j*step;g.fillStyle=colours[j];g.font='bold 23px Arcade, sans-serif';g.fillText(rankedTiers[j].rank,x+10,98);
          g.fillStyle='#d1cabc';g.font='17px Arcade, sans-serif';g.fillText(rankTitles[j],x+61,97);
          g.fillStyle=colours[j];g.fillRect(x,107,step-6,3);
        }
        for(let i=0;i<5;i++){
          const y=top+i*height;g.fillStyle='#d0d1c4';g.font='bold 20px Arcade, sans-serif';g.fillText(labels[i],29,y+height/2);
          for(let j=0;j<5;j++){
            const x=left+j*step;
            g.fillStyle=j===4?'#394044':'#343b3c';g.fillRect(x,y,step-6,height-5);
            drawCell(g,cells[i][j],x,y);
          }
        }
        return c.toDataURL('image/png').split(',')[1];
      }
      const inventory=board('생활관  /  등급별 장비',slots,iconRows,(g,cell,x,y)=>{
        const {img,label}=cell,scale=Math.min(2,150/img.width,98/img.height);
        const w=Math.round(img.width*scale),h=Math.round(img.height*scale);
        g.drawImage(img,Math.round(x+(202-w)/2),Math.round(y+(113-h)/2),w,h);
        g.textAlign='center';g.fillStyle='#e8e0cf';g.font='16px Arcade, sans-serif';g.fillText(label,x+101,y+134);g.textAlign='left';
      });
      const worn=board('분대  /  장비 착용 모습',names,frames,(g,img,x,y)=>{
        g.drawImage(img,x+15,y+12,168,128);
      });
      return {inventory,worn};
    });
    await page.locator('[data-slot="helmet"]').click();
    await page.locator('[data-item="helmet-6"]').click();
    await page.locator('#item-action').click();
    await page.locator('#change-crew').click();
    assert.match(await page.locator('[data-pick="4"] img').getAttribute('src'),/cct-S-plus\.png$/);
    await page.locator('#save-team').click();
    await page.locator('#prep-save').click();
    await page.locator('#start').click();
    await page.locator('#hud').waitFor();
    assert.match(await page.locator('#party [data-i="4"] img').getAttribute('src'),/cct-S-plus\.png$/);
    const support=await page.evaluate(()=>{
      initializeRadioTeam();
      const chief=run.squad[4],variants=[];
      for(const {variant} of rankedTiers){
        chief.loadout={...chief.loadout,helmet:'helmet-'+variant};
        const sheet=crewOutfitSheet(chief);
        let count=0;
        const draw=ctx.drawImage;ctx.drawImage=function(image,...args){
          if(image===sheet)count++;
          return draw.call(this,image,...args);
        };
        try{for(const ally of run.radioTeam)cctRadioSprite(ally)}finally{ctx.drawImage=draw}
        variants.push(count>=2);
      }
      openUpgrade([8,0,6]);
      return variants;
    });
    assert.deepEqual(support,[true,true,true,true,true]);
    assert.match(await page.locator('#cards [data-operator="4"] .who img').getAttribute('src'),/cct-S-plus\.png$/);
    assert.deepEqual(errors,[]);
    if(process.env.PREVIEW_DIR){
      fs.mkdirSync(process.env.PREVIEW_DIR,{recursive:true});
      for(const [key,file] of [['inventory','Armor-Ranks.png'],['worn','Equipped-Armor.png']]){
        fs.writeFileSync(path.join(process.env.PREVIEW_DIR,file),Buffer.from(rows[key],'base64'));
      }
    }
    console.log('All 25 items render distinctly on all five operators. Only S+ has optics on native heads, eight walking frames and portraits. Live roster, HUD, augment and CCT support rigs passed.');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
