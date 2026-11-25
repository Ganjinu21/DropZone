'use strict';

// Campaign order follows the Seoul location atlas. Boss classes reuse the three animated rigs.
const stages = [
  ['을지로3가 인쇄골목','철갑 돌격대장',1], ['종로 보신각','공진 파쇄기',2],
  ['청계천 광통교','수로 포격수',3], ['종로5가 광장시장','시장 돌격대장',1],
  ['성수대교 봉쇄선','교량 파쇄기',2], ['남산 서울타워','전망대 포격수',3],
  ['강남대로 사거리','광장 돌격대장',1], ['반포대교 고립구간','교두보 파쇄기',2],
  ['잠실야구장','구장 포격수',3], ['광화문광장','광화문 포격지휘관',3]
].map(([name,bossName,bossClass],i)=>{
  const finale=i===9;
  return {name,bossName,bossClass,bossHp:finale?1650:280+i*90,bossSpeed:34+i,
    bossContact:11+i,hpScale:.88+i*.055,speedBonus:i*.65,damageScale:.82+i*.035,
    cap:64+4*i,waves:Array.from({length:3},(_,w)=>({
      seconds:115,interval:.88-i*.014-w*.035,rush:16+i+w*3,
      runners:.14+i*.012+w*.03,heavies:.018+i*.004+w*.010
    }))};
});
function rollSeoulLight(){
  const roll=Math.random();
  return roll<.50?'overcast':roll<.92?'sunset':'day';
}
let selectedStartStage=1, sessionClearMask=0;
function highestPlayableStage(){
  if(developerMode)return stages.length;
  let cleared=sessionClearMask;
  for(const mask of Object.values(armory.bossClaims))cleared|=mask;
  let number=1;
  while(number<stages.length && (cleared & (1<<(number-1))))number++;
  return number;
}

function stageRules() { return stages[run.stage-1]; }
function waveRules() { return stageRules().waves[run.wave-1]; }
function beginWave(number) {
  run.wave=number;
  run.remaining=waveRules().seconds;
  run.bigWave=false;
  run.rushLeft=0;
  run.spawn=.5;
}
function announceEncounter(kind,title,detail,seconds) {
  run.encounterAlert={kind,title,detail,until:run.t+seconds};
}
function beginBossFight() {
  // Escort survivors on both floors stay in stage 2. Retreating zombies
  // do not award kills or XP and cannot trickle in from the other floor.
  if (run.stage!==2) {
    run.enemies.length=0;
    run.floors[otherFloor()].enemies.length=0;
    run.mark=null;
  }
  run.bigWave=false;
  run.bossPhase=true;
  run.bossArrival=1.15;
  announceEncounter('boss',stageRules().bossName,'변이체 출현',2.2);
  tone(155,.38,.04,'sawtooth',0,72);
  updateHud();
}
function updateEncounter(dt) {
  if(run.bossPhase){
    if(run.boss && run.boss.hp<=0){end(true);return;}
    if(!run.boss){
      run.bossArrival=Math.max(0,(run.bossArrival || 0)-dt);
      if(run.bossArrival>0)return;
      run.boss=spawn(Math.random()*TAU,260,true);
      if(run.boss){run.boss.stage=run.stage;updateHud()}
    }
    return;
  }
  const rules=waveRules();
  run.remaining=Math.max(0,run.remaining-dt);
  if(!run.bigWave && run.remaining<=8){
    run.bigWave=true;
    run.rushLeft=rules.rush;
    run.rushAngle=run.floor==='surface'&&seoulLayouts[run.stage-1].axis?(run.wave%2?Math.PI*.5:Math.PI*1.5):Math.random()*TAU;
    run.rushTimer=0;
    const bearings=['동','남동','남','남서','서','북서','북','북동'];
    const direction=bearings[Math.round(run.rushAngle*8/TAU)%8];
    announceEncounter('rush','빅웨이브 '+run.wave+'/'+stageRules().waves.length,direction+'쪽에서 감염체 '+rules.rush+'마리 접근',2);
    tone(196,.18,.035,'triangle',0,130);
    updateHud();
  }
  if(!run.bigWave){
    run.spawn-=dt;
    if(run.spawn<=0){spawn();run.spawn=rules.interval}
  }else if(run.rushLeft>0){
    run.rushTimer-=dt;
    if(run.rushTimer<=0){
      const groupSize=Math.min(4,run.rushLeft);
      for(let n=0;n<groupSize;n++){
        if(spawn(run.rushAngle+(Math.random()-.5)*.85,285+Math.random()*85,false,true))run.rushLeft--;
      }
      // A capped wave may finish spawning after its timer. Let the final
      // group engage before a stage 1/3 boss clears the remaining floor.
      if(run.rushLeft===0)run.remaining=Math.max(run.remaining,2);
      run.rushTimer=.45;
    }
  }
  if(run.remaining>0 || run.rushLeft>0)return;
  if(run.wave===stageRules().waves.length){beginBossFight();return}
  beginWave(run.wave+1);
  updateHud();
}
