'use strict';
const catalog = {
  bulk: {
    name:'벌크', call:'BULK', role:'방어병', color:'#94c9f1', tint:'#344953',
    moves:{
      basic:['기본 공격','방패 사격','방패 너머로 권총을 쏩니다. 굵은 탄두는 적에게 박히고, 빈 탄피는 벌크의 발밑으로 떨어집니다.',[[575,'격발'],[780,'탄두 비행'],[990,'명중'],[1175,'사격 자세 복귀']]],
      skill:['스킬','메카 벙커 고정 모드','대원들이 탑승하면 메카가 두 무릎을 접고 차체를 낮춥니다. 바닥에 두 발을 고정한 채 양쪽 어깨 포드를 돌려 주변의 적을 사격합니다.',[[120,'기립 자세'],[820,'대원 탑승'],[1600,'차체 고정'],[2290,'교차 사격']]]
    }
  },
  raven: {
    name:'레이븐', call:'RAVEN', role:'돌격병', color:'#ffaa81', tint:'#573b35',
    moves:{
      basic:['기본 공격','양손 SMG 점사','세 발씩 끊어 쏩니다. 두 총이 번갈아 튀어 오르고, 뒤로 튄 탄피와 앞으로 날아가는 탄두가 함께 보입니다.',[[678,'첫 격발'],[850,'반대 손 반동'],[1000,'세 번째 발'],[1210,'착탄']]],
      forward:['스킬 A','돌파 난사','몸을 낮추고 전진하며 앞쪽에 탄을 모읍니다. 먼저 쏜 탄의 자취가 식기 전에 다음 사선이 겹칩니다.',[[490,'준비'],[710,'첫 점사'],[1450,'겹치는 사선'],[2260,'마지막 점사']]],
      spin:['스킬 B','회전 난사','발을 축으로 두 바퀴 돌며 양손 SMG로 사방을 훑습니다. 몸과 스카프의 잔상이 앞선 자세를 남기고 총구 궤적이 회전 방향을 그립니다.',[[480,'몸 낮추기'],[790,'회전 진입'],[1636,'회전 잔상'],[2050,'후방 사격']]]
    }
  },
  lynx:{
    name:'링스',call:'LYNX',role:'저격병',color:'#9fddc8',tint:'#324d45',
    moves:{
      basic:['기본 공격','정밀 단발','어깨로 반동을 받고 다시 견착합니다. 구리빛 탄두가 날아가 첫 표적에 박힙니다.',[[400,'견착'],[729,'격발'],[915,'탄두 비행'],[1140,'명중']]],
      skill:['스킬','레이저 관통 4연격','발사 순간 한 줄에 선 세 표적을 동시에 꿰뚫습니다. 흰 광심이 먼저 꺼지고 청록색 잔광이 가늘어지는 사이에 다음 발을 준비합니다.',[[659,'발사 순간'],[715,'광로'],[900,'잔광'],[2945,'마지막 관통']]]
    }
  },
  mortar:{
    name:'해머',call:'HAMMER',role:'박격포병 · 가칭',color:'#ffbd70',tint:'#514536',
    moves:{
      basic:['기본 공격','곡사 유탄','짧은 발사기에서 나온 유탄이 포물선을 그립니다. 착탄점에서 불덩이가 솟고, 파편과 먼지가 가라앉은 자리에 그을음이 남습니다.',[[783,'격발'],[1040,'곡사'],[1500,'폭발'],[1760,'연기와 파편']]],
      skill:['스킬','연쇄 포격','박격포를 땅에 박으면 여덟 발이 주변으로 떨어집니다. 앞 포탄의 검은 연기가 걷히기 전에 옆에서 다음 불기둥이 솟습니다.',[[610,'설치 충격'],[1470,'포탄 비행'],[2250,'연쇄 폭발'],[3420,'마지막 착탄']]]
    }
  }
};
const imageCache = new Map();
const sources = {
  bulk:[['deploy.png','분대 탑승 동작'],['bunker.png','이족 메카 차체'],['pods.png','양쪽 어깨 포드'],['ballistics.png','실탄·피격'],['frames.json','프레임 좌표']],
  raven:[['raven-smg.png','사격·16방향 회전'],['dual-smg.png','양손 SMG'],['ballistics.png','실탄·총구화염'],['spin-echo.png','회전 잔상'],['atlas.json','프레임 좌표']],
  lynx:[['precision.png','조준·격발·복귀'],['pierce-fx.png','기본탄·피격'],['laser.png','레이저·잔광'],['frames.json','프레임 좌표']],
  mortar:[['operator.png','이동·설치 동작'],['emplacement.png','설치 장비'],['effects.png','포탄·착탄 예고'],['blast-layers.png','불기둥·파편·그을음'],['manifest.json','프레임 좌표']]
};
const $ = id => document.getElementById(id);
const kit = {
  image:path=>imageCache.get(path),
  shadow(g,x,y,r=12){
    g.fillStyle='#111c2470';g.beginPath();g.ellipse(Math.round(x),Math.round(y),r,Math.max(2,r*.27),0,0,2*Math.PI);g.fill();
  },
  enemy(g,x,y,type,time,hit=false,flip=-1){
    const col=Math.floor(time/145)%4,row=3+type+(hit?6:0);
    g.save();g.translate(Math.round(x),Math.round(y));g.scale(flip,1);
    g.drawImage(kit.image('shared/combat-units.png'),col*64,row*64,64,64,-32,-60,64,64);g.restore();
  },
  unit(g,id,col,x,y,lead=true,flip=1){
    g.save();g.translate(Math.round(x),Math.round(y));g.scale(flip,1);
    g.drawImage(kit.image('shared/units.png'),col*96,(id+(lead?0:3))*64,96,64,-32,-60,96,64);g.restore();
  },
  fx(g,name,age,x,y,angle=0,scale=1){
    const clip=ATLAS.fx[name];
    if(!clip||age<0)return;
    const times=clip.durationMs;
    if(clip.loop)age%=times.reduce((a,b)=>a+b,0);
    let col=0;while(col<times.length&&age>=times[col])age-=times[col++];
    if(col===times.length)return;
    g.save();g.translate(Math.round(x),Math.round(y));g.rotate(angle);g.scale(scale,scale);
    g.drawImage(kit.image('shared/fx.png'),48*col,48*clip.row,48,48,-clip.pivot[0],-clip.pivot[1],48,48);g.restore();
  }
};
const cueCache=new Map();
function cues(id,mode){
  const key=id+'/'+mode;
  if(!cueCache.has(key))cueCache.set(key,SkillLab[id].sounds(mode));
  return cueCache.get(key);
}
// Pixel-sized camera impulses keep the reticle and controls still. The rapid
// skill volleys get their movement from the weapons; only isolated shots kick.
const impulses={
  smgA:[1,0,75],smgB:[1,0,75],bulk:[2,1,110],rifle:[3,1,135],
  pierce:[3,1,155],thump:[2,1,110],plant:[1,3,165],
  grenade:[1,2,140],burst:[2,3,190]
};
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
function cameraOffset(id,mode,ms){
  let dx=0,dy=0;
  if(reducedMotion.matches)return [dx,dy];
  for(const [at,voice] of cues(id,mode)){
    if(at>ms)break;
    const spec=impulses[voice], age=ms-at;
    if(!spec||age>=spec[2]||(id==='raven'&&mode!=='basic'))continue;
    const u=age/spec[2], envelope=(1-u)*(1-u);
    dx-=spec[0]*Math.cos(u*2*Math.PI)*envelope;
    dy+=spec[1]*Math.cos(u*2.5*Math.PI)*envelope;
  }
  return [Math.round(dx),Math.round(dy)];
}
let streetPlate;
function background(){
  if(streetPlate)return streetPlate;
  streetPlate=document.createElement('canvas');streetPlate.width=410;streetPlate.height=170;
  const g=streetPlate.getContext('2d'),street=kit.image('shared/street.png');
  g.imageSmoothingEnabled=false;
  g.drawImage(street,30,0,410,1,0,0,410,5);
  g.drawImage(street,30,0,410,144,0,5,410,144);
  g.drawImage(street,30,128,410,16,0,149,410,16);
  g.drawImage(street,30,143,410,1,0,165,410,5);
  g.fillStyle='#18202339';g.fillRect(0,0,410,170);
  return streetPlate;
}
function drawScene(g,id,mode,ms){
  g.save();g.imageSmoothingEnabled=false;g.translate(...cameraOffset(id,mode,ms));
  g.drawImage(background(),-5,-5);
  SkillLab[id].draw(g,ms,mode,kit);g.restore();
}
const stage=$('stage').getContext('2d');
let role='bulk',mode='skill',time=0,speed=1,playing=true,audible=false,last=null,ready=false;
const voices=new Map(),liveAudio=new Set();
function stopAudio(){for(const sound of liveAudio)sound.pause();liveAudio.clear()}
function soundAt(id){
  if (!voices.has(id)) voices.set(id,new Audio('audio/'+id+'.wav'));
  const audio=voices.get(id).cloneNode();audio.volume=.65;
  liveAudio.add(audio);audio.onended=()=>liveAudio.delete(audio);
  audio.play().catch(()=>liveAudio.delete(audio));
}
function emit(a,b){
  if(!audible)return;
  for(const [at,name] of cues(role,mode))if(at>=a&&at<b)soundAt(name);
}
function setPlaying(value){
  playing=value;$('play').textContent=value?'일시정지':'재생';
  if(!value)stopAudio();
}
function paint(){if(!ready)return;drawScene(stage,role,mode,time);$('time').value=Math.round(time);$('clock').textContent=(time/1000).toFixed(2)+' s'}
function setMove(id,key){
  role=id;mode=key;time=0;last=null;stopAudio();
  const spec=catalog[id],move=spec.moves[key],duration=SkillLab[id].duration;
  document.documentElement.style.setProperty('--accent',spec.color);
  document.documentElement.style.setProperty('--tint',spec.tint);
  for(const btn of $('roster').children)btn.setAttribute('aria-pressed',String(btn.dataset.id===id));
  $('callsign').textContent=spec.call;$('operator').textContent=spec.name;$('role-name').textContent=spec.role;
  const picture='portraits/'+id+'.png';$('portrait').src=picture;$('portrait').alt=spec.name+' 스킬 원화';$('portrait-link').href=picture;
  $('modes').replaceChildren(...Object.entries(spec.moves).map(([k,v])=>{
    const b=document.createElement('button');b.type='button';b.textContent=v[0];b.dataset.mode=k;
    b.setAttribute('aria-pressed',String(k===key));b.onclick=()=>setMove(id,k);return b;
  }));
  $('move-title').textContent=move[1];$('description').textContent=move[2];$('time').max=duration-1;
  $('gif').href='clips/'+id+'-'+key+'.gif';
  $('sources').replaceChildren(...sources[id].map(([path,label])=>{
    const link=document.createElement('a');link.href=id+'/'+path;link.textContent=label+' ↗';return link;
  }));
  $('frames').replaceChildren(...move[3].map(([at,name])=>{
    const button=document.createElement('button'),c=document.createElement('canvas'),caption=document.createElement('span'),stamp=document.createElement('time');
    c.width=400;c.height=160;drawScene(c.getContext('2d'),id,key,at);
    caption.append(name,stamp);stamp.textContent=(at/1000).toFixed(2)+' s';button.append(c,caption);
    button.onclick=()=>{setPlaying(false);time=at;paint()};return button;
  }));
  paint();
}
function tick(now){
  if(ready&&playing&&!document.hidden){
    const duration=SkillLab[role].duration, next=time+Math.min(90,last===null?0:now-last)*speed;
    if(next>=duration){emit(time,duration);emit(0,next%duration)}else emit(time,next);
    time=next%duration;paint();
  }
  last=now;requestAnimationFrame(tick);
}
$('play').onclick=()=>setPlaying(!playing);
$('sound').onclick=()=>{audible=!audible;$('sound').textContent=audible?'소리 끄기':'소리 켜기';$('sound').setAttribute('aria-pressed',String(audible));if(!audible)stopAudio()};
$('speed').onclick=()=>{speed=speed===1?.5:1;$('speed').textContent=speed+'×'};
$('time').oninput=()=>{setPlaying(false);time=+$('time').value;paint()};
document.addEventListener('visibilitychange',()=>{last=null;if(document.hidden)stopAudio()});
(async()=>{
  const common=['shared/fx.png','shared/street.png','shared/units.png','shared/combat-units.png'];
  const files=[...new Set([...common,...Object.keys(catalog).flatMap(id=>SkillLab[id].assets)])];
  await Promise.all(files.map(path=>new Promise((resolve,reject)=>{
    const img=new Image();img.onload=()=>{imageCache.set(path,img);resolve()};img.onerror=()=>reject(Error(path));img.src=path;
  })));
  for(const [id,spec] of Object.entries(catalog)){
    const b=document.createElement('button'),title=document.createElement('strong'),tag=document.createElement('small');
    b.type='button';b.dataset.id=id;b.style.setProperty('--op',spec.color);title.textContent=spec.name;tag.textContent=spec.role.split(' ·')[0];
    b.append(title,tag);b.onclick=()=>setMove(id,id==='raven'?'spin':'skill');$('roster').append(b);
  }
  ready=true;setMove(role,mode);window.labReady=true;requestAnimationFrame(tick);
})().catch(e=>{$('description').textContent='에셋을 열 수 없습니다. '+e.message;console.error(e)});
