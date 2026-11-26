'use strict';
const $=id=>document.getElementById(id);
const cv=$('world'),ctx=cv.getContext('2d',{alpha:false}), art={};
const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const names=['벌크','레이븐','링스','해머','CCT'], roles=['돌격병','SMG 양손잡이','저격병','로켓병','공중통제사'];
const memberHealth=[145,98,85,102,94];
['bulk','raven','lynx','hammer','cct'].forEach((role,id)=>{
 ART['face'+id]=id===1?'art/armory/raven-cels/portrait-C.png':'art/armory/painted-squad/'+role+'-portrait-C.png';
});
const formationSlots = [[23, 0], [-15, -24], [-18, 24]];
const swapTime = 1.5;
let mode='home',run,viewW=960,viewH=540,stick=null,pressed=new Set(),sound,last=0,selected=0,offers=[];
function clock(t){return String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0')}
let renderScale=1;
function resize(){
  viewH=innerHeight>innerWidth?Math.round(420*innerHeight/innerWidth):540;
  viewW=Math.round(viewH*innerWidth/innerHeight);
  const pixelRatio=Math.min(3,devicePixelRatio||1);
  renderScale=Math.min(3,innerWidth*pixelRatio/viewW);
  cv.width=Math.round(viewW*renderScale);
  cv.height=Math.round(viewH*renderScale);
  ctx.imageSmoothingEnabled=false;
}
addEventListener('resize',resize);resize();
function show(next){
 if(next==='home' || next==='pause')saveBattleCheckpoint();
 if(next==='end')clearBattleCheckpoint();
 mode=next;syncRankTest();
 for(const [id,visible] of Object.entries({home:next==='home',hud:next==='play',upgrade:next==='upgrade',dialog:['pause','end'].includes(next)}))$(id).hidden=!visible;
 if(next==='home'){resetLobbyView();refreshContinueMenu()}
 if(next==='play')saveBattleCheckpoint();
 stick=null;pressed.clear();
}
function startBattleAudio(){
 try{sound??=new (window.AudioContext||window.webkitAudioContext)();sound.resume().catch(()=>{});gunAudio.load(sound)}catch{}
}
function start(initialStage=selectedStartStage){
 const entryStage=Number.isInteger(initialStage) && stages[initialStage-1]?initialStage:1;
 if(entryStage>highestPlayableStage())return;
 const lineup=testLineup(getSelectedSquad());
 if(lineup.length!==formationSlots.length){openPreparation();return}
 startBattleAudio();
 savedEquipment=normalizedEquipment(savedEquipment);
 const talents=TalentTree.effects(armory.talentRanks);
 const pos=fieldMaps[entryStage-1].spawn;
 const sortieEquipment=savedEquipment.map((row,id)=>testRow(id,row));
 const squad=names.map((_,id)=>{
   const slot=lineup.indexOf(id), deployed=slot>=0;
   const [front,side]=formationSlots[slot] || [0,0];
   const gear=gearStats(id,sortieEquipment),max=Math.round((memberHealth[id]+gear.health)*(1+talents.hpBonus));
   return {id,deployed,gear,testTier:developerMode?testGrades[id]:null,testOriginal:developerMode?{...savedEquipment[id]}:undefined,loadout:sortieEquipment[id],weapon:gearByKey.get(sortieEquipment[id].weapon),shieldItem:sortieEquipment[id].shield,x:pos.x+front,y:pos.y+side,hp:deployed?max:0,max,baseMax:max,
     cool:.15+id*.15,shoot:0,flip:1,hurt:0,gait:0,moving:false,moveSpeed:0,aimAngle:0};
 });
 run={...pos,floor:'surface',floors:{surface:freshFloor(),metro:freshFloor()},stair:-1,depth:0,t:0,level:1,xp:0,need:5,kills:0,lead:lineup[0],lineup:[...lineup],swap:0,face:1,dx:1,dy:0,heading:0,enemies:[],crystals:[],effects:[],marks:[],cues:[],pickupCool:0,entryStage,stage:entryStage,bossPhase:false,boss:null,walk:0,camera:{...pos},magnetUntil:0,up:Array(magnet+1).fill(0),squad,shield:0,lastHud:-1};
 run.light=rollSeoulLight();run.talents=talents;run.rerollsLeft=talents.rerolls;run.rewardRunId=newBattleId();run.defeatedBosses=[];
 $('party').replaceChildren();
 beginWave(1);
 useDistrictRoutes(entryStage);routes.surface.aimAt(pos.x,pos.y);
 for(let i=0;i<7;i++)spawn(i*TAU/7,160+i*20);show('play');updateHud();if(talents.opening)openUpgrade()}
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
// Even entries are weapon boosts. Odd entries are reserved for old checkpoint data.
const weaponRankCap=3,fieldKit=10,firepower=11,vitality=12,magnet=13;
const magnetRadius=300,magnetSeconds=10;
function weaponRank(id){return run.up[id*2]}
function weaponRunMultiplier(id){return 1+.2*weaponRank(id)}

function shuffleChoices(choices){
 for(let i=choices.length-1;i>0;i--){
   const j=Math.floor(Math.random()*(i+1));
   [choices[i],choices[j]]=[choices[j],choices[i]];
 }
 return choices;
}
function upgradeOffers(previous=[]){
 const weapons=run.lineup.filter(id=>weaponRank(id)<weaponRankCap).map(id=>id*2);
 const squad=[fieldKit,vitality,magnet];
 if(run.up[firepower]<3)squad.push(firepower);
 shuffleChoices(weapons);shuffleChoices(squad);
 // Keep a mix of weapons and squad upgrades. On reroll prefer unseen cards
 // within each pool, even when only three legal upgrades remain.
 const take=pool=>pool.splice(Math.max(0,pool.findIndex(k=>!previous.includes(k))),1)[0];
 const cards=[take(squad)];
 if(weapons.length)cards.push(take(weapons));
 const remaining=shuffleChoices([...weapons,...squad]);
 while(cards.length<3)cards.push(take(remaining));
 return shuffleChoices(cards);
}
function canRerollUpgrade(){
 return run.rerollsLeft>0 && (run.up[firepower]<3 || run.lineup.some(id=>weaponRank(id)<weaponRankCap));
}
function upgradeCard(key){
 if(key<fieldKit){
   const id=key/2,member=run.squad[id],rank=weaponRank(id);
   const family=itemFamilies[member.weapon.family];
   return {operator:id, owner:names[id], grade:member.weapon.rank, portrait:fieldPortrait(id), icon:inventoryImage(member.weapon),
     badge:'무기 '+(rank+1)+'/3',name:family+' 강화',
     description:gradeLabel(member.weapon)+' '+member.weapon.label+'의 이번 작전 피해가 증가합니다.',
     stat:'무기 피해',value:'+'+(rank*20)+'% → +'+((rank+1)*20)+'%'};
 }
 const card={operator:'squad',owner:'분대',badge:'즉시'};
 switch(key){
   case fieldKit:Object.assign(card,{icon:'field-kit',name:'응급 처치',description:'생존한 대원과 지원병의 체력을 회복합니다.',stat:'최대 체력의',value:'50% 회복'});break;
   case firepower:{
     const next=run.up[key]+1;
     Object.assign(card,{icon:'squad-damage',badge:next+'/3',name:'화력 강화',description:'모든 아군의 기본 공격과 특수공격 피해가 증가합니다.',stat:'분대 피해',value:'+'+(next*10)+'%'});break;
   }
   case vitality:Object.assign(card,{icon:'squad-vitality',badge:'지속',name:'추가 체력',description:'분대와 지원병의 작전 시작 최대 체력을 기준으로 누적됩니다.',stat:'최대 체력',value:'+'+((run.up[key]+1)*30)+'%'});break;
   case magnet:Object.assign(card,{icon:'xp-magnet',name:'경험치 자석',description:'주변 조각을 즉시 모으고 10초간 수집 범위를 넓힙니다.',stat:'수집 반경',value:'30 m'});break;
 }
 card.icon='art/augments/'+card.icon+'.webp';
 card.portrait='art/hub/nav-barracks.webp';
 return card;
}
function openUpgrade(restoredOffers,restoredChoice=0){
 offers=restoredOffers??upgradeOffers();
 selected=0;show('upgrade');$('levelcaption').textContent='분대 레벨 '+String(run.level).padStart(2,'0');
 const reroll=$('talent-reroll');
 reroll.hidden=!run.talents.rerolls;
 reroll.disabled=!canRerollUpgrade();
 reroll.textContent=reroll.disabled && run.rerollsLeft>0?'전체 후보 표시 중':'증강 리롤 '+run.rerollsLeft+'회';
 $('buildstat').textContent='생존 '+clock(run.t)+'　·　처치 '+run.kills;
 $('cards').innerHTML=offers.map((key,index)=>{
   const card=upgradeCard(key);
   return `<button class="card" data-i="${index}" data-operator="${card.operator}" data-grade="${card.grade||''}">
     <span class="who"><img src="${card.portrait}" alt="">${card.owner}<em>${card.badge}</em></span>
     <span class="item"><img src="${card.icon}" alt="">${card.grade?'<small class="card-grade">'+card.grade+'</small>':''}</span>
     <strong>${card.name}</strong><p>${card.description}</p>
     <span class="num"><span>${card.stat}</span><b>${card.value}</b></span>
   </button>`;
 }).join('');
 choose(restoredChoice);tone(480,.15,.04,'sine')
}
function choose(i){
 if(i<0||i>=offers.length)return;
 selected=i;
 [...$('cards').children].forEach((c,j)=>{c.classList.toggle('active',i===j);c.setAttribute('aria-pressed',i===j)});
 saveBattleCheckpoint();
}
function rerollUpgrade(){
 if(mode!=='upgrade' || !canRerollUpgrade())return;
 const cards=upgradeOffers(offers);
 run.rerollsLeft--;
 openUpgrade(cards);
}
function applyUpgrade(){
 if(mode!=='upgrade')return;
 const key=offers[selected],member=run.squad[key<fieldKit?Math.floor(key/2):run.lead];
 run.up[key]++;
 if(key===magnet){
   run.magnetUntil=run.t+magnetSeconds;
   collectCrystals(0,true);
 }
 if(key===fieldKit || key===vitality){
   for(const m of [...run.squad.filter(m=>m.deployed),...(run.radioTeam||[])]){
     if(key===fieldKit){
       if(m.hp>0)m.hp=Math.min(m.max,m.hp+m.max*.5);
     }else{
       const next=Math.round(m.baseMax*(1+.3*run.up[vitality]));
       m.hp=m.hp/m.max*next;m.max=next;
     }
   }
 }
 combatCue('equip',member.x,member.y,.52,member.id);
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
 run.lead=i;syncRankTest();run.mark=null;run.swap=swapTime;
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
 updateMapHud();$('time').textContent=clock(run.t);$('kills').textContent='처치 '+run.kills;$('lv').textContent='Lv. '+run.level;$('xpfill').style.width=Math.min(100,100*run.xp/run.need)+'%';
 const leader=run.squad[run.lead];
 magazineReady(leader,leader.weapon);
 $('ammo-status').textContent=leader.reloadAt>run.t?'재장전 '+(leader.reloadAt-run.t).toFixed(1)+'초':'탄약 '+leader.ammo+' / '+leader.weapon.capacity;
 const party=$('party');
 if(!party.children.length)party.innerHTML=run.lineup.map(i=>'<button class="operator" data-i="'+i+'" data-operator="'+i+'"><img alt="" src="'+fieldPortrait(i)+'"><span><strong>'+names[i]+'</strong><small></small></span><span class="health"><i></i></span></button>').join('');
 party.classList.toggle('reforming',run.swap>0);party.style.setProperty('--swap-left',run.swap/swapTime);
 for(const b of party.children){
   const i=Number(b.dataset.i),m=run.squad[i],lead=i===run.lead;
   b.classList.toggle('lead',lead);b.classList.toggle('hurt',m.hurt>.43);
   b.setAttribute('aria-pressed',String(lead));b.disabled=m.hp<=0 || (!!run.activeSkill && !lead);
   b.querySelector('small').textContent=m.hp<=0?'기절':m.reloadAt>run.t?'재장전':roles[i];
   b.querySelector('i').style.width=Math.max(0,100*m.hp/m.max)+'%';
 }
 const active=run.activeSkill;
 const form=skillForm(run.lead);
 const retracting=deployedBunker(active) && active.phase==='retract';
 const canRelease=run.lead===0 && deployedBunker(active) && !retracting && active.hp>0;
 const remaining=Math.ceil(squadSkillCooldown(run.lead));
 $('cast-name').textContent=canRelease || retracting?'벙커 해제':skillDisplayName(run.lead,form);
 $('cast-status').textContent=retracting?'접는 중':canRelease?`내구도 ${Math.ceil(active.hp)}/${active.maxHp}`:
   !form?'스킬트리 연구 필요':active?(active.awakened && active.id===0?'탑승 중':'사용 중'):
   remaining>0?remaining+'초':form===2 && run.lead===1?(3-ravenPendingCharges().length)+'/3 충전':form===2?'각성 발동':'스킬 발동';
 $('cast').disabled=!canRelease && (!form || !!active || remaining>0);
}
function showLoadout(){
 const panel=$('loadout');
 panel.innerHTML=run.lineup.map(i=>{
   const member=run.squad[i];
   const form=skillForm(i),skill=form?(form===2?'각성 · ':'')+skillDisplayName(i,form):'스킬트리 연구 필요';
   const enhancements='무기 강화 '+weaponRank(i)+'/3 · '+skill;
   const hp=Math.max(0,Math.ceil(member.hp));
   const weapon = gradeLabel(member.weapon)+' '+member.weapon.label+(i===0?' · '+gearByKey.get(member.shieldItem).label:'');
   return `<div data-operator="${i}"><canvas aria-hidden="true"></canvas><strong>${names[i]}</strong><span>${weapon}</span><small>${enhancements}</small><span class="hp">HP ${hp}/${member.max}</span></div>`;
 }).join('');
 panel.querySelectorAll('canvas').forEach((canvas,slot)=>{
   const i=run.lineup[slot];
   const weapon=run.squad[i].weapon;
   const icon=art[weapon.family==='smg'?weapon.artKey+'-pair':weapon.artKey];canvas.width=64;canvas.height=40;
   const g=canvas.getContext('2d'),scale=Math.min(58/icon.width,32/icon.height);
   g.imageSmoothingEnabled=false;g.drawImage(icon,(64-icon.width*scale)/2,(40-icon.height*scale)/2,icon.width*scale,icon.height*scale);
 });
}
function pause(){if(mode!=='play')return;$('resume').hidden=false;show('pause');$('homebtn').textContent='저장 후 나가기';$('dialog').dataset.state='pause';showLoadout();$('dialogtitle').textContent='일시 정지';$('summary').textContent='생존 '+clock(run.t)+'　·　처치 '+run.kills;$('resume').textContent='계속하기'}
function end(won){
 show('end');
 const next=Math.min(run.stage+1,highestPlayableStage());
 chooseStartStage(won?next:Math.min(run.stage,highestPlayableStage()));
 $('dialog').dataset.state=won?'win':'loss';
 $('dialogtitle').textContent=won?'스테이지 '+run.stage+' 클리어':'분대 전멸';
 $('summary').textContent=clock(run.t)+' 생존 · '+run.kills+' 처치 · 보스 토큰 +'+run.defeatedBosses.length+
   (won && next>run.stage?' · 다음 작전 '+stages[next-1].name:'');
 $('homebtn').textContent='스테이지 선택';$('resume').hidden=won;$('resume').textContent='다시 도전';
 showLoadout();
}
function back(){
 if(mode==='home')return closeSquadSelection();
 if(mode==='play')pause();
 else if(mode==='pause')show('play');
 else if(mode==='end')show('home');
 return true;
}
window.gameBack=back;$('pause').onclick=pause;$('equip').onclick=applyUpgrade;$('cards').onclick=e=>{let b=e.target.closest('.card');if(b)choose(+b.dataset.i)};$('party').onclick=e=>{let b=e.target.closest('.operator');if(b)switchLead(+b.dataset.i)};
$('resume').onclick=()=>mode==='end'?start(run.stage):show('play');$('homebtn').onclick=()=>show('home');
$('cast').onclick=activateSquadSkill;
$('talent-reroll').onclick=rerollUpgrade;
$('talent-reroll').addEventListener('keydown',event=>{
 if(event.code==='Enter' || event.code==='Space')event.stopPropagation();
});
addEventListener('keydown',e=>{if(['Tab','F5','F12'].includes(e.key))return;if(e.code==='Escape'){if(!e.repeat)back();return}if(mode==='home')return;if(/^Arrow|^Space$/.test(e.code))e.preventDefault();if(e.repeat)return;if(mode==='upgrade'){if(e.code==='Enter'){applyUpgrade();return}if(e.code==='ArrowRight')choose(Math.min(offers.length-1,selected+1));if(e.code==='ArrowLeft')choose(Math.max(0,selected-1))}
 if(e.code==='Space' && mode==='play'){activateSquadSkill();return}
 if(/^[1-3]$/.test(e.key)){const slot=Number(e.key)-1;if(mode==='upgrade')choose(slot);else if(mode==='play')switchLead(run.lineup[slot])}pressed.add(e.code)});
addEventListener('keyup',e=>{
 // Space already casts on keydown. A focused HUD button must not click again on keyup.
 if(e.code==='Space' && mode==='play')e.preventDefault();
 pressed.delete(e.code);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden && ['play','pause','upgrade'].includes(mode))show('home')});addEventListener('blur',pause);
$('party').addEventListener('pointerdown',e=>{const b=e.target.closest('.operator');if(b&&e.pointerType==='touch'){e.preventDefault();switchLead(+b.dataset.i)}});
cv.onpointerdown=e=>{if(mode!=='play'||stick)return;cv.setPointerCapture(e.pointerId);stick={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0}};
cv.onpointermove=e=>{if(stick?.id===e.pointerId){const r=Math.max(25,innerHeight*.091);stick.dx=(e.clientX-stick.x)/r;stick.dy=(e.clientY-stick.y)/r}};
cv.onpointerup=cv.onpointercancel=cv.onlostpointercapture=e=>{if(stick?.id===e.pointerId)stick=null};
function combatCue(kind,x,y,duration,id=0,angle=0,size=1){
 const cue={kind,x,y,duration,id,angle,size,age:0};
 run.cues.push(cue);
}
function damageEnemy(e,power,angle=0,state=run,operatorId){
 if(e.hp<=0)return;
 const talents=run.talents;
 const bossBonus=e.boss?talents.bossDamageBonus+(operatorId===2 && talents.lynxCap ? .25 : 0):0;
 e.hp-=criticalDamage(power,operatorId,e,state)*(1+.1*run.up[firepower])*(1+talents.damageBonus)*(1+bossBonus);
 e.hit=.12;e.hitAngle=angle;
 if(e.hp>0)return;
 run.kills++;
 if(e.boss)recordBossDefeat(e.stage??run.stage);
 else awardDiamonds(1);
 state.crystals.push({x:e.x,y:e.y,val:e.type===2?4:1});
 state.cues.push({kind:'down',x:e.x,y:e.y,duration:.28,id:e.type,bossStage:e.boss?(e.stage||run.stage):0,angle,flip:e.flip,age:0});
 if(e.type===2)state.effects.push({row:3,x:e.x,y:e.y,dir:1,w:58,duration:.46,id:e.type,angle,age:0});
}
function hitSquadMember(enemy,member,nav,amount){
 if(mode!=='play'||!member.deployed||member.hp<=0)return;
 if(run.activeSkill?.id===0 && (member.id===0 || deployedBunker())){
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
   if(run.moving || leader.moving || deployedBunker() || m.downFloor!==run.floor ||
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
 if(m.shoot<=0 && !m.aimTarget && Math.abs(dx)>dt*8)m.flip=Math.sign(dx);
 const backing=dx*m.flip<0 && Math.abs(dx)>Math.abs(dy)*.5;
 const depth=Math.abs(dy)>Math.abs(dx)*(m.walkRow>=6?.88:1.18);
 m.walkRow=depth?(dy>0?6:7):backing?5:1;
 const advance=(backing && !depth?-distance:distance)/scale;
 m.gait=((m.gait+advance)%crewStrideLength+crewStrideLength)%crewStrideLength;
}
function moveFormation(dt) {
 const nav=routes[run.floor];
 const order=[run.lead,...run.lineup.filter(id=>id!==run.lead && run.squad[id].hp>0)];
 const locked=squadSkillLocked();
 const fort=deployedBunker()?run.activeSkill:null;
 if(fort && !fort.seats)assignBunkerCover(fort);
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
   const dx=tx-m.x,dy=ty-m.y;
   const gap=Math.hypot(dx,dy);
   if(m.leavingCover && gap<2)m.leavingCover=false;
   const step=m.leavingCover?Math.min(follow,220*dt/Math.max(1,gap)):follow;
   const bx=m.x,by=m.y;
   if(fort && m.id!==0)moveBunkerCrew(m,fort,nav,dt);
   else if(!locked){
     if(nav.clear(m.x,m.y,tx,ty,4))nav.slide(m,dx*step,dy*step,4);
     else {m.speed=160;nav.chase(m,run,dt);}
   }
   m.cool-=dt;m.shoot-=dt;m.hurt-=dt;
   const target=m.aimTarget;
   if(target){
     const range=basicWeaponProfile(m,m.id===run.lead).range;
     const dx=target.x-m.x,dy=target.y-m.y;
     if(run.activeSkill && (deployedBunker() || run.activeSkill.id===m.id) ||
        !run.enemies.includes(target) || !targetInSight(m,target,range,dx*dx+dy*dy)){
       m.aimTarget=null;
     }else if(dx)m.flip=Math.sign(dx);
   }
   updateCrewStride(m,m.x-bx,m.y-by,dt);
   if(m.aimTarget)combatAim(m,m.aimTarget.x,chestY(m.aimTarget),m.shotColumn||1);
   if(m.cool<=0)shoot(m);
 }
}
function collectCrystals(dt,pulse=false){
 const nav=routes[run.floor],radius=pulse || run.t<run.magnetUntil?magnetRadius:85;
 run.pickupCool=Math.max(0,run.pickupCool-dt);
 let gained=0;
 run.crystals=run.crystals.filter(g=>{
   const distance=dist(g,run);
   if(distance>radius || !nav.clear(g.x,g.y,run.x,run.y,0))return true;
   if(pulse || distance<14){gained+=g.val;return false}
   const step=Math.min(1,dt*(5+120/distance));
   g.x+=(run.x-g.x)*step;g.y+=(run.y-g.y)*step;
   return true;
 });
 run.xp+=gained;
 if(gained && !run.pickupCool){
   run.pickupCool=.14;combatCue('pickup',run.x,run.y,.25,run.lead,0,gained);
   tone(gained>1?850:680,.085,.013,'sine',0,gained>1?1180:950);
 }
}
function update(dt){
 let nav=routes[run.floor];
 run.t+=dt;run.swap=Math.max(0,run.swap-dt);run.shield-=dt;
 let dx=(stick?.dx||0)+Number(pressed.has('KeyD')||pressed.has('ArrowRight'))-Number(pressed.has('KeyA')||pressed.has('ArrowLeft'));
 let dy=(stick?.dy||0)+Number(pressed.has('KeyS')||pressed.has('ArrowDown'))-Number(pressed.has('KeyW')||pressed.has('ArrowUp'));
 let l=squadSkillLocked()?0:Math.hypot(dx,dy);if(l>.05){run.dx=dx/l;run.dy=dy/l;let scale=105*run.squad[run.lead].gear.movement*(1+run.talents.moveBonus)*dt/Math.max(l,1);nav.slide(run,dx*scale,dy*scale,10);run.walk+=dt*9}run.moving=l>.05;
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
   const inBunker=deployedBunker();
   if(inBunker){near=target;closest=dist(e,target)}
   if(closest<(inBunker?36*bunkerShellScale:19) && (near.hurt<=0 || inBunker) && nav.clear(e.x,e.y,near.x,near.y,0)){
     hitSquadMember(e,near,nav);
     if(mode!=='play')return;
   }
 }
 run.enemies=run.enemies.filter(e=>e.hp>0);
 collectCrystals(dt);
 for(const list of [run.effects,run.cues]){
   let count=0;
   for(const v of list){v.age+=dt;if(v.age<v.duration)list[count++]=v}
   list.length=count;
 }
 run.camera.x+=(run.x-run.camera.x)*Math.min(1,dt*7);run.camera.y+=(run.y-run.camera.y)*Math.min(1,dt*7);
 if(Math.floor(run.t*6)!==run.lastHud){run.lastHud=Math.floor(run.t*6);updateHud()}
 if(run.xp>=run.need){
   run.xp-=run.need;run.level++;run.need=4+run.level*2;
   run.xp+=run.talents.xpOnLevel;
   if(run.talents.healOnLevel)for(const m of [...run.squad,...(run.radioTeam||[])]){
     if(m.hp>0)m.hp=Math.min(m.max,m.hp+m.max*run.talents.healOnLevel);
   }
   openUpgrade();
 }
}




for(const type of ['selectstart','contextmenu','dragstart']){
  document.addEventListener(type,event=>{
    if(mode!=='home' && event.target.closest?.('#world,#hud,#upgrade,#dialog'))event.preventDefault();
  },true);
}
