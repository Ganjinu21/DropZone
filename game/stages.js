'use strict';

// Each wave has a steady trickle and one concentrated attack from a shared bearing.
const stages = [
  {name:'을지로 봉쇄선', bossName:'철갑 돌격대장', bossHp:420, bossSpeed:47, bossContact:14,
   hpScale:1, speedBonus:0, damageScale:1, cap:48, waves:[
     {seconds:24, interval:1.35, rush:10, runners:.12, heavies:0},
     {seconds:26, interval:1.16, rush:14, runners:.22, heavies:.04},
     {seconds:28, interval:1.05, rush:18, runners:.25, heavies:.08}]},
  {name:'환승로 범람', bossName:'공진 파쇄기', bossHp:480, bossSpeed:38, bossContact:16,
   hpScale:1.12, speedBonus:5, damageScale:1.1, cap:84, waves:[
     {seconds:26, interval:.64, rush:20, runners:.35, heavies:.04},
     {seconds:28, interval:.55, rush:26, runners:.4, heavies:.06},
     {seconds:30, interval:.48, rush:32, runners:.43, heavies:.09}]},
  {name:'종점 포격지대', bossName:'종점 포격지휘관', bossHp:1200, bossSpeed:34, bossContact:19,
   hpScale:1.3, speedBonus:3, damageScale:1.2, cap:56, waves:[
     {seconds:24, interval:1, rush:12, runners:.15, heavies:.12},
     {seconds:26, interval:.88, rush:15, runners:.18, heavies:.15},
     {seconds:28, interval:.78, rush:18, runners:.2, heavies:.18}]}
];
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
function advanceStage() {
  if(run.stage===stages.length){end(true);return;}
  if(!deployedBunker())cancelSquadSkill();
  // Remove stragglers and rounds from both floors. Earned XP and equipment carry over.
  for(const state of [run,run.floors.surface,run.floors.metro]){
    state.enemies.length=0;
    state.marks.length=0;
    for(let i=state.effects.length-1;i>=0;i--) {
      if(state.effects[i].skillFx==='shellArc') state.effects.splice(i,1);
    }
  }
  run.stage++;
  run.boss=null;
  run.bossPhase=false;
  run.mark=null;
  beginWave(1);
  announceEncounter('stage',stageRules().name,'스테이지 '+run.stage+' 진입',2);
  updateHud();
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
    if(run.boss && run.boss.hp<=0){advanceStage();return;}
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
    run.rushAngle=Math.random()*TAU;
    run.rushTimer=0;
    const bearings=['동','남동','남','남서','서','북서','북','북동'];
    const direction=bearings[Math.round(run.rushAngle*8/TAU)%8];
    announceEncounter('rush','빅웨이브 '+run.wave+'/3',direction+'쪽에서 감염체 '+rules.rush+'마리 접근',2);
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
