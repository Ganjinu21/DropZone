'use strict';

function updateStageHud({stage, stageName, wave, waves, remaining, bigWave, bossPhase, bossName, boss}) {
  const label = bossPhase ? (boss ? '보스전' : '변이체 접근') : (bigWave ? '빅웨이브 ' : '웨이브 ') + wave + '/' + waves;
  $('stage-number').textContent = '스테이지 ' + stage;
  $('stage-name').textContent = stageName || '';
  if ($('wave-label').textContent !== label) $('wave-label').textContent = label;
  $('wave-countdown').hidden = bossPhase;
  $('boss-status').hidden = !bossPhase || !boss;
  $('stage-panel').classList.toggle('boss-phase', bossPhase);
  $('stage-panel').classList.toggle('rush-phase',!bossPhase && bigWave);
  const alert=$('encounter-alert'), notice=run.encounterAlert;
  alert.hidden=!notice || notice.until<=run.t;
  if(!alert.hidden){
    alert.dataset.kind=notice.kind;
    if(alert.firstElementChild.textContent!==notice.detail)alert.firstElementChild.textContent=notice.detail;
    if(alert.lastElementChild.textContent!==notice.title)alert.lastElementChild.textContent=notice.title;
  }
  if (bossPhase && boss) {
    $('boss-name').textContent = bossName;
    const percent = Math.ceil(100 * clamp(boss.hp / boss.max, 0, 1));
    $('boss-health').value = percent;
    $('boss-percent').textContent = percent + '%';
  } else {
    $('wave-countdown').textContent = bigWave && remaining<=0 && run.rushLeft>0 ? '진입 중' : clock(Math.max(0, Math.ceil(remaining)));
  }
}
