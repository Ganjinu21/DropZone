'use strict';
const $=id=>document.getElementById(id);
const cv=$('world'),ctx=cv.getContext('2d',{alpha:false}), art={};
const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const names=['벌크','레이븐','링스','해머','CCT'], roles=['돌격병','SMG 양손잡이','저격병','로켓병','공중통제사'];
const memberHealth=[145,98,85,102,94];
['bulk','raven','lynx','hammer','cct'].forEach((role,id)=>{
 ART['face'+id]='art/armory/'+role+'-portrait.png';
});
const formationSlots = [[23, 0], [-15, -24], [-18, 24]];
const swapTime = 1.5;
let mode='home',run,viewW=960,viewH=540,stick=null,pressed=new Set(),sound,last=0,selected=0,offers=[];
function clock(t){return String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0')}
function resize(){viewH=innerHeight>innerWidth?Math.round(420*innerHeight/innerWidth):540;viewW=Math.round(viewH*innerWidth/innerHeight);cv.width=viewW;cv.height=viewH;ctx.imageSmoothingEnabled=false}
addEventListener('resize',resize);resize();
function show(next){mode=next;for(const [id,visible] of Object.entries({home:next==='home',hud:next==='play',upgrade:next==='upgrade',dialog:['pause','end'].includes(next)}))$(id).hidden=!visible;if(next==='home')resetLobbyView();stick=null;pressed.clear()}
function start(){
 const lineup=getSelectedSquad();
 if(lineup.length!==formationSlots.length){openPreparation();return}
 try{sound??=new (window.AudioContext||window.webkitAudioContext)();sound.resume().catch(()=>{});gunAudio.load(sound)}catch{}
 savedEquipment=normalizedEquipment(savedEquipment);
 const pos=SURFACE.spawn;
 const squad=names.map((_,id)=>{
   const slot=lineup.indexOf(id), deployed=slot>=0;
   const [front,side]=formationSlots[slot] || [0,0];
   const gear=gearStats(id),max=memberHealth[id]+gear.health;
   return {id,deployed,gear,loadout:savedEquipment[id],weapon:gearByKey.get(savedEquipment[id].weapon),shieldItem:savedEquipment[id].shield,x:pos.x+front,y:pos.y+side,hp:deployed?max:0,max,
     cool:.15+id*.15,shoot:0,flip:1,hurt:0,gait:0,moving:false,moveSpeed:0,aimAngle:0};
 });
 run={...pos,floor:'surface',floors:{surface:freshFloor(),metro:freshFloor()},stair:-1,depth:0,t:0,level:1,xp:0,need:5,kills:0,lead:lineup[0],lineup:[...lineup],swap:0,face:1,dx:1,dy:0,heading:0,enemies:[],crystals:[],effects:[],marks:[],cues:[],pickupCool:0,stage:1,bossPhase:false,boss:null,walk:0,camera:{...pos},up:Array(upgrades.length).fill(0),squad,shield:0,lastHud:-1};
 $('party').replaceChildren();
 beginWave(1);
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
function spawn(a=Math.random()*TAU,d=Math.max(viewW,viewH)*.57,boss=false,rush=false){
 const stage=stageRules(),wave=waveRules();
 const cap=stage.cap-(rush?0:wave.rush);
 if(!boss && run.enemies.length+run.floors[otherFloor()].enemies.length>=cap)return;
 const roll=Math.random();
 const type=boss || roll<wave.heavies?2:roll<wave.heavies+wave.runners?1:0;
 const hp=boss?stage.bossHp:Math.round([22,16,74][type]*stage.hpScale);
 const speed=boss?stage.bossSpeed:[31,53,23][type]+stage.speedBonus;
 const contactDamage=boss?stage.bossContact:Math.round([8,6,15][type]*stage.damageScale);
 const nav=routes[run.floor];
 function place(x,y){
   const enemy={x,y,type,boss,hp,max:hp,speed,contactDamage,phase:Math.random()*8,hit:0,flip:1};
   run.enemies.push(enemy);
   return enemy;
 }
 // Sample the same incoming arc first, then widen the search on confined floors.
 for(let attempt=0;attempt<15;attempt++){
   const angle=attempt?a+(Math.random()-.5)*Math.min(TAU,attempt*.55):a;
   const radius = attempt > 8 ? d * .60 : d;
   const x=clamp(run.x+Math.cos(angle)*radius,12,nav.width-12);
   const y=clamp(run.y+Math.sin(angle)*radius,12,nav.height-12);
   if(Math.hypot(x-run.x,y-run.y)<110 || nav.blocked(x,y,6))continue;
   const cell=nav.node(x,y);
   if(cell<0 || nav.distance[cell]<0)continue;
   return place(x,y);
 }
 // Narrow platforms can miss every sampled arc. Keep special spawns reachable.
 if(boss || rush){
   let best=-1,score=Infinity;
   for(let i=0;i<nav.distance.length;i++){
     if(nav.distance[i]<0)continue;
     const x=nav.cx(i),y=nav.cy(i),distance=Math.hypot(x-run.x,y-run.y);
     if(distance<70 || Math.abs(distance-d)>=score || nav.blocked(x,y,6))continue;
     best=i;score=Math.abs(distance-d);
   }
   if(best>=0)return place(nav.cx(best),nav.cy(best));
 }
}
const upgrades=[
 ['방패 보강','벌크가 선두일 때 전방에서 받는 피해를 줄입니다.','피해 감소',n=>(55+n*6)+'%'],
 ['충격파','벌크가 선두에서 방어할 때 충격파가 더 멀리 퍼집니다.','충격 반경',n=>((32+n*13)/10).toFixed(1)+' m'],
 ['연장 점사','레이븐이 선두에서 쏘는 듀얼 SMG의 탄환 피해가 증가합니다.','탄환 피해',n=>String(equipmentDamage(run.squad[1].weapon,loadouts[1],n))],
 ['분산 사격','레이븐의 선두 점사가 추가 표적에도 탄환을 발사합니다.','동시 표적',n=>(1+n)+'명'],
 ['관통탄','링스의 선두 저격이 한 줄에 있는 적을 더 관통합니다.','추가 관통',n=>(1+n)+'명'],
 ['정밀 조준','링스의 선두 저격 피해가 증가합니다. 중장갑 적에게 특히 강합니다.','기본 피해',n=>String(equipmentDamage(run.squad[2].weapon,loadouts[2],n))],
 ['고폭탄','해머의 기본 포탄과 집중 포격의 폭발 피해가 증가합니다.','기본 피해',n=>String(equipmentDamage(run.squad[3].weapon,loadouts[3],n))],
 ['확산 탄두','해머의 기본 포탄과 집중 포격이 더 넓게 폭발합니다.','기본 반경',n=>((37+5*n)/10).toFixed(1)+' m'],
 ['조준 보정','통제관의 소총 탄환 피해를 높입니다.','탄환 피해',n=>String(equipmentDamage(run.squad[4].weapon,loadouts[4],n))],
 ['지원 편대','코브라의 지원 사격 피해를 높입니다.','지원 피해',n=>String(19+3*n)],
 ['응급 처치','생존한 분대원과 지원병의 체력을 즉시 회복합니다.','최대 체력',()=> '30%'],
 ['화력 강화','기본 공격, 특수 스킬, 지원 사격의 피해가 증가합니다.','피해 보너스',n=> '+'+(n*10)+'%']
];
const fieldKit=10, firepower=11;
const scalableUpgrades=[1,2,5,6,8];
function openUpgrade(){
 const available=run.lineup.filter(id=>run.squad[id].hp>0).flatMap(id=>[id*2,id*2+1]);
 if(!available.length)return;
 let personal=available.filter(key=>run.up[key]<5);
 // At a fully ranked loadout, keep a third, effective choice alongside the two squad cards.
 if(!personal.length)personal=available.filter(key=>scalableUpgrades.includes(key));
 const pick=list=>list[Math.floor(Math.random()*list.length)];
 const first=pick(personal),shared=pick([fieldKit,firepower]);
 const rest=[...personal.filter(i=>i!==first && Math.floor(i/2)!==Math.floor(first/2)),shared===fieldKit?firepower:fieldKit];
 offers=[first,shared,pick(rest)];
 for(let i=offers.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[offers[i],offers[j]]=[offers[j],offers[i]]}
 selected=0;show('upgrade');$('levelcaption').textContent='분대 레벨 '+String(run.level).padStart(2,'0');
 $('buildstat').textContent='생존 '+clock(run.t)+'　·　처치 '+run.kills;
 $('cards').innerHTML = offers.map((key, index) => {
   const [name, description, stat, format] = upgrades[key];
   const rank = run.up[key];
   const common=key>=fieldKit,operator=common?'squad':Math.floor(key/2);
   const sharedIcon=key===fieldKit?'art/armory/field-kit.png':'art/armory/squad-damage.png';
   const icon=common?sharedIcon:key===6||key===7?itemImage(gearByKey.get('rocket-0')):key===8?itemImage(gearByKey.get('ar-0')):key===9?'art/prep/cobra.png':'augment-'+key+'.png';
   return `<button class="card" data-i="${index}" data-operator="${operator}">
     <span class="who"><img src="${common?sharedIcon:ART['face'+operator]}" alt="">${common?'분대':names[operator]}<em>${key===fieldKit?'즉시':'Lv. '+(rank+1)}</em></span>
     <span class="item"><img src="${icon}" alt=""></span>
     <strong>${name}</strong><p>${description}</p>
     <span class="num"><span>${stat}</span><span>${key===fieldKit?'':format(rank)+' → '}<b>${format(rank+1)}</b></span></span>
   </button>`;
 }).join('');
 choose(0);tone(480,.15,.04,'sine')
}
function choose(i){if(i<0||i>=offers.length)return;selected=i;[...$('cards').children].forEach((c,j)=>{c.classList.toggle('active',i===j);c.setAttribute('aria-pressed',i===j)})}
function applyUpgrade(){
 if(mode!=='upgrade')return;
 const key=offers[selected],member=run.squad[key>=fieldKit?run.lead:Math.floor(key/2)];
 if(key===fieldKit){
   for(const m of [...run.squad,...(run.radioTeam||[])])if(m.hp>0)m.hp=Math.min(m.max,m.hp+m.max*.3);
 }
 run.up[key]++;
 if(member.deployed)combatCue('equip',member.x,member.y,.52,member.id);
 tone(520,.12,.024,'sine',0,610);
 tone(780,.12,.017,'sine',.07,870);
 show('play');updateHud();
}
function setLeader(i){
 const outgoing=run.squad[run.lead],incoming=run.squad[i];
 if(!incoming?.deployed || incoming.hp<=0)return;
 cancelSquadSkill();
 for(const member of [outgoing,incoming]){
   member.leadChanged=run.t;member.burstIndex=0;member.lastShot=null;member.shoot=0;
 }
 outgoing.cool=sidearm.delay;
 incoming.cool=.24;
 run.lead=i;run.mark=null;run.swap=swapTime;
 const member=run.squad[i];
 combatCue('swap',member.x,member.y,.62,i,run.heading);
 const pitch=[330,392,494,294,440][i];
 tone(pitch,.065,.026,'triangle',0,pitch);
 tone(pitch*1.5,.09,.021,'triangle',.063,pitch*1.5);
 updateHud();
}
function switchLead(i){if(mode!=='play'||run.activeSkill||run.swap>0||!run.squad[i]||run.squad[i].hp<=0||i===run.lead)return;setLeader(i)}
function updateHud(){
 updateStageHud({stage:run.stage,stageName:stageRules().name,wave:run.wave,waves:stageRules().waves.length,remaining:run.remaining,bossPhase:run.bossPhase,bossName:stageRules().bossName,boss:run.boss,bigWave:run.bigWave});
 updateMapHud();$('time').textContent=clock(run.t);$('kills').textContent='처치 '+run.kills;$('lv').textContent='Lv. '+run.level;$('xpfill').style.width=(100*run.xp/run.need)+'%';
 const leader=run.squad[run.lead];
 magazineReady(leader,leader.weapon);
 $('ammo-status').textContent=leader.reloadAt>run.t?'재장전 '+(leader.reloadAt-run.t).toFixed(1)+'초':'탄약 '+leader.ammo+' / '+leader.weapon.capacity;
 const party=$('party');
 if(!party.children.length)party.innerHTML=run.lineup.map(i=>'<button class="operator" data-i="'+i+'" data-operator="'+i+'"><img alt="" src="'+ART['face'+i]+'"><span><strong>'+names[i]+'</strong><small></small></span><span class="health"><i></i></span></button>').join('');
 party.classList.toggle('reforming',run.swap>0);party.style.setProperty('--swap-left',run.swap/swapTime);
 for(const b of party.children){
   const i=Number(b.dataset.i),m=run.squad[i],lead=i===run.lead;
   b.classList.toggle('lead',lead);b.classList.toggle('hurt',m.hurt>.43);
   b.setAttribute('aria-pressed',String(lead));b.disabled=m.hp<=0 || (!!run.activeSkill && !lead);
   b.querySelector('small').textContent=m.hp<=0?'기절':m.reloadAt>run.t?'재장전':roles[i];
   b.querySelector('i').style.width=Math.max(0,100*m.hp/m.max)+'%';
 }
 const active=run.activeSkill;
 const canRelease=run.lead===0 && active?.id===0 && active.hp>0;
 const remaining=Math.ceil(squadSkillCooldown(run.lead));
 $('cast-name').textContent=canRelease?'벙커 해제':squadSkillDefs[run.lead].name;
 $('cast-status').textContent=canRelease?`내구도 ${Math.ceil(active.hp)}/${active.maxHp}`:
   active?'사용 중':remaining>0?remaining+'초':'스킬 발동';
 $('cast').disabled=!canRelease && (!!active || remaining>0);
}
function showLoadout(){
 const panel=$('loadout');
 panel.innerHTML=run.lineup.map(i=>{
   const member=run.squad[i];
   const enhancements=upgrades.slice(i*2,i*2+2).map(([label],n)=>{
     const level=run.up[i*2+n];
     return level?label+' '+level:'';
   }).filter(Boolean).join(' · ');
   const hp=Math.max(0,Math.ceil(member.hp));
   const weapon = gradeLabel(member.weapon)+' '+member.weapon.label+(i===0?' · '+gearByKey.get(member.shieldItem).label:'');
   return `<div data-operator="${i}"><canvas aria-hidden="true"></canvas><strong>${names[i]}</strong><span>${weapon}</span><small>${enhancements || '기본 장비'}</small><span class="hp">HP ${hp}/${member.max}</span></div>`;
 }).join('');
 panel.querySelectorAll('canvas').forEach((canvas,slot)=>{
   const i=run.lineup[slot];
   const weapon=run.squad[i].weapon;
   const icon=art[weapon.family==='smg'?weapon.artKey+'-pair':weapon.artKey];canvas.width=64;canvas.height=40;
   const g=canvas.getContext('2d'),scale=Math.min(58/icon.width,32/icon.height);
   g.imageSmoothingEnabled=false;g.drawImage(icon,(64-icon.width*scale)/2,(40-icon.height*scale)/2,icon.width*scale,icon.height*scale);
 });
}
function pause(){if(mode!=='play')return;show('pause');$('dialog').dataset.state='pause';showLoadout();$('dialogtitle').textContent='일시 정지';$('summary').textContent='생존 '+clock(run.t)+'　·　처치 '+run.kills;$('resume').textContent='계속하기'}
function end(won){show('end');$('dialog').dataset.state=won?'win':'loss';showLoadout();$('dialogtitle').textContent=won?'작전 완료':'분대 전멸';$('summary').textContent='스테이지 '+run.stage+' · '+clock(run.t)+' 생존　·　'+run.kills+' 처치　·　Lv. '+run.level;$('resume').textContent='다시 시작'}
function back(){
 if(mode==='home')return closeSquadSelection();
 if(mode==='play')pause();
 else if(mode==='pause')show('play');
 else if(mode==='end')show('home');
 return true;
}
window.gameBack=back;$('pause').onclick=pause;$('equip').onclick=applyUpgrade;$('cards').onclick=e=>{let b=e.target.closest('.card');if(b)choose(+b.dataset.i)};$('party').onclick=e=>{let b=e.target.closest('.operator');if(b)switchLead(+b.dataset.i)};
$('resume').onclick=()=>mode==='end'?start():show('play');$('homebtn').onclick=()=>show('home');
$('cast').onclick=activateSquadSkill;
addEventListener('keydown',e=>{if(['Tab','F5','F12'].includes(e.key))return;if(e.code==='Escape'){if(!e.repeat)back();return}if(mode==='home')return;if(/^Arrow|^Space$/.test(e.code))e.preventDefault();if(e.repeat)return;if(mode==='upgrade'){if(e.code==='Enter'){applyUpgrade();return}if(e.code==='ArrowRight')choose(Math.min(offers.length-1,selected+1));if(e.code==='ArrowLeft')choose(Math.max(0,selected-1))}
 if(e.code==='Space' && mode==='play'){activateSquadSkill();return}
 if(/^[1-3]$/.test(e.key)){const slot=Number(e.key)-1;if(mode==='upgrade')choose(slot);else if(mode==='play')switchLead(run.lineup[slot])}pressed.add(e.code)});
addEventListener('keyup',e=>{
 // Space already casts on keydown. A focused HUD button must not click again on keyup.
 if(e.code==='Space' && mode==='play')e.preventDefault();
 pressed.delete(e.code);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});addEventListener('blur',pause);
$('party').addEventListener('pointerdown',e=>{const b=e.target.closest('.operator');if(b&&e.pointerType==='touch'){e.preventDefault();switchLead(+b.dataset.i)}});
cv.onpointerdown=e=>{if(mode!=='play'||stick)return;cv.setPointerCapture(e.pointerId);stick={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0}};
cv.onpointermove=e=>{if(stick?.id===e.pointerId){const r=Math.max(25,innerHeight*.091);stick.dx=(e.clientX-stick.x)/r;stick.dy=(e.clientY-stick.y)/r}};
cv.onpointerup=cv.onpointercancel=cv.onlostpointercapture=e=>{if(stick?.id===e.pointerId)stick=null};
function combatCue(kind,x,y,duration,id=0,angle=0,size=1){
 const cue={kind,x,y,duration,id,angle,size,age:0};
 run.cues.push(cue);
}
function damageEnemy(e,power,angle=0,state=run){
 if(e.hp<=0)return;e.hp-=power*(1+.1*(run.up[firepower]||0));e.hit=.12;e.hitAngle=angle;
 if(e.hp>0)return;
 run.kills++;awardDiamonds(e.boss?5:1);state.crystals.push({x:e.x,y:e.y,val:e.type===2?4:1});
 state.cues.push({kind:'down',x:e.x,y:e.y,duration:.28,id:e.type,bossStage:e.boss?(e.stage||run.stage):0,angle,flip:e.flip,age:0});
 if(e.type===2)state.effects.push({row:3,x:e.x,y:e.y,dir:1,w:58,duration:.46,id:e.type,angle,age:0});
}
function hitSquadMember(enemy,member,nav,amount){
 if(mode!=='play'||!member.deployed||member.hp<=0)return;
 if(run.activeSkill?.id===0){
   hitBunker(enemy,nav,amount??enemy.contactDamage??[8,6,15][enemy.type],amount===undefined);
   return;
 }
 if(member.hurt>0)return;
 absorbContact(enemy,member,nav,amount);
 if(member.hp>0)return;
 member.hp=0;member.downFloor=run.floor;member.reviveTime=0;member.moving=false;
 const next=run.lineup.find(id=>run.squad[id].hp>0);
 if(next===undefined)end(false);
 else if(run.lead===member.id)setLeader(next);
}
function updateRescues(dt){
 const leader=run.squad[run.lead],nav=routes[run.floor];
 for(const m of [...run.squad,...(run.radioTeam||[])]){
   if(!m.downFloor || m.hp>0)continue;
   if(run.moving || leader.moving || run.activeSkill?.id===0 || m.downFloor!==run.floor ||
      dist(leader,m)>24 || !nav.clear(leader.x,leader.y,m.x,m.y,0)){
     m.reviveTime=0;continue;
   }
   m.reviveTime+=dt;
   if(m.reviveTime+1e-8<3)continue;
   m.hp=m.max*.3;m.downFloor=null;m.reviveTime=0;m.hurt=1;m.grace=1;m.cool=.4;
   combatCue('equip',m.x,m.y,.58,m.id??4);
   tone(550,.15,.028,'sine',0,820);updateHud();
 }
}
// Distance is measured after collision resolution. A unit aiming into its
// retreat plays the same planted-foot sequence backwards.
const crewStrideLength=40;
function updateCrewStride(m,dx,dy,dt,scale=1){
 const distance=Math.hypot(dx,dy);
 m.moveSpeed=dt>0?distance/dt:0;
 m.moving=m.moveSpeed>5;
 if(!m.moving)return;
 if(m.shoot<=0 && Math.abs(dx)>dt*8)m.flip=Math.sign(dx);
 const backing=dx*m.flip<0 && Math.abs(dx)>Math.abs(dy)*.5;
 const advance=(backing?-distance:distance)/scale;
 m.gait=((m.gait+advance)%crewStrideLength+crewStrideLength)%crewStrideLength;
}
function moveFormation(dt) {
 const nav=routes[run.floor];
 const order=[run.lead,...run.lineup.filter(id=>id!==run.lead && run.squad[id].hp>0)];
 const locked=squadSkillLocked();
 const hx=Math.cos(run.heading),hy=Math.sin(run.heading);
 const follow=1-Math.exp(-12*dt);
 const spacing=stairFormationScale(run);
 for (let j=0;j<order.length;j++) {
   const m=run.squad[order[j]];
   if(m.hp<=0)continue;
   const [front,side]=formationSlots[j];
   const offsetX=hx*front-hy*side,offsetY=hy*front+hx*side;
   let reach=spacing;
   while(reach>0 && !nav.clear(run.x,run.y,run.x+reach*offsetX,run.y+reach*offsetY,4))reach=Math.max(0,reach-.25);
   const tx=run.x+reach*offsetX,ty=run.y+reach*offsetY;
   const stepX=(tx-m.x)*follow,stepY=(ty-m.y)*follow;
   const bx=m.x,by=m.y;
   if(!locked){
     if(nav.clear(m.x,m.y,tx,ty,4))nav.slide(m,stepX,stepY,4);
     else {m.speed=160;nav.chase(m,run,dt);}
   }
   m.cool-=dt;m.shoot-=dt;m.hurt-=dt;
   updateCrewStride(m,m.x-bx,m.y-by,dt);
   if(m.cool<=0)shoot(m);
 }
}
function update(dt){
 let nav=routes[run.floor];
 run.t+=dt;run.swap=Math.max(0,run.swap-dt);run.shield-=dt;
 let dx=(stick?.dx||0)+Number(pressed.has('KeyD')||pressed.has('ArrowRight'))-Number(pressed.has('KeyA')||pressed.has('ArrowLeft'));
 let dy=(stick?.dy||0)+Number(pressed.has('KeyS')||pressed.has('ArrowDown'))-Number(pressed.has('KeyW')||pressed.has('ArrowUp'));
 let l=squadSkillLocked()?0:Math.hypot(dx,dy);if(l>.05){run.dx=dx/l;run.dy=dy/l;let scale=105*run.squad[run.lead].gear.movement*dt/Math.max(l,1);nav.slide(run,dx*scale,dy*scale,10);run.walk+=dt*9}run.moving=l>.05;
 if(run.moving){
   const desired=Math.atan2(run.dy,run.dx),delta=desired-run.heading;
   run.heading+=clamp(Math.atan2(Math.sin(delta),Math.cos(delta)),-9*dt,9*dt);
 }
 updateStairDepth();
 nav=routes[run.floor];
 moveFormation(dt);
 const leader=run.squad[run.lead];
 nav.aimAt(leader.x,leader.y);
 tickSquadSkills(dt);
 updateRadioSupport(dt);
 updateRescues(dt);
 advanceRounds(dt);
 updatePursuit(dt);
 updateEncounter(dt);
 if(mode!=='play')return;
 tickBossAttack(dt,nav);
 if(mode!=='play')return;
 for(const e of run.enemies){
   if(e.hp<=0)continue;
   e.hit-=dt;
   if(e.charging)continue;
   const target=run.squad[run.lead];
   e.flip=e.x>target.x?-1:1;
   if(dist(e,target)>10)nav.chase(e,target,dt);

   let near=target,closest=dist(e,target);
   for(const m of run.squad){
     if(m===target || !m.deployed || m.hp<=0)continue;
     const distance=dist(e,m);
     if(distance<closest){near=m;closest=distance}
   }
   const inBunker=run.activeSkill?.id===0;
   if(closest<(inBunker?38:19) && (near.hurt<=0 || inBunker) && nav.clear(e.x,e.y,near.x,near.y,0)){
     hitSquadMember(e,near,nav);
     if(mode!=='play')return;
   }
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
 for(const list of [run.effects,run.cues]){
   let count=0;
   for(const v of list){v.age+=dt;if(v.age<v.duration)list[count++]=v}
   list.length=count;
 }
 run.camera.x+=(run.x-run.camera.x)*Math.min(1,dt*7);run.camera.y+=(run.y-run.camera.y)*Math.min(1,dt*7);
 if(Math.floor(run.t*6)!==run.lastHud){run.lastHud=Math.floor(run.t*6);updateHud()}
 if(run.xp>=run.need){run.xp-=run.need;run.level++;run.need=4+run.level*2;openUpgrade()}
}



