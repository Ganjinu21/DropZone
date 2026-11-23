'use strict';
const artRoot = '../../game/art/tag-combat/';
const roles = [
  { title:'벌크 · 방패 전개', note:'왼팔의 파란 방패로 전면을 막고, 오른손 권총으로 한 발씩 반격합니다.', accent:'#82bcff', cycle:1180, shots:[285] },
  { title:'레이븐 · 쌍권총 속사', note:'가까운 오른손과 먼 왼손이 한 발씩 번갈아 튑니다. 네 발을 몰아친 뒤 잠시 쉽니다.', accent:'#ff9b73', cycle:850, shots:[260,360,460,560] },
  { title:'링스 · 관통 사격', note:'왼손으로 총 앞쪽을 받치고, 오른손으로 한 발을 끊어 쏩니다. 같은 선상의 표적 세 곳에 차례로 충격이 생깁니다.', accent:'#91d6cc', cycle:1580, shots:[330] }
];
const names=['bulk','raven','lynx'];
const $ = id => document.getElementById(id);
const stage = $('stage').getContext('2d');
const files={units:artRoot+'units.png',gear:artRoot+'units-gear.png',equip:artRoot+'units-equip.png',fx:artRoot+'fx.png',enemy:'../../game/combat-units.png',street:'street.png'};
const art={}, sounds={}, activeSounds=new Set();
let role=0, elapsed=0, running=true, audible=false, lastTime=null, ready=false;
const modifiers={bulk:0.72,'raven-a':0.66,'raven-b':0.66,lynx:0.76,support:0.62,hit:0.53,block:0.70};
for (const name of Object.keys(modifiers)) {
  const audio = new Audio(artRoot+'sfx/'+name+'.wav'); audio.preload='auto'; sounds[name]=audio;
}
function playSound(name){
  if(!audible||document.hidden)return;
  const s=sounds[name].cloneNode(); s.volume=modifiers[name]; activeSounds.add(s);
  const release=()=>activeSounds.delete(s);s.onended=release;s.play().catch(release);
}
function silence(){for (const s of activeSounds)s.pause();activeSounds.clear()}
function cell(g,image,col,row,w,h,x,y,scale=1) {
  g.imageSmoothingEnabled=false;
  g.drawImage(image,col*w,row*h,w,h,Math.round(x),Math.round(y),w*scale,h*scale);
}
function drawPanels(){
  const gear=$('gear').getContext('2d'), strip=$('strip').getContext('2d');
  gear.clearRect(0,0,260,108); strip.clearRect(0,0,320,108);
  // Crop the transparent margins from each isolated equipment cell at display time.
  const bounds = ATLAS.gearBounds[role], [x,y,w,h]=bounds;
  const zoom=Math.min(4,Math.floor(210/w),Math.floor(94/h));
  gear.imageSmoothingEnabled=false;
  gear.drawImage(art.gear,x,64*role+y,w,h,Math.floor((260-w*zoom)/2),Math.floor((108-h*zoom)/2),w*zoom,h*zoom);
  [0,1,role===1?3:2].forEach((col,i)=>cell(strip,art.units,col,role,96,64,4+i*101,22));
  document.querySelector('.captions').replaceChildren(...(role===1?['준비','오른손','왼손']:['준비','발사','복귀']).map(s=>{const n=document.createElement('span');n.textContent=s;return n}));
}
function effect(name,age,x,y){
  if(age<0)return;
  const clip=ATLAS.fx[name], total=clip.durationMs.reduce((a,b)=>a+b,0);
  if(clip.loop)age%=total;
  let col=0;while(col<clip.durationMs.length && age>=clip.durationMs[col])age-=clip.durationMs[col++];
  if(col<clip.durationMs.length)cell(stage,art.fx,col,clip.row,48,48,x-clip.pivot[0],y-clip.pivot[1]);
}
function eventsSince(t,period,offsets,life){
  const events=[];
  for(let n=Math.max(0,Math.floor((t-life)/period));n<=Math.floor(t/period);n++){
    offsets.forEach((o,i)=>{const age=t-n*period-o;if(age>=0&&age<life)events.push({age,i})});
  }
  return events;
}
function shadow(x,y){stage.fillStyle='#10191a82';stage.beginPath();stage.ellipse(x,y,14,4,0,0,Math.PI*2);stage.fill()}
function describeActor(id,x,y,isLead,t) {
  const row=id+(isLead?0:3), spec=roles[role], cycle=isLead?spec.cycle:2110;
  const offsets=isLead?spec.shots:[590+id*343], shots=eventsSince(t,cycle,offsets,530);
  const recent=shots[shots.length-1], alternate=event=>isLead&&role===1&&event.i%2===1;
  let col=0;
  if(recent){const a=recent.age, shot=alternate(recent)?3:1; col=a<45?shot:a<100?shot+1:a<160?5:0}
  return {id,row,x,y,isLead,col,shots,alternate};
}
function render(t){
  stage.imageSmoothingEnabled=false;stage.drawImage(art.street,0,0);
  const other=[0,1,2].filter(i=>i!==role);
  const actors=[describeActor(other[0],94,75,false,t),describeActor(role,176,106,true,t),describeActor(other[1],79,131,false,t)];
  const targetXs=role===2?[315,385,458]:[355];
  const shots=[];
  for(const a of actors)for(const event of a.shots){
    const col=a.alternate(event)?3:1;
    const [mx,my]=ATLAS.muzzles[a.row][col];
    const x=a.x-32+mx,y=a.y-60+my, targets=a.isLead?targetXs:[targetXs[0]];
    shots.push({a,event,x,y,targets,speed:a.isLead&&role===2?1.76:1.24});
  }
  const aimY=role===2?106-60+ATLAS.muzzles[2][1][1]:80;
  for(const [index,x] of targetXs.entries()){
    const age=Math.min(...shots.filter(s=>s.targets.includes(x)).map(s=>s.event.age-(x-s.x)/s.speed).filter(v=>v>=0));
    const hit=age<64, recoil=age<88?Math.round((1-age/88)*4):0;
    shadow(x,aimY+22);stage.save();stage.translate(x+recoil,0);stage.scale(-1,1);
    cell(stage,art.enemy,Math.floor(t/180)%4,(index===2?5:3)+(hit?6:0),64,64,-32,aimY-38);stage.restore();
  }
  for(const a of actors){
    shadow(a.x,a.y);
    if(a.isLead && t<240){
      const col=t<42?0:t<100?1:t<158?2:3;
      cell(stage,art.equip,col,role,96,64,a.x-32,a.y-60);effect('tag_pulse',t,a.x,a.y-52);
    }else cell(stage,art.units,a.col,a.row,96,64,a.x-32,a.y-60);
  }
  for(const {a,event,x,y,targets,speed} of shots){
    const lead=a.isLead, prefix=lead?names[role]:'support', age=event.age;
    effect(prefix+'_muzzle',age,x,y);
    const bx=x+age*speed, slope=(aimY-y)/(targets[0]-x);
    if (bx<=targets[targets.length-1]+(lead&&role===2?38:0)) {
      stage.save();stage.translate(Math.round(bx),Math.round(y+(bx-x)*slope));stage.rotate(Math.atan(slope));
      if(lead)effect(names[role]+'_bullet',age,0,0);
      else{stage.fillStyle='#e7d4a7';stage.fillRect(-3,-1,3,1)}stage.restore();
    }
    for(const tx of targets)effect(lead&&role===2?'pierce_exit':'hit_spark',age-(tx-x)/speed,tx,y+(tx-x)*slope);
    if(lead && age<180)effect('brass',age,x-14-age*.07,y-3-9*Math.sin(Math.PI*age/180)+10*(age/180)**2);
  }
  if(role===0){
    const phase=t%roles[0].cycle;
    if(phase>=720&&phase<820){stage.fillStyle='#e0a979';stage.fillRect(346-(phase-720)*1.45,82,5,1)}
    effect('shield_block',phase-820,200,82);
  }
}
function emitBetween(before,now){
  if(!audible)return;
  function emit(period,offsets,name){for(const event of eventsSince(now,period,offsets,now-before))playSound(typeof name==='function'?name(event):name)}
  const spec=roles[role];
  emit(spec.cycle,spec.shots,e=>role===1?'raven-'+(e.i%2?'b':'a'):names[role]);
  emit(spec.cycle,spec.shots.map(n=>n+(role===2?73:125)),'hit');
  if(role===0)emit(spec.cycle,[820],'block');
  for(let id=0;id<3;id++)if(id!==role)emit(2110,[590+id*343],'support');
}
function setRole(i){
  role=i;elapsed=0;silence(); const r=roles[i];
  $('loadout').textContent=r.title;$('note').textContent=r.note;
  document.documentElement.style.setProperty('--accent',r.accent);
  document.querySelectorAll('[data-role]').forEach((b,j)=>b.setAttribute('aria-pressed',String(j===i)));
  if(ready){drawPanels();render(running?0:250)}
}
document.querySelectorAll('[data-role]').forEach((b,i)=>b.onclick=()=>setRole(i));
$('play').onclick=()=>{running=!running;$('play').textContent=running?'일시정지':'재생';if(!running)silence()};
$('audio').onclick=()=>{audible=!audible;$('audio').textContent=audible?'소리 끄기':'소리 켜기';$('audio').setAttribute('aria-pressed',String(audible));if(!audible)silence()};
function tick(now){
  if(running&&!document.hidden){const before=elapsed;elapsed+=Math.min(60,lastTime===null?0:now-lastTime);render(elapsed);emitBetween(before,elapsed)}
  lastTime=now;requestAnimationFrame(tick);
}
Promise.all(Object.entries(files).map(([key,url])=>new Promise((ok,fail)=>{
  const img=new Image();img.onload=()=>{art[key]=img;ok()};img.onerror=()=>fail(new Error(url));img.src=url;
}))).then(()=>{ready=true;setRole(0);window.reviewReady=true;requestAnimationFrame(tick)}).catch(err=>{$('note').textContent='이미지를 열 수 없습니다. '+err.message});
