'use strict';

const DiamondStore = (() => {
  const packs = Object.freeze([
    [100, 1100], [320, 3300], [660, 6600],
    [1200, 11000], [2500, 22000], [6500, 55000]
  ].map(([diamonds, priceKRW]) => Object.freeze({
    id: 'kr.dropzone.squad.diamonds.' + diamonds, diamonds, priceKRW
  })));

  function offer(pack) {
    return {priceLabel: '₩' + pack.priceKRW.toLocaleString('ko-KR'), available: developerMode};
  }

  async function buy(id) {
    const pack = packs.find(entry => entry.id === id);
    if (!pack || !developerMode) return {message: '스토어 판매 준비 중입니다.'};
    await awardDiamonds(pack.diamonds);
    return {message: '테스트 다이아 ' + pack.diamonds.toLocaleString('ko-KR') + '개를 받았습니다.'};
  }

  return Object.freeze({packs, offer, buy, refresh: async () => {}});
})();
