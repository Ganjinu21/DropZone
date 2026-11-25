const field = id => document.getElementById(id);
const preview = field('preview');
const controls = ['crew','rank','scene','speed','flash','trail','impact'];
const storage = 'dropzone.combat-lab.settings';
let saved;
try {saved=JSON.parse(sessionStorage.getItem(storage)) || {}} catch {saved={}}
let api, revision, waiting = false, notice = '';
const settings = () => Object.fromEntries(controls.map(id => {
  const input = field(id);
  return [id,input.type==='checkbox' ? input.checked : ['crew','speed'].includes(id) ? Number(input.value) : input.value];
}));
const save = () => sessionStorage.setItem(storage,JSON.stringify(settings()));
function loadGame() {
  api=null;
  field('status').textContent='게임 에셋 로딩 중';
  preview.src='/game/index.html';
}
preview.addEventListener('load', async () => {
  const game=preview.contentWindow.combatLab;
  for(let attempts=0; attempts<100 && game && !game.ready(); attempts++) {
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  if (!game?.ready()) {
    field('status').textContent=preview.contentDocument.getElementById('start')?.textContent || '게임을 읽을 수 없습니다.';
    return;
  }
  saved=Object.keys(saved).length ? saved : settings();
  field('crew').replaceChildren(...game.roster().map((name,i)=>new Option(name,i)));
  for(const id of controls) {
    const input=field(id);
    if(saved[id]===undefined) continue;
    if(input.type==='checkbox') input.checked=saved[id];
    else if([...input.options].some(option=>option.value===String(saved[id]))) input.value=saved[id];
  }
  api=game;
  reset();
});
function reset() {
  if (!api) return;
  notice='';
  api.reset(settings());
  field('pause').textContent='일시 정지';
}
for(const id of controls) field(id).addEventListener('change',() => {
  save(); saved=settings();
  if(['crew','rank','scene'].includes(id)) reset();
  else api?.configure(saved);
});
field('reset').onclick=reset;
field('basic').onclick=()=>{notice=api?.basic()?'기본 공격 재생':'사거리 안에 표적이 없습니다.'};
field('skill').onclick=()=>{
  notice=api?.skill()?'스킬 재생':['C','B'].includes(field('rank').value)?
    'A 등급부터 스킬이 열립니다.':'현재 스킬 종료 후 다시 발동하세요.';
};
field('pause').onclick=()=>{if(api) field('pause').textContent=api.pause()?'이어서 재생':'일시 정지'};
field('step').onclick=()=>{if(api){api.step();field('pause').textContent='이어서 재생'}};
async function checkFiles() {
  try {
    const next=await (await fetch('/revision',{cache:'no-store'})).text();
    if(revision!==undefined && revision!==next) {
      if(waiting) location.reload();
      else waiting=true;
    } else if(waiting) location.reload();
    revision=next;
  } catch {}
}
setInterval(checkFiles,500);
setInterval(()=>{
  if(!api) return;
  const {time, effects, enemies}=api.status();
  field('status').textContent=`${time.toFixed(2)}초 · 표적 ${enemies} · 이펙트 ${effects}${notice ? ' · '+notice : ''}`;
},150);
loadGame();
