'use strict';
const $=id=>document.getElementById(id);
const cv=$('world'),ctx=cv.getContext('2d',{alpha:false}), art={};
const LIMIT=300, TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const names=['벌크','레이븐','링스'], roles=['방어','돌격','저격'];
const formationSlots = [[23, 0], [-15, -24], [-18, 24]];
const swapTime = 1.5;
let mode='home',run,viewW=960,viewH=540,stick=null,pressed=new Set(),sound,last=0,selected=0,offers=[];
function clock(t){return String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0')}
function resize(){viewH=540;viewW=Math.round(viewH*innerWidth/innerHeight);cv.width=viewW;cv.height=viewH;ctx.imageSmoothingEnabled=false}
addEventListener('resize',resize);resize();
function show(next){mode=next;for(const [id,visible] of Object.entries({home:next==='home',hud:next==='play',upgrade:next==='upgrade',dialog:['pause','end'].includes(next)}))$(id).hidden=!visible;stick=null;pressed.clear()}
function start(){try{sound??=new (window.AudioContext||window.webkitAudioContext)();sound.resume().catch(()=>{})}catch{}
 const pos=SURFACE.spawn;run={...pos,floor:'surface',floors:{surface:freshFloor(),metro:freshFloor()},stairReady:0,arrivalGrace:0,t:0,level:1,xp:0,need:5,kills:0,lead:0,swap:0,face:1,dx:1,dy:0,heading:0,enemies:[],crystals:[],effects:[],marks:[],cues:[],pickupCool:0,spawn:0,wave:14,walk:0,camera:{...pos},up:Array(6).fill(0),squad:names.map((_,i)=>({x:pos.x+formationSlots[i][0],y:pos.y+formationSlots[i][1],id:i,hp:[145,98,85][i],max:[145,98,85][i],cool:.15+i*.15,shoot:0,flip:1,hurt:0,gait:0,moving:false,moveSpeed:0,aimAngle:0})),shield:0,lastHud:-1};
 routes.surface.aimAt(pos.x,pos.y);
 for(let i=0;i<7;i++)spawn(i*TAU/7,160+i*20);show('play');updateHud()}
function tone(freq,duration,amp,wave,delay=0,endFreq=freq*.34){
 if(!sound||sound.state!=='running')return;
 const o=sound.createOscillator(),g=sound.createGain(),at=sound.currentTime+delay;
 o.type=wave;o.frequency.setValueAtTime(freq,at);o.frequency.exponentialRampToValueAtTime(endFreq,at+duration);
 g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(amp,at+.003);g.gain.exponentialRampToValueAtTime(.0001,at+duration);
 o.connect(g);g.connect(sound.destination);o.start(at);o.stop(at+duration);
 o.onended=()=>{o.disconnect();g.disconnect()};
}
function spawn(a=Math.random()*TAU,d=Math.max(viewW,viewH)*.57){
 if(run.enemies.length+run.floors[otherFloor()].enemies.length>=185)return;
 const type=Math.random()<.1+run.t/1700?2:Math.random()<.20?1:0;
 const hp=[22,16,74][type]*(1+run.t/420);
 const nav=routes[run.floor];
 // Sample the same incoming arc first, then widen the search on confined floors.
 for(let attempt=0;attempt<15;attempt++){
   const angle=attempt?a+(Math.random()-.5)*Math.min(TAU,attempt*.55):a;
   const radius = attempt > 8 ? d * .60 : d;
   const x=clamp(run.x+Math.cos(angle)*radius,12,nav.width-12);
   const y=clamp(run.y+Math.sin(angle)*radius,12,nav.height-12);
   if(Math.hypot(x-run.x,y-run.y)<110 || nav.blocked(x,y,6))continue;
   const cell=nav.node(x,y);
   if(cell<0 || nav.distance[cell]<0)continue;
   run.enemies.push({x,y,type,hp,max:hp,speed:[31,53,23][type]+run.t*.045,phase:Math.random()*8,hit:0,flip:1});
   return;
 }
}
const upgrades=[
 ['방패 보강','정면에서 받는 피해를 줄입니다.','피해 감소',n=>(35+n*8)+'%'],
 ['충격파','방패 충격파의 반경이 넓어집니다.','충격 반경',n=>((32+n*13)/10).toFixed(1)+' m'],
 ['연장 점사','점사 한 번의 피해가 증가합니다.','점사 피해',n=>String(11+n*5)],
 ['분산 사격','인접한 적을 동시에 조준합니다.','동시 표적',n=>(1+n)+'명'],
 ['관통탄','표적 뒤의 적을 추가로 관통합니다.','관통 대상',n=>(1+n)+'명'],
 ['정밀 조준','체력이 높은 적에게 강한 한 발을 쏩니다.','탄환 피해',n=>String(30+n*11)]
];
function openUpgrade(){
 const pool=upgrades.map((_,i)=>i).filter(i=>run.up[i]<5);if(!pool.length)return;
 offers=[];for(let m=0;m<3;m++){let possible=pool.filter(k=>Math.floor(k/2)===m);if(possible.length)offers.push(possible[Math.floor(Math.random()*possible.length)])}
 for(const k of pool)if(offers.length<3&&!offers.includes(k))offers.push(k);
 selected=0;show('upgrade');$('levelcaption').textContent='분대 레벨 '+String(run.level).padStart(2,'0');
 $('buildstat').textContent='생존 '+clock(run.t)+'　·　처치 '+run.kills;
 $('cards').innerHTML = offers.map((key, index) => {
   const [name, description, stat, format] = upgrades[key];
   const rank = run.up[key];
   const operator = Math.floor(key / 2);
   return `<button class="card" data-i="${index}" data-operator="${operator}">
     <span class="who"><img src="${ART['face'+operator]}" alt="">${names[operator]}<em>Lv. ${rank+1}</em></span>
     <span class="item"><img src="augment-${key}.png" alt=""></span>
     <strong>${name}</strong><p>${description}</p>
     <span class="num"><span>${stat}</span><span>${format(rank)} <span class="arrow">→</span> <b>${format(rank+1)}</b></span></span>
   </button>`;
 }).join('');
 choose(0);tone(480,.15,.04,'sine')
}
function choose(i){if(i<0||i>=offers.length)return;selected=i;[...$('cards').children].forEach((c,j)=>{c.classList.toggle('active',i===j);c.setAttribute('aria-pressed',i===j)})}
function applyUpgrade(){
 if(mode!=='upgrade')return;
 const key=offers[selected],member=run.squad[Math.floor(key/2)];
 run.up[key]++;
 combatCue('equip',member.x,member.y,.52,member.id);
 tone(520,.12,.024,'sine',0,610);
 tone(780,.12,.017,'sine',.07,870);
 show('play');updateHud();
}
function setLeader(i){
 run.lead=i;run.mark=null;run.swap=swapTime;
 const member=run.squad[i];
 combatCue('swap',member.x,member.y,.62,i,run.heading);
 const pitch=[330,392,494][i];
 tone(pitch,.065,.026,'triangle',0,pitch);
 tone(pitch*1.5,.09,.021,'triangle',.063,pitch*1.5);
 updateHud();
}
function switchLead(i){if(mode!=='play'||run.swap>0||run.squad[i].hp<=0||i===run.lead)return;setLeader(i)}
function updateHud(){updateMapHud();$('time').textContent=clock(run.t);$('kills').textContent='처치 '+run.kills;$('lv').textContent='Lv. '+run.level;$('xpfill').style.width=(100*run.xp/run.need)+'%';
 const party=$('party');
 if(!party.children.length)party.innerHTML=names.map((n,i)=>'<button class="operator" data-i="'+i+'" data-operator="'+i+'"><img alt="" src="'+ART['face'+i]+'"><span><strong>'+n+'</strong><small></small></span><span class="health"><i></i></span></button>').join('');
 party.classList.toggle('reforming',run.swap>0);party.style.setProperty('--swap-left',run.swap/swapTime);
 [...party.children].forEach((b,i)=>{const m=run.squad[i],lead=i===run.lead;b.classList.toggle('lead',lead);b.classList.toggle('hurt',m.hurt>.43);b.setAttribute('aria-pressed',String(lead));b.disabled=m.hp<=0;b.querySelector('small').textContent=m.hp<=0?'이탈':lead?'선두':roles[i];b.querySelector('i').style.width=Math.max(0,100*m.hp/m.max)+'%'})}
function showLoadout(){
 const panel=$('loadout');
 panel.innerHTML=run.squad.map((member,i)=>{
   const enhancements=upgrades.slice(i*2,i*2+2).map(([label],n)=>{
     const level=run.up[i*2+n];
     return level?label+' '+level:'';
   }).filter(Boolean).join(' · ');
   const hp=Math.max(0,Math.ceil(member.hp));
   return `<div><img src="weapon-${i}.png" alt=""><strong>${names[i]}</strong><span>${['기관단총 · 방패','돌격소총','저격소총'][i]}</span><small>${enhancements || '기본 장비'}</small><span class="hp">HP ${hp}/${member.max}</span></div>`;
 }).join('');
}
function pause(){if(mode!=='play')return;show('pause');$('dialog').dataset.state='pause';showLoadout();$('dialogtitle').textContent='일시 정지';$('summary').textContent='생존 '+clock(run.t)+'　·　처치 '+run.kills;$('resume').textContent='계속하기'}
function end(won){show('end');$('dialog').dataset.state=won?'win':'loss';showLoadout();$('dialogtitle').textContent=won?'분대 생존':'분대 전멸';$('summary').textContent=clock(run.t)+' 생존　·　'+run.kills+' 처치　·　Lv. '+run.level;$('resume').textContent='다시 시작'}
function back(){if(mode==='play')pause();else if(mode==='pause')show('play');else if(mode==='end')show('home')}
window.gameBack=back;$('start').onclick=start;$('pause').onclick=pause;$('equip').onclick=applyUpgrade;$('cards').onclick=e=>{let b=e.target.closest('.card');if(b)choose(+b.dataset.i)};$('party').onclick=e=>{let b=e.target.closest('.operator');if(b)switchLead(+b.dataset.i)};
$('stairs').onclick=useStair;
$('resume').onclick=()=>mode==='end'?start():show('play');$('homebtn').onclick=()=>show('home');
addEventListener('keydown',e=>{if(['Tab','F5','F12'].includes(e.key))return;if(/^Arrow|^Space$/.test(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Escape'){back();return}if(e.code==='KeyE'){useStair();return}if(mode==='upgrade'){if(e.code==='Enter'){applyUpgrade();return}if(e.code==='ArrowRight')choose(Math.min(offers.length-1,selected+1));if(e.code==='ArrowLeft')choose(Math.max(0,selected-1))}
 if(/^[1-3]$/.test(e.key)){let i=+e.key-1;mode==='upgrade'?choose(i):switchLead(i)}pressed.add(e.code)});
addEventListener('keyup',e=>pressed.delete(e.code));document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});addEventListener('blur',pause);
$('party').addEventListener('pointerdown',e=>{const b=e.target.closest('.operator');if(b&&e.pointerType==='touch'){e.preventDefault();switchLead(+b.dataset.i)}});
cv.onpointerdown=e=>{if(mode!=='play'||stick)return;cv.setPointerCapture(e.pointerId);stick={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0}};
cv.onpointermove=e=>{if(stick?.id===e.pointerId){const r=Math.max(25,innerHeight*.091);stick.dx=(e.clientX-stick.x)/r;stick.dy=(e.clientY-stick.y)/r}};
cv.onpointerup=cv.onpointercancel=cv.onlostpointercapture=e=>{if(stick?.id===e.pointerId)stick=null};
function combatCue(kind,x,y,duration,id=0,angle=0,size=1){
 const cue={kind,x,y,duration,id,angle,size,age:0};
 run.cues.push(cue);
}
function damageEnemy(e,power,angle=0){
 if(e.hp<=0)return;e.hp-=power;e.hit=.12;e.hitAngle=angle;
 if(e.hp>0)return;
 run.kills++;run.crystals.push({x:e.x,y:e.y,val:e.type===2?4:1});
 combatCue('down',e.x,e.y,.28,e.type,angle);
 if(e.type===2)effect(3,e.x,e.y,1,58,.46);
}
function effect(row,x,y,dir,w,duration,angle=0,id=0){run.effects.push({row,x,y,dir,w,duration,angle,id,age:0})}
function shoot(m){
 const radius=[173,237,340][m.id],d2=e=>(m.x-e.x)**2+(m.y-e.y)**2;
 const targets=run.enemies.filter(e=>e.hp>0&&d2(e)<radius*radius&&routes[run.floor].clear(m.x,m.y,e.x,e.y,0));
 if(!targets.length){m.cool=.075;return}
 targets.sort((a,b)=>m.id===2?b.hp-a.hp:d2(a)-d2(b));
 const marked=run.mark;if(run.lead===2&&marked?.hp>0&&targets.includes(marked)&&m.id!==2)targets.unshift(targets.splice(targets.indexOf(marked),1)[0]);
 const e=targets[0];if(m.id===2&&run.lead===2)run.mark=e;
 const count=m.id===1?1+run.up[3]:1;
 for(const target of targets.slice(0,count)){
 const tx=target.x,ty=target.y-[18,17,25][target.type];
 const flip=tx<m.x?-1:1, pivotY=m.y-21;
 const pitch=clamp(Math.atan2(ty-pivotY,Math.abs(tx-m.x)),-.40,.40);
 const barrelX=[24,20,25][m.id],barrelY=21-[32,28,29][m.id];
 const cosPitch=Math.cos(pitch),sinPitch=Math.sin(pitch);
 const sx=m.x+flip*(barrelX*cosPitch-barrelY*sinPitch);
 const sy=pivotY+barrelX*sinPitch+barrelY*cosPitch;
 const angle=Math.atan2(ty-sy,tx-sx);
 if(target===e){m.flip=flip;m.aimAngle=angle;m.aimPitch=pitch}
 run.marks.push({x:sx,y:sy,tx,ty,age:0,id:m.id,operator:m.id,angle,duration:m.id===2?.15:.095,sniper:m.id===2});
 effect(0,sx,sy,flip,m.id===2?23:18,.11,angle,m.id);
 effect(2,tx,ty,1,m.id===2?22:17,.17,angle,m.id);
 damageEnemy(target,[8,11+5*run.up[2],30+11*run.up[5]][m.id],angle);
 if(m.id===2){let ux=Math.cos(angle),uy=Math.sin(angle);let line=run.enemies.map(v=>({v,along:(v.x-tx)*ux+(v.y-target.y)*uy,side:Math.abs((v.x-tx)*uy-(v.y-target.y)*ux)})).filter(o=>o.v!==target&&o.v.hp>0&&o.along>0&&o.along<160&&o.side<15&&routes[run.floor].clear(target.x,target.y,o.v.x,o.v.y,0)).sort((a,b)=>a.along-b.along);
 let px=tx,py=ty;
 for(const o of line.slice(0,1+run.up[4])){
   damageEnemy(o.v,22+8*run.up[5],angle);
   const hitY=o.v.y-[18,17,25][o.v.type];
   run.marks.push({x:px,y:py,tx:o.v.x,ty:hitY,id:2,operator:2,angle,age:0,duration:.15,sniper:true});
   effect(2,o.v.x,hitY,1,15,.13,angle,2);px=o.v.x;py=hitY;
 }}
 }
 m.lastShot=run.t;m.shellX=m.x;m.shellY=m.y;m.shellFlip=m.flip;
 m.shoot=.22;m.cool=[.52,.40,1.35][m.id]*(m.id===1&&run.lead===1?.73:1);
 tone([145,196,96][m.id],[.055,.045,.16][m.id],[.022,.015,.041][m.id],m.id===2?'triangle':'sawtooth');
 if(m.id===1)tone(152,.039,.010,'sawtooth',.052);
}
function moveFormation(dt) {
 const nav=routes[run.floor];
 const order=[run.lead,...[0,1,2].filter(i=>i!==run.lead && run.squad[i].hp>0)];
 const hx=Math.cos(run.heading),hy=Math.sin(run.heading);
 const follow=1-Math.exp(-12*dt);
 for (let j=0;j<order.length;j++) {
   const m=run.squad[order[j]];
   if(m.hp<=0)continue;
   const [front,side]=formationSlots[j];
   const offsetX=hx*front-hy*side,offsetY=hy*front+hx*side;
   let reach=1;
   while(reach>0 && !nav.clear(run.x,run.y,run.x+reach*offsetX,run.y+reach*offsetY,4))reach-=.25;
   const tx=run.x+reach*offsetX,ty=run.y+reach*offsetY;
   const stepX=(tx-m.x)*follow,stepY=(ty-m.y)*follow;
   const bx=m.x,by=m.y;
   if(nav.clear(m.x,m.y,tx,ty,4))nav.slide(m,stepX,stepY,4);
   else {m.speed=160;nav.chase(m,run,dt);}
   const traveled=Math.hypot(m.x-bx,m.y-by);
   m.gait+=traveled;
   m.moveSpeed=dt>0?traveled/dt:0;
   m.moving=m.moveSpeed>7;
   m.cool-=dt;m.shoot-=dt;m.hurt-=dt;
   if(m.cool<=0)shoot(m);
   if(m.moving&&m.shoot<=0&&Math.abs(stepX)>dt*10)m.flip=Math.sign(stepX);
 }
}
function update(dt){
 const nav=routes[run.floor];
 run.t+=dt;if(run.t>=LIMIT){end(true);return}run.swap=Math.max(0,run.swap-dt);run.shield-=dt;
 let dx=(stick?.dx||0)+Number(pressed.has('KeyD')||pressed.has('ArrowRight'))-Number(pressed.has('KeyA')||pressed.has('ArrowLeft'));
 let dy=(stick?.dy||0)+Number(pressed.has('KeyS')||pressed.has('ArrowDown'))-Number(pressed.has('KeyW')||pressed.has('ArrowUp'));
 let l=Math.hypot(dx,dy);if(l>.05){run.dx=dx/l;run.dy=dy/l;let scale=105*dt/Math.max(l,1);nav.slide(run,dx*scale,dy*scale,10);run.walk+=dt*9}run.moving=l>.05;
 if(run.moving){
   const desired=Math.atan2(run.dy,run.dx),delta=desired-run.heading;
   run.heading+=clamp(Math.atan2(Math.sin(delta),Math.cos(delta)),-9*dt,9*dt);
 }
 nav.aimAt(run.x,run.y);
 moveFormation(dt);
 updatePursuit(dt);
 run.spawn-=dt;if(run.spawn<=0){run.spawn=Math.max(.14,.68-run.t*.0016);spawn();if(run.t>65)spawn()}
 run.wave-=dt;
 if(run.wave<=0){
   run.wave=Math.max(8,15-run.t*.02);
   const angle=Math.random()*TAU;
   const groupSize=Math.min(24,7+Math.floor(run.t/16));
   for(let n=0;n<groupSize;n++)spawn(angle+(Math.random()-.5)*.54,viewH*.72+Math.random()*55);
 }
 let living=run.squad.filter(m=>m.hp>0);
 for(const e of run.enemies){if(e.hp<=0)continue;e.hit-=dt;
 let near=living[0];if(!near)break;for(const m of living)if(dist(m,e)<dist(near,e))near=m;
 let vx=near.x-e.x,vy=near.y-e.y,d=Math.hypot(vx,vy)||1;e.flip=vx<0?-1:1;
 if(d>10)nav.chase(e,near,dt);
 if(d<19 && near.hurt<=0 && run.t>=run.arrivalGrace && run.t>=(e.arrived??-1)+.65 && nav.clear(e.x,e.y,near.x,near.y,0)){
 const hx=Math.cos(run.heading),hy=Math.sin(run.heading);
 const aheadOfSquad=(e.x-run.x)*hx+(e.y-run.y)*hy>0;
 const incomingFromFront=(e.x-near.x)*hx+(e.y-near.y)*hy>0;
 const guard=run.lead===0&&aheadOfSquad&&incomingFromFront;
 near.hp-=([8,6,15][e.type])*(guard?1-(.35+.08*run.up[0]):1);near.hurt=.7;
 combatCue('hurt',near.x,near.y,.28,near.id,Math.atan2(vy,vx));
 if(guard&&run.shield<=0){run.shield=2.5;let radius=32+run.up[1]*13;
   combatCue('guard',run.x,run.y,.37,0,run.heading,radius);tone(190,.16,.027,'triangle',0,56);
   for(const v of run.enemies){let dd=dist(run,v);if(dd<radius&&dd>1){const angle=Math.atan2(v.y-run.y,v.x-run.x);nav.slide(v,(v.x-run.x)/dd*20,(v.y-run.y)/dd*20,4);damageEnemy(v,4,angle)}}
 }
 if(near.hp<=0){living=living.filter(m=>m.hp>0);if(!living.length){end(false);return}if(run.lead===near.id)setLeader(living[0].id)}}
 }
 run.enemies=run.enemies.filter(e=>e.hp>0);
 run.pickupCool=Math.max(0,run.pickupCool-dt);
 for(const g of run.crystals){const d=dist(g,run);if(d<85&&nav.clear(g.x,g.y,run.x,run.y,0)){let s=Math.min(1,dt*(5+120/(d+1)));g.x+=(run.x-g.x)*s;g.y+=(run.y-g.y)*s;if(d<14){
   run.xp+=g.val;g.taken=true;
   if(!run.pickupCool){
     run.pickupCool=.14;combatCue('pickup',run.x,run.y,.25,run.lead,0,g.val);
     tone(g.val>1?850:680,.085,.013,'sine',0,g.val>1?1180:950);
   }
 }}}run.crystals=run.crystals.filter(g=>!g.taken);
 for(const list of [run.effects,run.marks,run.cues]){
   let count=0;
   for(const v of list){v.age+=dt;if(v.age<v.duration)list[count++]=v}
   list.length=count;
 }
 run.camera.x+=(run.x-run.camera.x)*Math.min(1,dt*7);run.camera.y+=(run.y-run.camera.y)*Math.min(1,dt*7);
 if(Math.floor(run.t*6)!==run.lastHud){run.lastHud=Math.floor(run.t*6);updateHud()}
 if(run.xp>=run.need){run.xp-=run.need;run.level++;run.need=4+run.level*2;openUpgrade()}
}



