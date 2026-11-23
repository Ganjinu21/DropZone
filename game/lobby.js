'use strict';

const squadStorageKey = 'dropzone.squad.v1';
const squadLimit = formationSlots.length;
let savedSquad = [];
let draftSquad = [];

function validSquad(ids) {
  return Array.isArray(ids) && ids.length === squadLimit &&
    new Set(ids).size === squadLimit &&
    ids.every(id => Number.isInteger(id) && id >= 0 && id < names.length);
}

try {
  const saved = JSON.parse(localStorage.getItem(squadStorageKey));
  if (validSquad(saved)) savedSquad = saved;
} catch {
  // Storage is optional in offline WebViews and file previews.
}

function getSelectedSquad() {
  return savedSquad.slice();
}

function setLobbyReady() {
  $('start').textContent = '게임 시작';
  $('start').disabled = false;
  $('select-team').disabled = false;
}

function updateSquadSelection() {
  for (const card of $('operator-grid').querySelectorAll('[data-pick]')) {
    const id = Number(card.dataset.pick);
    const slot = draftSquad.indexOf(id);
    card.setAttribute('aria-pressed', String(slot >= 0));
    const rank = slot < 0 ? (draftSquad.length === squadLimit ? '대기' : '선택') : slot === 0 ? '선두' : (slot + 1) + '번';
    card.querySelector('.pick-mark').textContent = rank;
    card.setAttribute('aria-label', names[id] + ', ' + roles[id] + ', ' + rank);
    card.disabled = slot < 0 && draftSquad.length >= squadLimit;
  }
  const complete = validSquad(draftSquad);
  $('roster-count').textContent = draftSquad.length + ' / ' + squadLimit;
  $('roster-help').textContent = complete ? '대원을 교체하려면 선택한 카드를 한 번 더 누르세요.' :
    '세 명을 선택하세요. 첫 번째 대원이 선두에 섭니다.';
  $('squad-line').textContent = draftSquad.length ? draftSquad.map(id => names[id]).join('  ›  ') : '';
  $('save-team').disabled = !complete;
  $('deploy-team').disabled = !complete;
}

let menuReturnTarget;
function openSquadSelection() {
  if (mode !== 'home' || $('start').disabled) return;
  menuReturnTarget = document.activeElement === $('select-team') ? $('select-team') : $('start');
  draftSquad = getSelectedSquad();
  updateSquadSelection();
  $('main-menu').hidden = true;
  $('roster-screen').hidden = false;
  $('roster-back').focus({preventScroll:true});
}

function resetLobbyView() {
  $('roster-screen').hidden = true;
  $('main-menu').hidden = false;
}

function closeSquadSelection() {
  if ($('roster-screen').hidden) return false;
  resetLobbyView();
  menuReturnTarget?.focus({preventScroll:true});
  return true;
}

function commitSquad(deploy) {
  if (mode !== 'home' || $('roster-screen').hidden || !validSquad(draftSquad)) return;
  savedSquad = draftSquad.slice();
  try {
    localStorage.setItem(squadStorageKey, JSON.stringify(savedSquad));
  } catch {
    // The current session can still save and deploy this formation.
  }
  if (deploy) {
    resetLobbyView();
    start();
  } else {
    closeSquadSelection();
  }
}

$('operator-grid').innerHTML = names.map((name,id) =>
  `<button type="button" class="pick-operator" data-pick="${id}" data-operator="${id}" aria-pressed="false">
     <span class="pick-portrait"><img src="${id === 3 ? 'art/skills/hammer-roster.webp' : ART['face'+id]}" alt=""><span class="pick-mark">선택</span></span>
     <span class="pick-info"><small>${roles[id]}</small><strong>${name}</strong><span>${squadSkillDefs[id].name}</span></span>
   </button>`).join('') +
  '<button type="button" class="future-operator" disabled><i class="lock-glyph" aria-hidden="true"></i><span>출시 준비 중</span></button>';

$('operator-grid').addEventListener('click', event => {
  const card = event.target.closest('[data-pick]');
  if (!card || card.disabled || mode !== 'home') return;
  const id = Number(card.dataset.pick);
  const slot = draftSquad.indexOf(id);
  if (slot >= 0) draftSquad.splice(slot, 1);
  else if (draftSquad.length < squadLimit) draftSquad.push(id);
  updateSquadSelection();
});
$('start').onclick = () => validSquad(savedSquad) ? start() : openSquadSelection();
$('select-team').onclick = openSquadSelection;
$('roster-back').onclick = closeSquadSelection;
$('save-team').onclick = () => commitSquad(false);
$('deploy-team').onclick = () => commitSquad(true);
