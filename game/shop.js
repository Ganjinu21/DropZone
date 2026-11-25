'use strict';

const shopCards = new Map();
const packButtons = new Map();
const supplyNames = {weapon: '무기 보급상자', gear: '장비 보급상자'};
let purchasing = false;
let chosenPack = null;
let ratesKind = null;

function mountShop() {
  for (const [kind, name] of Object.entries(supplyNames)) {
    const card = $('supply-template').content.firstElementChild.cloneNode(true);
    card.dataset.supplyKind = kind;
    card.querySelector('[data-crate-art]').src = 'art/armory/shop/' + kind + '.png';
    const title = card.querySelector('[data-crate-name]');
    title.textContent = name;
    title.id = 'supply-title-' + kind;
    card.setAttribute('aria-labelledby', title.id);
    const more = card.querySelector('[data-rates]');
    more.setAttribute('aria-label', name + ' 레벨별 확률표 보기');
    more.addEventListener('click', () => openSupplyRates(kind));
    const open = card.querySelector('[data-draw]');
    open.id = kind === 'weapon' ? 'crate-open' : 'gear-crate-open';
    open.addEventListener('click', () => drawSupply(kind));
    card.querySelector('[data-price]').textContent = boxPrice.toLocaleString('ko-KR');
    shopCards.set(kind, card);
    $('supply-list').append(card);
  }

  for (const [index, pack] of DiamondStore.packs.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.offer = pack.id;
    button.innerHTML = '<img alt=""><strong></strong><span></span>';
    button.querySelector('img').src = 'art/armory/shop/gems-' + (index + 1) + '.png';
    button.querySelector('strong').textContent = pack.diamonds.toLocaleString('ko-KR') + '개';
    button.addEventListener('click', () => confirmPack(pack));
    packButtons.set(pack.id, button);
    $('diamond-packs').append(button);
  }
  updateOffers();
}

function paintSupplyRates(kind) {
  const {level, count, remainingToA} = crateProgress(kind);
  $('rates-title').textContent = supplyNames[kind] + ' 확률표';
  $('rates-status').textContent = '현재 Lv.' + level + ' · 누적 개봉 ' + count.toLocaleString('ko-KR') + '회';
  const next = remainingToA === 1 ? '이번 개봉은 A등급 100%입니다.' : '다음 확정까지 ' + remainingToA + '회 남았습니다.';
  $('rates-guarantee').textContent = '표는 일반 개봉 확률입니다. 매 ' + SupplyRules.interval + '번째 개봉은 A등급 확정입니다. ' + next;
  $('rates-table-body').innerHTML = SupplyRules.thresholds.map((threshold, index) => {
    const rowLevel = index + 1;
    const odds = SupplyRules.odds(rowLevel);
    const current = rowLevel === level;
    const cells = ['C', 'B', 'A', 'S'].map(rank =>
      '<td data-rank="' + rank + '">' + (odds[rank] / 100) + '%</td>').join('');
    return '<tr data-level="' + rowLevel + '"' + (current ? ' aria-current="true"' : '') + '>' +
      '<th scope="row">' + rowLevel + (current ? '<small>현재</small>' : '') + '</th>' +
      '<td>' + threshold.toLocaleString('ko-KR') + '회</td>' + cells + '</tr>';
  }).join('');
}

function openSupplyRates(kind) {
  const dialog = $('supply-rates-dialog');
  if (dialog.open) return;
  ratesKind = kind;
  paintSupplyRates(kind);
  const trigger = shopCards.get(kind).querySelector('[data-rates]');
  trigger.setAttribute('aria-expanded', 'true');
  dialog.showModal();
  const scroller = $('rates-scroll');
  scroller.focus({preventScroll: true});
  const row = scroller.querySelector('[aria-current="true"]');
  scroller.scrollTop += row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientHeight / 3;
}

$('rates-close').onclick = $('rates-done').onclick = () => $('supply-rates-dialog').close();
$('supply-rates-dialog').addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    $('supply-rates-dialog').close();
  }
});
$('supply-rates-dialog').addEventListener('close', () => {
  if (!ratesKind) return;
  const trigger = shopCards.get(ratesKind).querySelector('[data-rates]');
  ratesKind = null;
  trigger.setAttribute('aria-expanded', 'false');
  if (!$('shop-page').hidden) trigger.focus({preventScroll: true});
});

function paintSupplyCard(kind, card) {
  const progress = crateProgress(kind);
  const ready = progress.remainingToA === 1;
  card.dataset.guaranteed = String(ready);
  card.querySelector('[data-level]').textContent = 'Lv.' + progress.level;
  card.querySelector('[data-level-steps]').textContent = progress.nextLevelAt === null
    ? '최고 레벨'
    : '다음 레벨까지 ' + progress.nextLevelIn + '회';
  const fill = progress.nextLevelAt === null ? 1 :
    (progress.count - progress.levelStart) / (progress.nextLevelAt - progress.levelStart);
  card.querySelector('.level-meter i').style.width = (100 * fill) + '%';
  card.querySelector('[data-guarantee]').textContent = ready ? '이번 개봉 A등급 확정' : 'A등급 확정까지 ' + progress.remainingToA + '회';
  const open = card.querySelector('[data-draw]');
  open.disabled = purchasing || armory.diamonds < boxPrice;
  open.setAttribute('aria-label', supplyNames[kind] + ' 1회 개봉, 다이아 ' + boxPrice + '개');
  open.querySelector('span').textContent = armory.diamonds < boxPrice ? '다이아 부족' : '1회 개봉';
}

function updateDiamondDisplay() {
  for (const el of document.querySelectorAll('[data-balance]')) {
    el.textContent = armory.diamonds.toLocaleString('ko-KR');
  }
  if (!$('talent-page').hidden) renderTalentPage();
  if ($('shop-page').hidden) return;
  for (const [kind, card] of shopCards) paintSupplyCard(kind, card);
  if (ratesKind && $('supply-rates-dialog').open) paintSupplyRates(ratesKind);
  const profile = $('profile-mode');
  profile.disabled = purchasing;
  profile.setAttribute('aria-pressed', String(developerMode));
  profile.setAttribute('aria-label', developerMode ? '일반 프로필로 전환' : '개발자 프로필로 전환');
  profile.textContent = developerMode ? '개발자 모드 · 일반 프로필로 전환' : '일반 모드 · 개발자 프로필로 전환';
}

async function drawSupply(kind) {
  if (purchasing) return;
  const output = shopCards.get(kind).querySelector('[data-drop]');
  purchasing = true;
  updateDiamondDisplay();
  updateOffers();
  try {
    const result = await openSupplyCrate(kind);
    const item = result.drops?.[0];
    if (!item) {
      output.textContent = result.message;
      return;
    }
    output.innerHTML = '<img alt=""><span><small></small><b></b></span>';
    output.querySelector('img').src = itemImage(item);
    output.querySelector('small').textContent = (result.guaranteed ? '확정 보급' : '보급 완료') + ' · 보유 ' + armory.counts[item.key] + '개';
    output.querySelector('b').textContent = item.rank + ' · ' + item.label;
  } catch {
    output.textContent = '개봉 결과를 저장하지 못했습니다. 다시 시도해 주세요.';
  } finally {
    purchasing = false;
    updateDiamondDisplay();
    updateOffers();
  }
}

function updateOffers() {
  $('diamond-mode').textContent = developerMode ? '테스트 구매 · 실제 결제 없음' : '';
  for (const pack of DiamondStore.packs) {
    const offer = DiamondStore.offer(pack);
    const button = packButtons.get(pack.id);
    button.disabled = purchasing || !offer.available;
    button.querySelector('span').textContent = offer.available ? offer.priceLabel : '판매 준비 중';
    button.setAttribute('aria-label', '다이아 ' + pack.diamonds.toLocaleString('ko-KR') + '개 · ' +
      (offer.available ? offer.priceLabel + (developerMode ? ' 테스트 구매' : ' 구매') : '판매 준비 중'));
  }
}

function confirmPack(pack) {
  const offer = DiamondStore.offer(pack);
  if (purchasing || !offer.available) return;
  chosenPack = pack;
  $('purchase-title').textContent = '다이아 ' + pack.diamonds.toLocaleString('ko-KR') + '개';
  $('purchase-description').textContent = developerMode
    ? '표시 가격 ' + offer.priceLabel + ' · 테스트 다이아를 무료로 지급합니다.'
    : offer.priceLabel + '에 구매할까요?';
  $('confirm-diamonds').textContent = developerMode ? '테스트 지급' : offer.priceLabel + ' 구매';
  $('diamond-confirm').showModal();
}

$('confirm-diamonds').onclick = async () => {
  if (!chosenPack || purchasing) return;
  const pack = chosenPack;
  $('diamond-confirm').close();
  purchasing = true;
  updateDiamondDisplay();
  updateOffers();
  try {
    const result = await DiamondStore.buy(pack.id);
    $('diamond-result').textContent = result.message;
  } catch {
    $('diamond-result').textContent = '구매를 완료하지 못했습니다. 다시 시도해 주세요.';
  } finally {
    purchasing = false;
    updateDiamondDisplay();
    updateOffers();
  }
};

$('diamond-confirm').addEventListener('close', () => { chosenPack = null; });
document.addEventListener('diamond-store-updated', updateOffers);
$('profile-mode').onclick = () => {
  if (purchasing) return;
  try {
    localStorage.setItem(developerPreference, JSON.stringify(!developerMode));
    location.reload();
  } catch {
    $('diamond-result').textContent = '프로필을 저장하지 못했습니다.';
  }
};

async function enterSupplyShop() {
  for (const card of shopCards.values()) card.querySelector('[data-drop]').replaceChildren();
  $('diamond-result').textContent = '';
  $('shop-page').scrollTop = 0;
  updateDiamondDisplay();
  try {
    await DiamondStore.refresh();
  } catch {
    $('diamond-result').textContent = '다이아 상품을 불러오지 못했습니다.';
  } finally {
    updateOffers();
  }
}

mountShop();
