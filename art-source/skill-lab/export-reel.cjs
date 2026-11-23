// Offline skill-dossier export. Requires Playwright and a local Chrome with AVC/AAC WebCodecs.
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const {createHash} = require('node:crypto');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../../design/skill-lab');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png',
  '.woff2':'font/woff2','.wav':'audio/wav','.mp4':'video/mp4'};
const contains = (folder,name) => name.startsWith(folder+path.sep);
let candidate;
const server=http.createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/__candidate.mp4'&&req.method==='GET'&&candidate){
      res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':candidate.length,'Cache-Control':'no-store'}).end(candidate);return;
    }
    const file=path.resolve(root,'.'+pathname);
    if(!contains(root,file)||req.method!=='GET'){res.writeHead(403).end();return}
    const bytes=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream',
      'Cache-Control':'no-store','Content-Length':bytes.length}).end(bytes);
  } catch {res.writeHead(404).end()}
});

// ISO base media with interleaved 0.5-second chunks and a front-loaded index.
const raw=s=>Buffer.from(s,'ascii');
const u8=n=>Buffer.from([n]);
const u16=n=>{const b=Buffer.alloc(2);b.writeUInt16BE(n);return b};
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b};
const zero=n=>Buffer.alloc(n);
function box(name,...parts){
  const data=Buffer.concat(parts);return Buffer.concat([u32(data.length+8),raw(name),data]);
}
const full=(name,flags,...parts)=>box(name,u32(flags),...parts);
const matrix=Buffer.concat([u32(65536),zero(12),u32(65536),zero(12),u32(0x40000000)]);
function desc(tag,...parts) {
  const body=Buffer.concat(parts);
  if(body.length>127)throw Error('Unexpected descriptor size');
  return Buffer.concat([u8(tag),u8(body.length),body]);
}
function trackBox(t,id,offsets,chunkCounts) {
  const v=t.kind==='v',time=v?30:48000;
  const ticks=t.samples.reduce((n,s)=>n+s.delta,0);
  const tkhd=full('tkhd',7,zero(8),u32(id),zero(4),u32(Math.round(ticks/time*1000)),zero(8),
    u16(0),u16(0),u16(v?0:256),u16(0),matrix,u32(v?1280*65536:0),u32(v?720*65536:0));
  const mdhd=full('mdhd',0,zero(8),u32(time),u32(ticks),u16(0x55c4),zero(2));
  const hdlr=full('hdlr',0,zero(4),raw(v?'vide':'soun'),zero(12),raw(v?'Video\0':'Audio\0'));
  const cfg=Buffer.from(t.description,'base64');
  const entry=v?box('avc1',zero(6),u16(1),zero(16),u16(1280),u16(720),u32(0x00480000),
    u32(0x00480000),zero(4),u16(1),zero(32),u16(24),u16(65535),box('avcC',cfg)):
    box('mp4a',zero(6),u16(1),zero(8),u16(2),u16(16),zero(4),u32(48000*65536),
      full('esds',0,desc(3,u16(id),u8(0),desc(4,u8(0x40),u8(0x15),zero(3),u32(160000),u32(128000),desc(5,cfg)),desc(6,u8(2)))));
  const deltas=[];
  for(const s of t.samples){
    if(deltas.at(-1)?.delta===s.delta)deltas.at(-1).count++;
    else deltas.push({count:1,delta:s.delta});
  }
  const sync=t.samples.flatMap((s,i)=>s.key?[i+1]:[]);
  const chunkRuns=[];
  chunkCounts.forEach((count,i)=>{
    if(count!==chunkCounts[i-1])chunkRuns.push([u32(i+1),u32(count),u32(1)]);
  });
  const stbl=box('stbl',full('stsd',0,u32(1),entry),full('stts',0,u32(deltas.length),
    ...deltas.flatMap(r=>[u32(r.count),u32(r.delta)])),full('stsc',0,u32(chunkRuns.length),...chunkRuns.flat()),
    full('stsz',0,u32(0),u32(t.samples.length),...t.samples.map(s=>u32(s.size))),
    full('stco',0,u32(offsets.length),...offsets.map(u32)),
    ...(v?[full('stss',0,u32(sync.length),...sync.map(u32))]:[]));
  const dinf=box('dinf',full('dref',0,u32(1),full('url ',1)));
  return box('trak',tkhd,box('mdia',mdhd,hdlr,box('minf',v?full('vmhd',1,zero(8)):full('smhd',0,zero(4)),dinf,stbl)));
}
function chapterBox(chapters){
  const entries=chapters.map(({title,start})=>{
    const name=Buffer.from(title,'utf8'),time=Buffer.alloc(8);
    if(name.length>255)throw Error('Chapter name too long');
    time.writeBigUInt64BE(BigInt(Math.round(start*10000000)));
    return Buffer.concat([time,u8(name.length),name]);
  });
  return box('udta',full('chpl',0x01000000,u32(0),u8(entries.length),...entries));
}
function mux(t,chapters) {
  const ftyp=box('ftyp',raw('isom'),u32(0x200),raw('isomiso2avc1mp41'));
  const movieLength=Math.max(...t.map(tr=>Math.round(tr.samples.reduce((n,s)=>n+s.delta,0)/(tr.kind==='v'?30:48000)*1000)));
  const mvhd=full('mvhd',0,zero(8),u32(1000),u32(movieLength),u32(65536),u16(256),zero(10),matrix,zero(24),u32(3));
  const chunks=t.flatMap((track,id)=>{
    const bytes=Buffer.from(track.payload,'base64'),result=[];
    const video=track.kind==='v',countPerChunk=video?15:24,rate=video?30:48000;
    let ticks=0,offset=0;
    for(let i=0;i<track.samples.length;i+=countPerChunk){
      const group=track.samples.slice(i,i+countPerChunk),time=ticks/rate,start=offset;
      for(const sample of group){ticks+=sample.delta;offset+=sample.size}
      result.push({id,count:group.length,time,bytes:bytes.subarray(start,offset)});
    }
    if(offset!==bytes.length)throw Error('Encoded sample table size mismatch');
    return result;
  }).sort((a,b)=>a.time-b.time||a.id-b.id);
  const relative=t.map(()=>[]),counts=t.map(()=>[]);
  let cursor=0;
  for(const chunk of chunks){
    relative[chunk.id].push(cursor);counts[chunk.id].push(chunk.count);cursor+=chunk.bytes.length;
  }
  const build=start=>box('moov',mvhd,...t.map((tr,id)=>trackBox(tr,id+1,relative[id].map(n=>start+n),counts[id])),chapterBox(chapters));
  const moov=build(ftyp.length+build(0).length+8);
  return Buffer.concat([ftyp,moov,box('mdat',...chunks.map(c=>c.bytes))]);
}
async function render(){
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page=await browser.newPage();await page.goto(origin+'/index.html');
    await page.waitForFunction(()=>window.labReady);
    await page.evaluate(()=>{
      window.measureReelAudio=(audio,chapters)=>{
        const channels=Array.from({length:audio.numberOfChannels},(_,i)=>audio.getChannelData(i));
        let peak=0,clipped=0;
        for(const channel of channels){
          for(const sample of channel){
            if(!Number.isFinite(sample))throw Error('Invalid audio sample');
            const level=Math.abs(sample);
            if(level>peak)peak=level;
            if(level>=1)clipped++;
          }
        }
        const rms=chapters.map(({start,end})=>{
          const from=Math.round(start*audio.sampleRate),to=Math.min(audio.length,Math.round(end*audio.sampleRate));
          let energy=0;
          for(const channel of channels){
            for(let i=from;i<to;i++)energy+=channel[i]*channel[i];
          }
          return Math.sqrt(energy/((to-from)*channels.length));
        });
        return {peak,clipped,rms};
      };
    });
    const data=await page.evaluate(async()=>{
      setPlaying(false);
      await document.fonts.load('700 36px Gal','벌크 벙커 전개');
      const segments=Object.entries(catalog).flatMap(([id,bank])=>
        Object.keys(bank.moves).map(mode=>({id,mode,count:Math.ceil(SkillLab[id].duration*30/1000)})));
      const portraits=new Map(await Promise.all(Object.keys(catalog).map(async id=>{
        const image=new Image();image.src='portraits/'+id+'.png';await image.decode();
        return [id,image];
      })));
      const frame= document.createElement('canvas');frame.width=1280;frame.height=720;
      const g=frame.getContext('2d',{alpha:false});
      const scene=document.createElement('canvas');scene.width=400;scene.height=160;
      const s=scene.getContext('2d',{alpha:false});g.imageSmoothingEnabled=false;
      const label=(txt,x,y,size,color,align='left',font='Gal')=>{
        g.textAlign=align;g.fillStyle=color;g.font='700 '+size+'px '+font+', sans-serif';g.fillText(txt,x,y);
      };
      const introFrames=54;
      function paintIntro(n){
        const settle=1-(1-Math.min(n/15,1))**3;
        const light=g.createRadialGradient(980,355,25,935,358,760);
        light.addColorStop(0,'#3a515a');light.addColorStop(.58,'#22313a');light.addColorStop(1,'#141d23');
        g.fillStyle=light;g.fillRect(0,0,1280,720);
        g.fillStyle='#a3d6ee';g.fillRect(64,59,12,12);
        label('DROP ZONE SQUAD',91,74,22,'#e3e8df');
        g.fillStyle='#58717b';g.fillRect(64,101,1152,2);
        label('벌크',64,260,34,'#aad7e9');
        label('메카 벙커',60,369,82,'#f4f0df');
        label('고정 모드',61,463,74,'#f4f0df');
        g.fillStyle='#82b4ce';g.fillRect(64,522,72,4);
        label('탑승  →  착좌  →  교차 사격',64,580,28,'#d2e2df','left','"Malgun Gothic"');
        const portrait=portraits.get('bulk');
        const fit=Math.min(715/portrait.width,542/portrait.height)*(.97+.03*settle);
        const w=Math.round(portrait.width*fit),h=Math.round(portrait.height*fit);
        g.fillStyle='#111b2280';g.beginPath();g.ellipse(875,588,232,18,0,0,2*Math.PI);g.fill();
        g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
        g.drawImage(portrait,875-Math.floor(w/2),Math.round(366-h/2+7*(1-settle)),w,h);
        g.imageSmoothingEnabled=false;
      }
      function paintSegment(i,n) {
        const {id,mode,count}=segments[i],bank=catalog[id],item=bank.moves[mode];
        g.fillStyle='#151c20';g.fillRect(0,0,1280,720);
        g.fillStyle=bank.color;g.fillRect(40,28,11,11);
        label('DROP ZONE SQUAD',61,42,17,'#d7dcce');
        label('전투 동작 시안   '+String(i+1).padStart(2,'0')+' / '+String(segments.length).padStart(2,'0'),1240,42,16,'#b3b9ae','right');
        g.fillStyle='#3b494d';g.fillRect(40,58,1200,2);
        label(item[1],40,111,39,'#f1ead6');
        const portrait=portraits.get(id),fit=Math.min(180/portrait.width,112/portrait.height);
        const artW=Math.round(portrait.width*fit),artH=Math.round(portrait.height*fit);
        g.fillStyle='#151c20';g.fillRect(800,0,188,128);
        g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
        g.drawImage(portrait,894-Math.floor(artW/2),Math.round((130-artH)/2),artW,artH);
        g.imageSmoothingEnabled=false;
        label(bank.name+'   /   '+item[0],1240,108,23,bank.color,'right');
        g.fillStyle='#617071';g.fillRect(39,131,1202,482);
        drawScene(s,id,mode,n*1000/30);g.drawImage(scene,40,132,1200,480);
        const caption=item[2],captionFont='"Malgun Gothic", sans-serif';
        let size=23;
        g.font='700 '+size+'px '+captionFont;
        while(g.measureText(caption).width>1200&&size>16)g.font='700 '+(--size)+'px '+captionFont;
        label(caption,40,657,size,'#d3d8ca','left',captionFont);
        const gap=7,span=(1200+gap)/segments.length;
        for(let j=0;j<segments.length;j++){
          const offset=Math.round(j*span),x=40+offset,width=Math.round((j+1)*span)-offset-gap;
          g.fillStyle='#344145';g.fillRect(x,688,width,4);
          if(j<=i){g.fillStyle=j===i?bank.color:'#78857c';g.fillRect(x,688,j===i?Math.round(width*(n+1)/count):width,4)}
        }
      }
      const base64=b=>new Promise(resolve=>{const r=new FileReader;r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(new Blob([b]));});
      function sink(kind) {
        const samples=[],parts=[];let cfg,prev=-Infinity;
        return {onChunk(chunk,info){
          if(chunk.timestamp<=prev)throw Error('Non-monotonic '+kind+' timestamp');prev=chunk.timestamp;
          const dst=new Uint8Array(chunk.byteLength);chunk.copyTo(dst);parts.push(dst);
          samples.push({delta:kind==='v'?1:1024,size:dst.length,key:chunk.type==='key'});
          if(info?.decoderConfig?.description&&!cfg)cfg=info.decoderConfig.description;
        },async pack(){
          if(!cfg)throw Error('Missing '+kind+' codec initialization');
          return {kind,samples,description:await base64(cfg),payload:await base64(await new Blob(parts).arrayBuffer())};
        }};
      }
      const vv=sink('v'),aa=sink('a'),errors=[];
      const video=new VideoEncoder({output:vv.onChunk,error:e=>errors.push(String(e))});
      video.configure({codec:'avc1.42001f',width:1280,height:720,bitrate:3400000,bitrateMode:'variable',
        framerate:30,latencyMode:'realtime',avc:{format:'avc'}});
      const frames=introFrames+segments.reduce((n,row)=>n+row.count,0),rate=48000;
      const offline=new OfflineAudioContext(2,frames*rate/30,rate),buffers=new Map(),events=[];
      let f=0;const chapters=[];
      async function submitFrame(keyFrame){
        const ts=Math.round(f*1e6/30),end=Math.round((f+1)*1e6/30);
        const vf=new VideoFrame(frame,{timestamp:ts,duration:end-ts});
        video.encode(vf,{keyFrame});vf.close();
        if(video.encodeQueueSize>12)await new Promise(resolve=>video.addEventListener('dequeue',resolve,{once:true}));
      }
      for(;f<introFrames;f++){
        paintIntro(f);
        if(f===30)window.reelCover=await createImageBitmap(frame);
        await submitFrame(f===0);
      }
      for(let i=0;i<segments.length;i++){
        const {id,mode,count}=segments[i];
        const keyframes=catalog[id].moves[mode][3];
        const proofFrame={'bulk/skill':3,'lynx/skill':0}[id+'/'+mode]??2;
        const representative=keyframes[proofFrame][0];
        const title=catalog[id].name+' · '+catalog[id].moves[mode][1];
        chapters.push({id,mode,title,start:f/30,end:(f+count)/30,representative});
        for(const [ms,name] of SkillLab[id].sounds(mode)){
          if(!Number.isFinite(ms)||ms<0||ms>=count*1000/30)throw Error('Sound outside chapter: '+id+'/'+mode+' '+ms);
          events.push([f/30+ms/1000,name]);
        }
        for(let n=0;n<count;n++,f++){
          paintSegment(i,n);
          await submitFrame(n===0||n%60===0);
        }
      }
      await video.flush();video.close();
      for(const id of new Set(events.map(e=>e[1]))){
        const response=await fetch('audio/'+id+'.wav');
        if(!response.ok)throw Error('Missing audio/'+id+'.wav');
        const buf=await response.arrayBuffer();
        buffers.set(id,await offline.decodeAudioData(buf));
      }
      for(const [when,id] of events){
        const src=offline.createBufferSource();
        src.buffer=buffers.get(id);src.connect(offline.destination);src.start(when);
      }
      const rendered=await offline.startRendering(),audio=new AudioEncoder({output:aa.onChunk,error:e=>errors.push(String(e))});
      const mix=measureReelAudio(rendered,chapters);
      const masterGain=Math.min(1,10**(-3/20)/mix.peak);
      const channels=[rendered.getChannelData(0),rendered.getChannelData(1)];
      for(const channel of channels)for(let i=0;i<channel.length;i++)channel[i]*=masterGain;
      audio.configure({codec:'mp4a.40.2',sampleRate:rate,numberOfChannels:2,bitrate:128000});
      for(let i=0;i<rendered.length;i+=4096){
        const n=Math.min(4096,rendered.length-i),planar=new Float32Array(n*2);
        planar.set(channels[0].subarray(i,i+n));planar.set(channels[1].subarray(i,i+n),n);
        const af=new AudioData({format:'f32-planar',sampleRate:rate,numberOfChannels:2,numberOfFrames:n,timestamp:Math.round(i*1e6/rate),data:planar});
        audio.encode(af);af.close();if(audio.encodeQueueSize>16)await new Promise(r=>setTimeout(r,4));
      }
      await audio.flush();audio.close();if(errors.length)throw Error(errors.join('; '));
      return {tracks:[await vv.pack(),await aa.pack()],chapters,masterGain,mixPeak:mix.peak,events:events.length};
    });
    const target=path.join(root,'skill-reel.mp4');
    const share=path.resolve(root,'../../dist/DropZone-Squad-Skill-Preview-v3.mp4');
    candidate=mux(data.tracks,data.chapters);
    const verified=await page.evaluate(async chapters=>{
      const b=await(await fetch('/__candidate.mp4')).arrayBuffer();
      const ctx=new OfflineAudioContext(2,1,48000),audio=await ctx.decodeAudioData(b.slice(0));
      const audioLevels=measureReelAudio(audio,chapters);
      const video=document.createElement('video');video.preload='auto';
      video.src=URL.createObjectURL(new Blob([b],{type:'video/mp4'}));
      await new Promise((res,rej)=>{video.onloadedmetadata=res;video.onerror=()=>rej(Error('Cannot demux MP4'))});
      const sample=document.createElement('canvas'),reference=document.createElement('canvas');
      sample.width=reference.width=400;sample.height=reference.height=160;
      const snap=sample.getContext('2d',{willReadFrequently:true}),ref=reference.getContext('2d',{willReadFrequently:true});
      snap.imageSmoothingEnabled=false;
      const sheet=document.createElement('canvas'),tileWidth=480,tileHeight=270,coverHeight=400;
      sheet.width=3*tileWidth;sheet.height=coverHeight+Math.ceil(chapters.length/3)*tileHeight;
      const gallery=sheet.getContext('2d'),rgbErrors=[];
      gallery.fillStyle='#151c20';gallery.fillRect(0,0,sheet.width,sheet.height);
      const seek=t=>new Promise((res,rej)=>{video.onseeked=res;video.onerror=()=>rej(Error('Frame decode failed at '+t));video.currentTime=t});
      const compare=()=>{
        const actual=snap.getImageData(0,0,400,160).data,expected=ref.getImageData(0,0,400,160).data;
        let delta=0;
        for(let j=0;j<actual.length;j++)if(j%4!==3)delta+=Math.abs(actual[j]-expected[j]);
        return delta/(400*160*3);
      };
      await seek(1+0.5/30);
      gallery.drawImage(video,(sheet.width-coverHeight*16/9)/2,0,coverHeight*16/9,coverHeight);
      ref.imageSmoothingEnabled=false;
      ref.drawImage(window.reelCover,0,0,400,160);
      snap.drawImage(video,0,0,400,160);
      const coverError=compare();
      for(const [i,chapter] of chapters.entries()){
        const tick=Math.round(chapter.representative*30/1000);
        const t=chapter.start+(tick+0.5)/30;
        await seek(t);
        snap.drawImage(video,40,132,1200,480,0,0,400,160);
        drawScene(ref,chapter.id,chapter.mode,tick*1000/30);
        rgbErrors.push(compare());
        gallery.drawImage(video,i%3*tileWidth,coverHeight+Math.floor(i/3)*tileHeight,tileWidth,tileHeight);
      }
      await seek(0);
      video.muted=true;video.playbackRate=8;
      const ended=new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(Error('Timed out playing exported movie')),20000);
        video.onended=()=>{clearTimeout(timeout);resolve()};
        video.onerror=()=>{clearTimeout(timeout);reject(Error('Cannot play exported movie'))};
      });
      await video.play();await ended;
      const playbackEnded=video.ended;
      URL.revokeObjectURL(video.src);
      return {width:video.videoWidth,height:video.videoHeight,duration:video.duration,channels:audio.numberOfChannels,audioDuration:audio.duration,
        playbackEnded,...audioLevels,coverError,rgbErrors,sheet:sheet.toDataURL('image/png').split(',')[1]};
    },data.chapters);
    const {sheet,...checks}=verified;
    const duration=data.chapters.at(-1).end;
    if(checks.width!==1280||checks.height!==720||checks.channels!==2||!checks.playbackEnded||Math.abs(checks.duration-duration)>.08||
      Math.abs(checks.duration-checks.audioDuration)>.08||checks.peak<.1||checks.clipped||
      checks.rms.some(v=>!Number.isFinite(v)||v<.006)||checks.coverError>7||checks.rgbErrors.some(error=>error>7))throw Error(JSON.stringify(checks));
    const sheetPath=path.join(os.tmpdir(),'dropzone-skill-reel-frames.png');
    await fs.writeFile(sheetPath,Buffer.from(sheet,'base64'));
    await fs.mkdir(path.dirname(share),{recursive:true});
    await fs.writeFile(target,candidate);
    await fs.copyFile(target,share);
    const digest=b=>createHash('sha256').update(b).digest('hex'),sha256=digest(candidate);
    for(const file of [target,share])if(digest(await fs.readFile(file))!==sha256)throw Error('MP4 file differs: '+file);
    console.log(JSON.stringify({file:target,share,bytes:candidate.length,sha256,sheetPath,...checks,events:data.events,masterGain:data.masterGain,mixPeak:data.mixPeak,
      chapters:data.chapters.map(({id,mode,start,end})=>({id,mode,start,end}))}));
  } finally {await browser.close()}
}
render().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
